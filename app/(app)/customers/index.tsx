import { useMemo, useState } from "react";
import { Alert, FlatList } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { CUSTOMER_SWITCH, CustomerRow } from "@/components/rows";
import { NightScreen, SearchBar, SheetEmpty } from "@/components/shell";
import { ErrorNote, LoadingBlock, refreshControl } from "@/components/ui";
import { deleteStoreCustomer } from "@/lib/remote";
import { useSession } from "@/lib/session";
import { useAllowed, useStoreData } from "@/lib/store-data";
import { TAB_SPACE } from "@/theme/tokens";

export default function CustomersScreen() {
  const router = useRouter();
  const { storeId } = useSession();
  const allowed = useAllowed("customers.read");
  const canCreate = useAllowed("customers.create");
  const canOrders = useAllowed("orders.read");
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const [query, setQuery] = useState("");
  const [byName, setByName] = useState(false);
  const [problem, setProblem] = useState("");
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

  function askDelete(id: string, name: string) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    Alert.alert("למחוק את הלקוח?", `${name || "ללא שם"}\nההזמנות יישארו, בלי שיוך ללקוח.`, [
      { text: "ביטול", style: "cancel" },
      { text: "מחיקה", style: "destructive", onPress: () => void remove(id) },
    ]);
  }

  async function remove(id: string) {
    if (!storeId) {
      setProblem("אין חנות נבחרת.");
      return;
    }
    setProblem("");
    try {
      await deleteStoreCustomer(storeId, id);
      await refresh();
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "לא הצלחנו למחוק את הלקוח.");
    }
  }

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
          {problem ? <ErrorNote text={problem} /> : null}
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
            renderItem={({ item }) => <CustomerRow person={item} spent={spent ? spent.get(item.id) ?? 0 : undefined} onPress={() => router.push(`/customers/${item.id}`)} onLongPress={() => askDelete(item.id, item.name || item.email || "")} />}
            ListEmptyComponent={error ? undefined : (
              <SheetEmpty icon="user" text={!customers ? "הסנאפשוט לא כולל לקוחות." : query.trim() ? "אין תוצאות לחיפוש" : "אין לקוחות עדיין"} />
            )}
          />
        </>
      )}
    </NightScreen>
  );
}
