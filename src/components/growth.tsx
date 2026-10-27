import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { useRouter, type Href } from "expo-router";
import { Icon } from "@/components/icon";
import { SheetEmpty } from "@/components/shell";
import { AppText, ErrorNote, LoadingBlock, refreshControl } from "@/components/ui";
import { formatCount, formatIls } from "@/lib/format";
import { useStoreCall, loadAttribution, type ChannelRow } from "@/lib/remote";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, tokens } from "@/theme/tokens";

const PAGE = "#f6f6f7";
const LINE = "#ececec";
const MUTED = "#8a8a8a";
const ATTRIBUTION = "/more/area/attribution" as Href;
const TYPE_ORDER = ["ישיר", "ממומן", "אורגני", "לא ידוע"] as const;
const TYPE_COLORS: Record<string, string> = {
  ישיר: "#1fa7e8",
  ממומן: "#6b3fe0",
  אורגני: "#4f7fe8",
  "לא ידוע": "#d63fb0",
};
const SERIES_COLORS = ["#2a5bd7", "#1fa7e8", "#6b3fe0", "#0c5132", "#8e1f0b"];
const GRAINS = ["יומי", "שבועי", "חודשי"] as const;

type Grain = (typeof GRAINS)[number];

const card = {
  backgroundColor: "#ffffff",
  borderRadius: 16,
  borderWidth: 1,
  borderColor: LINE,
} as const;

function useChannels() {
  return useStoreCall(loadAttribution);
}

function sumDays(rows: ChannelRow[]) {
  const length = Math.max(30, ...rows.map((row) => row.days.length), 0);
  return Array.from({ length }, (_, index) => rows.reduce((sum, row) => sum + (row.days[index] ?? 0), 0));
}

function spark(values: number[], width: number, height: number) {
  const max = Math.max(...values, 1);
  const pad = 3;
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = pad + (height - pad * 2) * (1 - value / max);
      return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function bucket(days: number[], size: number) {
  const groups: number[] = [];
  for (let index = 0; index < days.length; index += size) {
    groups.push(days.slice(index, index + size).reduce((sum, value) => sum + value, 0));
  }
  return groups.length ? groups : [0];
}

function seriesFor(days: number[], grain: Grain) {
  if (grain === "שבועי") return bucket(days, 7);
  if (grain === "חודשי") return bucket(days, 30);
  return days.length ? days : [0];
}

function linePath(values: number[], max: number) {
  const yOf = (value: number) => 168 - (max ? (value / max) * 148 : 0);
  if (values.length < 2) return `M0 ${yOf(values[0] ?? 0).toFixed(1)} L1000 ${yOf(values[0] ?? 0).toFixed(1)}`;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 1000;
      return `${index ? "L" : "M"}${x.toFixed(1)} ${yOf(value).toFixed(1)}`;
    })
    .join(" ");
}

function trafficTypes(rows: ChannelRow[]) {
  const visits = rows.reduce((sum, row) => sum + row.visits, 0);
  const known = TYPE_ORDER.map((label) => ({
    label,
    value: rows.filter((row) => row.type === label).reduce((sum, row) => sum + row.visits, 0),
    color: TYPE_COLORS[label] ?? MUTED,
  }));
  const other = Math.max(0, visits - known.reduce((sum, type) => sum + type.value, 0));
  return other ? [...known, { label: "אחר", value: other, color: MUTED }] : known;
}

function Sparkline({ values, color, height = 52 }: { values: number[]; color: string; height?: number }) {
  const [width, setWidth] = useState(0);
  const points = values.length ? values : [0];
  return (
    <View style={{ direction: "ltr" }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Path d={spark(points, width, height)} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      ) : <View style={{ height }} />}
    </View>
  );
}

