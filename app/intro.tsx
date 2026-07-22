import { useEffect, useRef, useState } from "react";
import { View, Text, Image, Animated, Pressable, useWindowDimensions, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Button } from "@/components/Button";

export default function IntroScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
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
  }, [step, fadeAnim, titleFadeAnim]);

  const handleSkip = () => {
    setStep(3);
    titleFadeAnim.setValue(1);
  };

  const images = [
    require("../assets/images/intro_dish_one.png"),
    require("../assets/images/intro_dish_two.png"),
    require("../assets/images/intro_table_meeting.png"),
  ];
  const logoWidth = Math.min(width - 48, 360);
  const logoHeight = logoWidth * (1012 / 1844);

  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#0A0A0A" }]}>
      <StatusBar style="light" translucent />
      {step < 3 ? (
        <Pressable onPress={handleSkip} style={StyleSheet.absoluteFillObject}>
          <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: fadeAnim }]}>
            <Image
              source={images[step]}
              style={[StyleSheet.absoluteFillObject, { width: "100%", height: "100%", resizeMode: "cover" }]}
            />
          </Animated.View>
          
          {/* Skip button overlay */}
          <Pressable
            onPress={handleSkip}
            className="absolute top-12 right-6 z-50 bg-black/55 rounded-full px-4.5 py-2 border border-white/10 active:bg-black/80"
          >
            <Text className="text-white/80 text-xs font-semibold uppercase tracking-wider">Skip</Text>
          </Pressable>
        </Pressable>
      ) : (
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { opacity: titleFadeAnim }]}
        >
          <View className="flex-1 items-center justify-center px-6">
            <Image
              source={require("../assets/images/table_for_2_logo.png")}
              style={{ width: logoWidth, height: logoHeight, resizeMode: "contain" }}
            />
          </View>

          <View className="absolute bottom-0 left-0 right-0 items-center pb-16 px-8">
            <View className="w-full gap-3">
              <Button
                label="Get Started"
                onPress={() => router.replace("/(auth)/login")}
              />
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
