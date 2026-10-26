import { useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { ResourceList } from "@/components/resource-list";
import { AppText, Badge } from "@/components/ui";
import { formatIls } from "@/lib/format";
import { DISCOUNT_KIND, DISCOUNT_STATUS, knownBadge } from "@/lib/orders";
import type { DiscountRecord } from "@/lib/snapshot";
import { useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

export default function DiscountsScreen() {
  const fonts = useFontSet();
  const router = useRouter();
  const { snapshot } = useStoreData();
  const [query, setQuery] = useState("");
  const discounts = snapshot?.discounts;
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = discounts ?? [];
    if (!needle) return list;
    return list.filter((discount) => `${discount.code ?? ""} ${discount.title ?? ""}`.toLowerCase().includes(needle));
  }, [discounts, query]);

  return (
    <ResourceList
      header={false}
      permission="discounts.read"
      query={query}
      onQuery={setQuery}
      placeholder="חיפוש הנחות"
      data={discounts ? rows : []}
      empty={discounts ? "אין הנחות עדיין" : "הסנאפשוט לא כולל הנחות."}
      keyExtractor={(discount) => discount.id}
      onPress={(discount) => router.push(`/more/discounts/${discount.id}`)}
      renderItem={(discount) => <DiscountRow discount={discount} bold={fonts.semibold} />}
    />
  );
}

function DiscountRow({ discount, bold }: { discount: DiscountRecord; bold: string }) {
  const badge = knownBadge(DISCOUNT_STATUS, discount.status);
  const kind = discount.kind ? DISCOUNT_KIND[discount.kind] ?? discount.kind : "";
  const value = discount.value == null ? "" : discount.valueType === "fixed" ? formatIls(discount.value) : discount.valueType === "pct" ? `${discount.value}%` : String(discount.value);
  const detail = [kind, value].filter(Boolean).join(" · ");
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <AppText style={{ flex: 1, fontFamily: bold }} numberOfLines={1}>{discount.code || discount.title || ""}</AppText>
        {badge ? <Badge {...badge} /> : null}
      </View>
      {detail ? <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }}>{detail}</AppText> : null}
    </View>
  );
}
