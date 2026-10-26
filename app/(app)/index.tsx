import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/icon";
import { SalesChart } from "@/components/sales-chart";
import { initials, useStatusBar } from "@/components/shell";
import { AppText, Badge, ErrorNote, LoadingBlock, refreshControl } from "@/components/ui";
import { allows } from "@/lib/access";
import { compactCount, compactIls, formatCount, formatIls, hebrewTime } from "@/lib/format";
import { FULFILLMENT_BADGE, PAY_BADGE, knownBadge } from "@/lib/orders";
import { loadTraffic, useStoreCall, type TrafficSnapshot } from "@/lib/remote";
import { useSession } from "@/lib/session";
import { sortedOrders } from "@/lib/snapshot";
import { useStoreData, useStoreTitle } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { SHEET_RADIUS, TAB_SPACE, tokens } from "@/theme/tokens";

type Metric = "sales" | "orders" | "conversion";

function jerusalemHour() {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" }).format(new Date())) % 24;
}

function greeting(hour: number) {
  if (hour < 12) return "בוקר טוב!";
  if (hour < 17) return "צהריים טובים!";
  if (hour < 21) return "ערב טוב!";
  return "לילה טוב!";
}

function sumTo(values: number[], hour: number) {
  return values.slice(0, hour + 1).reduce((sum, value) => sum + value, 0);
}

