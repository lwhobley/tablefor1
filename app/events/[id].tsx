import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ScrollView, ActivityIndicator, Alert, Share, Pressable, ImageBackground, Linking } from "react-native";
import { useAuth } from "@/lib/auth";
import {
  useEventDetails,
  useCreateBooking,
  useProfile,
  useRestaurantMenu,
  useMyWaitlistEntry,
  useJoinWaitlist,
  useLeaveWaitlist,
  useVerifyInviteCode,
  useCreatePlusOneInvite,
  useClaimPlusOneInvite,
  useEventInvite,
  useUserBookings,
  useIsRestaurantFavorited,
  useToggleFavoriteRestaurant,
  useRestaurantPerks,
} from "@/lib/queries";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { MysteryBadge } from "@/components/MysteryBadge";
import { MenuPreview } from "@/components/MenuPreview";
import { isMysteryRevealed, priceTier } from "@/lib/mystery";
import { Ionicons } from "@expo/vector-icons";
import { getEventArtwork } from "@/components/event-artwork";
import { getEventMatchFit, googleCalendarUrl } from "@/lib/matchValue";
import type { RestaurantPerk } from "@/lib/supabase";

export default function EventDetail() {
  const { id, invite_code } = useLocalSearchParams<{ id: string; invite_code?: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const { data: event, isLoading, error } = useEventDetails(id);
  const { data: profile } = useProfile(userId);
  const createBooking = useCreateBooking(userId);
  const revealed = event ? isMysteryRevealed(event) : true;
  const { data: menuItems } = useRestaurantMenu(
    event && revealed ? event.restaurant_id : undefined,
  );
  const { data: waitlistEntry } = useMyWaitlistEntry(id, userId);
  const joinWaitlist = useJoinWaitlist(userId);
  const leaveWaitlist = useLeaveWaitlist(userId);

  const { data: invite } = useVerifyInviteCode(invite_code, id);
  const { data: bookings } = useUserBookings(userId);
  const { data: myInvite } = useEventInvite(id, userId);
  const createInvite = useCreatePlusOneInvite(userId);
  const claimInvite = useClaimPlusOneInvite();

  const { data: isFavorited } = useIsRestaurantFavorited(userId, event?.restaurant_id);
  const toggleFavorite = useToggleFavoriteRestaurant(userId);
  const { data: perks } = useRestaurantPerks(event && revealed ? event.restaurant_id : undefined);

  const handleToggleFavorite = () => {
    if (!event?.restaurant_id) return;
    toggleFavorite.mutate({
      restaurantId: event.restaurant_id,
      isFavorited: !!isFavorited,
    }, {
      onError: (err) => Alert.alert("Error", err.message)
    });
  };

  const myBooking = bookings?.find((b: any) => b.event_id === id && b.status === "confirmed");
  const isBooked = !!myBooking;
  const isInviteValid = !!(invite && !invite.used_at && !invite.invitee_id);

  const handleBook = async () => {
    if (!userId) {
      Alert.alert("Not signed in");
      return;
    }

    try {
      let plusOneInviteId: string | undefined = undefined;
      if (invite_code && isInviteValid) {
        const claimed = await claimInvite.mutateAsync({ inviteCode: invite_code });
        plusOneInviteId = claimed.id;
      }

      createBooking.mutate(
        { eventId: id!, amountCents: event!.price_cents, plusOneInviteId },
        {
          onSuccess: (booking) => {
            router.push({
              pathname: "/checkout/[bookingId]",
              params: { bookingId: booking.id, eventId: id },
            });
          },
          onError: (err) => {
            Alert.alert("Couldn't book", (err as Error).message);
          },
        }
      );
    } catch (err) {
      Alert.alert("Claim Invite Failed", (err as Error).message);
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#C2410C" />
        </View>
      </Screen>
    );
  }

  if (error || !event) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center gap-4">
          <Text className="text-lg text-ink">Event not found</Text>
          <Button label="Back" variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const publishedTime = event.published_at ? new Date(event.published_at).getTime() : 0;
  const earlyAccessLimit = publishedTime + (event.early_access_hours || 24) * 60 * 60 * 1000;
  const isEarlyAccess = new Date().getTime() < earlyAccessLimit;
  const isLocked = isEarlyAccess && !profile?.is_premium;

  const spotsLeft = Math.max(0, event.group_size - event.confirmed_covers);
  const isFull = spotsLeft === 0 && !isInviteValid;
  const eventDate = new Date(event.event_date);
  const fit = getEventMatchFit(profile, event);
  const formattedDate = eventDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const formattedTime = eventDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const openUrl = async (url: string | null | undefined, fallbackMessage: string) => {
    if (!url) {
      Alert.alert("Not available yet", fallbackMessage);
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Couldn't open link", "Please try again in a moment.");
    }
  };

  const mapsUrl = event.restaurant?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.restaurant.address)}`
    : null;
  const calendarUrl = googleCalendarUrl(
    event,
    `${event.theme ?? "Table for 2"} at ${event.restaurant?.name ?? "a mystery restaurant"}`,
    event.restaurant?.address,
  );

  return (
    <Screen scroll={false}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Invite Code Banner */}
        {invite_code && (
          <View className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 gap-2">
            <View className="flex-row items-center gap-2">
              <Ionicons name="gift-outline" size={20} color="#D97706" />
              <Text className="font-semibold text-amber-800">Bring a Friend Invite</Text>
            </View>
            {invite ? (
              isInviteValid ? (
                <Text className="text-sm text-amber-900 leading-5">
                  You've been invited by <Text className="font-bold">{invite.sender?.name}</Text>! 
                  Accept this invite to skip the waitlist and secure a confirmed seat at this table.
                </Text>
              ) : (
                <Text className="text-sm text-rose-800 font-medium">
                  This invite code is invalid or has already been claimed by another user.
                </Text>
              )
            ) : (
              <Text className="text-sm text-amber-900">Validating invite details...</Text>
            )}
          </View>
        )}

        <View className="mb-5 overflow-hidden rounded-lg bg-ink">
          <ImageBackground
            source={getEventArtwork(event)}
            resizeMode="cover"
            imageStyle={{ width: "100%", height: "100%", objectFit: "cover" }}
            style={{ height: 264 }}
          >
            <View className="flex-1 justify-between bg-black/25 p-3">
              <View className="flex-row items-start justify-between">
                <Pressable
                  onPress={() => router.back()}
                  accessibilityLabel="Go back"
                  className="h-10 w-10 items-center justify-center rounded-full bg-white/95 active:opacity-70"
                >
                  <Ionicons name="arrow-back" size={20} color="#17201C" />
                </Pressable>
                <View className="items-end gap-2">
                  {revealed && event.restaurant_id && (
                    <Pressable
                      onPress={handleToggleFavorite}
                      disabled={toggleFavorite.isPending}
                      accessibilityLabel={isFavorited ? "Remove from favorites" : "Add to favorites"}
                      className="h-10 w-10 items-center justify-center rounded-full bg-white/95 active:opacity-70"
                    >
                      <Ionicons
                        name={isFavorited ? "heart" : "heart-outline"}
                        size={21}
                        color={isFavorited ? "#B5462D" : "#17201C"}
                      />
                    </Pressable>
                  )}
                  {event.is_mystery && !revealed && <MysteryBadge event={event} />}
                </View>
              </View>

              <View className="gap-2 rounded-md bg-black/70 p-4">
                <Text className="text-xs font-bold uppercase text-white/70">
                  {event.theme ?? event.format.replace("_", " ")}
                </Text>
                <Text className="font-serif text-3xl text-white">
                  {revealed
                    ? event.restaurant?.name
                    : `Mystery Dinner ${priceTier(event.price_cents)}`}
                </Text>
                <View className="flex-row items-center gap-2">
                  <Ionicons name="location-outline" size={15} color="#FFFFFF" />
                  <Text className="flex-1 text-sm text-white/80">
                    {revealed
                      ? event.restaurant?.neighborhood
                      : `Revealed ${event.reveal_hours_before}h before dinner`}
                    {event.restaurant?.cuisine?.length
                      ? ` / ${event.restaurant.cuisine.join(", ")}`
                      : ""}
                  </Text>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {event.is_signature && (
                    <View className="flex-row items-center gap-1 rounded-full bg-white/15 px-2 py-1">
                      <Ionicons name="diamond" size={10} color="#FFFFFF" />
                      <Text className="text-[10px] font-semibold text-white">Signature Table</Text>
                    </View>
                  )}
                  {(event.vibe_tags ?? []).slice(0, 2).map((vibe: string) => (
                    <View key={vibe} className="rounded-full bg-white/15 px-2 py-1">
                      <Text className="text-[10px] capitalize text-white">{vibe}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </ImageBackground>
        </View>

        <View className="mb-8 gap-3 border-y border-ink/10 py-5">
          <View className="flex-row items-center justify-between gap-4">
            <View className="flex-1">
              <Text className="text-xs font-bold uppercase text-forest">Your table fit</Text>
              <Text className="font-serif text-2xl text-ink">{fit.score}% match</Text>
            </View>
            <View className="h-12 w-12 items-center justify-center rounded-full bg-forest">
              <Ionicons name="sparkles" size={21} color="#FFFFFF" />
            </View>
          </View>
          {fit.reasons.map((reason) => (
            <View key={reason} className="flex-row items-center gap-2">
              <Ionicons name="checkmark-circle" size={16} color="#1D5A4A" />
              <Text className="text-sm text-ink/75">{reason}</Text>
            </View>
          ))}
        </View>

        {revealed && (
          <View className="mb-8 gap-3">
            <Text className="text-lg font-bold text-ink">Plan your evening</Text>
            <View className="flex-row flex-wrap gap-2">
              <Pressable onPress={() => openUrl(mapsUrl, "Directions will appear when the restaurant is revealed.")} className="min-w-[46%] flex-1 flex-row items-center gap-2 rounded-lg border border-ink/10 bg-white px-3 py-3">
                <Ionicons name="navigate-outline" size={18} color="#1D5A4A" /><Text className="text-sm font-semibold text-ink">Directions</Text>
              </Pressable>
              <Pressable onPress={() => openUrl(calendarUrl, "Calendar export is unavailable.")} className="min-w-[46%] flex-1 flex-row items-center gap-2 rounded-lg border border-ink/10 bg-white px-3 py-3">
                <Ionicons name="calendar-outline" size={18} color="#1D5A4A" /><Text className="text-sm font-semibold text-ink">Add calendar</Text>
              </Pressable>
              <Pressable onPress={() => openUrl(event.restaurant?.menu_url, "This restaurant has not supplied a menu link yet.")} className="min-w-[46%] flex-1 flex-row items-center gap-2 rounded-lg border border-ink/10 bg-white px-3 py-3">
                <Ionicons name="book-outline" size={18} color="#1D5A4A" /><Text className="text-sm font-semibold text-ink">Full menu</Text>
              </Pressable>
              <Pressable onPress={() => openUrl(event.restaurant?.reservation_url, "Your Table for 2 seat is handled in the app. The restaurant has not supplied a separate reservation link.")} className="min-w-[46%] flex-1 flex-row items-center gap-2 rounded-lg border border-ink/10 bg-white px-3 py-3">
                <Ionicons name="open-outline" size={18} color="#1D5A4A" /><Text className="text-sm font-semibold text-ink">Restaurant booking</Text>
              </Pressable>
            </View>
            {event.restaurant?.parking_info && (
              <View className="flex-row items-start gap-2 rounded-lg bg-sage/10 p-3">
                <Ionicons name="car-outline" size={18} color="#1D5A4A" />
                <Text className="flex-1 text-sm leading-5 text-ink/75">{event.restaurant.parking_info}</Text>
              </View>
            )}
          </View>
        )}

        {(perks ?? []).length > 0 && (
          <View className="mb-8 gap-3">
            <Text className="text-lg font-bold text-ink">Member perks</Text>
            {(perks ?? []).map((perk: RestaurantPerk) => (
              <View key={perk.id} className="flex-row items-start gap-3 border-l-4 border-rust bg-white p-4">
                <Ionicons name="gift-outline" size={20} color="#B5462D" />
                <View className="flex-1 gap-1">
                  <View className="flex-row items-center gap-2"><Text className="font-semibold text-ink">{perk.title}</Text>{perk.premium_only && <Text className="text-[10px] font-bold uppercase text-rust">Premium</Text>}</View>
                  <Text className="text-sm leading-5 text-muted">{perk.description}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Event details grid */}
        <View className="mb-8 rounded-lg border border-ink/10 bg-white p-4">
          <View className="mb-4 flex-row justify-between">
            <View>
              <Text className="mb-1 text-sm font-medium text-ink/60">Date</Text>
              <Text className="font-semibold text-ink">{formattedDate}</Text>
            </View>
            <View>
              <Text className="mb-1 text-sm font-medium text-ink/60">Time</Text>
              <Text className="font-semibold text-ink">{formattedTime}</Text>
            </View>
            <View>
              <Text className="mb-1 text-sm font-medium text-ink/60">Format</Text>
              <Text className="font-semibold capitalize text-ink">
                {event.format.replace("_", " ")}
              </Text>
            </View>
          </View>

          <View className="flex-row justify-between border-t border-ink/10 pt-4">
            <View>
              <Text className="mb-1 text-sm font-medium text-ink/60">
                Group Size
              </Text>
              <Text className="font-semibold text-ink">
                {event.group_size} people
              </Text>
            </View>
            <View>
              <Text className="mb-1 text-sm font-medium text-ink/60">Price</Text>
              <Text className="font-semibold text-ink">
                ${(event.price_cents / 100).toFixed(2)}
              </Text>
            </View>
            <View>
              <Text className="mb-1 text-sm font-medium text-ink/60">
                Spots Left
              </Text>
              <Text
                className={`font-semibold ${isFull ? "text-clay" : "text-sage"}`}
              >
                {spotsLeft}
              </Text>
            </View>
          </View>
        </View>

        {/* Status badge */}
        {event.confirmed_covers > 0 && (
          <View className="mb-6 rounded-lg border border-sage/30 bg-sage/10 px-4 py-3">
            <Text className="font-medium text-sage">
              {event.confirmed_covers} diner
              {event.confirmed_covers !== 1 ? "s" : ""} already booked
            </Text>
          </View>
        )}

        {/* Description */}
        {event.description && (
          <View className="mb-8 gap-2">
            <Text className="text-lg font-bold text-ink">About</Text>
            <Text className="leading-6 text-ink/70">{event.description}</Text>
          </View>
        )}

        {/* Live menu preview (hidden until a mystery dinner's restaurant is revealed) */}
        {revealed && (
          <MenuPreview
            items={menuItems ?? []}
            userDietary={profile?.dietary ?? []}
          />
        )}

        {/* Info section */}
        <View className="mb-8 gap-2 rounded-lg border border-clay/20 bg-clay/5 p-4">
          <Text className="font-semibold text-ink">How it works</Text>
          <Text className="text-sm text-ink/70">
            • Book your spot for this exclusive dinner
          </Text>
          <Text className="text-sm text-ink/70">
            • Get matched with other solo diners 24 hours before
          </Text>
          <Text className="text-sm text-ink/70">
            • Enjoy dinner with your carefully matched group
          </Text>
        </View>

        {/* Vibe Check CTA */}
        {event.confirmed_covers >= 2 && (
          <View className="mb-6 gap-2 rounded-lg border border-rust/20 bg-rust/5 p-4">
            <View className="flex-row items-center gap-2">
              <Ionicons name="heart-circle-outline" size={20} color="#C2410C" />
              <Text className="font-semibold text-ink">Vibe Check</Text>
            </View>
            <Text className="text-sm text-ink/60">
              Swipe on fellow diners — mutual vibes boost your match chances.
            </Text>
            <Button
              label="Start Vibe Check"
              variant="secondary"
              onPress={() => router.push(`/events/${id}/vibes`)}
            />
          </View>
        )}

        {/* Waitlist (no-show insurance) */}
        {isFull && (
          <View className="mb-6 gap-2 rounded-lg border border-clay/20 bg-clay/5 p-4">
            {waitlistEntry ? (
              <>
                <Text className="font-semibold text-ink">
                  {waitlistEntry.notified_at
                    ? "A spot just opened up!"
                    : "You're on the waitlist"}
                </Text>
                <Text className="text-sm text-ink/60">
                  {waitlistEntry.notified_at
                    ? "Book now before someone else takes it."
                    : "We'll flag it here the moment a seat frees up."}
                </Text>
                <Button
                  label="Leave waitlist"
                  variant="ghost"
                  onPress={() => leaveWaitlist.mutate(id!)}
                  loading={leaveWaitlist.isPending}
                />
              </>
            ) : (
              <>
                <Text className="font-semibold text-ink">This dinner is full</Text>
                <Text className="text-sm text-ink/60">
                  Join the waitlist and we'll let you know if a spot opens.
                </Text>
                <Button
                  label="Join waitlist"
                  variant="secondary"
                  onPress={() => joinWaitlist.mutate(id!)}
                  loading={joinWaitlist.isPending}
                />
              </>
            )}
          </View>
        )}

        {/* Invite a Friend Host Section */}
        {isBooked && (
          <View className="mb-6 gap-3 rounded-lg border border-amber-300 bg-amber-50/20 p-4">
            <View className="flex-row items-center gap-2">
              <Ionicons name="people-circle-outline" size={22} color="#D97706" />
              <Text className="font-bold text-ink text-base">Bring a +1</Text>
            </View>

            {myInvite ? (
              <View className="gap-3">
                <Text className="text-sm text-ink/75 leading-5">
                  You have generated a +1 invite for this event! Share the code or link below with your friend to let them join your table.
                </Text>
                <View className="bg-white border border-ink/10 rounded-xl p-3 items-center">
                  <Text className="text-xs uppercase tracking-widest text-ink/50 font-bold mb-1">Invite Code</Text>
                  <Text className="font-serif text-2xl font-bold text-amber-700 tracking-wider">
                    {myInvite.invite_code}
                  </Text>
                </View>
                <Button
                  label="Share Invite Link"
                  variant="secondary"
                  onPress={() => {
                    const appUrl = "https://tablefor2.app";
                    Share.share({
                      message: `Join my dinner table at Table for 2! Use my invite code: ${myInvite.invite_code} or click this link to skip the waitlist: ${appUrl}/events/${id}?invite_code=${myInvite.invite_code}`
                    });
                  }}
                />
              </View>
            ) : profile && profile.plus_one_tokens > 0 ? (
              <View className="gap-3">
                <Text className="text-sm text-ink/75 leading-5">
                  You have <Text className="font-bold">{profile.plus_one_tokens}</Text> unused +1 Token(s). Invite a friend to secure a seat next to you (they will skip the waitlist).
                </Text>
                <Button
                  label="Generate +1 Invite Link"
                  variant="secondary"
                  loading={createInvite.isPending}
                  onPress={() => {
                    createInvite.mutate(
                      { eventId: id! },
                      {
                        onError: (err) => Alert.alert("Could not generate invite", (err as Error).message)
                      }
                    );
                  }}
                />
              </View>
            ) : (
              <View className="gap-1">
                <Text className="text-sm text-ink/75 leading-5">
                  Earn a +1 token by attending 5 dinners (completed check-ins).
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Premium Early Access banner */}
        {isEarlyAccess && (
          <View className={`mb-6 gap-2 rounded-lg border p-4 ${isLocked ? "border-amber-300 bg-amber-50" : "border-sage/20 bg-sage/5"}`}>
            <View className="flex-row items-center gap-2">
              <Ionicons name={isLocked ? "lock-closed-outline" : "lock-open-outline"} size={20} color={isLocked ? "#D97706" : "#166534"} />
              <Text className="font-semibold text-ink">
                {isLocked ? "Premium Early Access Only" : "Early Access Unlocked"}
              </Text>
            </View>
            <Text className="text-sm text-ink/70 leading-5">
              {isLocked 
                ? "This table is currently in early booking for Premium members only. Upgrade to Premium to book now, or wait until public release." 
                : "This table is in early booking. Your Premium membership unlocked access to book now!"}
            </Text>
            {isLocked && (
              <Button
                label="Upgrade to Premium"
                variant="secondary"
                onPress={() => router.push("/(tabs)/profile")}
              />
            )}
          </View>
        )}

        {/* Book button */}
        <View className="gap-2">
          <Button
            label={isBooked ? "You're Booked" : isLocked ? "Premium Early Access" : isFull ? "Event Full" : "Book Now"}
            disabled={isBooked || isLocked || isFull || createBooking.isPending}
            loading={createBooking.isPending}
            onPress={handleBook}
          />
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </Screen>
  );
}
