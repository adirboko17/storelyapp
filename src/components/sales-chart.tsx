import { useState } from "react";
import { View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { AppText } from "@/components/ui";
import { tokens } from "@/theme/tokens";

function smooth(points: [number, number][]) {
  if (!points.length) return "";
  if (points.length === 1) return `M${points[0][0]},${points[0][1]}`;
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function niceMax(value: number) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 1.5, 2, 3, 5, 10];
  const step = steps.find((item) => item * power >= value) ?? 10;
  return step * power;
}

export function SalesChart({
  current,
  previous,
  label,
  height = 150,
  count = 24,
  xLabels = ["00:00", "12:00", "23:00"],
  grid = tokens.nightLine,
  axisColor = tokens.nightMuted,
  stroke = tokens.chart,
}: {
  current: number[];
  previous?: number[];
  label: (value: number) => string;
  height?: number;
  count?: number;
  xLabels?: string[];
  grid?: string;
  axisColor?: string;
  stroke?: string;
}) {
  const [width, setWidth] = useState(0);
  const axis = 44;
  const chartWidth = Math.max(0, width - axis);
  const top = niceMax(Math.max(1, ...current, ...(previous ?? [])));
  const ticks = [top, (top * 2) / 3, top / 3, 0];
  const plotHeight = height - 20;
  const x = (index: number) => axis + (chartWidth * index) / Math.max(1, count - 1);
  const y = (value: number) => 6 + (plotHeight - 6) * (1 - value / top);
  const line = (values: number[]) => smooth(values.map((value, index) => [x(index), y(value)]));
  return (
    <View style={{ direction: "ltr" }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {ticks.map((tick) => (
            <Line key={tick} x1={axis} x2={width} y1={y(tick)} y2={y(tick)} stroke={grid} strokeWidth={1} />
          ))}
          {previous && previous.length ? <Path d={line(previous.slice(0, count))} stroke={tokens.chartPrevious} strokeWidth={1.6} strokeDasharray="4 4" fill="none" /> : null}
          {current.length ? <Path d={line(current.slice(0, count))} stroke={stroke} strokeWidth={2.2} fill="none" strokeLinecap="round" /> : null}
        </Svg>
      ) : <View style={{ height }} />}
      {width > 0 ? ticks.map((tick) => (
        <AppText key={`label-${tick}`} style={{ position: "absolute", left: 0, top: y(tick) - 8, width: axis - 6, fontSize: 11, color: axisColor, textAlign: "left", writingDirection: "ltr" }}>
          {label(tick)}
        </AppText>
      )) : null}
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingLeft: axis, marginTop: -14 }}>
        {xLabels.map((tick, index) => (
          <AppText key={`${index}-${tick}`} style={{ fontSize: 11, color: axisColor, writingDirection: "ltr" }}>{tick}</AppText>
        ))}
      </View>
    </View>
  );
}
