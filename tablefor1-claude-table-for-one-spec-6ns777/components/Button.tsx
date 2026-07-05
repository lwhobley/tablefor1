import { ActivityIndicator, Pressable, Text } from "react-native";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, { base: string; text: string }> = {
  primary: {
    base: "bg-rust active:bg-rust/80 disabled:bg-muted/40",
    text: "text-white",
  },
  secondary: {
    base: "bg-clay/20 active:bg-clay/30 disabled:bg-muted/20",
    text: "text-rust",
  },
  ghost: {
    base: "bg-transparent active:bg-ink/5",
    text: "text-ink",
  },
};

export function Button({
  label,
  onPress,
  loading,
  disabled,
  variant = "primary",
}: {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
}) {
  const v = variants[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`h-12 items-center justify-center rounded-2xl px-5 ${v.base}`}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text className={`text-base font-semibold ${v.text}`}>{label}</Text>
      )}
    </Pressable>
  );
}
