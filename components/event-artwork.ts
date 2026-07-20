import type { ImageSourcePropType } from "react-native";

const artwork: ImageSourcePropType[] = [
  require("../assets/images/intro_table_meeting.png"),
  require("../assets/images/intro_dish_one.png"),
  require("../assets/images/intro_dish_two.png"),
];

export function getEventArtwork(event: { id?: string; format?: string }): ImageSourcePropType {
  const key = `${event.id ?? ""}:${event.format ?? "dinner"}`;
  const hash = Array.from(key).reduce((total, char) => total + char.charCodeAt(0), 0);
  return artwork[hash % artwork.length];
}

export const storyArtwork = require("../assets/images/intro_table_meeting.png");
