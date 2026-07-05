import { Text, View } from "react-native";

export function StepHeader({
  step,
  total,
  title,
  subtitle,
}: {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
}) {
  const pct = Math.round((step / total) * 100);
  return (
    <View className="gap-3">
      <View className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
        <View
          className="h-1.5 rounded-full bg-rust"
          style={{ width: `${pct}%` }}
        />
      </View>
      <Text className="text-xs uppercase tracking-widest text-ink/50">
        Step {step} of {total}
      </Text>
      <Text className="font-serif text-3xl text-ink">{title}</Text>
      {subtitle && <Text className="text-base text-ink/60">{subtitle}</Text>}
    </View>
  );
}