function Pill({ label, onPress }: { label: string; onPress?: () => void }) {
  const fonts = useFontSet();
  const body = (
    <View style={{ height: 32, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#ebebeb", flexDirection: "row", alignItems: "center", gap: 4 }}>
      <AppText style={{ fontFamily: fonts.semibold, fontSize: 13, color: tokens.inkStrong }}>{label}</AppText>
      {onPress ? <Icon name="down" size={13} color={tokens.inkStrong} strokeWidth={2.2} /> : null}
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>{body}</Pressable>;
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const fonts = useFontSet();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}>
      <AppText style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }}>{title}</AppText>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <AppText style={{ fontFamily: fonts.semibold, fontSize: 14, color: tokens.link }}>{action}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function GrowthChannels() {
  const fonts = useFontSet();
  const router = useRouter();
  const remote = useChannels();
  const [hero, setHero] = useState(true);
  const rows = useMemo(
    () => [...(remote.data ?? [])].sort((a, b) => b.sales - a.sales || b.orders - a.orders),
    [remote.data],
  );
  const sales = rows.reduce((sum, row) => sum + row.sales, 0);
  const orders = rows.reduce((sum, row) => sum + row.orders, 0);
  const visits = rows.reduce((sum, row) => sum + row.visits, 0);
  const types = trafficTypes(rows);
  const days = sumDays(rows);
  const leader = rows[0];

  function openAttribution() {
    router.navigate(ATTRIBUTION);
  }

  if (remote.loading && !remote.data) return <LoadingBlock />;
  if (!remote.data) return <SheetEmpty icon="growth" text={remote.error || "אין נתוני צמיחה"} />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: PAGE }}
      contentContainerStyle={{ padding: 16, paddingBottom: TAB_SPACE + 24, gap: 14 }}
      refreshControl={refreshControl(remote.refreshing, () => void remote.refresh())}
    >
      {remote.error ? <ErrorNote text={remote.error} /> : null}
      {hero ? (
        <View style={{ gap: 12, paddingBottom: 4 }}>
          <Pressable onPress={() => setHero(false)} hitSlop={8} style={({ pressed }) => ({ alignSelf: "flex-end", opacity: pressed ? 0.6 : 1 })}>
            <View style={{ height: 30, paddingHorizontal: 10, borderRadius: 10, backgroundColor: "#ebebeb", justifyContent: "center" }}>
              <AppText style={{ fontFamily: fonts.semibold, fontSize: 13 }}>הסתרה</AppText>
            </View>
          </Pressable>
          <AppText style={{ fontFamily: fonts.bold, fontSize: 24, lineHeight: 32, color: tokens.inkStrong }}>מאיפה מגיעות המכירות</AppText>
          <AppText style={{ fontSize: 15, lineHeight: 22, color: tokens.ink }}>הערוצים ששלחו קונים לחנות ב-30 הימים האחרונים. ישיר, ממומן, אורגני, וכל מקור אחר שנרשם בכניסה.</AppText>
          <Pressable onPress={openAttribution} style={({ pressed }) => ({ alignSelf: "flex-start", height: 36, paddingHorizontal: 16, borderRadius: 10, backgroundColor: tokens.inkStrong, justifyContent: "center", opacity: pressed ? 0.8 : 1 })}>
            <AppText style={{ color: "#ffffff", fontFamily: fonts.semibold, fontSize: 14 }}>לפרטים</AppText>
          </Pressable>
          <View style={{ marginTop: 4, borderRadius: 16, backgroundColor: "#2a2a2a", padding: 14, gap: 8 }}>
            <AppText style={{ color: "#b5b5b5", fontSize: 12 }}>מכירות לפי ערוץ</AppText>
            <AppText style={{ color: "#ffffff", fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, writingDirection: "ltr", textAlign: "right" }}>{formatIls(sales)}</AppText>
            <Sparkline values={days} color="#36d399" />
            <View style={{ alignSelf: "flex-start", borderRadius: 10, backgroundColor: "#3a3a3a", paddingHorizontal: 8, paddingVertical: 3 }}>
              <AppText style={{ color: "#e3e3e3", fontSize: 12 }} numberOfLines={1}>{leader ? leader.channel : "30 הימים האחרונים"}</AppText>
            </View>
          </View>
        </View>
      ) : null}

      <View style={{ gap: 10 }}>
        <SectionTitle title="ביצועים" action="לפרטים" onAction={openAttribution} />
        <Pill label="30 הימים האחרונים" />
      </View>

      <View style={[card, { padding: 16, gap: 8 }]}>
        <AppText style={{ fontFamily: fonts.semibold, fontSize: 14, textDecorationLine: "underline", textDecorationStyle: "dotted", textDecorationColor: MUTED }}>מכירות שיוחסו לשיווק</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 6 }}>
          <AppText style={{ fontFamily: fonts.bold, fontSize: 26, lineHeight: 34, color: tokens.inkStrong, writingDirection: "ltr" }}>{formatIls(sales)}</AppText>
          <AppText style={{ fontSize: 14, color: tokens.ink }}>מתוך <AppText style={{ fontFamily: fonts.bold, fontSize: 14 }}>{formatCount(orders)}</AppText> הזמנות שיוחסו</AppText>
        </View>
        <Sparkline values={days} color="#1fa7e8" height={64} />
      </View>

      <View style={[card, { padding: 16, gap: 14 }]}>
        <AppText style={{ fontFamily: fonts.semibold, fontSize: 14, textDecorationLine: "underline", textDecorationStyle: "dotted", textDecorationColor: MUTED }}>ביקורים לפי סוג תנועה</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
          {types.map((type) => (
            <View key={type.label} style={{ minWidth: 72, gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: type.color }} />
                <AppText style={{ fontSize: 12, color: "#4a4a4a" }}>{type.label}</AppText>
              </View>
              <AppText style={{ fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }}>{formatCount(type.value)}</AppText>
            </View>
          ))}
        </View>
        {visits > 0 ? (
          <View style={{ flexDirection: "row", height: 52, gap: 3 }}>
            {types.filter((type) => type.value > 0).map((type) => (
              <View key={type.label} style={{ flex: type.value, borderRadius: 4, backgroundColor: type.color }} />
            ))}
          </View>
        ) : <View style={{ height: 52, borderRadius: 8, backgroundColor: "#f1f1f1" }} />}
      </View>

      <SectionTitle title="מכירות לפי ערוץ שיווק" action="הצגת הכל" onAction={openAttribution} />
      <View style={[card, { overflow: "hidden" }]}>
        <View style={{ minHeight: 36, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", backgroundColor: "#f7f7f7", gap: 8 }}>
          <AppText style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: "#4a4a4a" }}>ערוץ</AppText>
          <AppText style={{ width: 64, fontFamily: fonts.semibold, fontSize: 13, color: "#4a4a4a", textAlign: "left" }}>הזמנות</AppText>
          <AppText style={{ width: 88, fontFamily: fonts.semibold, fontSize: 13, color: "#4a4a4a", textAlign: "left" }}>מכירות</AppText>
        </View>
        {rows.length === 0 ? (
          <AppText style={{ paddingHorizontal: 14, paddingVertical: 22, color: tokens.inkSecondary }}>אין עדיין מכירות מערוצי שיווק</AppText>
        ) : rows.map((row) => (
          <View key={`${row.channel}-${row.type}`} style={{ paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderTopColor: "#f1f1f1" }}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText style={{ fontFamily: fonts.semibold, fontSize: 15, color: tokens.inkStrong }} numberOfLines={1}>{row.channel}</AppText>
              <AppText style={{ fontSize: 12, color: "#4a4a4a" }} numberOfLines={1}>{row.type || "לא ידוע"}</AppText>
            </View>
            <AppText style={{ width: 64, textAlign: "left", writingDirection: "ltr", fontSize: 14 }}>{formatCount(row.orders)}</AppText>
            <AppText style={{ width: 88, textAlign: "left", writingDirection: "ltr", fontFamily: fonts.bold, fontSize: 14, color: tokens.inkStrong }}>{formatIls(row.sales)}</AppText>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function AttributionChannels() {
  const fonts = useFontSet();
  const remote = useChannels();
  const [grain, setGrain] = useState<Grain>("יומי");
  const [hidden, setHidden] = useState<number[]>([]);
  const [banner, setBanner] = useState(true);
  const [asc, setAsc] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);
  const ranked = useMemo(
    () => [...(remote.data ?? [])].sort((a, b) => asc ? a.visits - b.visits : b.visits - a.visits),
    [asc, remote.data],
  );
  const top = useMemo(
    () => [...(remote.data ?? [])].sort((a, b) => b.visits - a.visits).slice(0, 5),
    [remote.data],
  );
  const series = top.map((row) => seriesFor(row.days, grain));
  const max = Math.max(...series.flat(), 1);

  function cycleGrain() {
    setGrain((current) => GRAINS[(GRAINS.indexOf(current) + 1) % GRAINS.length] ?? "יומי");
  }

  function toggleSeries(index: number) {
    setHidden((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index]);
  }

  if (remote.loading && !remote.data) return <LoadingBlock />;
  if (!remote.data) return <SheetEmpty icon="growth" text={remote.error || "אין נתוני ייחוס"} />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: PAGE }}
      contentContainerStyle={{ padding: 16, paddingBottom: TAB_SPACE + 24, gap: 12 }}
      refreshControl={refreshControl(remote.refreshing, () => void remote.refresh())}
    >
      {remote.error ? <ErrorNote text={remote.error} /> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Pill label={grain} onPress={cycleGrain} />
        <Pill label="קליק אחרון ללא ישיר" />
      </View>
      {banner ? (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 14, backgroundColor: "#d8f3fb", paddingHorizontal: 14, paddingVertical: 12 }}>
          <AppText style={{ flex: 1, fontSize: 14, lineHeight: 20, color: "#0b3b4b" }}>הייחוס מבוסס על ביקורים ב-30 הימים האחרונים. כניסה ישירה לא מוחקת קמפיין או הפניה שכבר נרשמו.</AppText>
          <Pressable onPress={() => setBanner(false)} hitSlop={8} accessibilityLabel="סגירה">
            <Icon name="close" size={16} color="#0b3b4b" strokeWidth={2} />
          </Pressable>
        </View>
      ) : null}

      <View style={[card, { padding: 16, gap: 12 }]}>
        <AppText style={{ fontFamily: fonts.semibold, fontSize: 15, color: tokens.inkStrong }}>ביקורים לפי הערוצים המובילים</AppText>
        {top.length === 0 ? <AppText style={{ color: tokens.inkSecondary, paddingVertical: 18 }}>אין ביקורים ב-30 הימים האחרונים.</AppText> : (
          <View style={{ direction: "ltr" }} onLayout={(event) => setChartWidth(event.nativeEvent.layout.width)}>
            {chartWidth > 0 ? (
              <Svg width={chartWidth} height={180} viewBox="0 0 1000 180">
                {[0, 1, 2, 3].map((tick) => (
                  <Line key={tick} x1={0} x2={1000} y1={20 + tick * 46} y2={20 + tick * 46} stroke="#f1f1f1" strokeWidth={1} />
                ))}
                {series.map((values, index) => (
                  <Path
                    key={top[index]?.channel ?? index}
                    d={linePath(values, max)}
                    fill="none"
                    stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                    strokeWidth={index === 0 ? 2.4 : 1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={hidden.includes(index) ? 0 : 1}
                  />
                ))}
              </Svg>
            ) : <View style={{ height: 180 }} />}
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <AppText style={{ fontSize: 11, color: MUTED }}>לפני 30 יום</AppText>
              <AppText style={{ fontSize: 11, color: MUTED }}>היום</AppText>
            </View>
          </View>
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, direction: "rtl" }}>
          {top.map((row, index) => (
            <Pressable key={`${row.channel}-${row.type}`} onPress={() => toggleSeries(index)} style={{ flexDirection: "row", alignItems: "center", gap: 6, direction: "rtl", opacity: hidden.includes(index) ? 0.4 : 1 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length] }} />
              <AppText style={{ fontSize: 13, color: tokens.inkStrong }} numberOfLines={1}>{row.channel}</AppText>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable onPress={() => setAsc((value) => !value)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 }}>
        <AppText style={{ fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }}>ערוצים</AppText>
        <AppText style={{ fontSize: 13, color: MUTED }}>{asc ? "ביקורים ▲" : "ביקורים ▼"}</AppText>
      </Pressable>

      {ranked.length === 0 ? (
        <View style={[card, { padding: 18 }]}>
          <AppText style={{ color: tokens.inkSecondary }}>עדיין אין ביקורים להציג.</AppText>
        </View>
      ) : ranked.map((row, index) => {
        const conversion = row.visits ? (row.orders / row.visits) * 100 : 0;
        const average = row.orders ? row.sales / row.orders : 0;
        const color = SERIES_COLORS[index % SERIES_COLORS.length] ?? SERIES_COLORS[0];
        const metrics = [
          { label: "ביקורים", value: formatCount(row.visits) },
          { label: "מכירות", value: formatIls(row.sales) },
          { label: "הזמנות", value: formatCount(row.orders) },
          { label: "המרה", value: `${conversion.toFixed(1)}%` },
          { label: "ממוצע הזמנה", value: formatIls(average) },
          { label: "חדשים", value: formatCount(row.fresh) },
          { label: "חוזרים", value: formatCount(row.returning) },
        ];
        return (
          <View key={`${row.channel}-${row.type}`} style={[card, { padding: 14, gap: 4 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
                <AppText style={{ color: "#ffffff", fontFamily: fonts.bold, fontSize: 13 }}>{row.channel.slice(0, 1)}</AppText>
              </View>
              <View style={{ flex: 1, gap: 1 }}>
                <AppText style={{ fontFamily: fonts.semibold, fontSize: 16, color: tokens.inkStrong }} numberOfLines={1}>{row.channel}</AppText>
                <AppText style={{ fontSize: 13, color: "#4a4a4a" }}>{row.type || "לא ידוע"}</AppText>
              </View>
            </View>
            {metrics.map((metric) => (
              <View key={metric.label} style={{ minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, borderTopWidth: 1, borderTopColor: "#f3f3f3" }}>
                <AppText style={{ flex: 1, fontSize: 14, color: "#4a4a4a" }}>{metric.label}</AppText>
                <AppText style={{ fontFamily: fonts.semibold, fontSize: 15, color: tokens.inkStrong, writingDirection: "ltr" }}>{metric.value}</AppText>
              </View>
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}
