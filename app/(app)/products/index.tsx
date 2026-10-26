import { useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { JumpRow } from "@/components/browse";
import { ResourceList } from "@/components/resource-list";
import { AppText, Badge } from "@/components/ui";
import { formatCount, formatIls } from "@/lib/format";
import { PRODUCT_BADGE, knownBadge } from "@/lib/orders";
import type { ProductRecord } from "@/lib/snapshot";
import { useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

export default function ProductsScreen() {
  const fonts = useFontSet();
  const router = useRouter();
  const { snapshot } = useStoreData();
  const [query, setQuery] = useState("");
  const products = snapshot?.products;
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = products ?? [];
    if (!needle) return list;
    return list.filter((product) => `${product.title ?? ""} ${product.sku ?? ""}`.toLowerCase().includes(needle));
  }, [products, query]);

  return (
    <ResourceList
      permission="products.read"
      query={query}
      onQuery={setQuery}
      placeholder="חיפוש מוצרים"
      data={products ? rows : []}
      empty={products ? "אין מוצרים עדיין" : "הסנאפשוט לא כולל מוצרים."}
      keyExtractor={(product) => product.id}
      onPress={(product) => router.push(`/products/${product.id}`)}
      extra={<JumpRow items={[{ label: "קטגוריות", href: "/more/area/collections" }, { label: "מלאי", href: "/more/area/inventory" }, { label: "ביקורות", href: "/more/area/reviews" }, { label: "כרטיסי מתנה", href: "/more/area/gift-cards" }]} />}
      renderItem={(product) => <ProductRow product={product} bold={fonts.semibold} />}
    />
  );
}

function ProductRow({ product, bold }: { product: ProductRecord; bold: string }) {
  const badge = knownBadge(PRODUCT_BADGE, product.status);
  const empty = product.stock === 0;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <AppText style={{ flex: 1, fontFamily: bold }} numberOfLines={1}>{product.title || ""}</AppText>
        {product.price != null ? <AppText style={{ writingDirection: "ltr" }}>{formatIls(product.price)}</AppText> : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {product.stock != null ? (
          <AppText style={{ flex: 1, color: empty ? tokens.negative : tokens.inkSecondary, fontSize: 13 }}>
            {empty ? "אזל" : `מלאי ${formatCount(product.stock)}`}
          </AppText>
        ) : <View style={{ flex: 1 }} />}
        {badge ? <Badge {...badge} /> : null}
      </View>
    </View>
  );
}
