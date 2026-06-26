import { Pressable, Text } from "react-native";
import type { Option } from "./preferences";

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`h-10 items-center justify-center rounded-full border px-4 ${
        selected ? "border-rust bg-rust" : "border-ink/15 bg-white"
      }`}
    >
      <Text
        className={`text-sm font-medium ${
          selected ? "text-white" : "text-ink"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipGroup<T extends string>({
  options,
  values,
  onChange,
  multi = true,
}: {
  options: Option<T>[];
  values: T[];
  onChange: (next: T[]) => void;
  multi?: boolean;
}) {
  return (
    <>
      {options.map((opt) => {
        const selected = values.includes(opt.value);
        return (
          <Chip
            key={opt.value}
            label={opt.label}
            selected={selected}
            onPress={() => {
              if (multi) {
                onChange(
                  selected
                    ? values.filter((v) => v !== opt.value)
                    : [...values, opt.value],
                );
              } else {
                onChange(selected ? ([] as T[]) : [opt.value]);
              }
            }}
          />
        );
      })}
    </>
  );
}
