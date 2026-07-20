import { ImageBackground, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { useAuth } from "../lib/auth";
import { useDiningPassport, type PassportVisit } from "../lib/queries";

const passportArtwork = require("../assets/images/intro_table_meeting.png");

export default function PassportScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { data: visits } = useDiningPassport(session?.user.id);
  const neighborhoods = new Set(visits?.map((visit: PassportVisit) => visit.booking.event.restaurant?.neighborhood).filter(Boolean));
  const cuisines = new Set(visits?.flatMap((visit: PassportVisit) => visit.booking.event.restaurant?.cuisine ?? []));

  return (
    <Screen scroll={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <View className="mb-5 overflow-hidden rounded-lg bg-ink">
          <ImageBackground source={passportArtwork} resizeMode="cover" style={{ height: 220 }}>
            <View className="flex-1 justify-between bg-black/45 p-4">
              <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-white/95">
                <Ionicons name="arrow-back" size={20} color="#17201C" />
              </Pressable>
              <View>
                <Text className="text-xs font-bold uppercase text-white/70">Your dining life</Text>
                <Text className="font-serif text-3xl text-white">Dinner Passport</Text>
                <Text className="mt-1 text-sm text-white/80">Every checked-in table becomes part of your story.</Text>
              </View>
            </View>
          </ImageBackground>
        </View>

        <View className="mb-7 flex-row border-y border-ink/10 py-4">
          <View className="flex-1 items-center"><Text className="font-serif text-2xl text-ink">{visits?.length ?? 0}</Text><Text className="text-xs text-muted">Tables</Text></View>
          <View className="flex-1 items-center border-x border-ink/10"><Text className="font-serif text-2xl text-ink">{neighborhoods.size}</Text><Text className="text-xs text-muted">Neighborhoods</Text></View>
          <View className="flex-1 items-center"><Text className="font-serif text-2xl text-ink">{cuisines.size}</Text><Text className="text-xs text-muted">Cuisines</Text></View>
        </View>

        {(visits ?? []).length === 0 ? (
          <View className="items-center gap-3 py-12">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-sage/15">
              <Ionicons name="map-outline" size={27} color="#1D5A4A" />
            </View>
            <Text className="font-serif text-xl text-ink">Your first stamp is waiting</Text>
            <Text className="max-w-md text-center text-sm leading-5 text-muted">
              Check in at a confirmed dinner to save its restaurant, cuisine, and neighborhood here.
            </Text>
            <Button label="Find a table" onPress={() => router.push("/(tabs)/home")} />
          </View>
        ) : (
          <View className="gap-5">
            {(visits ?? []).map((visit: PassportVisit, index: number) => {
              const event = visit.booking.event;
              return (
                <View key={visit.id} className="flex-row gap-4">
                  <View className="items-center">
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-rust">
                      <Text className="font-bold text-white">{String((visits?.length ?? 0) - index).padStart(2, "0")}</Text>
                    </View>
                    {index < (visits?.length ?? 0) - 1 && <View className="mt-2 w-px flex-1 bg-ink/15" />}
                  </View>
                  <View className="flex-1 gap-1 border-b border-ink/10 pb-5">
                    <Text className="text-xs font-bold uppercase text-rust">{event.theme ?? event.format.replaceAll("_", " ")}</Text>
                    <Text className="font-serif text-xl text-ink">{event.restaurant?.name ?? "Table for 2 dinner"}</Text>
                    <Text className="text-sm text-muted">{event.restaurant?.neighborhood ?? event.city} · {new Date(visit.checked_in_at).toLocaleDateString()}</Text>
                    <View className="mt-2 flex-row flex-wrap gap-1.5">
                      {(event.restaurant?.cuisine ?? []).map((cuisine: string) => <View key={cuisine} className="rounded-full bg-sage/10 px-2.5 py-1"><Text className="text-xs text-forest">{cuisine}</Text></View>)}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
