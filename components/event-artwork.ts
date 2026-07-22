import type { ImageSourcePropType } from "react-native";

const artwork: ImageSourcePropType[] = [
  require("../assets/images/restaurant_glasshouse.png"),
  require("../assets/images/restaurant_courtyard.png"),
  require("../assets/images/restaurant_izakaya.png"),
  require("../assets/images/restaurant_rooftop.png"),
  require("../assets/images/restaurant_chefs_table.png"),
  require("../assets/images/restaurant_supper_club.png"),
];

export function getEventArtwork(
  event: { id?: string; format?: string },
  position?: number,
): ImageSourcePropType {
  if (typeof position === "number") return artwork[position % artwork.length];
  const key = `${event.id ?? ""}:${event.format ?? "dinner"}`;
  const hash = Array.from(key).reduce((total, char) => total + char.charCodeAt(0), 0);
  return artwork[hash % artwork.length];
}

export const storyArtwork = require("../assets/images/restaurant_courtyard.png");
export const homeHeroArtwork = require("../assets/images/restaurant_rooftop.png");
export const rouletteArtwork = require("../assets/images/restaurant_supper_club.png");
