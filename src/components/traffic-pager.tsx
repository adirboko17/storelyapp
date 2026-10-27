import { useMemo, useRef, useState } from "react";
import { Modal, PanResponder, Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/icon";
import { SalesChart } from "@/components/sales-chart";
import { AppText } from "@/components/ui";
import { compactCount, compactIls, formatCount, formatIls } from "@/lib/format";
import type { TrafficSnapshot } from "@/lib/remote";
import { useFontSet } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

export type RangeKey = "today" | "yesterday" | "12h" | "7d" | "30d";
type MetricKey = "sales" | "orders" | "conversion" | "sessions" | "aov";
type Format = "money" | "count" | "percent";
type Base = { sales: number[]; orders: number[]; visits: number[] };
type Totals = { sales: number; orders: number; visits: number };

export const RANGES: { id: RangeKey; label: string }[] = [
  { id: "today", label: "היום" },
  { id: "yesterday", label: "אתמול" },
  { id: "12h", label: "12 השעות האחרונות" },
  { id: "7d", label: "7 הימים האחרונים" },
  { id: "30d", label: "30 הימים האחרונים" },
];

const METRICS: { key: MetricKey; label: string; format: Format }[] = [
  { key: "sales", label: "סך המכירות", format: "money" },
  { key: "orders", label: "הזמנות", format: "count" },
  { key: "conversion", label: "שיעור המרה", format: "percent" },
  { key: "sessions", label: "ביקורים", format: "count" },
  { key: "aov", label: "ערך הזמנה ממוצע", format: "money" },
];

const CHART_HEIGHT = 150;
const PAGER_HEIGHT = CHART_HEIGHT + 8;
const STRIP_PAD = 6;
const STRIP_GAP = 6;

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function totals(base: Base): Totals {
  return { sales: sum(base.sales), orders: sum(base.orders), visits: sum(base.visits) };
}

function fill(values: number[], length: number) {
  return Array.from({ length }, (_, index) => values[index] ?? 0);
}

function hourLabel(hour: number) {
  return `${String(((hour % 24) + 24) % 24).padStart(2, "0")}:00`;
}

function dayLabel(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return `${date.getDate()}.${date.getMonth() + 1}`;
}

function windowFor(data: TrafficSnapshot, range: RangeKey, hour: number) {
  const today = { sales: fill(data.today.salesByHour, 24), orders: fill(data.today.ordersByHour, 24), visits: fill(data.today.visitsByHour, 24) };
  const yesterday = { sales: fill(data.yesterday.salesByHour, 24), orders: fill(data.yesterday.ordersByHour, 24), visits: fill(data.yesterday.visitsByHour, 24) };
  const pick = (base: Base, from: number, to: number): Base => ({ sales: base.sales.slice(from, to), orders: base.orders.slice(from, to), visits: base.visits.slice(from, to) });

  if (range === "today") {
    const previous = pick(yesterday, 0, hour + 1);
    return { current: pick(today, 0, hour + 1), previous: yesterday, previousTotals: totals(previous), count: 24, xLabels: ["00:00", "12:00", "23:00"] };
  }
  if (range === "yesterday") {
    const days = data.days;
    const before = days.sales.length >= 3 ? { sales: days.sales[days.sales.length - 3] ?? 0, orders: days.orders[days.orders.length - 3] ?? 0, visits: days.visits[days.visits.length - 3] ?? 0 } : null;
    return { current: yesterday, previous: null, previousTotals: before, count: 24, xLabels: ["00:00", "12:00", "23:00"] };
  }
  if (range === "12h") {
    const both: Base = { sales: [...yesterday.sales, ...today.sales], orders: [...yesterday.orders, ...today.orders], visits: [...yesterday.visits, ...today.visits] };
    const end = 24 + hour;
    const previous = pick(both, end - 23, end - 11);
    return { current: pick(both, end - 11, end + 1), previous, previousTotals: totals(previous), count: 12, xLabels: [hourLabel(hour - 11), hourLabel(hour - 5), hourLabel(hour)] };
  }
  const span = range === "7d" ? 7 : 30;
  const recent = { sales: fill(data.days.sales, 30), orders: fill(data.days.orders, 30), visits: fill(data.days.visits, 30) };
  const earlier = { sales: fill(data.days.previousSales, 30), orders: fill(data.days.previousOrders, 30), visits: fill(data.days.previousVisits, 30) };
  const line: Base = { sales: [...earlier.sales, ...recent.sales], orders: [...earlier.orders, ...recent.orders], visits: [...earlier.visits, ...recent.visits] };
  const previous = pick(line, 60 - span * 2, 60 - span);
  return { current: pick(line, 60 - span, 60), previous, previousTotals: totals(previous), count: span, xLabels: [dayLabel(span - 1), dayLabel(Math.floor((span - 1) / 2)), dayLabel(0)] };
}

function seriesOf(base: Base, key: MetricKey) {
  if (key === "sales") return base.sales;
  if (key === "orders") return base.orders;
  if (key === "sessions") return base.visits;
  if (key === "conversion") return base.orders.map((value, index) => (base.visits[index] ? (value / (base.visits[index] ?? 1)) * 100 : 0));
  return base.orders.map((value, index) => (value ? (base.sales[index] ?? 0) / value : 0));
}

function totalOf(total: Totals, key: MetricKey) {
  if (key === "sales") return total.sales;
  if (key === "orders") return total.orders;
  if (key === "sessions") return total.visits;
  if (key === "conversion") return total.visits ? (total.orders / total.visits) * 100 : 0;
  return total.orders ? total.sales / total.orders : 0;
}

function show(format: Format, value: number) {
  if (format === "money") return formatIls(value);
  if (format === "percent") return `${value.toFixed(1)}%`;
  return formatCount(value);
}

function axis(format: Format) {
  if (format === "money") return compactIls;
  if (format === "percent") return (value: number) => `${Math.round(value)}%`;
  return compactCount;
}

export function buildAnalyticsCards(data: TrafficSnapshot, range: RangeKey, hour: number) {
  const view = windowFor(data, range, hour);
  const now = totals(view.current);
  return METRICS.map((metric) => {
    const value = totalOf(now, metric.key);
    const before = view.previousTotals ? totalOf(view.previousTotals, metric.key) : 0;
    return {
      ...metric,
      numeric: value,
      value: show(metric.format, value),
      change: before ? Math.round(((value - before) / before) * 100) : null,
      current: seriesOf(view.current, metric.key),
      previous: view.previous ? seriesOf(view.previous, metric.key) : undefined,
      count: view.count,
      xLabels: view.xLabels,
    };
  });
}

export function TrafficPager({ data, hour, range, onRange, onLive }: { data: TrafficSnapshot; hour: number; range: RangeKey; onRange: (range: RangeKey) => void; onLive?: () => void }) {
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const [sheet, setSheet] = useState(false);
  const pos = useSharedValue(0);
  const pageWidth = useSharedValue(0);
  const settled = useSharedValue(0);
  const dragFrom = useSharedValue(0);
  const shifts = useSharedValue<number[]>([]);
  const maxShift = useSharedValue(0);
  const tileWidths = useRef<number[]>([]);
  const clipWidth = useRef(0);

  const cards = useMemo(() => buildAnalyticsCards(data, range, hour), [data, range, hour]);

  const pager = useMemo(() => {
    const last = METRICS.length - 1;
    const settle = (target: number) => {
      const next = Math.max(0, Math.min(last, target));
      setPage(next);
      settled.set(next);
      pos.set(withTiming(next, { duration: 260 }));
    };
    const responder = PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
      onPanResponderGrant: () => {
        dragFrom.set(settled.get());
      },
      onPanResponderMove: (_, gesture) => {
        let next = dragFrom.get() + gesture.dx / (pageWidth.get() || 1);
        if (next < 0) next *= 0.3;
        if (next > last) next = last + (next - last) * 0.3;
        pos.set(next);
      },
      onPanResponderRelease: (_, gesture) => {
        const from = dragFrom.get();
        const moved = gesture.dx / (pageWidth.get() || 1);
        if (moved > 0.18 || gesture.vx > 0.35) settle(from + 1);
        else if (moved < -0.18 || gesture.vx < -0.35) settle(from - 1);
        else settle(from);
      },
      onPanResponderTerminate: () => settle(dragFrom.get()),
      onPanResponderTerminationRequest: () => false,
    });
    return { settle, handlers: responder.panHandlers };
  }, [pos, settled, dragFrom, pageWidth]);

  function measureStrip() {
    const widths = tileWidths.current;
    if (widths.length < METRICS.length || widths.some((value) => !value)) return;
    const offsets: number[] = [];
    let run = STRIP_PAD;
    widths.forEach((value) => {
      offsets.push(Math.max(0, run - STRIP_PAD));
      run += value + STRIP_GAP;
    });
    const content = run - STRIP_GAP + STRIP_PAD;
    shifts.set(offsets);
    maxShift.set(Math.max(0, content - clipWidth.current));
  }

  const track = useAnimatedStyle(() => ({ transform: [{ translateX: pos.get() * pageWidth.get() }] }));
  const strip = useAnimatedStyle(() => {
    const list = shifts.get();
    if (!list.length) return { transform: [{ translateX: 0 }] };
    const p = Math.max(0, Math.min(list.length - 1, pos.get()));
    const low = Math.floor(p);
    const high = Math.min(list.length - 1, low + 1);
    const value = (list[low] ?? 0) + ((list[high] ?? 0) - (list[low] ?? 0)) * (p - low);
    return { transform: [{ translateX: Math.min(maxShift.get(), value) }] };
  });

  const label = RANGES.find((item) => item.id === range)?.label ?? "היום";

  return (
    <View style={{ gap: 12 }} {...pager.handlers}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingStart: 12 }}>
        <MetricTile label="כעת באתר" value={formatCount(data.now.visitors)} live onPress={onLive} />
        <View
          style={{ flex: 1, overflow: "hidden" }}
          onLayout={(event) => {
            clipWidth.current = event.nativeEvent.layout.width;
            measureStrip();
          }}
        >
          <Animated.View style={[{ flexDirection: "row", alignSelf: "flex-start", gap: STRIP_GAP, paddingHorizontal: STRIP_PAD }, strip]}>
            {cards.map((card, index) => (
              <View
                key={card.key}
                onLayout={(event) => {
                  tileWidths.current[index] = event.nativeEvent.layout.width;
                  measureStrip();
                }}
              >
                <MetricTile label={card.label} value={card.value} change={card.change} active={page === index} onPress={() => pager.settle(index)} />
              </View>
            ))}
          </Animated.View>
          <LinearGradient pointerEvents="none" colors={[tokens.night, "rgba(0,0,0,0)"]} start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }} style={{ position: "absolute", top: 0, bottom: 0, start: 0, width: 14 }} />
        </View>
      </View>

      <View
        style={{ height: PAGER_HEIGHT, overflow: "hidden", direction: "ltr" }}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width;
          pageWidth.set(next);
          setWidth(next);
        }}
      >
        <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }, track]}>
          {width > 0 ? cards.map((card, index) => (
            <View key={card.key} style={{ position: "absolute", top: 0, left: -index * width, width, paddingHorizontal: 12 }}>
              <SalesChart current={card.current} previous={card.previous} label={axis(card.format)} height={CHART_HEIGHT} count={card.count} xLabels={card.xLabels} />
            </View>
          )) : null}
        </Animated.View>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 }}>
        {METRICS.map((metric, index) => (
          <View key={metric.key} style={{ width: page === index ? 14 : 5, height: 5, borderRadius: 3, backgroundColor: page === index ? "#ffffff" : "#4a4a4a" }} />
        ))}
      </View>

      <View style={{ flexDirection: "row", justifyContent: "center" }}>
        <NightButton icon="calendar" label={label} onPress={() => setSheet(true)} />
      </View>

      <RangeSheet visible={sheet} value={range} onClose={() => setSheet(false)} onPick={(next) => { setSheet(false); onRange(next); }} />
    </View>
  );
}

