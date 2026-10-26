import { useMemo, useState } from "react";
import { FlatList } from "react-native";
import { useRouter } from "expo-router";
import { CUSTOMER_SWITCH, CustomerRow } from "@/components/rows";
import { NightScreen, SearchBar, SheetEmpty } from "@/components/shell";
import { ErrorNote, LoadingBlock, refreshControl } from "@/components/ui";
import { useAllowed, useStoreData } from "@/lib/store-data";
import { TAB_SPACE } from "@/theme/tokens";

export default function CustomersScreen() {
  const router = useRouter();
  const allowed = useAllowed("customers.read");
  const canCreate = useAllowed("customers.create");
  const canOrders = useAllowed("orders.read");
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const [query, setQuery] = useState("");
  const [byName, setByName] = useState(false);
  const customers = snapshot?.customers;
  const orders = snapshot?.orders;
  const spent = useMemo(() => {
    if (!canOrders || !orders) return null;
    const totals = new Map<string, number>();
    for (const order of orders) {
      if (!order.customerId) continue;
      totals.set(order.customerId, (totals.get(order.customerId) ?? 0) + (order.total ?? 0));
    }
    return totals;
  }, [orders, canOrders]);
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = (customers ?? []).filter((person) => {
      if (!needle) return true;
      return `${person.name ?? ""} ${person.email ?? ""} ${person.phone ?? ""} ${person.city ?? ""}`.toLowerCase().includes(needle);
    });
    return byName ? [...list].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "he")) : list;
  }, [customers, query, byName]);

  return (
    <NightScreen
      sharedKey="customers"
      title="לקוחות"
      options={CUSTOMER_SWITCH.map((item) => ({ ...item, active: item.href === "/customers" }))}
      onAdd={allowed && canCreate ? () => router.push("/customers/new") : undefined}
    >
      {loading ? <LoadingBlock /> : !allowed ? (
        <SheetEmpty icon="user" text="אין הרשאה למסך הזה." />
      ) : (
        <>
          <SearchBar value={query} onChange={setQuery} placeholder="חיפוש" onSort={() => setByName(!byName)} sortActive={byName} />
          {error ? <ErrorNote text={error} /> : null}
          <FlatList
            style={{ flex: 1, marginTop: 8 }}
            data={rows}
            keyExtractor={(person) => person.id}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={5}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: TAB_SPACE + 12 }}
            refreshControl={refreshControl(refreshing, () => void refresh())}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <CustomerRow person={item} spent={spent ? spent.get(item.id) ?? 0 : undefined} onPress={() => router.push(`/customers/${item.id}`)} />}
            ListEmptyComponent={error ? undefined : (
              <SheetEmpty icon="user" text={!customers ? "הסנאפשוט לא כולל לקוחות." : query.trim() ? "אין תוצאות לחיפוש" : "אין לקוחות עדיין"} />
            )}
          />
        </>
      )}
    </NightScreen>
  );
}
