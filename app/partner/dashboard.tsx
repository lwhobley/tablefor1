import { ActivityIndicator, Text, View } from "react-native";
import { Link } from "expo-router";
import { Screen } from "../../components/Screen";
import { PartnerNav } from "../../components/PartnerNav";
import {
  usePartnerRestaurant,
  usePartnerStats,
} from "../../lib/partnerQueries";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View className="flex-1 gap-1 rounded-2xl border border-ink/10 bg-white p-4">
      <Text className="text-xs uppercase tracking-widest text-ink/50">
        {label}
      </Text>
      <Text className="font-serif text-2xl text-ink">{value}</Text>
      {hint && <Text className="text-xs text-ink/50">{hint}</Text>}
    </View>
  );
}

export default function PartnerDashboard() {
  const { data: restaurant } = usePartnerRestaurant();
  const { data: stats, isLoading } = usePartnerStats();

  const grossDollars = stats ? `$${(stats.gross_payout_cents / 100).toFixed(0)}` : "—";
  const partnerShare = stats
    ? `$${((stats.gross_payout_cents * 0.8) / 100).toFixed(0)}`
    : "—";

  return (
    <Screen>
      <View className="gap-2 pb-2">
        <Text className="text-xs uppercase tracking-widest text-rust">
          Partner portal
        </Text>
        <Text className="font-serif text-3xl text-ink">
          {restaurant?.name ?? "Your venue"}
        </Text>
        <Text className="text-sm text-ink/60">
          {restaurant?.neighborhood} · {restaurant?.city}
        </Text>
      </View>
      <PartnerNav />

      {isLoading || !stats ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <View className="gap-6">
          <View className="gap-3">
            <Text className="text-sm font-medium text-ink/70">Next 30 days</Text>
            <View className="flex-row gap-3">
              <Stat
                label="Upcoming"
                value={String(stats.upcoming_events)}
                hint="events"
              />
              <Stat
                label="Covers"
                value={String(stats.confirmed_covers)}
                hint="confirmed"
              />
            </View>
            <View className="flex-row gap-3">
              <Stat
                label="Pending"
                value={String(stats.pending_slots)}
                hint="awaiting review"
              />
              <Stat
                label="Payout est."
                value={partnerShare}
                hint={`from ${grossDollars} gross`}
              />
            </View>
          </View>

          {!restaurant?.stripe_account && (
            <View className="gap-3 rounded-2xl bg-clay/15 p-5">
              <Text className="font-serif text-xl text-ink">
                Connect Stripe to get paid
              </Text>
              <Text className="text-sm text-ink/70">
                We use Stripe Connect to settle covers after each event.
                Onboarding takes about two minutes.
              </Text>
              <Link
                href="/partner/connect/stripe"
                className="text-base font-semibold text-rust"
              >
                Start onboarding →
              </Link>
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}
