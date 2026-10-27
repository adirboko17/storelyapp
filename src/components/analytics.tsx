import { useMemo, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View, type ScrollViewInstance } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Icon } from "@/components/icon";
import { SalesChart } from "@/components/sales-chart";
import { SearchBar, SheetEmpty } from "@/components/shell";
import { RangeSheet, RANGES, buildAnalyticsCards, type RangeKey } from "@/components/traffic-pager";
import { AppText, ErrorNote, LoadingBlock } from "@/components/ui";
import { REPORTS, buildReport, reportById } from "@/lib/reports";
import { loadTraffic, useStoreCall } from "@/lib/remote";
import { useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, tokens } from "@/theme/tokens";

const PAGE = "#f6f6f7";
const CARD = "#ffffff";
const LINE = "#ececec";
const MUTED = "#8a8a8a";
const UP = "#1f7a4d";
const DOWN = "#8e1f0b";

const PINNED = ["sales-over-time", "orders-over-time", "sales-by-product", "sessions-over-time", "conversion-breakdown", "new-vs-returning"];

const CHARTS: Record<string, "sales" | "orders" | "sessions" | "conversion"> = {
  "sales-over-time": "sales",
  "orders-over-time": "orders",
  "sessions-over-time": "sessions",
  "conversion-breakdown": "conversion",
};

function jerusalemHour() {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" }).format(new Date())) % 24;
}

