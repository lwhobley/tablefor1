import { useMemo, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import type { EventWithRestaurant } from "../lib/queries";

type Decision = "maybe" | "pass";
type Mode = "browse" | "maybes";

type SwipeCardProps = {
  children: React.ReactNode;
  cardKey: string;
  onDecision: (decision: Decision) => void;
};

function SwipeCard({ children, cardKey, onDecision }: SwipeCardProps) {
  const { width } = useWindowDimensions();
  const translateX = useSharedValue(0);
  const locked = useSharedValue(false);
  const threshold = Math.min(110, width * 0.26);

  const finishSwipe = (decision: Decision) => {
    if (locked.value) return;
    locked.value = true;
    const destination = decision === "maybe" ? width * 1.2 : -width * 1.2;
    translateX.value = withTiming(destination, { duration: 190 }, (finished) => {
      if (finished) runOnJS(onDecision)(decision);
    });
  };

  const gesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onUpdate((event) => {
      if (!locked.value) translateX.value = event.translationX;
    })
    .onEnd((event) => {
      const shouldDecide =
        Math.abs(translateX.value) >= threshold || Math.abs(event.velocityX) >= 800;
      if (shouldDecide) {
        const decision = translateX.value >= 0 ? "maybe" : "pass";
        locked.value = true;
        const destination = decision === "maybe" ? width * 1.2 : -width * 1.2;
        translateX.value = withTiming(destination, { duration: 190 }, (finished) => {
          if (finished) runOnJS(onDecision)(decision);
        });
      } else {
        translateX.value = withSpring(0, { damping: 17, stiffness: 190 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      {
        rotate: `${interpolate(
          translateX.value,
          [-width, 0, width],
          [-8, 0, 8],
          Extrapolation.CLAMP,
        )}deg`,
      },
    ],
  }));
  const maybeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, threshold], [0, 1], Extrapolation.CLAMP),
  }));
  const passStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-threshold, 0], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <View key={cardKey} className="flex-1">
      <GestureDetector gesture={gesture}>
        <Animated.View style={cardStyle} className="flex-1">
          {children}
          <Animated.View
            pointerEvents="none"
            style={maybeStyle}
            className="absolute left-4 top-5 rotate-[-7deg] rounded-md border-2 border-teal bg-white/95 px-3 py-2"
          >
            <Text className="text-sm font-black uppercase text-teal">Maybe</Text>
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={passStyle}
            className="absolute right-4 top-5 rotate-[7deg] rounded-md border-2 border-rust bg-white/95 px-3 py-2"
          >
            <Text className="text-sm font-black uppercase text-rust">No</Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      <View className="flex-row items-center justify-center gap-5 pt-3">
        <View className="items-center gap-1">
          <Pressable
            accessibilityLabel="Pass on this dinner"
            onPress={() => finishSwipe("pass")}
            className="h-14 w-14 items-center justify-center rounded-full border border-rust/30 bg-white active:bg-rust/10"
          >
            <Ionicons name="close" size={27} color="#B5462D" />
          </Pressable>
          <Text className="text-[10px] font-bold uppercase text-rust">No</Text>
        </View>
        <View className="items-center gap-1">
          <Pressable
            accessibilityLabel="Save this dinner as a maybe"
            onPress={() => finishSwipe("maybe")}
            className="h-14 w-14 items-center justify-center rounded-full bg-teal active:opacity-80"
          >
            <Ionicons name="bookmark" size={23} color="#FFFFFF" />
          </Pressable>
          <Text className="text-[10px] font-bold uppercase text-teal">Maybe</Text>
        </View>
      </View>
    </View>
  );
}

