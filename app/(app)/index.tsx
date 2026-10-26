import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText, Badge, Card, ErrorNote, LoadingBlock, StoreHeader, refreshControl } from "@/components/ui";
import { allows, allowsAny } from "@/lib/access";
import { formatCount, formatIls, hebrewWhen } from "@/lib/format";
import { FULFILLMENT_BADGE, knownBadge } from "@/lib/orders";
import { openOrderCount, sortedOrders } from "@/lib/snapshot";
import { useStoreData, useStoreTitle } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

export default function HomeScreen() {
  const fonts = useFontSet();
  const router = useRouter();
  const title = useStoreTitle();
  const { snapshot, access, loading, refreshing, error, refresh } = useStoreData();
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.canvas }}>
        <StoreHeader title={title} />
        <LoadingBlock />
      </View>
    );
  }
  const canOrders = allows(access, "orders.read");
  const canSales = allowsAny(access, ["orders.read", "analytics.read"]);
  const open = canOrders ? openOrderCount(snapshot?.orders) : undefined;
  const sales = canSales ? snapshot?.sales : undefined;
  const recent = canOrders && snapshot?.orders ? sortedOrders(snapshot.orders).slice(0, 4) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.canvas }}>
      <StoreHeader title={title} />
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} refreshControl={refreshControl(refreshing, () => void refresh())}>
        {error ? <ErrorNote text={error} /> : null}
        {open != null || sales != null ? (
          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 12 }}>
            {open != null ? <Metric label="הזמנות פתוחות" value={formatCount(open)} /> : null}
            {sales != null ? <Metric label="מכירות" value={formatIls(sales)} /> : null}
          </View>
        ) : null}
        {recent ? (
          <View style={{ marginTop: 12, marginHorizontal: 12 }}>
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
                <AppText style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15 }}>הזמנות אחרונות</AppText>
                <Pressable onPress={() => router.push("/orders")}>
                  <AppText style={{ color: tokens.link, fontSize: 14 }}>לכל ההזמנות</AppText>
                </Pressable>
              </View>
              {recent.length === 0 ? <AppText style={{ borderTopWidth: 1, borderTopColor: tokens.line, paddingHorizontal: 16, paddingVertical: 16, color: tokens.inkSecondary }}>אין הזמנות עדיין</AppText> : null}
              {recent.map((order) => {
                const badge = knownBadge(FULFILLMENT_BADGE, order.fulfillment);
                return (
                  <Pressable
                    key={order.number}
                    onPress={() => router.push(`/orders/${order.number}`)}
                    style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: tokens.line, paddingHorizontal: 16, paddingVertical: 8 }}
                  >
                    <AppText style={{ width: 52, fontFamily: fonts.semibold, writingDirection: "ltr" }}>#{order.number}</AppText>
                    <View style={{ flex: 1 }}>
                      {order.customerName ? <AppText numberOfLines={1}>{order.customerName}</AppText> : null}
                      {order.createdAt ? <AppText style={{ fontSize: 12, color: tokens.inkSecondary }}>{hebrewWhen(order.createdAt)}</AppText> : null}
                    </View>
                    {badge ? <Badge {...badge} /> : null}
                    {order.total != null ? <AppText style={{ fontFamily: fonts.medium, writingDirection: "ltr" }}>{formatIls(order.total)}</AppText> : null}
                  </Pressable>
                );
              })}
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const fonts = useFontSet();
  return (
    <View style={{ flex: 1, backgroundColor: tokens.card, borderRadius: 12, borderWidth: 1, borderColor: "rgba(26,26,26,0.07)", padding: 14, gap: 4 }}>
      <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }}>{label}</AppText>
      <AppText style={{ fontFamily: fonts.bold, fontSize: 22, color: tokens.inkStrong }}>{value}</AppText>
    </View>
  );
}
