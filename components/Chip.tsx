import { Pressable, Text } from "react-native";

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
        selected
          ? "border-rust bg-rust"
          : "border-ink/15 bg-white"
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

export function ChipGroup({
  options,
  values,
  onChange,
  multi = true,
}: {
  options: string[];
  values: string[];
  onChange: (next: string[]) => void;
  multi?: boolean;
}) {
  return (
    <>
      {options.map((opt) => {
        const selected = values.includes(opt);
        return (
          <Chip
            key={opt}
            label={opt}
            selected={selected}
            onPress={() => {
              if (multi) {
                onChange(selected ? values.filter((v) => v !== opt) : [...values, opt]);
              } else {
                onChange(selected ? [] : [opt]);
              }
            }}
          />
        );
      })}
    </>
  );
}
