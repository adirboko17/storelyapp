import { useMemo, useState } from "react";
import { FlatList } from "react-native";
import { useRouter } from "expo-router";
import { PRODUCT_SWITCH, ProductRow } from "@/components/rows";
import { Chips, NightScreen, SearchBar, SheetEmpty } from "@/components/shell";
import { ErrorNote, LoadingBlock, refreshControl } from "@/components/ui";
import { useAllowed, useStoreData } from "@/lib/store-data";
import { TAB_SPACE } from "@/theme/tokens";

type Tab = "all" | "active" | "draft" | "archived";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "הכל" },
  { id: "active", label: "פעיל" },
  { id: "draft", label: "טיוטה" },
  { id: "archived", label: "בארכיון" },
];

export default function ProductsScreen() {
  const router = useRouter();
  const allowed = useAllowed("products.read");
  const canCreate = useAllowed("products.create");
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [byName, setByName] = useState(false);
  const products = snapshot?.products;
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = (products ?? []).filter((product) => {
      if (tab !== "all" && product.status !== tab) return false;
      if (!needle) return true;
      return `${product.title ?? ""} ${product.sku ?? ""} ${product.vendor ?? ""}`.toLowerCase().includes(needle);
    });
    return byName ? [...list].sort((a, b) => (a.title ?? "").localeCompare(b.title ?? "", "he")) : list;
  }, [products, query, tab, byName]);

  return (
    <NightScreen
      sharedKey="products"
      title="מוצרים"
      options={PRODUCT_SWITCH.map((item) => ({ ...item, active: item.href === "/products" }))}
      onAdd={allowed && canCreate ? () => router.push("/products/new") : undefined}
    >
      {loading ? <LoadingBlock /> : !allowed ? (
        <SheetEmpty icon="tag" text="אין הרשאה למסך הזה." />
      ) : (
        <>
          <SearchBar value={query} onChange={setQuery} placeholder="חיפוש" onSort={() => setByName(!byName)} sortActive={byName} />
          <Chips items={TABS} value={tab} onChange={setTab} />
          {error ? <ErrorNote text={error} /> : null}
          <FlatList
            style={{ flex: 1 }}
            data={rows}
            keyExtractor={(product) => product.id}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={5}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: TAB_SPACE + 12 }}
            refreshControl={refreshControl(refreshing, () => void refresh())}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <ProductRow product={item} onPress={() => router.push(`/products/${item.id}`)} />}
            ListEmptyComponent={error ? undefined : (
              <SheetEmpty icon="tag" text={!products ? "הסנאפשוט לא כולל מוצרים." : query.trim() ? "אין תוצאות לחיפוש" : tab === "all" ? "אין מוצרים עדיין" : "אין מוצרים בסינון הזה"} />
            )}
          />
        </>
      )}
    </NightScreen>
  );
}
