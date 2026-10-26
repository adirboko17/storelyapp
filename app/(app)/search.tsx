import { useMemo, useState } from "react";
import { Pressable, SectionList, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/icon";
import { CustomerRow, OrderRow, ProductRow } from "@/components/rows";
import { SectionLabel, SheetEmpty, useStatusBar } from "@/components/shell";
import { AppText } from "@/components/ui";
import { sortedOrders, type CustomerRecord, type OrderRecord, type ProductRecord } from "@/lib/snapshot";
import { useAllowed, useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { SHEET_RADIUS, tokens } from "@/theme/tokens";

type Scope = "all" | "orders" | "products" | "customers";

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
  const fonts = useFontSet();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { snapshot } = useStoreData();
  const canOrders = useAllowed("orders.read");
  const canProducts = useAllowed("products.read");
  const canCustomers = useAllowed("customers.read");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
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

  const open = (href: string) => {
    remember(query);
    bump((value) => value + 1);
    router.push(href as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.night }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.navigate("/"))} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: tokens.nightRaised, alignItems: "center", justifyContent: "center" }}>
          <Icon name="close" size={17} color="#ffffff" strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1, height: 40, borderRadius: 12, backgroundColor: tokens.nightField, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10 }}>
          <Icon name="search" size={16} color={tokens.nightMuted} strokeWidth={1.8} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => { remember(query); bump((value) => value + 1); }}
            placeholder="חיפוש"
            placeholderTextColor={tokens.nightMuted}
            returnKeyType="search"
            selectionColor={tokens.chart}
            style={{ flex: 1, height: 40, color: "#ffffff", fontFamily: fonts.regular, fontSize: 16, textAlign: "right", writingDirection: "rtl" }}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Icon name="close" size={14} color={tokens.nightMuted} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 4, paddingHorizontal: 12, paddingVertical: 12 }}>
        {scopes.map((item) => {
          const on = item.id === scope;
          return (
            <Pressable key={item.id} onPress={() => setScope(item.id)} style={{ height: 30, borderRadius: 8, paddingHorizontal: 12, justifyContent: "center", backgroundColor: on ? tokens.nightField : "transparent" }}>
              <AppText style={{ color: "#ffffff", fontFamily: on ? fonts.semibold : fonts.medium }}>{item.label}</AppText>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flex: 1, backgroundColor: tokens.card, borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS, overflow: "hidden" }}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
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
