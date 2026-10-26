import { useMemo, useState } from "react";
import { Keyboard, Pressable, SectionList, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Icon } from "@/components/icon";
import { CustomerRow, OrderRow, ProductRow } from "@/components/rows";
import { SectionLabel, SheetEmpty, useStatusBar } from "@/components/shell";
import { searchReturnPath, useSearchDraft, useTabHeader } from "@/components/tab-header";
import { AppText } from "@/components/ui";
import { sortedOrders, type CustomerRecord, type OrderRecord, type ProductRecord } from "@/lib/snapshot";
import { useAllowed, useStoreData } from "@/lib/store-data";
import { SHEET_RADIUS, TAB_SPACE, tokens } from "@/theme/tokens";

type Hit =
  | { kind: "order"; key: string; order: OrderRecord }
  | { kind: "product"; key: string; product: ProductRecord }
  | { kind: "customer"; key: string; person: CustomerRecord };

const recent: string[] = [];

function remember(term: string) {
  const clean = term.trim();
  if (!clean) return;
  const index = recent.indexOf(clean);
  if (index >= 0) recent.splice(index, 1);
  recent.unshift(clean);
  recent.splice(8);
}

export default function SearchScreen() {
  useStatusBar("light");
  const router = useRouter();
  const { snapshot } = useStoreData();
  const canOrders = useAllowed("orders.read");
  const canProducts = useAllowed("products.read");
  const canCustomers = useAllowed("customers.read");
  const { query, setQuery, scope } = useSearchDraft();
  const [, bump] = useState(0);

  const scopes = [
    { id: "all" as const, label: "הכל", on: true },
    { id: "orders" as const, label: "הזמנות", on: canOrders },
    { id: "products" as const, label: "מוצרים", on: canProducts },
    { id: "customers" as const, label: "לקוחות", on: canCustomers },
  ].filter((item) => item.on);

  const sections = useMemo(() => {
    const needle = query.trim().replaceAll("#", "").toLowerCase();
    if (!needle) return [];
    const result: { title: string; data: Hit[] }[] = [];
    if (canOrders && (scope === "all" || scope === "orders")) {
      const data = sortedOrders(snapshot?.orders ?? [])
        .filter((order) => String(order.number).includes(needle) || (order.customerName ?? "").toLowerCase().includes(needle))
        .slice(0, scope === "all" ? 5 : 50)
        .map((order): Hit => ({ kind: "order", key: `o-${order.number}`, order }));
      if (data.length) result.push({ title: "הזמנות", data });
    }
    if (canProducts && (scope === "all" || scope === "products")) {
      const data = (snapshot?.products ?? [])
        .filter((product) => `${product.title ?? ""} ${product.sku ?? ""} ${product.barcode ?? ""}`.toLowerCase().includes(needle))
        .slice(0, scope === "all" ? 5 : 50)
        .map((product): Hit => ({ kind: "product", key: `p-${product.id}`, product }));
      if (data.length) result.push({ title: "מוצרים", data });
    }
    if (canCustomers && (scope === "all" || scope === "customers")) {
      const data = (snapshot?.customers ?? [])
        .filter((person) => `${person.name ?? ""} ${person.email ?? ""} ${person.phone ?? ""}`.toLowerCase().includes(needle))
        .slice(0, scope === "all" ? 5 : 50)
        .map((person): Hit => ({ kind: "customer", key: `c-${person.id}`, person }));
      if (data.length) result.push({ title: "לקוחות", data });
    }
    return result;
  }, [query, scope, snapshot, canOrders, canProducts, canCustomers]);

  useTabHeader(
    { kind: "search", owner: "search", scopes: scopes.map(({ id, label }) => ({ id, label })) },
    {
      onClose: () => {
        Keyboard.dismiss();
        router.navigate(searchReturnPath() as Href);
      },
      onSubmit: (value) => {
        remember(value);
        bump((count) => count + 1);
      },
    },
  );

  const open = (href: string) => {
    remember(query);
    bump((value) => value + 1);
    router.push(href as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.night }}>
      <View style={{ flex: 1, backgroundColor: tokens.card, borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS, overflow: "hidden" }}>
        <SectionList
          style={{ flex: 1 }}
          sections={sections}
          keyExtractor={(item) => item.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: TAB_SPACE }}
          renderSectionHeader={({ section }) => <SectionLabel text={section.title} />}
          renderItem={({ item }) => {
            if (item.kind === "order") return <OrderRow order={item.order} onPress={() => open(`/orders/${item.order.number}`)} />;
            if (item.kind === "product") return <ProductRow product={item.product} onPress={() => open(`/products/${item.product.id}`)} />;
            return <CustomerRow person={item.person} onPress={() => open(`/customers/${item.person.id}`)} />;
          }}
          ListEmptyComponent={query.trim() ? <SheetEmpty text="אין תוצאות לחיפוש" /> : recent.length ? (
            <View>
              <SectionLabel text="חיפושים אחרונים" />
              {recent.map((term) => (
                <Pressable key={term} onPress={() => setQuery(term)} style={{ height: 48, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: tokens.line }}>
                  <Icon name="search" size={15} color={tokens.inkSecondary} />
                  <AppText style={{ flex: 1, color: tokens.inkStrong }}>{term}</AppText>
                </Pressable>
              ))}
            </View>
          ) : <SheetEmpty text="אין חיפושים אחרונים" />}
        />
      </View>
    </View>
  );
}
