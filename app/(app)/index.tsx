import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import Svg, { Circle, Defs, Line, LinearGradient as SvgGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import Animated, { Easing, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { AccountSheet } from "@/components/account-sheet";
import { AlertsSheet } from "@/components/alerts-sheet";
import { Icon, type IconName } from "@/components/icon";
import { initials, useStatusBar } from "@/components/shell";
import { useTabHeader } from "@/components/tab-header";
import { TrafficPager, type RangeKey } from "@/components/traffic-pager";
import { AppText, Badge, ErrorNote, LoadingBlock } from "@/components/ui";
import { allows } from "@/lib/access";
import { formatCount, formatIls, hebrewTime } from "@/lib/format";
import { FULFILLMENT_BADGE, PAY_BADGE, knownBadge } from "@/lib/orders";
import { loadTraffic, useStoreCall } from "@/lib/remote";
import { useSession } from "@/lib/session";
import { sortedOrders } from "@/lib/snapshot";
import { useStoreData, useStoreTitle } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { SHEET_RADIUS, TAB_SPACE, tokens } from "@/theme/tokens";

function jerusalemHour() {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" }).format(new Date())) % 24;
}

type Sky = "morning" | "noon" | "evening" | "night";
type Greeting = { text: string; sky: Sky };

const NIGHT: Greeting = { text: "לילה טוב", sky: "night" };

function greeting(hour: number): Greeting {
  if (hour < 5) return NIGHT;
  if (hour < 12) return { text: "בוקר טוב", sky: "morning" };
  if (hour < 17) return { text: "צהריים טובים", sky: "noon" };
  if (hour < 19) return { text: "ערב טוב", sky: "evening" };
  if (hour < 23) return { text: "ערב טוב", sky: "night" };
  return NIGHT;
}

const SKY: Record<Sky, { sky: [string, string, string]; sun: string; halo: string; hill: string; sunAt: [number, number, number] }> = {
  morning: { sky: ["#dcecff", "#fff1e0", "#ffe0bf"], sun: "#ffb547", halo: "#ffcf8a", hill: "#f1d9c2", sunAt: [96, 116, 20] },
  noon: { sky: ["#d6eaff", "#eaf4ff", "#f6faff"], sun: "#ffcc33", halo: "#ffe38a", hill: "#dfe9e4", sunAt: [318, 40, 17] },
  evening: { sky: ["#e6d9ff", "#ffd3c0", "#ffbb98"], sun: "#ff8a52", halo: "#ffb085", hill: "#f0c1ae", sunAt: [300, 122, 24] },
  night: { sky: ["#c9c3f0", "#dedaf6", "#ecebfa"], sun: "#ffffff", halo: "#ffffff", hill: "#d5d1ee", sunAt: [318, 38, 13] },
};

const NIGHT_STARS: [number, number, number][] = [[60, 30, 1.6], [104, 52, 1.1], [150, 22, 1.3], [236, 40, 1.1], [270, 18, 1.5], [366, 64, 1.2], [30, 70, 1]];

function GreetingSky({ sky }: { sky: Sky }) {
  const look = SKY[sky];
  const [cx, cy, r] = look.sunAt;
  return (
    <Svg pointerEvents="none" width="100%" height="100%" viewBox="0 0 400 150" preserveAspectRatio="xMidYMax slice" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}>
      <Defs>
        <SvgGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={look.sky[0]} />
          <Stop offset="0.6" stopColor={look.sky[1]} />
          <Stop offset="1" stopColor={look.sky[2]} />
        </SvgGradient>
        <RadialGradient id="halo" cx={cx} cy={cy} r={r * 3.2} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={look.halo} stopOpacity={sky === "night" ? 0.5 : 0.75} />
          <Stop offset="1" stopColor={look.halo} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="400" height="150" fill="url(#sky)" />
      {sky === "night" ? NIGHT_STARS.map(([x, y, size]) => <Circle key={`${x}-${y}`} cx={x} cy={y} r={size} fill="#ffffff" opacity={0.9} />) : null}
      <Circle cx={cx} cy={cy} r={r * 3.2} fill="url(#halo)" />
      {sky === "night" ? (
        <Path d={`M${cx} ${cy - r} A${r} ${r} 0 1 0 ${cx} ${cy + r} A${r * 1.25} ${r * 1.25} 0 0 1 ${cx} ${cy - r} Z`} fill="#ffffff" />
      ) : (
        <Circle cx={cx} cy={cy} r={r} fill={look.sun} />
      )}
      {sky === "noon" ? (
        <>
          <Path d="M58 52 h52 a11 11 0 0 0 -16 -14 a15 15 0 0 0 -27 2 a10 10 0 0 0 -9 12z" fill="#ffffff" opacity={0.9} />
          <Path d="M196 30 h38 a8 8 0 0 0 -11 -10 a11 11 0 0 0 -20 2 a7 7 0 0 0 -7 8z" fill="#ffffff" opacity={0.75} />
        </>
      ) : null}
      <Path d="M0 122 C 60 104, 130 108, 190 118 S 320 102, 400 114 L400 150 L0 150 Z" fill={look.hill} />
      <Path d="M0 136 C 70 122, 150 126, 220 135 S 340 124, 400 131 L400 150 L0 150 Z" fill={HOME_BG} />
    </Svg>
  );
}

function firstName(name: string | null | undefined) {
  const clean = name?.trim() ?? "";
  if (!clean || clean.includes("@")) return "";
  return clean.split(/\s+/)[0] ?? "";
}

const HOME_BG = tokens.canvas;

type Task = { key: string; icon: IconName; label: string; count: number; tint: string; ink: string; onPress: () => void };

export default function HomeScreen() {
  useStatusBar("light");
  const fonts = useFontSet();
  const router = useRouter();
  const title = useStoreTitle();
  const { email, memberships, storeId, selectStore, signOut } = useSession();
  const [accountsOpen, setAccountsOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const { snapshot, access, loading, refreshing, error, refresh } = useStoreData();
  const canTraffic = allows(access, "analytics.read") || allows(access, "analytics.live");
  const load = useCallback(async (id: string) => (canTraffic ? loadTraffic(id) : null), [canTraffic]);
  const traffic = useStoreCall(load);
  const [range, setRange] = useState<RangeKey>("today");
  const canLive = allows(access, "analytics.live");
  const member = memberships.find((item) => item.storeId === storeId);
  const person = access?.name?.trim() || member?.memberName || email || title;
  const name = firstName(access?.name || member?.memberName);

  const refreshAll = useCallback(() => {
    void refresh();
    void traffic.refresh();
  }, [refresh, traffic]);
  const refreshingNow = refreshing || traffic.refreshing;
  const pull = useSharedValue(0);
  const turn = useSharedValue(0);
  const spinning = useSharedValue(0);
  useEffect(() => {
    spinning.set(refreshingNow ? 1 : 0);
    if (!refreshingNow) {
      turn.set(0);
      return;
    }
    turn.set(withRepeat(withTiming(1, { duration: 760, easing: Easing.linear }), -1, false));
    return () => {
      turn.set(0);
    };
  }, [refreshingNow, spinning, turn]);
  const onPull = useAnimatedScrollHandler({
    onScroll: (event) => {
      pull.set(Math.max(0, -event.contentOffset.y));
    },
  });
  const refreshMark = useAnimatedStyle(() => {
    const shown = spinning.get() > 0 ? 1 : Math.min(1, Math.max(0, (pull.get() - 8) / 44));
    const angle = spinning.get() > 0 ? turn.get() * 360 : Math.min(pull.get() * 2.2, 180);
    return {
      opacity: shown,
      transform: [{ scale: 0.72 + shown * 0.28 }, { rotate: `${angle}deg` }],
    };
  });
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
    { onAvatar: () => setAccountsOpen(true), onBell: () => setAlertsOpen(true) },
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
        <AlertsSheet visible={alertsOpen} onClose={() => setAlertsOpen(false)} />
      </View>
    );
  }

  const { toFulfill, unpaid, soldOut, carts, recent } = tasks;
  const hour = jerusalemHour();
  const hello = greeting(hour);
  const todo = ([
    { key: "fulfill", icon: "box", label: "הזמנות לטיפול", count: toFulfill ?? 0, tint: "#fff1e3", ink: "#8a4b00", onPress: () => router.push("/orders?tab=unfulfilled" as Href) },
    { key: "unpaid", icon: "receipt", label: "ממתינות לתשלום", count: unpaid ?? 0, tint: tokens.warnBg, ink: tokens.warnText, onPress: () => router.push("/orders?tab=unpaid" as Href) },
    { key: "soldout", icon: "tag", label: "מוצרים שאזלו מהמלאי", count: soldOut ?? 0, tint: tokens.emptyBg, ink: tokens.negative, onPress: () => router.push("/more/area/inventory" as Href) },
    { key: "carts", icon: "orders", label: "עגלות נטושות", count: carts ?? 0, tint: tokens.draftBg, ink: tokens.draftText, onPress: () => router.push("/more/area/abandoned" as Href) },
  ] satisfies Task[]).filter((task) => task.count > 0);
  const tracksTasks = toFulfill != null || soldOut != null;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.night }}>
      <Animated.ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 0 }}
        refreshControl={(
          <RefreshControl
            refreshing={refreshingNow}
            onRefresh={refreshAll}
            tintColor="transparent"
            colors={["#ffffff"]}
            progressBackgroundColor={tokens.night}
          />
        )}
        onScroll={onPull}
        scrollEventThrottle={16}
        style={{ backgroundColor: tokens.night }}
      >
        {canTraffic ? (
          traffic.loading ? <View style={{ height: 290 }} /> : traffic.data ? (
            <TrafficPager
              data={traffic.data}
              hour={hour}
              range={range}
              onRange={setRange}
              onLive={canLive ? () => router.push("/more/area/live" as Href) : undefined}
            />
          ) : traffic.error ? <AppText style={{ color: tokens.nightMuted, paddingHorizontal: 16, paddingBottom: 8 }}>{traffic.error}</AppText> : null
        ) : null}
        <View style={{ flex: 1, backgroundColor: HOME_BG, borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS, paddingHorizontal: 12, paddingTop: 22, paddingBottom: TAB_SPACE + 20, gap: 16, marginTop: 10 }}>
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: "100%", height: 2000, backgroundColor: HOME_BG }} />
          <View style={{ marginHorizontal: -12, marginTop: -22, marginBottom: -6, overflow: "hidden", borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS }}>
            <GreetingSky sky={hello.sky} />
            <View style={{ alignItems: "center", paddingTop: 30, paddingBottom: 50, paddingHorizontal: 20, gap: 2 }}>
              <AppText style={{ textAlign: "center", fontSize: 26, lineHeight: 34, fontFamily: fonts.bold, color: tokens.inkStrong }}>
                {name ? `${hello.text}, ${name}` : hello.text}
              </AppText>
              <AppText style={{ textAlign: "center", fontSize: 16, color: tokens.inkSecondary }}>הנה הפעילות שלך</AppText>
            </View>
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
      </Animated.ScrollView>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 26, left: 0, right: 0, alignItems: "center" }, refreshMark]}>
        <RefreshAsterisk />
      </Animated.View>
      <SheetCorners />
      {accounts}
      <AlertsSheet visible={alertsOpen} onClose={() => setAlertsOpen(false)} />
    </View>
  );
}

function RefreshAsterisk() {
  return (
    <Svg width={22} height={22} viewBox="0 0 22 22">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <Line key={deg} x1={11} y1={2.2} x2={11} y2={7.4} stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" originX={11} originY={11} rotation={deg} />
      ))}
    </Svg>
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
