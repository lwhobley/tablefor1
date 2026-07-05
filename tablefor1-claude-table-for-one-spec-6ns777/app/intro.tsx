import { useEffect, useRef, useState } from "react";
import { View, Text, Image, Animated, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";

export default function IntroScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0: pasta, 1: sushi, 2: meeting, 3: title & login

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const titleFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Reset fadeAnim on each step change (except step 3)
    if (step < 3) {
      fadeAnim.setValue(0);
    }

    if (step === 0) {
      // Fade in pasta
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }).start(() => setStep(1));
        }, 1100);
      });
    } else if (step === 1) {
      // Fade in sushi
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }).start(() => setStep(2));
        }, 1100);
      });
    } else if (step === 2) {
      // Fade in meeting
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1100,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }).start(() => setStep(3));
        }, 2400); // Longer duration to appreciate the strangers dining/smiling
      });
    } else if (step === 3) {
      // Fade in Title and Buttons
      Animated.timing(titleFadeAnim, {
        toValue: 1,
        duration: 1300,
        useNativeDriver: true,
      }).start();
    }
  }, [step]);

  const handleSkip = () => {
    setStep(3);
    titleFadeAnim.setValue(1);
  };

  const images = [
    require("../assets/images/intro_dish_one.png"),
    require("../assets/images/intro_dish_two.png"),
    require("../assets/images/intro_table_meeting.png"),
  ];

  return (
    <Screen scroll={false}>
      <View className="flex-1 justify-center items-center bg-stone-950 w-full h-full">
        {step < 3 ? (
          <Pressable onPress={handleSkip} className="flex-1 w-full h-full justify-center items-center">
            <Animated.View style={{ opacity: fadeAnim, width: "100%", height: "100%", position: "absolute" }}>
              <Image
                source={images[step]}
                style={{ width: "100%", height: "100%", resizeMode: "cover" }}
              />
            </Animated.View>
            
            {/* Skip button overlay */}
            <Pressable
              onPress={handleSkip}
              className="absolute top-12 right-6 bg-black/55 rounded-full px-4.5 py-2 border border-white/10 active:bg-black/80"
            >
              <Text className="text-white/80 text-xs font-semibold uppercase tracking-wider">Skip</Text>
            </Pressable>
          </Pressable>
        ) : (
          <Animated.View
            style={{ opacity: titleFadeAnim }}
            className="flex-1 w-full justify-center px-8 gap-12 bg-stone-950"
          >
            <View className="gap-5">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-xs font-bold uppercase tracking-widest text-amber-500/70">
                  INTRODUCING
                </Text>
              </View>
              
              <View className="gap-1.5">
                <Text className="font-serif text-5xl text-stone-100">
                  Table <Text className="text-amber-500 font-bold">FOR 2</Text>
                </Text>
                <Text className="text-base text-stone-400 leading-7 mt-2">
                  Curated dining pairings. Meet strangers, share incredible stories, and make authentic connections over a shared table.
                </Text>
              </View>
            </View>

            <View className="gap-3 mt-4">
              <Button
                label="Get Started"
                onPress={() => router.replace("/(auth)/login")}
              />
            </View>
          </Animated.View>
        )}
      </View>
    </Screen>
  );
}
