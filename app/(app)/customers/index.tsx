import { useMemo, useState } from "react";
import { FlatList } from "react-native";
import { useRouter } from "expo-router";
import { CUSTOMER_SWITCH, CustomerRow } from "@/components/rows";
import { Chips, NightScreen, SearchBar, SheetEmpty } from "@/components/shell";
import { ErrorNote, LoadingBlock, refreshControl } from "@/components/ui";
import { useAllowed, useStoreData } from "@/lib/store-data";
import { TAB_SPACE } from "@/theme/tokens";

type Tab = "all" | "repeat" | "subscribed";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "הכל" },
  { id: "repeat", label: "לקוחות חוזרים" },
  { id: "subscribed", label: "מנויים לדיוור" },
];

export default function CustomersScreen() {
  const router = useRouter();
  const allowed = useAllowed("customers.read");
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [byName, setByName] = useState(false);
  const customers = snapshot?.customers;
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = (customers ?? []).filter((person) => {
      if (tab === "repeat" && !(person.orders != null && person.orders > 1)) return false;
      if (tab === "subscribed" && person.subscribed !== true) return false;
      if (!needle) return true;
      return `${person.name ?? ""} ${person.email ?? ""} ${person.phone ?? ""} ${person.city ?? ""}`.toLowerCase().includes(needle);
    });
    return byName ? [...list].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "he")) : list;
  }, [customers, query, tab, byName]);

  return (
    <NightScreen title="לקוחות" options={CUSTOMER_SWITCH.map((item) => ({ ...item, active: item.href === "/customers" }))}>
      {loading ? <LoadingBlock /> : !allowed ? (
        <SheetEmpty icon="user" text="אין הרשאה למסך הזה." />
      ) : (
        <>
          <SearchBar value={query} onChange={setQuery} placeholder="חיפוש" onSort={() => setByName(!byName)} sortActive={byName} />
          <Chips items={TABS} value={tab} onChange={setTab} />
          {error ? <ErrorNote text={error} /> : null}
          <FlatList
            data={rows}
            keyExtractor={(person) => person.id}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: TAB_SPACE + 12 }}
            refreshControl={refreshControl(refreshing, () => void refresh())}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <CustomerRow person={item} onPress={() => router.push(`/customers/${item.id}`)} />}
            ListEmptyComponent={error ? undefined : (
              <SheetEmpty icon="user" text={!customers ? "הסנאפשוט לא כולל לקוחות." : query.trim() ? "אין תוצאות לחיפוש" : "אין לקוחות בסינון הזה"} />
            )}
          />
        </>
      )}
    </NightScreen>
  );
}