function ChartFigure({ label, value, change }: { label: string; value: string; change: number | null }) {
  const fonts = useFontSet();
  return (
    <View style={{ paddingHorizontal: 16, direction: "rtl" }}>
      <AppText style={{ fontSize: 14, color: MUTED }}>{label}</AppText>
      <View style={{ paddingTop: 2, flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <AppText style={{ fontFamily: fonts.bold, fontSize: 32, lineHeight: 38, color: tokens.inkStrong, writingDirection: "ltr" }}>{value}</AppText>
        {change != null ? <View style={{ marginBottom: 6 }}><Change value={change} /></View> : null}
      </View>
    </View>
  );
}

function Change({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      <View style={{ transform: [{ scaleY: up ? 1 : -1 }] }}>
        <Icon name="up" size={13} color={up ? UP : DOWN} strokeWidth={2.2} />
      </View>
      <AppText style={{ color: up ? UP : DOWN, fontSize: 13, writingDirection: "ltr" }}>{`${up ? "+" : ""}${value}%`}</AppText>
    </View>
  );
}

export function AnalyticsHome() {
  const fonts = useFontSet();
  const router = useRouter();
  const remote = useStoreCall(loadTraffic);
  const scroller = useRef<ScrollViewInstance>(null);
  const [range, setRange] = useState<RangeKey>("30d");
  const [page, setPage] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [width, setWidth] = useState(0);
  const hour = jerusalemHour();
  const cards = useMemo(() => (remote.data ? buildAnalyticsCards(remote.data, range, hour) : []), [remote.data, range, hour]);
  const rangeLabel = RANGES.find((item) => item.id === range)?.label ?? "30 הימים האחרונים";
  const pinned = PINNED.flatMap((id) => {
    const report = REPORTS.find((item) => item.id === id);
    return report ? [report] : [];
  });

  function select(index: number) {
    setPage(index);
    if (width) scroller.current?.scrollTo({ x: index * width, animated: true });
  }

  if (remote.loading) return <LoadingBlock />;
  if (!remote.data) return <SheetEmpty text={remote.error || "אין נתוני תנועה"} />;

  return (
    <View style={{ flex: 1, backgroundColor: PAGE }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={remote.refreshing} onRefresh={() => void remote.refresh()} tintColor={tokens.inkStrong} colors={[tokens.inkStrong]} />}
        contentContainerStyle={{ paddingBottom: TAB_SPACE + 28 }}
      >
        {remote.error ? <ErrorNote text={remote.error} /> : null}
        <Pressable onPress={() => setSheet(true)} style={({ pressed }) => ({ alignSelf: "flex-start", marginTop: 16, marginHorizontal: 16, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: CARD, borderWidth: 1, borderColor: "#e3e3e3", flexDirection: "row", alignItems: "center", gap: 6, opacity: pressed ? 0.7 : 1 })}>
          <Icon name="calendar" size={16} color={tokens.inkStrong} strokeWidth={1.7} />
          <AppText style={{ fontFamily: fonts.medium, fontSize: 14, color: tokens.inkStrong }}>{rangeLabel}</AppText>
          <Icon name="down" size={14} color={MUTED} strokeWidth={2} />
        </Pressable>
        <AppText style={{ marginHorizontal: 20, marginTop: 8, fontSize: 13, color: MUTED }}>לעומת התקופה הקודמת</AppText>

        <View style={{ marginTop: 12 }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
          {width > 0 ? (
            <ScrollView
              ref={scroller}
              horizontal
              pagingEnabled
              directionalLockEnabled
              showsHorizontalScrollIndicator={false}
              style={{ direction: "ltr" }}
              onMomentumScrollEnd={(event) => {
                const next = Math.round(event.nativeEvent.contentOffset.x / width);
                setPage(Math.max(0, Math.min(cards.length - 1, next)));
              }}
            >
              {cards.map((card) => (
                <View key={card.key} style={{ width, paddingHorizontal: 16 }}>
                  <View style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE, paddingTop: 16, paddingBottom: 8 }}>
                    <ChartFigure label={card.label} value={card.value} change={card.change} />
                    <View style={{ marginTop: 8, paddingHorizontal: 8 }}>
                      <SalesChart
                        current={card.current}
                        previous={card.previous}
                        label={(value) => (card.format === "money" ? `₪${Math.round(value)}` : card.format === "percent" ? `${Math.round(value)}%` : String(Math.round(value)))}
                        height={168}
                        count={card.count}
                        xLabels={card.xLabels}
                        grid="#f0f0f0"
                        axisColor={MUTED}
                        stroke={tokens.link}
                      />
                    </View>
                    <View style={{ flexDirection: "row", gap: 16, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}>
                      <Legend color={tokens.link} label="התקופה" />
                      <Legend color={tokens.chartPrevious} dashed label="התקופה הקודמת" />
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, paddingTop: 12 }}>
          {cards.map((card, index) => (
            <Pressable key={card.key} onPress={() => select(index)} hitSlop={6} style={{ width: page === index ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: page === index ? tokens.inkStrong : "#d0d0d0" }} />
          ))}
        </View>

        <View style={{ marginTop: 16, marginHorizontal: 16, backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE, overflow: "hidden" }}>
          {cards.map((card, index) => (
            <Pressable key={card.key} onPress={() => select(index)} style={({ pressed }) => ({ minHeight: 56, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: index ? 1 : 0, borderTopColor: "#f2f2f2", backgroundColor: pressed || page === index ? "#f7f9fc" : CARD })}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: page === index ? tokens.link : "#d5d5d5" }} />
              <AppText style={{ flex: 1, fontSize: 16, color: tokens.inkStrong, fontFamily: page === index ? fonts.semibold : fonts.regular }}>{card.label}</AppText>
              {card.change != null ? <Change value={card.change} /> : null}
              <AppText style={{ fontFamily: fonts.semibold, fontSize: 15, color: tokens.inkStrong, writingDirection: "ltr" }}>{card.value}</AppText>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 28, paddingBottom: 10 }}>
          <AppText style={{ fontFamily: fonts.bold, fontSize: 18, color: tokens.inkStrong }}>דוחות</AppText>
          <Pressable onPress={() => router.push("/more/area/reports" as Href)} hitSlop={8}>
            <AppText style={{ fontFamily: fonts.medium, fontSize: 16, color: tokens.link }}>הצג הכל</AppText>
          </Pressable>
        </View>
        <View style={{ marginHorizontal: 16, backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE, overflow: "hidden" }}>
          {pinned.map((report, index) => (
            <ReportRow key={report.id} title={report.name} meta={report.category} last={index === pinned.length - 1} onPress={() => router.push(`/more/area/reports/${encodeURIComponent(report.id)}` as Href)} />
          ))}
        </View>
      </ScrollView>
      <RangeSheet visible={sheet} value={range} onClose={() => setSheet(false)} onPick={(next) => { setSheet(false); setRange(next); }} />
    </View>
  );
}

export function ReportsLibrary() {
  const fonts = useFontSet();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const visible = REPORTS.filter((report) => !needle || `${report.name} ${report.category}`.toLowerCase().includes(needle));
    const order: string[] = [];
    visible.forEach((report) => {
      if (!order.includes(report.category)) order.push(report.category);
    });
    return order.map((category) => ({ category, reports: visible.filter((report) => report.category === category) }));
  }, [needle]);

  return (
    <View style={{ flex: 1, backgroundColor: PAGE }}>
      <SearchBar size="large" value={query} onChange={setQuery} placeholder="חיפוש דוחות" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: TAB_SPACE + 28, flexGrow: 1 }}>
        {groups.length ? groups.map((group) => (
          <View key={group.category}>
            <AppText style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 8, fontFamily: fonts.semibold, fontSize: 13, color: tokens.inkSecondary }}>{group.category}</AppText>
            <View style={{ marginHorizontal: 16, backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE, overflow: "hidden" }}>
              {group.reports.map((report, index) => (
                <ReportRow key={report.id} title={report.name} last={index === group.reports.length - 1} onPress={() => router.push(`/more/area/reports/${encodeURIComponent(report.id)}` as Href)} />
              ))}
            </View>
          </View>
        )) : <SheetEmpty text={needle ? "אין תוצאות לחיפוש" : "אין דוחות"} />}
      </ScrollView>
    </View>
  );
}

