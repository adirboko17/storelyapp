import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { AccountSheet } from "@/components/account-sheet";
import { Icon, type IconName } from "@/components/icon";
import { SalesChart } from "@/components/sales-chart";
import { initials, useStatusBar } from "@/components/shell";
import { useTabHeader } from "@/components/tab-header";
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
  if (hour < 5) return "לילה טוב";
  if (hour < 12) return "בוקר טוב";
  if (hour < 17) return "צהריים טובים";
  if (hour < 21) return "ערב טוב";
  return "לילה טוב";
}

function firstName(name: string | null | undefined) {
  const clean = name?.trim() ?? "";
  if (!clean || clean.includes("@")) return "";
  return clean.split(/\s+/)[0] ?? "";
}

const HOME_BG = tokens.canvas;

type Task = { key: string; icon: IconName; label: string; count: number; tint: string; ink: string; onPress: () => void };

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
  const title = useStoreTitle();
  const { email, memberships, storeId, selectStore, signOut } = useSession();
  const [accountsOpen, setAccountsOpen] = useState(false);
  const { snapshot, access, loading, refreshing, error, refresh } = useStoreData();
  const canTraffic = allows(access, "analytics.read") || allows(access, "analytics.live");
  const load = useCallback(async (id: string) => (canTraffic ? loadTraffic(id) : null), [canTraffic]);
  const traffic = useStoreCall(load);
  const [metric, setMetric] = useState<Metric>("sales");
  const [day, setDay] = useState<"today" | "yesterday">("today");
  const member = memberships.find((item) => item.storeId === storeId);
  const person = access?.name?.trim() || member?.memberName || email || title;
  const name = firstName(access?.name || member?.memberName);

  const refreshAll = useCallback(() => {
    void refresh();
    void traffic.refresh();
  }, [refresh, traffic]);
  const tasks = useMemo(() => {
    const canOrders = allows(access, "orders.read");
    const orderList = canOrders ? snapshot?.orders : undefined;
    return {
      toFulfill: orderList?.filter((order) => order.fulfillment && order.fulfillment !== "fulfilled").length,
      unpaid: orderList?.filter((order) => order.pay === "pending").length,
      soldOut: allows(access, "products.read") ? snapshot?.products?.filter((product) => product.stock === 0 && product.status !== "archived").length : undefined,
      carts: canOrders ? snapshot?.checkouts?.filter((item) => !item.recovered).length : undefined,
      recent: orderList ? sortedOrders(orderList).slice(0, 4) : undefined,
    };
  }, [snapshot, access]);

  useTabHeader(
    { kind: "home", owner: "home", title, initials: initials(person), logoUrl: member?.logoUrl ?? "" },
    { onAvatar: () => setAccountsOpen(true), onBell: () => router.push("/orders") },
  );

  const accounts = (
    <AccountSheet
      visible={accountsOpen}
      email={access?.email?.trim() || email}
      title={title}
      storeId={storeId}
      memberships={memberships}
      onClose={() => setAccountsOpen(false)}
      onSelect={(id) => {
        setAccountsOpen(false);
        void selectStore(id);
      }}
      onSignOut={() => {
        setAccountsOpen(false);
        void signOut();
      }}
    />
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.night }}>
        <LoadingBlock />
        {accounts}
      </View>
    );
  }

  const { toFulfill, unpaid, soldOut, carts, recent } = tasks;
  const hour = jerusalemHour();
  const todo = ([
    { key: "fulfill", icon: "box", label: "הזמנות לטיפול", count: toFulfill ?? 0, tint: "#fff1e3", ink: "#8a4b00", onPress: () => router.push("/orders?tab=unfulfilled" as Href) },
    { key: "unpaid", icon: "receipt", label: "ממתינות לתשלום", count: unpaid ?? 0, tint: tokens.warnBg, ink: tokens.warnText, onPress: () => router.push("/orders?tab=unpaid" as Href) },
    { key: "soldout", icon: "tag", label: "מוצרים שאזלו מהמלאי", count: soldOut ?? 0, tint: tokens.emptyBg, ink: tokens.negative, onPress: () => router.push("/more/area/inventory" as Href) },
    { key: "carts", icon: "orders", label: "עגלות נטושות", count: carts ?? 0, tint: tokens.draftBg, ink: tokens.draftText, onPress: () => router.push("/more/area/abandoned" as Href) },
  ] satisfies Task[]).filter((task) => task.count > 0);
  const tracksTasks = toFulfill != null || soldOut != null;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.night }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 0 }}
        refreshControl={refreshControl(refreshing || traffic.refreshing, refreshAll)}
        style={{ backgroundColor: tokens.night }}
      >
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
        <View style={{ flex: 1, backgroundColor: HOME_BG, borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS, paddingHorizontal: 12, paddingTop: 22, paddingBottom: TAB_SPACE + 20, gap: 16, marginTop: 10 }}>
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: "100%", height: 2000, backgroundColor: HOME_BG }} />
          <View style={{ paddingHorizontal: 6, gap: 2 }}>
            <AppText style={{ fontSize: 26, lineHeight: 34, fontFamily: fonts.bold, color: tokens.inkStrong }}>
              {name ? `${greeting(hour)}, ${name}` : greeting(hour)}
            </AppText>
            <AppText style={{ fontSize: 16, color: tokens.inkSecondary }}>הנה הפעילות שלך</AppText>
          </View>
          {error ? <ErrorNote text={error} /> : null}

          {todo.length ? (
            <Card>
              <CardTitle title="משימות" />
              {todo.map((task) => <TaskRow key={task.key} task={task} />)}
            </Card>
          ) : tracksTasks ? (
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: tokens.activeBg, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="check" size={20} color={tokens.activeText} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText style={{ fontFamily: fonts.semibold, fontSize: 16, color: tokens.inkStrong }}>הכל מטופל</AppText>
                  <AppText style={{ fontSize: 14, color: tokens.inkSecondary }}>אין משימות פתוחות כרגע</AppText>
                </View>
              </View>
            </Card>
          ) : null}

          {recent && recent.length ? (
            <Card>
              <CardTitle title="הזמנות אחרונות" action="הצג הכל" onAction={() => router.push("/orders")} />
              {recent.map((order) => {
                const fulfillment = knownBadge(FULFILLMENT_BADGE, order.fulfillment);
                const pay = knownBadge(PAY_BADGE, order.pay);
                return (
                  <Pressable
                    key={order.number}
                    onPress={() => router.push(`/orders/${order.number}`)}
                    style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: 1, borderTopColor: tokens.line, gap: 6, backgroundColor: pressed ? tokens.hover : tokens.card })}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <AppText style={{ flex: 1, fontFamily: fonts.bold, color: tokens.inkStrong, fontSize: 16 }}>#{order.number}</AppText>
                      {order.total != null ? <AppText style={{ fontFamily: fonts.semibold, color: tokens.inkStrong, fontSize: 16, writingDirection: "ltr" }}>{formatIls(order.total)}</AppText> : null}
                    </View>
                    <AppText style={{ color: tokens.inkSecondary, fontSize: 14 }} numberOfLines={1}>{[order.customerName, hebrewTime(order.createdAt)].filter(Boolean).join(" · ")}</AppText>
                    {fulfillment || pay ? (
                      <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
                        {fulfillment ? <Badge {...fulfillment} /> : null}
                        {pay ? <Badge {...pay} /> : null}
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </Card>
          ) : null}
          {!tracksTasks && !recent ? <AppText style={{ color: tokens.inkSecondary, paddingHorizontal: 6 }}>אין פעילות להצגה.</AppText> : null}
        </View>
      </ScrollView>
      <SheetCorners />
      {accounts}
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

function SheetCorner({ side }: { side: "left" | "right" }) {
  const r = SHEET_RADIUS;
  return (
    <View style={{ position: "absolute", top: 0, [side]: 0, width: r, height: r, overflow: "hidden" }}>
      <View style={{ position: "absolute", top: -r, [side]: -r, width: r * 4, height: r * 4, borderRadius: r * 2, borderWidth: r, borderColor: tokens.night }} />
    </View>
  );
}

function SheetCorners() {
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: SHEET_RADIUS }}>
      <SheetCorner side="left" />
      <SheetCorner side="right" />
    </View>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <View style={{ borderRadius: 14, backgroundColor: tokens.card, shadowColor: "#1a1a1a", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1 }}>
      <View style={{ borderRadius: 14, overflow: "hidden" }}>{children}</View>
    </View>
  );
}

function CardTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const fonts = useFontSet();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
      <AppText style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: tokens.inkStrong }}>{title}</AppText>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <AppText style={{ color: tokens.link, fontFamily: fonts.semibold, fontSize: 14 }}>{action}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function TaskRow({ task }: { task: Task }) {
  const fonts = useFontSet();
  return (
    <Pressable
      onPress={task.onPress}
      style={({ pressed }) => ({ minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: tokens.line, backgroundColor: pressed ? tokens.hover : tokens.card })}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: task.tint, alignItems: "center", justifyContent: "center" }}>
        <Icon name={task.icon} size={18} color={task.ink} strokeWidth={1.9} />
      </View>
      <AppText style={{ flex: 1, fontFamily: fonts.medium, fontSize: 16, color: tokens.inkStrong }}>{task.label}</AppText>
      <View style={{ minWidth: 30, height: 26, borderRadius: 13, paddingHorizontal: 9, backgroundColor: tokens.neutralBg, alignItems: "center", justifyContent: "center" }}>
        <AppText style={{ fontFamily: fonts.semibold, fontSize: 14, color: tokens.inkStrong }}>{formatCount(task.count)}</AppText>
      </View>
      <Icon name="forward" size={16} color={tokens.inkSecondary} />
    </Pressable>
  );
}
