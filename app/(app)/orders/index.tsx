import { useMemo, useState } from "react";
import { SectionList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ORDER_SWITCH, OrderRow } from "@/components/rows";
import { Chips, NightScreen, SearchBar, SectionLabel, SheetEmpty } from "@/components/shell";
import { ErrorNote, LoadingBlock, refreshControl } from "@/components/ui";
import { hebrewDay } from "@/lib/format";
import { isOpenOrder, sortedOrders, type OrderRecord } from "@/lib/snapshot";
import { useAllowed, useStoreData } from "@/lib/store-data";
import { TAB_SPACE } from "@/theme/tokens";

type Tab = "all" | "unfulfilled" | "unpaid" | "open" | "closed";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "הכל" },
  { id: "unfulfilled", label: "לא נשלחו" },
  { id: "unpaid", label: "לא שולמו" },
  { id: "open", label: "פתוחות" },
  { id: "closed", label: "בארכיון" },
];

function inTab(order: OrderRecord, tab: Tab) {
  if (tab === "unfulfilled") return Boolean(order.fulfillment) && order.fulfillment !== "fulfilled";
  if (tab === "unpaid") return order.pay === "pending";
  if (tab === "open") return isOpenOrder(order);
  if (tab === "closed") return Boolean(order.fulfillment) && !isOpenOrder(order);
  return true;
}

export default function OrdersScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const router = useRouter();
  const allowed = useAllowed("orders.read");
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>(() => TABS.find((item) => item.id === params.tab)?.id ?? "all");
  const [oldest, setOldest] = useState(false);
  const [seenTab, setSeenTab] = useState(params.tab);
  if (params.tab !== seenTab) {
    setSeenTab(params.tab);
    const next = TABS.find((item) => item.id === params.tab)?.id;
    if (next) setTab(next);
  }

  const orders = snapshot?.orders;
  const sections = useMemo(() => {
    const needle = query.trim().replaceAll("#", "").toLowerCase();
    const sorted = sortedOrders(orders ?? []);
    const list = (oldest ? sorted.reverse() : sorted).filter((order) => {
      if (!inTab(order, tab)) return false;
      if (!needle) return true;
      return String(order.number).includes(needle) || (order.customerName ?? "").toLowerCase().includes(needle);
    });
    const groups: { title: string; data: OrderRecord[] }[] = [];
    list.forEach((order) => {
      const title = hebrewDay(order.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.title === title) last.data.push(order);
      else groups.push({ title, data: [order] });
    });
    return groups;
  }, [orders, query, tab, oldest]);

  return (
    <NightScreen title="הזמנות" options={ORDER_SWITCH.map((item) => ({ ...item, active: item.href === "/orders" }))}>
      {loading ? <LoadingBlock /> : !allowed ? (
        <SheetEmpty icon="orders" text="אין הרשאה למסך הזה." />
      ) : (
        <>
          <SearchBar value={query} onChange={setQuery} placeholder="חיפוש" onSort={() => setOldest(!oldest)} sortActive={oldest} />
          <Chips items={TABS} value={tab} onChange={setTab} />
          {error ? <ErrorNote text={error} /> : null}
          <SectionList
            sections={sections}
            keyExtractor={(order) => String(order.number)}
            stickySectionHeadersEnabled
            contentContainerStyle={{ flexGrow: 1, paddingBottom: TAB_SPACE + 12 }}
            refreshControl={refreshControl(refreshing, () => void refresh())}
            keyboardShouldPersistTaps="handled"
            renderSectionHeader={({ section }) => <SectionLabel text={section.title} />}
            renderItem={({ item }) => <OrderRow order={item} onPress={() => router.push(`/orders/${item.number}`)} />}
            ListEmptyComponent={error ? undefined : (
              <SheetEmpty
                icon="orders"
                text={!orders ? "הסנאפשוט לא כולל הזמנות." : query.trim() ? "אין תוצאות לחיפוש" : tab === "all" ? "אין הזמנות עדיין" : "אין הזמנות בסינון הזה"}
              />
            )}
          />
        </>
      )}
    </NightScreen>
  );
}