export function ReportView({ id }: { id: string }) {
  const fonts = useFontSet();
  const { snapshot, loading } = useStoreData();
  const remote = useStoreCall(loadTraffic);
  const report = reportById(id);
  const hour = jerusalemHour();
  const card = useMemo(() => {
    const key = CHARTS[id];
    if (!key || !remote.data) return null;
    return buildAnalyticsCards(remote.data, "30d", hour).find((item) => item.key === key) ?? null;
  }, [id, remote.data, hour]);
  if (loading || remote.loading) return <LoadingBlock />;
  if (!report || !snapshot) return <SheetEmpty text="הדוח לא נמצא." />;
  const built = buildReport(id, snapshot, remote.data);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: PAGE }} contentContainerStyle={{ paddingBottom: TAB_SPACE + 28 }}>
      <AppText style={{ paddingHorizontal: 20, paddingTop: 16, fontSize: 13, color: MUTED }}>{report.category}</AppText>
      {card ? (
        <View style={{ marginTop: 12, marginHorizontal: 16, backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE, paddingTop: 16, paddingBottom: 8 }}>
          <ChartFigure label="30 הימים האחרונים" value={card.value} change={card.change} />
          <View style={{ marginTop: 8, paddingHorizontal: 8 }}>
            <SalesChart
              current={card.current}
              previous={card.previous}
              label={(value) => (card.format === "money" ? `₪${Math.round(value)}` : card.format === "percent" ? `${Math.round(value)}%` : String(Math.round(value)))}
              height={168}
              count={card.count}
              xLabels={card.xLabels}
              grid="#f0f0f0"
              axisColor={MUTED}
              stroke={tokens.link}
            />
          </View>
        </View>
      ) : null}
      {built.missing ? <SheetEmpty text={built.missing} /> : null}
      {built.rows.length ? (
        <View style={{ marginTop: 16, marginHorizontal: 16, backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE, overflow: "hidden" }}>
          {built.rows.map((row, index) => (
            <View key={`${row.label}-${index}`} style={{ minHeight: 52, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: index ? 1 : 0, borderTopColor: "#f2f2f2" }}>
              <AppText style={{ flex: 1, fontSize: 15, color: tokens.inkStrong }} numberOfLines={2}>{row.label}</AppText>
              <AppText style={{ fontFamily: fonts.semibold, fontSize: 15, color: tokens.inkStrong, writingDirection: "ltr" }}>{row.value}</AppText>
            </View>
          ))}
        </View>
      ) : null}
      {!built.missing && !built.rows.length ? <SheetEmpty text="אין נתונים בטווח הזה." /> : null}
    </ScrollView>
  );
}

function Legend({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: color, opacity: dashed ? 0.45 : 1 }} />
      <AppText style={{ fontSize: 12, color: MUTED }}>{label}</AppText>
    </View>
  );
}

function ReportRow({ title, meta, last = false, onPress }: { title: string; meta?: string; last?: boolean; onPress: () => void }) {
  const fonts = useFontSet();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ minHeight: 54, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: "#f2f2f2", backgroundColor: pressed ? "#f7f7f7" : CARD })}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={{ fontSize: 16, color: tokens.inkStrong, fontFamily: fonts.regular }} numberOfLines={2}>{title}</AppText>
        {meta ? <AppText style={{ fontSize: 13, color: MUTED }}>{meta}</AppText> : null}
      </View>
      <Icon name="forward" size={16} color="#c8c8c8" strokeWidth={2} />
    </Pressable>
  );
}
