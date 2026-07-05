import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { isAuthorizedAdminCaller, unauthorizedResponse } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (!isAuthorizedAdminCaller(req)) return unauthorizedResponse(corsHeaders);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const apiKey = Deno.env.get("RESY_API_KEY");
  const authToken = Deno.env.get("RESY_AUTH_TOKEN");
  const paymentMethodId = Deno.env.get("RESY_PAYMENT_METHOD_ID");

  if (!apiKey || !authToken) {
    console.error("Missing RESY_API_KEY or RESY_AUTH_TOKEN environment variables.");
    return new Response(
      JSON.stringify({ error: "Resy credentials not configured on backend." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 1. Fetch pending events with integrated Resy restaurants
  const { data: events, error: eventsErr } = await supabase
    .from("events")
    .select("*, restaurants(*)")
    .eq("resy_booking_status", "pending")
    .not("restaurants.resy_venue_id", "is", null);

  if (eventsErr) {
    console.error("Error fetching pending events:", eventsErr.message);
    return new Response(
      JSON.stringify({ error: "Failed to query pending events." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`Found ${events?.length || 0} pending Resy booking jobs.`);
  const results = [];

  for (const event of events || []) {
    const venueName = event.restaurants.name;
    const venueId = event.restaurants.resy_venue_id;
    const groupSize = event.group_size;
    const eventDateStr = event.event_date; // UTC ISO String
    
    console.log(`Processing Job: Event ${event.id} at "${venueName}" (Venue ID: ${venueId}) for Party of ${groupSize} on ${eventDateStr}`);

    try {
      const eventDate = new Date(eventDateStr);
      const now = new Date();

      // Check if event date has passed
      if (eventDate < now) {
        console.warn(`Event ${event.id} is in the past. Marking booking job as failed.`);
        await supabase
          .from("events")
          .update({
            resy_booking_status: "failed",
            resy_error: "Event date has passed without securing a Resy slot."
          })
          .eq("id", event.id);

        results.push({ event_id: event.id, status: "failed", error: "Event date in past" });
        continue;
      }

      // Convert event date to Central Time (Texas timezone where Table for One operates)
      const dateOptions = { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' } as const;
      const timeOptions = { timeZone: 'America/Chicago', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false } as const;

      const dateParts = new Intl.DateTimeFormat('en-US', dateOptions).formatToParts(eventDate);
      const yyyy = dateParts.find(p => p.type === 'year')?.value;
      const mm = dateParts.find(p => p.type === 'month')?.value;
      const dd = dateParts.find(p => p.type === 'day')?.value;
      const yyyymmdd = `${yyyy}-${mm}-${dd}`;

      const timeParts = new Intl.DateTimeFormat('en-US', timeOptions).formatToParts(eventDate);
      const hh = timeParts.find(p => p.type === 'hour')?.value;
      const min = timeParts.find(p => p.type === 'minute')?.value;
      const sec = timeParts.find(p => p.type === 'second')?.value;
      const hhmmss = `${hh}:${min}:${sec}`;

      console.log(`Local target reservation: Date = ${yyyymmdd}, Time = ${hhmmss}`);

      // 2. Query Resy availability /4/find
      const findUrl = new URL("https://api.resy.com/4/find");
      findUrl.searchParams.set("lat", "0");
      findUrl.searchParams.set("long", "0");
      findUrl.searchParams.set("day", yyyymmdd);
      findUrl.searchParams.set("party_size", String(groupSize));
      findUrl.searchParams.set("venue_id", venueId);

      const findRes = await fetch(findUrl.toString(), {
        headers: {
          "Authorization": `ResyAPI api_key="${apiKey}"`,
          "x-resy-auth-token": authToken,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Origin": "https://widgets.resy.com",
          "Referer": "https://widgets.resy.com/",
        }
      });

      if (!findRes.ok) {
        const errText = await findRes.text();
        throw new Error(`Resy find call failed (HTTP ${findRes.status}): ${errText}`);
      }

      const findData = await findRes.json();
      const slots = findData.results?.venues?.[0]?.slots || [];
      console.log(`Found ${slots.length} total slots for ${yyyymmdd}. Filtering for time ${hhmmss}...`);

      const matchingSlot = slots.find((s: any) => {
        const slotStart = s.date?.start || ""; // Format: "YYYY-MM-DD HH:MM:SS"
        const slotTime = slotStart.split(" ")[1];
        return slotTime === hhmmss;
      });

      if (!matchingSlot) {
        console.log(`No slot found matching time ${hhmmss} yet. Staying in pending status.`);
        results.push({ event_id: event.id, status: "pending", message: "Slot not found yet" });
        continue;
      }

      const configToken = matchingSlot.config?.token;
      if (!configToken) {
        throw new Error("Matching slot found but config token was missing.");
      }

      console.log(`Matching slot found! Config Token: ${configToken}. Fetching details...`);

      // 3. Fetch details /3/details
      const detailsUrl = new URL("https://api.resy.com/3/details");
      detailsUrl.searchParams.set("config_id", configToken);
      detailsUrl.searchParams.set("day", yyyymmdd);
      detailsUrl.searchParams.set("party_size", String(groupSize));

      const detailsRes = await fetch(detailsUrl.toString(), {
        headers: {
          "Authorization": `ResyAPI api_key="${apiKey}"`,
          "x-resy-auth-token": authToken,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        }
      });

      if (!detailsRes.ok) {
        const errText = await detailsRes.text();
        throw new Error(`Resy details call failed (HTTP ${detailsRes.status}): ${errText}`);
      }

      const detailsData = await detailsRes.json();
      const bookToken = typeof detailsData.book_token === "object"
        ? detailsData.book_token?.value
        : detailsData.book_token;

      if (!bookToken) {
        throw new Error("Could not extract book_token from details response.");
      }

      console.log(`Details fetched. Book Token extracted. Executing booking request...`);

      // Check payment requirement
      const paymentRequired = detailsData.user?.payment_methods?.length > 0;
      if (paymentRequired && !paymentMethodId) {
        console.warn("WARNING: This reservation requires a payment method to secure, but RESY_PAYMENT_METHOD_ID is not configured.");
      }

      // 4. Book /3/book
      const bookUrl = "https://api.resy.com/3/book";
      const bodyParams = new URLSearchParams();
      bodyParams.set("book_token", bookToken);
      if (paymentMethodId) {
        bodyParams.set("struct_payment_method", JSON.stringify({ id: Number(paymentMethodId) }));
      }

      const bookRes = await fetch(bookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `ResyAPI api_key="${apiKey}"`,
          "x-resy-auth-token": authToken,
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Origin": "https://widgets.resy.com",
          "Referer": "https://widgets.resy.com/",
        },
        body: bodyParams.toString()
      });

      if (!bookRes.ok) {
        const errText = await bookRes.text();
        throw new Error(`Resy booking call failed (HTTP ${bookRes.status}): ${errText}`);
      }

      const bookData = await bookRes.json();
      const resyToken = bookData.resy_token;
      console.log(`SUCCESS! Booked table. Resy Token: ${resyToken}`);

      // 5. Update DB event status to booked
      const { error: updateErr } = await supabase
        .from("events")
        .update({
          resy_booking_status: "booked",
          resy_booking_token: resyToken,
          resy_error: null
        })
        .eq("id", event.id);

      if (updateErr) {
        throw new Error(`Failed to update DB event booking status: ${updateErr.message}`);
      }

      results.push({ event_id: event.id, status: "booked", token: resyToken });

    } catch (err: any) {
      console.error(`Error booking event ${event.id}:`, err.message);
      
      // Update event status to failed with error details
      await supabase
        .from("events")
        .update({
          resy_booking_status: "failed",
          resy_error: err.message
        })
        .eq("id", event.id);

      results.push({ event_id: event.id, status: "failed", error: err.message });
    }
  }

  return new Response(JSON.stringify({ processed: results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
