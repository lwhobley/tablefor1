import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { ChipGroup } from "../components/Chip";
import { useAuth } from "../lib/auth";
import { useConciergeRequests, useProfile, useSubmitConciergeRequest } from "../lib/queries";

const REQUEST_TYPES = [
  { value: "find_a_table", label: "Find a table" },
  { value: "private_table", label: "Private table" },
  { value: "travel_planning", label: "Travel planning" },
  { value: "restaurant_help", label: "Restaurant help" },
];

export default function ConciergeScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data: profile } = useProfile(userId);
  const { data: requests } = useConciergeRequests(userId);
  const submit = useSubmitConciergeRequest(userId);
  const [type, setType] = useState<string[]>(["find_a_table"]);
  const [details, setDetails] = useState("");

  const send = async () => {
    if (details.trim().length < 10) return Alert.alert("Tell us a little more", "Add at least 10 characters so the concierge can help.");
    try {
      await submit.mutateAsync({ requestType: type[0], details: details.trim() });
      setDetails("");
      Alert.alert("Concierge request received", "Your request is now in the member care queue.");
    } catch (error) {
      Alert.alert("Couldn't send request", (error as Error).message);
    }
  };

  return (
    <Screen>
      <View className="gap-6">
        <View className="flex-row items-center gap-3"><Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-white"><Ionicons name="arrow-back" size={20} color="#17201C" /></Pressable><View><Text className="text-xs font-bold uppercase text-muted">Premium member care</Text><Text className="font-serif text-3xl text-ink">Dining Concierge</Text></View></View>
        {!profile?.is_premium ? <View className="gap-3 rounded-lg bg-ink p-5"><Text className="font-serif text-xl text-white">Concierge is a Premium benefit</Text><Text className="text-sm leading-5 text-white/70">Upgrade from the Club tab for custom table and travel planning.</Text><Button label="Back to Club" variant="secondary" onPress={() => router.replace("/(tabs)/club")} /></View> : <>
          <View className="gap-2"><Text className="text-sm font-semibold text-ink">How can we help?</Text><View className="flex-row flex-wrap gap-2"><ChipGroup options={REQUEST_TYPES} values={type} onChange={setType} multi={false} /></View></View>
          <TextInput multiline value={details} onChangeText={setDetails} maxLength={2000} textAlignVertical="top" placeholder="Share your city, dates, group size, dining mood, and any must-haves." placeholderTextColor="#68736D" className="min-h-40 rounded-lg border border-ink/15 bg-white p-4 text-ink" />
          <Button label="Send to concierge" loading={submit.isPending} onPress={send} />
          <View className="gap-3 border-t border-ink/10 pt-5"><Text className="font-serif text-xl text-ink">Recent requests</Text>{(requests ?? []).length === 0 ? <Text className="text-sm text-muted">No concierge requests yet.</Text> : (requests ?? []).map((request: any) => <View key={request.id} className="flex-row items-start justify-between rounded-lg bg-white p-4"><View className="flex-1"><Text className="font-semibold capitalize text-ink">{request.request_type.replaceAll("_", " ")}</Text><Text className="mt-1 text-xs text-muted">{new Date(request.created_at).toLocaleDateString()}</Text></View><Text className="text-xs font-semibold capitalize text-forest">{request.status.replaceAll("_", " ")}</Text></View>)}</View>
        </>}
      </View>
    </Screen>
  );
}
