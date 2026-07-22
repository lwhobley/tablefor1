import { Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useCreateMatchPoll,
  useMatchPolls,
  useVoteMatchPoll,
} from "../lib/queries";
import type { MatchPoll } from "../lib/supabase";

const POLL_PRESETS = [
  { question: "When should we arrive?", options: ["10 minutes early", "Right on time"] },
  { question: "After-dinner plan?", options: ["Dessert", "One more stop", "Call it a night"] },
  { question: "What table mood sounds best?", options: ["Easygoing", "Lively", "Food-focused"] },
];

export function DinnerPolls({ matchId, userId }: { matchId: string; userId: string }) {
  const { data: polls } = useMatchPolls(matchId);
  const createPoll = useCreateMatchPoll(matchId, userId);
  const vote = useVoteMatchPoll(matchId, userId);

  const handleCreate = async (preset: (typeof POLL_PRESETS)[number]) => {
    try {
      await createPoll.mutateAsync(preset);
    } catch (error) {
      Alert.alert("Couldn't start poll", (error as Error).message);
    }
  };

  return (
    <View className="mb-4 gap-3 border-y border-ink/10 py-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Ionicons name="stats-chart-outline" size={18} color="#1D5A4A" />
          <Text className="font-semibold text-ink">Table polls</Text>
        </View>
        <Text className="text-xs text-muted">Plan together</Text>
      </View>

      {(polls ?? []).map((poll: MatchPoll) => {
        const myVote = poll.votes.find((item: MatchPoll["votes"][number]) => item.user_id === userId)?.option_index;
        const totalVotes = poll.votes.length;
        return (
          <View key={poll.id} className="gap-2 rounded-lg bg-white p-3">
            <Text className="text-sm font-semibold text-ink">{poll.question}</Text>
            {poll.options.map((option: string, index: number) => {
              const count = poll.votes.filter((item: MatchPoll["votes"][number]) => item.option_index === index).length;
              const selected = myVote === index;
              return (
                <Pressable
                  key={`${poll.id}-${option}`}
                  onPress={() => vote.mutate({ pollId: poll.id, optionIndex: index })}
                  disabled={vote.isPending}
                  className={`flex-row items-center justify-between rounded-md border px-3 py-2.5 ${
                    selected ? "border-forest bg-sage/10" : "border-ink/10 bg-pearl"
                  }`}
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons
                      name={selected ? "radio-button-on" : "radio-button-off"}
                      size={16}
                      color={selected ? "#1D5A4A" : "#68736D"}
                    />
                    <Text className="text-sm text-ink">{option}</Text>
                  </View>
                  <Text className="text-xs font-semibold text-muted">
                    {totalVotes ? `${count}/${totalVotes}` : "Vote"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        );
      })}

      <View className="flex-row flex-wrap gap-2">
        {POLL_PRESETS.map((preset) => (
          <Pressable
            key={preset.question}
            onPress={() => handleCreate(preset)}
            disabled={createPoll.isPending || polls?.some((poll: MatchPoll) => poll.question === preset.question)}
            className="flex-row items-center gap-1.5 rounded-full border border-ink/10 bg-white px-3 py-2 disabled:opacity-40"
          >
            <Ionicons name="add" size={14} color="#B5462D" />
            <Text className="text-xs font-medium text-ink">{preset.question}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