function MetricTile({ label, value, change, active = false, live = false, onPress }: { label: string; value: string; change?: number | null; active?: boolean; live?: boolean; onPress?: () => void }) {
  const fonts = useFontSet();
  const up = change != null && change >= 0;
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: active ? tokens.nightRaised : live ? tokens.night : "transparent", borderWidth: 1, borderColor: active ? "#3a3a3a" : "transparent", gap: 2 }}>
      <AppText style={{ color: "#e3e3e3", fontSize: 12 }} numberOfLines={1}>{label}</AppText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        {live ? <Icon name="pulse" size={15} color="#36d07c" strokeWidth={1.8} /> : null}
        <AppText style={{ color: "#ffffff", fontFamily: fonts.bold, fontSize: 17, writingDirection: "ltr" }} numberOfLines={1}>{value}</AppText>
        {change != null ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
            <View style={{ transform: [{ scaleY: up ? 1 : -1 }] }}>
              <Icon name="up" size={12} color={up ? "#36d07c" : "#ff6a5c"} strokeWidth={2} />
            </View>
            <AppText style={{ color: up ? "#36d07c" : "#ff6a5c", fontSize: 11, writingDirection: "ltr" }}>{`${up ? "+" : ""}${change}%`}</AppText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function NightButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const fonts = useFontSet();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ height: 36, borderRadius: 10, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: tokens.nightRaised, borderWidth: 1, borderColor: "#3a3a3a", opacity: pressed ? 0.7 : 1 })}>
      <Icon name={icon} size={16} color="#ffffff" strokeWidth={1.7} />
      <AppText style={{ color: "#ffffff", fontFamily: fonts.medium, fontSize: 14 }}>{label}</AppText>
    </Pressable>
  );
}

export function RangeSheet({ visible, value, onClose, onPick }: { visible: boolean; value: RangeKey; onClose: () => void; onPick: (range: RangeKey) => void }) {
  const fonts = useFontSet();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} />
      <View style={{ backgroundColor: tokens.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: Math.max(insets.bottom, 12) + 6, direction: "rtl" }}>
        <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 4 }}>
          <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: "#d4d4d4" }} />
        </View>
        <AppText style={{ fontFamily: fonts.bold, fontSize: 17, color: tokens.inkStrong, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>טווח תאריכים</AppText>
        {RANGES.map((item, index) => (
          <Pressable
            key={item.id}
            onPress={() => onPick(item.id)}
            style={({ pressed }) => ({ minHeight: 54, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", borderTopWidth: index === 0 ? 0 : 1, borderTopColor: tokens.line, backgroundColor: pressed ? tokens.hover : tokens.card })}
          >
            <AppText style={{ flex: 1, fontSize: 16, color: tokens.inkStrong, fontFamily: item.id === value ? fonts.semibold : fonts.regular }}>{item.label}</AppText>
            {item.id === value ? <Icon name="check" size={18} color={tokens.inkStrong} strokeWidth={2.2} /> : null}
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}
