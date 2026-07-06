import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";

export function TableFor2Logo({
  width = 320,
}: {
  width?: number;
}) {
  const height = width * 0.55;
  const scale = width / 320;

  return (
    <Svg width={width} height={height} viewBox="0 0 320 176">
      <G transform="translate(0 0)">
        <SvgText
          x="201"
          y="82"
          fill="#c39443"
          fontSize={108}
          fontWeight="700"
          textAnchor="middle"
          fontFamily="Georgia"
        >
          2
        </SvgText>

        <Line
          x1="101"
          y1="89"
          x2="205"
          y2="89"
          stroke="#1f1b16"
          strokeWidth={5}
          strokeLinecap="round"
        />
        <Path
          d="M153 89 C145 101 141 114 139 133"
          stroke="#1f1b16"
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
        />
        <Path
          d="M177 89 C185 101 189 114 191 133"
          stroke="#1f1b16"
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
        />
        <Line
          x1="130"
          y1="134"
          x2="200"
          y2="134"
          stroke="#1f1b16"
          strokeWidth={5}
          strokeLinecap="round"
        />
        <Circle cx="153" cy="78" r="11" fill="#fff7ed" stroke="#1f1b16" strokeWidth={4} />
        <Line x1="183" y1="68" x2="183" y2="88" stroke="#1f1b16" strokeWidth={3} strokeLinecap="round" />
        <Path d="M180 68 C183 59 187 66 183 68" fill="#d7b56d" />

        <Path
          d="M87 83 C70 86 62 101 67 126 M65 101 L98 101 M98 101 L91 133"
          stroke="#1f1b16"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path
          d="M235 83 C252 86 260 101 255 126 M257 101 L224 101 M224 101 L231 133"
          stroke="#1f1b16"
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </G>

      <SvgText
        x="98"
        y="166"
        fill="#1f1b16"
        fontSize={44 * scale}
        fontWeight="700"
        textAnchor="middle"
        fontFamily="Georgia"
      >
        TABLE
      </SvgText>
      <SvgText
        x="177"
        y="166"
        fill="#c39443"
        fontSize={36 * scale}
        fontStyle="italic"
        textAnchor="middle"
        fontFamily="Georgia"
      >
        for
      </SvgText>
      <SvgText
        x="242"
        y="166"
        fill="#c39443"
        fontSize={44 * scale}
        fontWeight="700"
        textAnchor="middle"
        fontFamily="Georgia"
      >
        2
      </SvgText>
    </Svg>
  );
}
