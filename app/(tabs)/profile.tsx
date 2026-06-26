import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Screen } from "../../components/Screen";
import { Field } from "../../components/Field";
import { Button } from "../../components/Button";
import { ChipGroup } from "../../components/Chip";
import {
  CITY_OPTIONS,
  CONV_OPTIONS,
  CUISINES,
  DIETARY,
  ENERGY_OPTIONS,
  LANGUAGE_OPTIONS,
} from "../../components/preferences";
import { useAuth } from "../../lib/auth";
import { useProfile, useUpdateProfile } from "../../lib/queries";
import { uploadAvatar } from "../../lib/uploadAvatar";
import type { ConvStyle, Dietary, EnergyLevel } from "../../lib/supabase";

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const { data: profile } = useProfile(session?.user.id);
  const update = useUpdateProfile(session?.user.id);

  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [city, setCity] = useState<string[]>([]);
  const [food, setFood] = useState<string[]>([]);
  const [diet, setDiet] = useState<Dietary[]>([]);
  const [energy, setEnergy] = useState<EnergyLevel[]>([]);
  const [conv, setConv] = useState<ConvStyle[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setPhoto(profile.photo_url);
    setCity([profile.city]);
    setFood(profile.food_prefs);
    setDiet(profile.dietary);
    setEnergy([profile.energy_level]);
    setConv([profile.conv_style]);
    setLanguages(profile.languages);
  }, [profile]);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !session) return;
    try {
      setUploading(true);
      const url = await uploadAvatar(session.user.id, {
        uri: result.assets[0].uri,
        mimeType: result.assets[0].mimeType ?? undefined,
      });
      setPhoto(url);
      await update.mutateAsync({ photo_url: url });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!city[0] || !energy[0] || !conv[0]) return;
    await update.mutateAsync({
      name: name.trim(),
      city: city[0],
      food_prefs: food,
      dietary: diet,
      energy_level: energy[0],
      conv_style: conv[0],
      languages,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <Screen>
      <View className="gap-6">
        <Text className="font-serif text-3xl text-ink">Your profile</Text>

        <View className="items-center gap-3">
          <Pressable
            onPress={pickPhoto}
            className="h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-ink/10 bg-white"
          >
            {photo ? (
              <Image source={{ uri: photo }} className="h-28 w-28" />
            ) : (
              <Text className="text-ink/40">Add</Text>
            )}
          </Pressable>
          <Button
            label={uploading ? "Uploading…" : "Change photo"}
            variant="ghost"
            onPress={pickPhoto}
            loading={uploading}
          />
        </View>

        <Field label="Name" value={name} onChangeText={setName} />

        <View className="gap-3">
          <Text className="text-sm font-medium text-ink/70">City</Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipGroup
              options={CITY_OPTIONS}
              values={city}
              onChange={setCity}
              multi={false}
            />
          </View>
        </View>

        <View className="gap-3">
          <Text className="text-sm font-medium text-ink/70">Cuisines</Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipGroup options={CUISINES} values={food} onChange={setFood} />
          </View>
        </View>

        <View className="gap-3">
          <Text className="text-sm font-medium text-ink/70">Dietary</Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipGroup options={DIETARY} values={diet} onChange={setDiet} />
          </View>
        </View>

        <View className="gap-3">
          <Text className="text-sm font-medium text-ink/70">Energy</Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipGroup
              options={ENERGY_OPTIONS}
              values={energy}
              onChange={setEnergy}
              multi={false}
            />
          </View>
        </View>

        <View className="gap-3">
          <Text className="text-sm font-medium text-ink/70">Conversation</Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipGroup
              options={CONV_OPTIONS}
              values={conv}
              onChange={setConv}
              multi={false}
            />
          </View>
        </View>

        <View className="gap-3">
          <Text className="text-sm font-medium text-ink/70">Languages</Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipGroup
              options={LANGUAGE_OPTIONS}
              values={languages}
              onChange={setLanguages}
            />
          </View>
        </View>

        <View className="gap-3 pt-2">
          <Button label="Save changes" onPress={save} loading={update.isPending} />
          {saved && (
            <Text className="text-center text-sm text-sage">Saved!</Text>
          )}
          <Button label="Sign out" variant="ghost" onPress={signOut} />
        </View>
      </View>
    </Screen>
  );
}