export function DiningSwipeDeck({
  events,
  renderCard,
  onPullMore,
  pulling,
}: {
  events: EventWithRestaurant[];
  renderCard: (event: EventWithRestaurant, index: number) => React.ReactNode;
  onPullMore: () => void;
  pulling: boolean;
}) {
  const [mode, setMode] = useState<Mode>("browse");
  const [browseIndex, setBrowseIndex] = useState(0);
  const [maybeIndex, setMaybeIndex] = useState(0);
  const [maybeIds, setMaybeIds] = useState<string[]>([]);
  const [history, setHistory] = useState<{ eventId: string; decision: Decision }[]>([]);

  const maybeEvents = useMemo(
    () => maybeIds.map((id) => events.find((event) => event.id === id)).filter(Boolean) as EventWithRestaurant[],
    [events, maybeIds],
  );
  const normalizedMaybeIndex = maybeEvents.length === 0 ? 0 : maybeIndex % maybeEvents.length;
  const currentEvent = mode === "browse" ? events[browseIndex] : maybeEvents[normalizedMaybeIndex];

  const decide = (decision: Decision) => {
    if (!currentEvent) return;
    if (mode === "browse") {
      if (decision === "maybe") {
        setMaybeIds((ids) => (ids.includes(currentEvent.id) ? ids : [...ids, currentEvent.id]));
      }
      setHistory((items) => [...items, { eventId: currentEvent.id, decision }]);
      setBrowseIndex((index) => index + 1);
      return;
    }

    if (decision === "pass") {
      setMaybeIds((ids) => ids.filter((id) => id !== currentEvent.id));
    } else {
      setMaybeIndex((index) => index + 1);
    }
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    if (previous.decision === "maybe") {
      setMaybeIds((ids) => ids.filter((id) => id !== previous.eventId));
    }
    setHistory((items) => items.slice(0, -1));
    setBrowseIndex((index) => Math.max(0, index - 1));
  };

  const pullMore = () => {
    setMode("browse");
    setBrowseIndex(0);
    setHistory([]);
    onPullMore();
  };

  return (
    <View className="min-h-0 flex-1 gap-3">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-row rounded-lg bg-ink/5 p-1">
          <Pressable
            onPress={() => setMode("browse")}
            className={`rounded-md px-4 py-2 ${mode === "browse" ? "bg-white" : "bg-transparent"}`}
          >
            <Text className={`text-xs font-bold ${mode === "browse" ? "text-ink" : "text-muted"}`}>
              Browse
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setMaybeIndex(0);
              setMode("maybes");
            }}
            className={`rounded-md px-4 py-2 ${mode === "maybes" ? "bg-white" : "bg-transparent"}`}
          >
            <Text className={`text-xs font-bold ${mode === "maybes" ? "text-ink" : "text-muted"}`}>
              Maybes {maybeIds.length}
            </Text>
          </Pressable>
        </View>

        {mode === "browse" && history.length > 0 && (
          <Pressable
            accessibilityLabel="Undo last swipe"
            onPress={undo}
            className="h-9 w-9 items-center justify-center rounded-full bg-white active:bg-ink/5"
          >
            <Ionicons name="arrow-undo" size={18} color="#17201C" />
          </Pressable>
        )}
      </View>

      {currentEvent ? (
        <SwipeCard
          key={`${mode}-${currentEvent.id}-${mode === "maybes" ? maybeIndex : browseIndex}`}
          cardKey={`${mode}-${currentEvent.id}-${mode === "maybes" ? maybeIndex : browseIndex}`}
          onDecision={decide}
        >
          {renderCard(currentEvent, events.findIndex((event) => event.id === currentEvent.id))}
        </SwipeCard>
      ) : (
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-teal/10">
            <Ionicons
              name={mode === "maybes" ? "bookmark-outline" : "restaurant-outline"}
              size={26}
              color="#0D5C63"
            />
          </View>
          <Text className="text-center font-serif text-xl text-ink">
            {mode === "maybes" ? "No maybes yet" : "You've seen every table"}
          </Text>
          <Pressable
            onPress={mode === "maybes" ? () => setMode("browse") : pullMore}
            disabled={pulling}
            className="flex-row items-center gap-2 rounded-lg bg-teal px-5 py-3 active:opacity-80 disabled:opacity-50"
          >
            <Ionicons name={mode === "maybes" ? "albums-outline" : "refresh"} size={18} color="#FFFFFF" />
            <Text className="font-bold text-white">
              {mode === "maybes" ? "Browse tables" : pulling ? "Pulling tables..." : "Pull more"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
