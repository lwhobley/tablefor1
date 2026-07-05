import { useLocalSearchParams, useRouter } from "expo-router";
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  FlatList,
  TextInput,
  Pressable,
  Image,
  Alert,
} from "react-native";
import { useAuth } from "@/lib/auth";
import {
  useMatchDetail,
  useMatchMessages,
  usePostMessage,
  useSubscribeToMessages,
  useMyBookingId,
  useMyCheckin,
} from "@/lib/queries";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { MysteryBadge } from "@/components/MysteryBadge";
import { ConversationStarters } from "@/components/ConversationStarters";
import { CheckInButton } from "@/components/CheckInButton";
import { isMysteryRevealed, priceTier } from "@/lib/mystery";
import { generateConversationStarters } from "@/lib/conversationStarters";
import { Ionicons } from "@expo/vector-icons";
import { useState, useRef, useEffect, useMemo } from "react";

export default function MatchDetail() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const { data: match, isLoading: matchLoading } = useMatchDetail(matchId);
  const { data: messages } = useMatchMessages(matchId);
  useSubscribeToMessages(matchId);

  const postMessage = usePostMessage(matchId, userId);
  const [text, setText] = useState("");
  const listRef = useRef<FlatList>(null);

  const { data: myBookingId } = useMyBookingId(match?.event_id, userId);
  const { data: myCheckin } = useMyCheckin(myBookingId);

  // Hooks must run in the same order every render, so this is computed
  // before any early return below (match may still be loading/undefined).
  const conversationStarters = useMemo(() => {
    if (!match) return [];
    return generateConversationStarters(match.diners, match.event);
  }, [match]);

  useEffect(() => {
    if (messages && messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages]);

  if (matchLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#C2410C" />
        </View>
      </Screen>
    );
  }

  if (!match) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center gap-4">
          <Text className="text-lg text-ink">Match not found</Text>
          <Button label="Back" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const eventDate = new Date(match.event.event_date);
  const isPast = eventDate < new Date();
  const isRevealed = !!match.revealed_at;
  const canMessage = isRevealed && !isPast;
  const restaurantRevealed = isMysteryRevealed(match.event);
  const checkinWindowOpen =
    Date.now() >= eventDate.getTime() - 30 * 60 * 1000 &&
    Date.now() <= eventDate.getTime() + 3 * 3600 * 1000;

  const handleSendMessage = () => {
    if (!text.trim()) return;
    const messageText = text;
    setText("");
    postMessage.mutate(messageText, {
      onError: (err) => {
        setText(messageText); // restore so the user doesn't lose their message
        Alert.alert("Couldn't send", (err as Error).message);
      },
    });
  };

  return (
    <Screen scroll={false}>
      {/* Header with event details */}
      <View className="mb-4 gap-2 rounded-lg bg-white p-4">
        {match.event.is_mystery && !restaurantRevealed && (
          <View className="flex-row">
            <MysteryBadge event={match.event} />
          </View>
        )}
        <Text className="font-serif text-xl text-ink">
          {restaurantRevealed
            ? match.event.restaurant?.name
            : `Mystery Dinner ${priceTier(match.event.price_cents)}`}
        </Text>
        <View className="flex-row items-center gap-2">
          <Ionicons name="calendar-outline" size={14} color="#8C7F73" />
          <Text className="text-sm text-ink/70">
            {eventDate.toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}{" "}
            at{" "}
            {eventDate.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
        {isPast && (
          <Text className="mt-2 text-xs text-clay">Dinner completed</Text>
        )}
        {checkinWindowOpen && myBookingId && userId && (
          <View className="mt-2">
            <CheckInButton
              bookingId={myBookingId}
              userId={userId}
              alreadyCheckedIn={!!myCheckin}
            />
          </View>
        )}
      </View>

      {/* Conversation starters — generated from the group's shared attributes */}
      {isRevealed && !isPast && (
        <ConversationStarters starters={conversationStarters} />
      )}

      {/* Diner profiles */}
      {isRevealed ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4 max-h-28 flex-grow-0"
          contentContainerStyle={{ gap: 12 }}
        >
          {match.diners.map((diner: any) => (
            <View key={diner.id} className="w-20 items-center gap-2">
              <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-ink/10 bg-cream">
                {diner.photo_url ? (
                  <Image source={{ uri: diner.photo_url }} className="h-16 w-16" />
                ) : (
                  <Ionicons name="person-circle" size={64} color="#C2410C" />
                )}
              </View>
              <Text className="text-center text-xs font-medium text-ink">
                {diner.name}
              </Text>
              <Text className="text-center text-xs text-ink/60">
                {diner.energy_level} energy
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View className="mb-4 rounded-lg border border-clay/30 bg-clay/10 p-4">
          <Text className="text-sm font-medium text-clay">
            👀 Profiles will appear 24 hours before dinner
          </Text>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={listRef}
        className="flex-1"
        data={messages ?? []}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => {
          const isOwnMessage = item.sender_id === userId;
          return (
            <View
              className={`mb-3 flex-row gap-2 ${
                isOwnMessage ? "justify-end" : "justify-start"
              }`}
            >
              {!isOwnMessage && (
                <View className="h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cream">
                  <Ionicons name="person-circle" size={32} color="#C2410C" />
                </View>
              )}
              <View
                className={`max-w-xs rounded-lg px-3 py-2 ${
                  isOwnMessage ? "bg-rust" : "bg-ink/10"
                }`}
              >
                <Text
                  className={`text-sm ${isOwnMessage ? "text-white" : "text-ink"}`}
                >
                  {item.body}
                </Text>
                <Text
                  className={`mt-1 text-xs ${
                    isOwnMessage ? "text-white/70" : "text-ink/60"
                  }`}
                >
                  {new Date(item.created_at).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View className="items-center justify-center py-8">
            <Text className="text-ink/60">
              {canMessage
                ? "No messages yet. Start a conversation!"
                : isRevealed
                  ? "This dinner has wrapped up."
                  : "Messaging opens when your match is revealed."}
            </Text>
          </View>
        }
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
      />

      {/* Composer (pre-event) or feedback CTA (post-event) */}
      {canMessage && (
        <View className="mt-2 flex-row items-center gap-2 border-t border-ink/10 pt-3">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor="#8C7F73"
            multiline
            maxLength={2000}
            className="flex-1 rounded-full bg-ink/5 px-4 py-2 text-ink"
          />
          <Pressable
            onPress={handleSendMessage}
            disabled={!text.trim() || postMessage.isPending}
            className={`h-10 w-10 items-center justify-center rounded-full ${
              text.trim() && !postMessage.isPending ? "bg-rust" : "bg-rust/40"
            }`}
          >
            <Ionicons name="send" size={20} color="white" />
          </Pressable>
        </View>
      )}

      {isPast && (
        <View className="mt-2 gap-3">
          <Button
            label="Send Sparks"
            variant="secondary"
            onPress={() => router.push(`/matches/${matchId}/sparks`)}
          />
          <Button
            label="Leave feedback"
            onPress={() => router.push(`/feedback/${matchId}`)}
          />
        </View>
      )}
    </Screen>
  );
}
