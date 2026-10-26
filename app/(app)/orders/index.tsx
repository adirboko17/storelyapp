import { useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { JumpRow } from "@/components/browse";
import { ResourceList } from "@/components/resource-list";
import { AppText, Badge } from "@/components/ui";
import { formatIls, hebrewWhen } from "@/lib/format";
import { FULFILLMENT_BADGE, knownBadge } from "@/lib/orders";
import { sortedOrders, type OrderRecord } from "@/lib/snapshot";
import { useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

function includes(value: string | undefined, needle: string) {
  return (value ?? "").toLowerCase().includes(needle);
}

export default function OrdersScreen() {
  const fonts = useFontSet();
  const router = useRouter();
  const { snapshot } = useStoreData();
  const [query, setQuery] = useState("");
  const orders = snapshot?.orders;
  const rows = useMemo(() => {
    const needle = query.trim().replaceAll("#", "").toLowerCase();
    const sorted = sortedOrders(orders ?? []);
    if (!needle) return sorted;
    return sorted.filter((order) => String(order.number).includes(needle) || includes(order.customerName, needle));
  }, [orders, query]);

  return (
    <ResourceList
      permission="orders.read"
      query={query}
      onQuery={setQuery}
      placeholder="חיפוש הזמנות"
      data={orders ? rows : []}
      empty={orders ? "אין הזמנות עדיין" : "אין הזמנות בסנאפשוט"}
      keyExtractor={(order) => String(order.number)}
      onPress={(order) => router.push(`/orders/${order.number}`)}
      extra={<JumpRow items={[{ label: "החזרות", href: "/more/area/returns" }, { label: "עגלות נטושות", href: "/more/area/abandoned" }]} />}
      renderItem={(order) => <OrderRow order={order} bold={fonts.semibold} />}
    />
  );
}

function OrderRow({ order, bold }: { order: OrderRecord; bold: string }) {
  const badge = knownBadge(FULFILLMENT_BADGE, order.fulfillment);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <AppText style={{ fontFamily: bold, writingDirection: "ltr" }}>#{order.number}</AppText>
        <AppText style={{ flex: 1 }} numberOfLines={1}>{order.customerName || ""}</AppText>
        {order.total != null ? <AppText style={{ fontFamily: bold, writingDirection: "ltr" }}>{formatIls(order.total)}</AppText> : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {order.createdAt ? <AppText style={{ flex: 1, fontSize: 12, color: tokens.inkSecondary }}>{hebrewWhen(order.createdAt)}</AppText> : <View style={{ flex: 1 }} />}
        {badge ? <Badge {...badge} /> : null}
      </View>
    </View>
  );
}
