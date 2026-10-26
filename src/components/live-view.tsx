import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import * as Location from "expo-location";
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { Globe, placeCoordinates, type GlobeSpot } from "@/components/globe";
import { RoundButton, Thumb } from "@/components/shell";
import { AppText, ErrorNote, LoadingBlock, refreshControl } from "@/components/ui";
import { formatCount, formatIls, hebrewDay } from "@/lib/format";
import { loadTraffic, useStoreCall } from "@/lib/remote";
import { productImage } from "@/lib/snapshot";
import { useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, tokens } from "@/theme/tokens";

const ORDER_DOT = "#8f6cf0";
const VISITOR_DOT = "#1fb2ff";
const FUNNEL = "#2f5fe0";
const LOCATION_BAR = "#13b5ea";
const RETURNING = "#6a3df0";
const SYNC_MS = 10000;

type Navigator = {
  getState: () => { type?: string } | undefined;
  getParent: () => Navigator | undefined;
  setOptions: (options: { gestureEnabled: boolean }) => void;
};

function jerusalemHour() {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" }).format(new Date())) % 24;
}

function sumTo(values: number[], hour: number) {
  return values.slice(0, hour + 1).reduce((sum, value) => sum + value, 0);
}

function delta(current: number, previous: number) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function LiveView() {
  const fonts = useFontSet();
  const router = useRouter();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const remote = useStoreCall(loadTraffic);
  const { snapshot, sync: syncStore } = useStoreData();
  const { refresh, sync } = remote;
  const [showOrders, setShowOrders] = useState(true);
  const [showVisitors, setShowVisitors] = useState(true);
  const [focused, setFocused] = useState(true);
  const [myPlace, setMyPlace] = useState<{ lat: number; lon: number } | null>(null);

  useFocusEffect(useCallback(() => {
    setFocused(true);
    const stacks: Navigator[] = [];
    let current: Navigator | undefined = navigation as unknown as Navigator;
    while (current && current.getState()?.type === "stack") {
      current.setOptions({ gestureEnabled: false });
      stacks.push(current);
      current = current.getParent();
    }
    return () => {
      setFocused(false);
      stacks.forEach((stack) => stack.setOptions({ gestureEnabled: true }));
    };
  }, [navigation]));

  useEffect(() => {
    if (!focused) return undefined;
    let tick = 0;
    const timer = setInterval(() => {
      if (AppState.currentState !== "active") return;
      tick += 1;
      void sync();
      if (tick % 3 === 0) void syncStore();
    }, SYNC_MS);
    return () => clearInterval(timer);
  }, [focused, sync, syncStore]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted || cancelled) return;
        const last = await Location.getLastKnownPositionAsync();
        if (last && !cancelled) setMyPlace({ lat: last.coords.latitude, lon: last.coords.longitude });
        const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) setMyPlace({ lat: fresh.coords.latitude, lon: fresh.coords.longitude });
      } catch {
        // Location is optional; the store address is used instead.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const todayOrders = useMemo(() => (snapshot?.orders ?? []).filter((order) => hebrewDay(order.createdAt) === "היום"), [snapshot?.orders]);

  const productSales = useMemo(() => {
    const totals = new Map<string, { id?: string; title: string; sales: number }>();
    for (const order of todayOrders) {
      for (const line of order.lines ?? []) {
        const key = line.productId ?? line.title ?? "";
        if (!key) continue;
        const entry = totals.get(key) ?? { id: line.productId, title: line.title ?? "", sales: 0 };
        entry.sales += (line.unitPrice ?? 0) * (line.quantity ?? 1);
        totals.set(key, entry);
      }
    }
    return [...totals.values()].sort((a, b) => b.sales - a.sales).slice(0, 5);
  }, [todayOrders]);

  const traffic = remote.data;

  const storeCity = snapshot?.shipping?.contact?.city;
  const pin = useMemo(() => {
    if (myPlace) return myPlace;
    const point = placeCoordinates(storeCity) ?? placeCoordinates("Israel");
    return point ? { lat: point[0], lon: point[1] } : null;
  }, [myPlace, storeCity]);

  const spots = useMemo(() => {
    const list: GlobeSpot[] = [];
    if (showVisitors && traffic) {
      for (const place of traffic.now.locations) {
        const point = placeCoordinates(place.label);
        if (point && place.count > 0) list.push({ key: `v-${place.label}`, lat: point[0], lon: point[1], color: VISITOR_DOT });
      }
    }
    if (showOrders) {
      const customers = snapshot?.customers ?? [];
      for (const order of todayOrders) {
        const city = customers.find((person) => person.id === order.customerId)?.city;
        const point = placeCoordinates(city) ?? placeCoordinates("Israel");
        if (point) list.push({ key: `o-${order.number}`, lat: point[0], lon: point[1], color: ORDER_DOT });
      }
    }
    return list;
  }, [showOrders, showVisitors, traffic, todayOrders, snapshot?.customers]);

  if (remote.loading && !traffic) return <LoadingBlock />;

  const hour = jerusalemHour();
  const yesterday = traffic?.yesterday;
  const salesChange = traffic && yesterday ? delta(traffic.today.sales, sumTo(yesterday.salesByHour, hour)) : null;
  const visitsChange = traffic && yesterday ? delta(traffic.today.visits, sumTo(yesterday.visitsByHour, hour)) : null;
  const ordersChange = traffic && yesterday ? delta(traffic.today.orders, sumTo(yesterday.ordersByHour, hour)) : null;
  const locations = traffic ? [...(traffic.today.locations.length ? traffic.today.locations : traffic.now.locations)].sort((a, b) => b.count - a.count).slice(0, 5) : [];
  const maxLocation = Math.max(1, ...locations.map((place) => place.count));
  const globeSize = Math.min(width - 72, 340);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tokens.field }}
      contentContainerStyle={{ padding: 10, gap: 10, paddingBottom: TAB_SPACE + 20 }}
      refreshControl={refreshControl(remote.refreshing, () => void refresh())}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <LegendChip color={ORDER_DOT} label="הזמנות" on={showOrders} onPress={() => setShowOrders((value) => !value)} />
        <LegendChip color={VISITOR_DOT} label="מבקרים כעת" on={showVisitors} onPress={() => setShowVisitors((value) => !value)} />
        <View style={{ flex: 1 }} />
        <WhiteRound icon="search" onPress={() => router.push("/search")} />
      </View>

      <Globe size={globeSize} spots={spots} pin={pin} />

      {remote.error ? <ErrorNote text={remote.error} /> : null}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <MetricCard label="מבקרים כעת" value={formatCount(traffic?.now.visitors ?? 0)} />
        <MetricCard label="סה״כ מכירות" value={formatIls(traffic?.today.sales ?? 0)} change={salesChange} />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <MetricCard label="סשנים" value={formatCount(traffic?.today.visits ?? 0)} change={visitsChange} />
        <MetricCard label="הזמנות" value={formatCount(traffic?.today.orders ?? 0)} change={ordersChange} />
      </View>

      <Card title="התנהגות לקוחות">
        <Funnel width={width - 20 - 32} steps={[
          { label: "עגלות פעילות", value: traffic?.now.carts ?? 0 },
          { label: "בתהליך תשלום", value: traffic?.now.checkouts ?? 0 },
          { label: "רכשו", value: traffic?.now.purchased ?? 0 },
        ]} />
      </Card>

      <Card title="סשנים לפי מיקום">
        {locations.length ? locations.map((place) => (
          <View key={place.label} style={{ gap: 4 }}>
            <AppText style={{ fontSize: 12, color: tokens.ink }} numberOfLines={1}>{place.label}</AppText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ flex: 1, flexDirection: "row" }}>
                <View style={{ width: `${Math.max(3, (place.count / maxLocation) * 100)}%`, height: 14, borderRadius: 2, backgroundColor: LOCATION_BAR }} />
              </View>
              <AppText style={{ fontSize: 13, color: tokens.ink, minWidth: 28 }}>{formatCount(place.count)}</AppText>
            </View>
          </View>
        )) : <Empty />}
      </Card>

      <Card title="מבקרים חדשים מול חוזרים">
        <NewVsReturning fresh={traffic?.now.newVisitors ?? 0} returning={traffic?.now.returningVisitors ?? 0} />
      </Card>

      <Card title="מכירות לפי מוצר">
        {productSales.length ? productSales.map((product) => (
          <Pressable
            key={product.id ?? product.title}
            disabled={!product.id}
            onPress={() => product.id && router.push(`/products/${product.id}`)}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4, opacity: pressed ? 0.6 : 1 })}
          >
            <Thumb uri={productImage(snapshot?.products, product.id)} size={30} />
            <AppText style={{ flex: 1, fontSize: 14, color: tokens.inkStrong, textDecorationLine: "underline" }} numberOfLines={2}>{product.title}</AppText>
            <AppText style={{ fontFamily: fonts.bold, fontSize: 15, color: tokens.inkStrong }}>{formatIls(product.sales)}</AppText>
          </Pressable>
        )) : <Empty text="אין עדיין מכירות היום" />}
      </Card>
    </ScrollView>
  );
}

