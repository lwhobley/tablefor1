import React from "react";
import { Alert, Modal, View, Text, Image, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth";
import { useBadges, useBlockedUsers, useProfileVerification, useToggleBlockedUser, useUserIcebreakers } from "../lib/queries";
import { BadgeList } from "./BadgeList";
import type { Profile } from "../lib/supabase";

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  diner: Profile | null;
}

export function ProfileModal({ visible, onClose, diner }: ProfileModalProps) {
  const router = useRouter();
  const { session } = useAuth();
  const { data: userIcebreakers, isLoading: icebreakersLoading } = useUserIcebreakers(diner?.id);
  const { data: badges } = useBadges(diner?.id);
  const { data: verification } = useProfileVerification(diner?.id);
  const { data: blockedUsers } = useBlockedUsers(session?.user.id);
  const toggleBlocked = useToggleBlockedUser(session?.user.id);

  if (!diner) return null;

  // Capitalize helpers
  const formatText = (text: string) => {
    return text.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };
  const isBlocked = blockedUsers?.some((entry: { blocked_id: string }) => entry.blocked_id === diner.id) ?? false;

  const handleBlock = () => {
    Alert.alert(
      isBlocked ? `Unblock ${diner.name}?` : `Block ${diner.name}?`,
      isBlocked
        ? "They may appear in future matching again."
        : "They will be excluded from your future matching and can no longer contact you.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isBlocked ? "Unblock" : "Block",
          style: isBlocked ? "default" : "destructive",
          onPress: () => toggleBlocked.mutate({ blockedId: diner.id, blocked: isBlocked }),
        },
      ],
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View className="h-[85%] rounded-t-lg bg-white p-6 shadow-2xl">
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-ink/10 pb-4 mb-4">
            <Text className="font-serif text-2xl text-ink">Diner Profile</Text>
            <Pressable onPress={onClose} className="h-8 w-8 items-center justify-center rounded-full bg-cream active:bg-cream/70">
              <Ionicons name="close" size={20} color="#1F1B16" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
            {/* Profile Card Header */}
            <View className="items-center gap-3 mb-6">
              <View className="h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-rust/10 bg-cream">
                {diner.photo_url ? (
                  <Image source={{ uri: diner.photo_url }} className="h-28 w-28" />
                ) : (
                  <Ionicons name="person-circle" size={112} color="#C2410C" />
                )}
              </View>

              <View className="items-center">
                <View className="flex-row items-center gap-1.5">
                  <Text className="font-serif text-2xl text-ink font-semibold">{diner.name}</Text>
                  {verification?.status === "verified" && (
                    <Ionicons name="checkmark-circle" size={19} color="#1D5A4A" />
                  )}
                </View>
                <Text className="text-sm text-ink/60 mt-0.5">
                  <Ionicons name="location-outline" size={12} color="#8C7F73" /> {diner.neighborhood || diner.city}
                </Text>
              </View>
            </View>

            {/* About / Bio */}
            {diner.bio && (
              <View className="mb-6 bg-cream/30 border border-ink/5 rounded-lg p-4">
                <Text className="text-xs font-bold uppercase tracking-wider text-rust mb-1.5">About Me</Text>
                <Text className="text-sm leading-relaxed text-ink/80">{diner.bio}</Text>
              </View>
            )}

            {/* Vibe & Conversational Style */}
            <View className="flex-row gap-3 mb-6">
              <View className="flex-1 bg-cream/35 border border-ink/5 rounded-lg p-3.5 items-center">
                <Ionicons name="flash-outline" size={20} color="#C2410C" />
                <Text className="text-xs text-ink/50 mt-1 uppercase tracking-wider font-semibold">Energy</Text>
                <Text className="text-sm font-semibold text-ink mt-0.5">{formatText(diner.energy_level)}</Text>
              </View>
              <View className="flex-1 bg-cream/35 border border-ink/5 rounded-lg p-3.5 items-center">
                <Ionicons name="chatbubbles-outline" size={20} color="#C2410C" />
                <Text className="text-xs text-ink/50 mt-1 uppercase tracking-wider font-semibold">Style</Text>
                <Text className="text-sm font-semibold text-ink mt-0.5">{formatText(diner.conv_style)}</Text>
              </View>
            </View>

            {/* Badges / Reputation */}
            {badges && badges.length > 0 && (
              <View className="mb-6">
                <BadgeList badges={badges} />
              </View>
            )}

            {/* Food Prefs & Dietary */}
            <View className="mb-6 gap-3">
              {diner.dietary && diner.dietary.length > 0 && diner.dietary[0] !== "none" && (
                <View className="gap-2">
                  <Text className="text-xs font-bold uppercase tracking-wider text-ink/50">Dietary</Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {diner.dietary.map((d) => (
                      <View key={d} className="rounded-full bg-rust/5 border border-rust/10 px-3 py-1">
                        <Text className="text-xs font-medium text-rust">{formatText(d)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {diner.food_prefs && diner.food_prefs.length > 0 && (
                <View className="gap-2">
                  <Text className="text-xs font-bold uppercase tracking-wider text-ink/50">Favorite Cuisines</Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {diner.food_prefs.map((f) => (
                      <View key={f} className="rounded-full bg-ink/5 border border-ink/10 px-3 py-1">
                        <Text className="text-xs font-medium text-ink/80">{f}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {/* Icebreaker Prompts Section */}
            <View className="mb-6 border-t border-ink/10 pt-4">
              <Text className="font-serif text-lg text-ink mb-3.5">Icebreaker Prompts</Text>
              
              {icebreakersLoading ? (
                <ActivityIndicator size="small" color="#C2410C" />
              ) : userIcebreakers && userIcebreakers.length > 0 ? (
                <View className="gap-4">
                  {userIcebreakers.map((ib: any) => (
                    <View key={ib.id} className="rounded-lg border border-rust/10 bg-rust/5 p-4 shadow-sm">
                      <Text className="text-xs font-bold text-rust uppercase tracking-wider mb-1">
                        {ib.prompt.prompt_text}
                      </Text>
                      <Text className="text-sm italic font-serif leading-relaxed text-ink mt-0.5">
                        "{ib.answer}"
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="text-sm text-ink/50 italic">
                  No icebreaker answers added yet.
                </Text>
              )}
            </View>

            <View className="mb-6 flex-row gap-3 border-t border-ink/10 pt-4">
              <Pressable
                onPress={() => {
                  onClose();
                  router.push({ pathname: "/safety/report", params: { subjectId: diner.id, subjectName: diner.name } });
                }}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-ink/15 py-3"
              >
                <Ionicons name="flag-outline" size={17} color="#B5462D" />
                <Text className="text-sm font-semibold text-ink">Report</Text>
              </Pressable>
              <Pressable
                onPress={handleBlock}
                disabled={toggleBlocked.isPending}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-lg border border-rust/20 py-3"
              >
                <Ionicons name={isBlocked ? "refresh-outline" : "ban-outline"} size={17} color="#B5462D" />
                <Text className="text-sm font-semibold text-rust">{isBlocked ? "Unblock" : "Block"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