function delta(current: number, previous: number) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export default function HomeScreen() {
  useStatusBar("light");
  const fonts = useFontSet();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const title = useStoreTitle();
  const { email, memberships, storeId } = useSession();
  const { snapshot, access, loading, refreshing, error, refresh } = useStoreData();
  const canTraffic = allows(access, "analytics.read") || allows(access, "analytics.live");
  const load = useCallback(async (id: string) => (canTraffic ? loadTraffic(id) : null), [canTraffic]);
  const traffic = useStoreCall(load);
  const [metric, setMetric] = useState<Metric>("sales");
  const [day, setDay] = useState<"today" | "yesterday">("today");
  const member = memberships.find((item) => item.storeId === storeId);
  const person = access?.name?.trim() || member?.memberName || email || title;

  const refreshAll = useCallback(() => {
    void refresh();
    void traffic.refresh();
  }, [refresh, traffic]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.night }}>
        <LoadingBlock />
      </View>
    );
  }

  const canOrders = allows(access, "orders.read");
  const orders = canOrders ? snapshot?.orders : undefined;
  const toFulfill = orders?.filter((order) => order.fulfillment && order.fulfillment !== "fulfilled").length;
  const unpaid = orders?.filter((order) => order.pay === "pending").length;
  const soldOut = allows(access, "products.read") ? snapshot?.products?.filter((product) => product.stock === 0 && product.status !== "archived").length : undefined;
  const carts = canOrders ? snapshot?.checkouts?.filter((item) => !item.recovered).length : undefined;
  const recent = orders ? sortedOrders(orders).slice(0, 4) : undefined;
  const hour = jerusalemHour();

  return (
    <View style={{ flex: 1, backgroundColor: tokens.night }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 0 }}
        refreshControl={refreshControl(refreshing || traffic.refreshing, refreshAll)}
        style={{ backgroundColor: tokens.night }}
      >
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={() => router.push("/more")} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#b03bd1", alignItems: "center", justifyContent: "center" }}>
            <AppText style={{ color: "#ffffff", fontFamily: fonts.bold, fontSize: 12 }}>{initials(person)}</AppText>
          </Pressable>
          <AppText style={{ flex: 1, textAlign: "center", color: "#ffffff", fontFamily: fonts.bold, fontSize: 17 }} numberOfLines={1}>{title}</AppText>
          <Pressable onPress={() => router.push("/orders")} hitSlop={8} style={{ width: 32, alignItems: "center" }}>
            <Icon name="bell" size={22} color="#ffffff" strokeWidth={1.7} />
          </Pressable>
        </View>
        {canTraffic ? (
          <TrafficPanel
            data={traffic.data}
            loading={traffic.loading}
            error={traffic.error}
            metric={metric}
            onMetric={setMetric}
            day={day}
            onDay={() => setDay(day === "today" ? "yesterday" : "today")}
            hour={hour}
            onReport={() => router.push("/more/area/reports/sales-over-time" as Href)}
          />
        ) : null}
        <View style={{ flex: 1, backgroundColor: tokens.canvas, borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS, paddingHorizontal: 14, paddingTop: 18, paddingBottom: TAB_SPACE + 20, gap: 12, marginTop: 10 }}>
          <AppText style={{ fontSize: 20, fontFamily: fonts.bold, color: tokens.inkStrong }}>
            {greeting(hour)} <AppText style={{ fontSize: 20, fontFamily: fonts.regular, color: tokens.inkStrong }}>הנה הפעילות שלך</AppText>
          </AppText>
          {error ? <ErrorNote text={error} /> : null}
          {toFulfill != null ? <TaskRow icon="orders" label="הזמנות לטיפול" count={toFulfill} onPress={() => router.push("/orders?tab=unfulfilled" as Href)} /> : null}
          {unpaid ? <TaskRow icon="orders" label="הזמנות שממתינות לתשלום" count={unpaid} onPress={() => router.push("/orders?tab=unpaid" as Href)} /> : null}
          {soldOut ? <TaskRow icon="tag" label="מוצרים שאזלו מהמלאי" count={soldOut} onPress={() => router.push("/more/area/inventory" as Href)} /> : null}
          {carts ? <TaskRow icon="orders" label="עגלות נטושות" count={carts} onPress={() => router.push("/more/area/abandoned" as Href)} /> : null}
          {recent && recent.length ? (
            <View style={{ backgroundColor: tokens.card, borderRadius: 14, borderWidth: 1, borderColor: tokens.line, overflow: "hidden" }}>
              <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 }}>
                <AppText style={{ flex: 1, fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }}>הזמנות אחרונות</AppText>
                <Pressable onPress={() => router.push("/orders")} hitSlop={8}>
                  <AppText style={{ color: tokens.link, fontFamily: fonts.medium }}>הכל</AppText>
                </Pressable>
              </View>
              {recent.map((order) => {
                const fulfillment = knownBadge(FULFILLMENT_BADGE, order.fulfillment);
                const pay = knownBadge(PAY_BADGE, order.pay);
                return (
                  <Pressable key={order.number} onPress={() => router.push(`/orders/${order.number}`)} style={{ paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: 1, borderTopColor: tokens.line, gap: 5 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <AppText style={{ fontFamily: fonts.bold, color: tokens.inkStrong, fontSize: 15 }}>#{order.number}</AppText>
                      <AppText style={{ flex: 1, color: tokens.inkSecondary, fontSize: 13 }} numberOfLines={1}>{[order.customerName, hebrewTime(order.createdAt)].filter(Boolean).join(" • ")}</AppText>
                      {order.total != null ? <AppText style={{ color: tokens.inkStrong, writingDirection: "ltr" }}>{formatIls(order.total)}</AppText> : null}
                    </View>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {fulfillment ? <Badge {...fulfillment} /> : null}
                      {pay ? <Badge {...pay} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {toFulfill == null && !recent ? <AppText style={{ color: tokens.inkSecondary }}>אין פעילות להצגה.</AppText> : null}
        </View>
      </ScrollView>
    </View>
  );
}

function TrafficPanel({
  data,
  loading,
  error,
  metric,
  onMetric,
  day,
  onDay,
  hour,
  onReport,
}: {
  data: TrafficSnapshot | null;
  loading: boolean;
  error: string;
  metric: Metric;
  onMetric: (metric: Metric) => void;
  day: "today" | "yesterday";
  onDay: () => void;
  hour: number;
  onReport: () => void;
}) {
  const view = useMemo(() => {
    if (!data) return null;
    const today = data.today;
    const yesterday = data.yesterday;
    const salesPrev = sumTo(yesterday.salesByHour, hour);
    const ordersPrev = sumTo(yesterday.ordersByHour, hour);
    const visitsPrev = sumTo(yesterday.visitsByHour, hour);
    const conversion = today.visits ? (today.orders / today.visits) * 100 : 0;
    const conversionPrev = visitsPrev ? (ordersPrev / visitsPrev) * 100 : 0;
    return {
      live: data.now.visitors,
      sales: today.sales,
      salesDelta: delta(today.sales, salesPrev),
      orders: today.orders,
      ordersDelta: delta(today.orders, ordersPrev),
      conversion,
      conversionDelta: delta(conversion, conversionPrev),
    };
  }, [data, hour]);

  if (loading) return <View style={{ height: 250 }} />;
  if (!data || !view) {
    return error ? <AppText style={{ color: tokens.nightMuted, paddingHorizontal: 16, paddingBottom: 8 }}>{error}</AppText> : null;
  }

  const source = day === "today" ? data.today : data.yesterday;
  const series = metric === "sales" ? source.salesByHour : metric === "orders" ? source.ordersByHour : source.visitsByHour;
  const previous = day === "today" ? (metric === "sales" ? data.yesterday.salesByHour : metric === "orders" ? data.yesterday.ordersByHour : data.yesterday.visitsByHour) : undefined;
  const current = day === "today" ? series.slice(0, hour + 1) : series;

  return (
    <View style={{ gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}>
        <MetricTile label="כעת באתר" value={formatCount(view.live)} live />
        <MetricTile label="סך המכירות" value={formatIls(view.sales)} change={view.salesDelta} active={metric === "sales"} onPress={() => onMetric("sales")} />
        <MetricTile label="הזמנות" value={formatCount(view.orders)} change={view.ordersDelta} active={metric === "orders"} onPress={() => onMetric("orders")} />
        <MetricTile label="שיעור המרה" value={`${Math.round(view.conversion)}%`} change={view.conversionDelta} active={metric === "conversion"} onPress={() => onMetric("conversion")} />
      </ScrollView>
      <View style={{ paddingHorizontal: 12 }}>
        <SalesChart current={current} previous={previous} label={metric === "sales" ? compactIls : compactCount} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
        <NightButton icon="calendar" label={day === "today" ? "היום" : "אתמול"} onPress={onDay} />
        <NightButton icon="report" label="צפייה בדוח" onPress={onReport} />
      </View>
    </View>
  );
}

function MetricTile({ label, value, change, active = false, live = false, onPress }: { label: string; value: string; change?: number | null; active?: boolean; live?: boolean; onPress?: () => void }) {
  const fonts = useFontSet();
  const up = change != null && change >= 0;
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: active ? tokens.nightRaised : "transparent", borderWidth: 1, borderColor: active ? "#3a3a3a" : "transparent", gap: 2 }}>
      <AppText style={{ color: "#e3e3e3", fontSize: 12 }}>{label}</AppText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        {live ? <Icon name="pulse" size={15} color="#36d07c" strokeWidth={1.8} /> : null}
        <AppText style={{ color: "#ffffff", fontFamily: fonts.bold, fontSize: 17, writingDirection: "ltr" }}>{value}</AppText>
        {change != null ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
            <Icon name="up" size={12} color={up ? "#36d07c" : "#ff6a5c"} strokeWidth={2} />
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
    <Pressable onPress={onPress} style={{ height: 34, borderRadius: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: tokens.nightRaised, borderWidth: 1, borderColor: "#3a3a3a" }}>
      <Icon name={icon} size={16} color="#ffffff" strokeWidth={1.7} />
      <AppText style={{ color: "#ffffff", fontFamily: fonts.medium, fontSize: 14 }}>{label}</AppText>
    </Pressable>
  );
}

function TaskRow({ icon, label, count, onPress }: { icon: IconName; label: string; count: number; onPress: () => void }) {
  const fonts = useFontSet();
  return (
    <Pressable onPress={onPress} style={{ height: 48, borderRadius: 12, backgroundColor: tokens.card, borderWidth: 1, borderColor: tokens.line, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 }}>
      <Icon name={icon} size={18} color={tokens.inkSecondary} />
      <AppText style={{ flex: 1, fontFamily: fonts.medium, color: tokens.inkStrong }}>{label}</AppText>
      <AppText style={{ fontFamily: fonts.semibold, color: tokens.inkStrong }}>{formatCount(count)}</AppText>
      <Icon name="forward" size={16} color={tokens.inkSecondary} />
    </Pressable>
  );
}