function LegendChip({ color, label, on, onPress }: { color: string; label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 32, paddingHorizontal: 10, borderRadius: 8, backgroundColor: tokens.card, opacity: on ? 1 : 0.5 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />
      <AppText style={{ fontSize: 14, color: tokens.inkStrong }}>{label}</AppText>
    </Pressable>
  );
}

function WhiteRound({ icon, onPress }: { icon: "search"; onPress: () => void }) {
  return (
    <View style={{ borderRadius: 12, backgroundColor: tokens.card }}>
      <RoundButton icon={icon} onPress={onPress} size={38} />
    </View>
  );
}

function Title({ text }: { text: string }) {
  const fonts = useFontSet();
  return (
    <AppText style={{ fontFamily: fonts.semibold, fontSize: 15, color: tokens.inkStrong, textDecorationLine: "underline", textDecorationStyle: "dotted", textDecorationColor: "#b5b5b5" }}>
      {text}
    </AppText>
  );
}

function MetricCard({ label, value, change }: { label: string; value: string; change?: number | null }) {
  const fonts = useFontSet();
  const up = change != null && change >= 0;
  return (
    <View style={{ flex: 1, backgroundColor: tokens.card, borderRadius: 12, padding: 14, gap: 4, borderWidth: 1, borderColor: tokens.line }}>
      <Title text={label} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <AppText style={{ fontFamily: fonts.semibold, fontSize: 16, color: tokens.inkStrong }}>{value}</AppText>
        {change != null ? (
          <AppText style={{ fontSize: 12, fontFamily: fonts.semibold, color: up ? "#0c7d4a" : tokens.inkSecondary }}>{`${up ? "↗" : "↘"} ${Math.abs(change)}%`}</AppText>
        ) : null}
      </View>
    </View>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ backgroundColor: tokens.card, borderRadius: 12, padding: 16, gap: 12, borderWidth: 1, borderColor: tokens.line }}>
      <Title text={title} />
      {children}
    </View>
  );
}

