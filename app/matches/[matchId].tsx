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
import * as ImagePicker from "expo-image-picker";
import { uploadChatPhoto } from "@/lib/uploadChatPhoto";
import {
  useMatchDetail,
  useMatchMessages,
  usePostMessage,
  useSubscribeToMessages,
  useMyBookingId,
  useMyCheckin,
  useReactToMessage,
  useRemoveReaction,
  useProfile,
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
import { ProfileModal } from "@/components/ProfileModal";
import type { Profile } from "@/lib/supabase";
import { DinnerPolls } from "@/components/DinnerPolls";
import { getGroupMatchReasons } from "@/lib/matchValue";

export default function MatchDetail() {
  const { matchId, recipientId } = useLocalSearchParams<{
    matchId: string;
    recipientId?: string;
  }>();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [selectedDiner, setSelectedDiner] = useState<Profile | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  const reactToMessage = useReactToMessage(matchId, userId);
  const removeReaction = useRemoveReaction(matchId, userId);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [activeMessageForReaction, setActiveMessageForReaction] = useState<string | null>(null);

  const handleSendPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !userId) return;
    
    try {
      setPhotoUploading(true);
      const photoPath = await uploadChatPhoto(userId, {
        uri: result.assets[0].uri,
        mimeType: result.assets[0].mimeType ?? undefined,
      });

      postMessage.mutate(canPairMessage
        ? { photoUrl: photoPath, recipientId: selectedRecipient!.id }
        : { photoUrl: photoPath }, {
        onError: (err) => {
          Alert.alert("Couldn't send photo", (err as Error).message);
        },
      });
    } catch (err) {
      Alert.alert("Error uploading photo", (err as Error).message);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string, hasReacted: boolean) => {
    try {
      if (hasReacted) {
        await removeReaction.mutateAsync({ messageId, emoji });
      } else {
        await reactToMessage.mutateAsync({ messageId, emoji });
      }
    } catch (err) {
      Alert.alert("Error updating reaction", (err as Error).message);
    }
  };

  const { data: match, isLoading: matchLoading } = useMatchDetail(matchId);
  const { data: profile } = useProfile(userId);
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
  const matchReasons = useMemo(() => {
    if (!match || !profile) return [];
    return getGroupMatchReasons(profile, match.diners);
  }, [match, profile]);

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
  const selectedRecipient = match.diners.find(
    (diner: { id: string }) => diner.id === recipientId,
  );
  const canGroupMessage = isRevealed && !isPast;
  const canPairMessage = isPast && !!selectedRecipient;
  const canMessage = canGroupMessage || canPairMessage;
  const visibleMessages = (messages ?? []).filter((message: {
    sender_id: string;
    recipient_id: string | null;
  }) => {
    if (!selectedRecipient) return !message.recipient_id;
    return (
      message.recipient_id &&
      ((message.sender_id === userId && message.recipient_id === selectedRecipient.id) ||
        (message.sender_id === selectedRecipient.id && message.recipient_id === userId))
    );
  });
  const restaurantRevealed = isMysteryRevealed(match.event);
  const checkinWindowOpen =
    Date.now() >= eventDate.getTime() - 30 * 60 * 1000 &&
    Date.now() <= eventDate.getTime() + 3 * 3600 * 1000;

  const handleSendMessage = () => {
    if (!text.trim()) return;
    const messageText = text;
    setText("");
    postMessage.mutate(canPairMessage
      ? { body: messageText, recipientId: selectedRecipient!.id }
      : messageText, {
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

      {isRevealed && matchReasons.length > 0 && (
        <View className="mb-4 gap-2 rounded-lg bg-sage/10 p-4">
          <View className="flex-row items-center gap-2">
            <Ionicons name="sparkles" size={17} color="#1D5A4A" />
            <Text className="font-semibold text-forest">Why this group works</Text>
          </View>
          <Text className="text-sm leading-5 text-ink/70">{matchReasons.join(" · ")}</Text>
        </View>
      )}

      {isRevealed && !isPast && userId && (
        <DinnerPolls matchId={matchId} userId={userId} />
      )}

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
            <Pressable
              key={diner.id}
              onPress={() => {
                setSelectedDiner(diner);
                setProfileModalVisible(true);
              }}
              className="w-20 items-center gap-2 active:opacity-75"
            >
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
            </Pressable>
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
        data={visibleMessages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => {
          const isOwnMessage = item.sender_id === userId;
          const reactions = item.reactions || [];
          const emojiGroups = reactions.reduce((acc: Record<string, string[]>, r: any) => {
            acc[r.emoji] = acc[r.emoji] || [];
            acc[r.emoji].push(r.user_id);
            return acc;
          }, {});

          return (
            <View
              className={`mb-3 flex-row gap-2 relative ${
                isOwnMessage ? "justify-end" : "justify-start"
              }`}
            >
              {!isOwnMessage && (
                <View className="h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cream">
                  <Ionicons name="person-circle" size={32} color="#C2410C" />
                </View>
              )}
              
              <View className="relative">
                {/* Long Press Reaction Picker */}
                {activeMessageForReaction === item.id && (
                  <View 
                    style={{ elevation: 5 }}
                    className={`flex-row gap-2.5 bg-white border border-ink/10 rounded-full px-3 py-1.5 absolute -top-11 z-50 shadow-md ${
                      isOwnMessage ? "right-0" : "left-0"
                    }`}
                  >
                    {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => {
                      const hasReacted = (emojiGroups[emoji] || []).includes(userId || "");
                      return (
                        <Pressable
                          key={emoji}
                          onPress={() => {
                            handleToggleReaction(item.id, emoji, hasReacted);
                            setActiveMessageForReaction(null);
                          }}
                          className="active:scale-125"
                        >
                          <Text className="text-lg">{emoji}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                <Pressable
                  onLongPress={() => setActiveMessageForReaction(item.id)}
                  delayLongPress={250}
                  className={`max-w-[250px] rounded-2xl px-4 py-2.5 ${
                    isOwnMessage ? "bg-rust rounded-tr-none" : "bg-ink/10 rounded-tl-none"
                  }`}
                >
                  {/* Photo Rendering */}
                  {item.photo_url && (
                    <Image
                      source={{ uri: item.photo_url }}
                      className="h-44 w-44 rounded-xl mb-1.5 bg-cream/20"
                      resizeMode="cover"
                    />
                  )}

                  {/* Body Text */}
                  {item.body ? (
                    <Text
                      className={`text-sm leading-5 ${isOwnMessage ? "text-white" : "text-ink"}`}
                    >
                      {item.body}
                    </Text>
                  ) : null}

                  {/* Message Timestamp */}
                  <Text
                    className={`mt-1 text-[10px] text-right ${
                      isOwnMessage ? "text-white/70" : "text-ink/50"
                    }`}
                  >
                    {new Date(item.created_at).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </Pressable>

                {/* Reaction Badges */}
                {reactions.length > 0 && (
                  <View className={`flex-row flex-wrap gap-1 mt-1 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
                    {Object.keys(emojiGroups).map((emoji) => {
                      const userIds = emojiGroups[emoji];
                      const hasReacted = userIds.includes(userId || "");
                      return (
                        <Pressable
                          key={emoji}
                          onPress={() => handleToggleReaction(item.id, emoji, hasReacted)}
                          className={`flex-row items-center gap-1 rounded-full px-2 py-0.5 border ${
                            hasReacted ? "bg-rust/10 border-rust/35" : "bg-ink/5 border-ink/10"
                          }`}
                        >
                          <Text className="text-[10px]">{emoji}</Text>
                          <Text className={`text-[9px] font-bold ${hasReacted ? "text-rust" : "text-ink/60"}`}>
                            {userIds.length}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View className="items-center justify-center py-8">
            <Text className="text-ink/60">
              {canMessage
                ? canPairMessage
                  ? `No private messages with ${selectedRecipient!.name} yet.`
                  : "No messages yet. Start a conversation!"
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
        <View className="mt-2 gap-2 border-t border-ink/10 pt-3">
          {canPairMessage && (
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-medium text-ink/60">
                Private spark chat with {selectedRecipient!.name}
              </Text>
              <Pressable onPress={() => router.setParams({ recipientId: undefined })}>
                <Text className="text-xs font-medium text-rust">Group view</Text>
              </Pressable>
            </View>
          )}
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={handleSendPhoto}
              disabled={photoUploading || postMessage.isPending}
              className="h-10 w-10 items-center justify-center rounded-full bg-ink/5 active:bg-ink/10"
            >
              {photoUploading ? (
                <ActivityIndicator size="small" color="#C2410C" />
              ) : (
                <Ionicons name="image-outline" size={20} color="#8C7F73" />
              )}
            </Pressable>
            
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={canPairMessage ? `Message ${selectedRecipient!.name}...` : "Type a message..."}
              placeholderTextColor="#8C7F73"
              multiline
              maxLength={2000}
              className="flex-1 rounded-full bg-ink/5 px-4 py-2 text-ink"
            />
            
            <Pressable
              onPress={handleSendMessage}
              disabled={(!text.trim() && !photoUploading) || postMessage.isPending}
              className={`h-10 w-10 items-center justify-center rounded-full ${
                (text.trim() && !postMessage.isPending) ? "bg-rust" : "bg-rust/40"
              }`}
            >
              <Ionicons name="send" size={20} color="white" />
            </Pressable>
          </View>
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
      <ProfileModal
        visible={profileModalVisible}
        onClose={() => setProfileModalVisible(false)}
        diner={selectedDiner}
      />
    </Screen>
  );
}
