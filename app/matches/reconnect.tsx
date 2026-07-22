import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, Alert, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth";
import {
  useProfile,
  useMutualSparks,
  useReconnectRequests,
  useCreateReconnectRequest,
  useRespondReconnectRequest,
  useBookReconnectDinner,
  useRestaurants,
  type ReconnectRequest,
} from "@/lib/queries";

export default function ReconnectScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const { data: profile } = useProfile(userId);
  const { data: mutualSparks, isLoading: sparksLoading } = useMutualSparks(userId);
  const { data: requests, isLoading: requestsLoading } = useReconnectRequests(userId);
  const { data: restaurants } = useRestaurants(profile?.city);

  const createRequest = useCreateReconnectRequest(userId);
  const respondRequest = useRespondReconnectRequest(userId);
  const bookDinner = useBookReconnectDinner(userId);

  // Scheduling state
  const [selectedRequest, setSelectedRequest] = useState<ReconnectRequest | null>(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);

  const handleInvite = async (targetUserId: string) => {
    try {
      await createRequest.mutateAsync(targetUserId);
      Alert.alert("Request Sent", "Invite sent to reconnect diner!");
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    }
  };

  const handleResponse = async (id: string, status: "accepted" | "declined") => {
    try {
      await respondRequest.mutateAsync({ id, status });
      Alert.alert(
        status === "accepted" ? "Accepted!" : "Declined",
        status === "accepted" 
          ? "You can now book a table together!"
          : "Reconnect request declined."
      );
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    }
  };

  const handleBookTable = async () => {
    if (!selectedRequest || !selectedRestaurantId || !eventDate.trim()) {
      Alert.alert("Validation", "Please fill in all fields.");
      return;
    }

    try {
      setBookingLoading(true);
      const res = await bookDinner.mutateAsync({
        reconnectRequestId: selectedRequest.id,
        restaurantId: selectedRestaurantId,
        eventDate: new Date(eventDate).toISOString(),
      });
      
      Alert.alert("Success 🎉", "Reconnect dinner booked! Chat room is now active.", [
        {
          text: "Open Chat",
          onPress: () => {
            setSelectedRequest(null);
            setSelectedRestaurantId("");
            setEventDate("");
            router.push(`/matches/${res.event_id}`);
          },
        },
      ]);
    } catch (err) {
      Alert.alert("Error booking table", (err as Error).message);
    } finally {
      setBookingLoading(false);
    }
  };

  const activeTabClass = "border-b-2 border-rust pb-2 px-1";
  const inactiveTabClass = "pb-2 px-1 text-ink/40";

  const [activeTab, setActiveTab] = useState<"sparks" | "requests">("sparks");

  return (
    <Screen scroll={false}>
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-ink/10 pb-4 mb-4">
        <Pressable onPress={() => router.back()} className="h-8 w-8 items-center justify-center rounded-full bg-cream active:bg-cream/70">
          <Ionicons name="arrow-back" size={20} color="#1F1B16" />
        </Pressable>
        <Text className="font-serif text-2xl text-ink">Reconnect Dinners</Text>
      </View>

      {/* Selector tab bar */}
      <View className="flex-row gap-6 border-b border-ink/5 mb-4">
        <Pressable onPress={() => setActiveTab("sparks")}>
          <Text className={`font-semibold text-sm ${activeTab === "sparks" ? activeTabClass : inactiveTabClass}`}>
            Mutual Sparks ({mutualSparks?.length ?? 0})
          </Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab("requests")}>
          <Text className={`font-semibold text-sm ${activeTab === "requests" ? activeTabClass : inactiveTabClass}`}>
            Reconnect Requests ({requests?.filter((r: any) => r.status !== "declined").length ?? 0})
          </Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Tab 1: Mutual Sparks */}
        {activeTab === "sparks" && (
          <View className="gap-3">
            {sparksLoading ? (
              <ActivityIndicator size="large" color="#C2410C" />
            ) : mutualSparks && mutualSparks.length > 0 ? (
              mutualSparks.filter((spark: any) => spark.user).map((spark: any) => {
                const hasPendingRequest = requests?.some(
                  (r: any) => r.status === "pending" && (r.user_id === spark.user.id || r.target_user_id === spark.user.id)
                );
                const hasAcceptedRequest = requests?.some(
                  (r: any) => r.status === "accepted" && (r.user_id === spark.user.id || r.target_user_id === spark.user.id)
                );

                return (
                  <View key={spark.user.id} className="flex-row items-center justify-between border border-ink/10 rounded-2xl bg-white p-4">
                    <View className="flex-row items-center gap-3 flex-1 pr-2">
                      <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-cream">
                        {spark.user.photo_url ? (
                          <Image source={{ uri: spark.user.photo_url }} className="h-12 w-12" />
                        ) : (
                          <Ionicons name="person-circle" size={48} color="#C2410C" />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="font-semibold text-ink text-base">{spark.user.name}</Text>
                        <Text className="text-xs text-ink/50 mt-0.5">Mutual spark in match chat</Text>
                      </View>
                    </View>

                    {hasAcceptedRequest ? (
                      <View className="rounded-full bg-emerald-100 border border-emerald-300 px-3 py-1.5">
                        <Text className="text-xs font-semibold text-emerald-800">Connected</Text>
                      </View>
                    ) : hasPendingRequest ? (
                      <View className="rounded-full bg-cream border border-ink/10 px-3 py-1.5">
                        <Text className="text-xs text-ink/60 font-medium">Request pending</Text>
                      </View>
                    ) : (
                      <Button
                        label="Invite"
                        onPress={() => handleInvite(spark.user.id)}
                        variant="secondary"
                      />
                    )}
                  </View>
                );
              })
            ) : (
              <View className="items-center py-10">
                <Ionicons name="heart-dislike-outline" size={48} color="#8C7F73" />
                <Text className="text-ink/65 text-center mt-3 leading-5 px-6">
                  No mutual sparks recorded yet. Mutual sparks happen when you both select "Sparked" on the sparks feedback screen!
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Tab 2: Reconnect Requests */}
        {activeTab === "requests" && (
          <View className="gap-3">
            {requestsLoading ? (
              <ActivityIndicator size="large" color="#C2410C" />
            ) : requests && requests.filter((r: any) => r.status !== "declined").length > 0 ? (
              requests
                .filter((r: any) => r.status !== "declined")
                .map((req: any) => {
                  const isRecipient = req.target_user_id === userId;
                  // Fall back to a placeholder rather than crashing if a
                  // profile payload is ever missing.
                  const partner = (isRecipient ? req.sender : req.recipient) ??
                    { id: null, name: "A fellow diner", photo_url: null };

                  return (
                    <View key={req.id} className="border border-ink/10 rounded-2xl bg-white p-4 gap-3">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-3 flex-1 pr-2">
                          <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-cream">
                            {partner.photo_url ? (
                              <Image source={{ uri: partner.photo_url }} className="h-12 w-12" />
                            ) : (
                              <Ionicons name="person-circle" size={48} color="#C2410C" />
                            )}
                          </View>
                          <View className="flex-1">
                            <Text className="font-semibold text-ink text-base">{partner.name}</Text>
                            <Text className="text-xs text-ink/50 mt-0.5">
                              {req.status === "pending" 
                                ? isRecipient ? "wants to reconnect!" : "invitation sent"
                                : "Matched reconnect dinner"}
                            </Text>
                          </View>
                        </View>

                        {req.status === "accepted" && (
                          <View className="rounded-full bg-emerald-100 border border-emerald-300 px-3 py-1.5">
                            <Text className="text-xs font-semibold text-emerald-800">Accepted</Text>
                          </View>
                        )}
                      </View>

                      {/* Pending Response UI */}
                      {req.status === "pending" && isRecipient && (
                        <View className="flex-row gap-2 mt-1">
                          <View className="flex-1">
                            <Button
                              label="Accept"
                              onPress={() => handleResponse(req.id, "accepted")}
                            />
                          </View>
                          <View className="flex-1">
                            <Button
                              label="Decline"
                              variant="ghost"
                              onPress={() => handleResponse(req.id, "declined")}
                            />
                          </View>
                        </View>
                      )}

                      {/* Schedule Dinner form trigger */}
                      {req.status === "accepted" && !req.event_id && (
                        <View className="mt-2 border-t border-ink/5 pt-3">
                          {selectedRequest?.id === req.id ? (
                            <View className="gap-3">
                              <Text className="font-serif text-base text-ink">Schedule custom table</Text>

                              {/* Restaurant Selection List */}
                              <View className="gap-1">
                                <Text className="text-xs text-ink/50">Select Partner Restaurant</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
                                  <View className="flex-row gap-2">
                                    {(restaurants ?? []).map((r: any) => {
                                      const isSel = selectedRestaurantId === r.id;
                                      return (
                                        <Pressable
                                          key={r.id}
                                          onPress={() => setSelectedRestaurantId(r.id)}
                                          className={`rounded-full px-3 py-1.5 border ${
                                            isSel ? "bg-rust border-rust" : "bg-cream/40 border-ink/15"
                                          }`}
                                        >
                                          <Text className={`text-xs ${isSel ? "text-white font-medium" : "text-ink/80"}`}>
                                            {r.name} ({r.neighborhood})
                                          </Text>
                                        </Pressable>
                                      );
                                    })}
                                  </View>
                                </ScrollView>
                              </View>

                              {/* Date Time Picker input */}
                              <View className="gap-1">
                                <Text className="text-xs text-ink/50">Date & Time (YYYY-MM-DD HH:MM)</Text>
                                <TextInput
                                  value={eventDate}
                                  onChangeText={setEventDate}
                                  placeholder="e.g. 2026-07-10 19:00"
                                  className="rounded-lg border border-ink/10 bg-cream/30 p-2.5 text-sm text-ink"
                                />
                              </View>

                              <View className="flex-row gap-2 mt-1">
                                <View className="flex-1">
                                  <Button
                                    label="Book Dinner"
                                    onPress={handleBookTable}
                                    disabled={!selectedRestaurantId || !eventDate.trim()}
                                    loading={bookingLoading}
                                  />
                                </View>
                                <View className="flex-1">
                                  <Button
                                    label="Cancel"
                                    variant="ghost"
                                    onPress={() => {
                                      setSelectedRequest(null);
                                      setSelectedRestaurantId("");
                                      setEventDate("");
                                    }}
                                  />
                                </View>
                              </View>
                            </View>
                          ) : (
                            <Button
                              label="Schedule Dinner"
                              onPress={() => setSelectedRequest(req)}
                            />
                          )}
                        </View>
                      )}

                      {/* Redirect to booked match chat */}
                      {req.event_id && (
                        <Button
                          label="Open Chat Room"
                          variant="secondary"
                          onPress={() => router.push(`/matches/${req.event_id}`)}
                        />
                      )}
                    </View>
                  );
                })
            ) : (
              <View className="items-center py-10">
                <Ionicons name="chatbox-ellipses-outline" size={48} color="#8C7F73" />
                <Text className="text-ink/65 text-center mt-3 leading-5 px-6">
                  No active reconnect requests yet. Select a mutual spark from the other tab to invite them to reconnect!
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