function Empty({ text = "אין נתונים כרגע" }: { text?: string }) {
  return <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>{text}</AppText>;
}

function Funnel({ width, steps }: { width: number; steps: { label: string; value: number }[] }) {
  const height = 110;
  const column = width / steps.length;
  const bar = column * 0.74;
  const max = Math.max(1, ...steps.map((step) => step.value));
  const heightOf = (value: number) => Math.max(3, (value / max) * height);
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row" }}>
        {steps.map((step, index) => (
          <View key={step.label} style={{ width: column, gap: 2, paddingHorizontal: 6, borderStartWidth: index ? 1 : 0, borderStartColor: tokens.line }}>
            <AppText style={{ fontSize: 12, color: tokens.ink }} numberOfLines={1}>{step.label}</AppText>
            <AppText style={{ fontSize: 14, color: tokens.inkStrong }}>{formatCount(step.value)}</AppText>
          </View>
        ))}
      </View>
      <View style={{ transform: [{ scaleX: -1 }] }}>
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="flow" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={FUNNEL} stopOpacity="0.55" />
              <Stop offset="1" stopColor={FUNNEL} stopOpacity="0.25" />
            </LinearGradient>
          </Defs>
          {steps.map((step, index) => {
            const x = index * column;
            const h = heightOf(step.value);
            const next = steps[index + 1];
            const nextH = next ? heightOf(next.value) : 0;
            return (
              <G key={step.label}>
                <Rect x={x} y={height - h} width={bar} height={h} rx={3} fill={FUNNEL} />
                {next ? <Path d={`M${x + bar} ${height - h}L${x + column} ${height - nextH}L${x + column} ${height}L${x + bar} ${height}Z`} fill="url(#flow)" /> : null}
              </G>
            );
          })}
        </Svg>
      </View>
    </View>
  );
}

function NewVsReturning({ fresh, returning }: { fresh: number; returning: number }) {
  const fonts = useFontSet();
  const total = fresh + returning;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 20 }}>
        {[{ label: "חדשים", value: fresh, color: LOCATION_BAR }, { label: "חוזרים", value: returning, color: RETURNING }].map((item) => (
          <View key={item.label} style={{ gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
              <AppText style={{ fontSize: 12, color: tokens.ink }}>{item.label}</AppText>
            </View>
            <AppText style={{ fontSize: 13, fontFamily: fonts.semibold, color: tokens.inkStrong, paddingStart: 14 }}>{formatCount(item.value)}</AppText>
          </View>
        ))}
      </View>
      {total ? (
        <View style={{ flexDirection: "row", height: 52, gap: 3 }}>
          {fresh ? <View style={{ flex: fresh, backgroundColor: LOCATION_BAR, borderRadius: 2 }} /> : null}
          {returning ? <View style={{ flex: returning, backgroundColor: RETURNING, borderRadius: 2 }} /> : null}
        </View>
      ) : <Empty />}
    </View>
  );
}
