import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { PartnerNav } from "../../components/PartnerNav";
import { usePartnerEvents, type PartnerEvent } from "../../lib/partnerQueries";

const STATUS_STYLES: Record<PartnerEvent["status"], string> = {
  open: "text-sage",
  matched: "text-rust",
  full: "text-rust",
  cancelled: "text-muted",
  completed: "text-ink/60",
};

function EventRow({ event }: { event: PartnerEvent }) {
  const [expanded, setExpanded] = useState(false);
  const when = new Date(event.event_date).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
      className="gap-2 rounded-2xl border border-ink/10 bg-white p-4"
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-serif text-lg text-ink">{when}</Text>
        <Text
          className={`text-xs font-semibold uppercase tracking-widest ${
            STATUS_STYLES[event.status]
          }`}
        >
          {event.status}
        </Text>
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="text-sm text-ink/60">
          {event.format.replace("_", " ")}
        </Text>
        <Text className="text-sm font-medium text-ink">
          {event.confirmed_covers} / {event.group_size}
        </Text>
      </View>
      {expanded && event.first_names.length > 0 && (
        <View className="gap-1 border-t border-ink/10 pt-2">
          <Text className="text-xs uppercase tracking-widest text-ink/50">
            Confirmed guests
          </Text>
          <Text className="text-sm text-ink">
            {event.first_names.join(", ")}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default function PartnerEvents() {
  const { data: events, isLoading } = usePartnerEvents();

  return (
    <Screen>
      <View className="gap-2 pb-2">
        <Text className="font-serif text-3xl text-ink">Upcoming events</Text>
        <Text className="text-sm text-ink/60">
          Tap a row to see the first names of confirmed diners.
        </Text>
      </View>
      <PartnerNav />

      {isLoading ? (
        <ActivityIndicator />
      ) : (events ?? []).length === 0 ? (
        <View className="mt-8 gap-3 rounded-2xl bg-clay/10 p-6">
          <Text className="font-serif text-xl text-ink">No events yet</Text>
          <Text className="text-sm text-ink/60">
            Submit availability slots and approved nights will appear here as
            bookable events.
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {(events ?? []).map((e) => (
            <EventRow key={e.event_id} event={e} />
          ))}
        </View>
      )}
    </Screen>
  );
}
