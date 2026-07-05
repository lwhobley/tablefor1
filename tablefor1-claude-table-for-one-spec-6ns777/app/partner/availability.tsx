import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { Field } from "../../components/Field";
import { Button } from "../../components/Button";
import { ChipGroup } from "../../components/Chip";
import { PartnerNav } from "../../components/PartnerNav";
import {
  usePartnerAvailability,
  usePartnerRestaurant,
  useSubmitAvailability,
} from "../../lib/partnerQueries";
import type { EventFormat } from "../../lib/supabase";

const FORMAT_OPTIONS: { value: EventFormat; label: string }[] = [
  { value: "dinner", label: "Dinner" },
  { value: "brunch", label: "Brunch" },
  { value: "late_night", label: "Late night" },
  { value: "food_crawl", label: "Food crawl" },
  { value: "chefs_table", label: "Chef's table" },
];

function parseLocalDateTime(input: string): string | null {
  // Accept "YYYY-MM-DD HH:MM" or ISO. Returns a UTC ISO string or null.
  const trimmed = input.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export default function PartnerAvailability() {
  const { data: restaurant } = usePartnerRestaurant();
  const { data: slots, isLoading } = usePartnerAvailability(restaurant?.id);
  const submit = useSubmitAvailability(restaurant?.id);

  const [date, setDate] = useState("");
  const [format, setFormat] = useState<EventFormat[]>(["dinner"]);
  const [maxCovers, setMaxCovers] = useState("4");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    const iso = parseLocalDateTime(date);
    const covers = parseInt(maxCovers, 10);
    if (!iso) {
      setError("Use the format YYYY-MM-DD HH:MM (24-hour).");
      return;
    }
    if (isNaN(covers) || covers < 2) {
      setError("Max covers must be at least 2.");
      return;
    }
    await submit.mutateAsync({
      proposed_date: iso,
      format: format[0] ?? "dinner",
      max_covers: covers,
      notes: notes.trim() || null,
    });
    setDate("");
    setNotes("");
    setMaxCovers("4");
  }

  return (
    <Screen>
      <View className="gap-2 pb-2">
        <Text className="font-serif text-3xl text-ink">Availability</Text>
        <Text className="text-sm text-ink/60">
          Propose nights you can host. We'll review and turn approved slots into
          bookable events.
        </Text>
      </View>
      <PartnerNav />

      <View className="gap-4 rounded-2xl border border-ink/10 bg-white p-5">
        <Text className="font-serif text-xl text-ink">New slot</Text>
        <Field
          label="Date & time (YYYY-MM-DD HH:MM)"
          value={date}
          onChangeText={setDate}
          placeholder="2026-07-15 19:30"
          autoCapitalize="none"
        />
        <View className="gap-2">
          <Text className="text-sm font-medium text-ink/70">Format</Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipGroup
              options={FORMAT_OPTIONS}
              values={format}
              onChange={setFormat}
              multi={false}
            />
          </View>
        </View>
        <Field
          label="Max Table for One covers"
          value={maxCovers}
          onChangeText={setMaxCovers}
          placeholder="4"
        />
        <Field
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Private back room, prix fixe, etc."
        />
        {error && <Text className="text-sm text-rust">{error}</Text>}
        <Button
          label="Submit for review"
          onPress={onSubmit}
          loading={submit.isPending}
          disabled={!restaurant}
        />
      </View>

      <View className="gap-3 pt-6">
        <Text className="font-serif text-xl text-ink">Submitted slots</Text>
        {isLoading ? (
          <ActivityIndicator />
        ) : (slots ?? []).length === 0 ? (
          <Text className="text-sm text-ink/50">
            Nothing submitted yet.
          </Text>
        ) : (
          (slots ?? []).map((slot: any) => {
            const when = new Date(slot.proposed_date).toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });
            return (
              <View
                key={slot.id}
                className="gap-1 rounded-2xl border border-ink/10 bg-white p-4"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="font-serif text-lg text-ink">{when}</Text>
                  <Text
                    className={`text-xs font-semibold uppercase tracking-widest ${
                      slot.is_approved ? "text-sage" : "text-clay"
                    }`}
                  >
                    {slot.is_approved ? "Approved" : "Pending"}
                  </Text>
                </View>
                <Text className="text-sm text-ink/60">
                  {slot.format.replace("_", " ")} · up to {slot.max_covers}{" "}
                  covers
                </Text>
                {slot.notes && (
                  <Text className="text-sm text-ink/60">{slot.notes}</Text>
                )}
              </View>
            );
          })
        )}
      </View>
    </Screen>
  );
}
