import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { useRouter } from "expo-router";
import { Chips, FlatRow, NightScreen, SearchBar, SheetEmpty } from "@/components/shell";
import { AppText, Badge, ErrorNote, LoadingBlock, refreshControl } from "@/components/ui";
import { formatIls } from "@/lib/format";
import { DISCOUNT_KIND, DISCOUNT_STATUS, knownBadge } from "@/lib/orders";
import type { DiscountRecord } from "@/lib/snapshot";
import { useAllowed, useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, tokens } from "@/theme/tokens";

type Tab = "all" | "active" | "scheduled" | "expired";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "הכל" },
  { id: "active", label: "פעיל" },
  { id: "scheduled", label: "מתוזמן" },
  { id: "expired", label: "פג תוקף" },
];

export default function DiscountsScreen() {
  const router = useRouter();
  const allowed = useAllowed("discounts.read");
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const discounts = snapshot?.discounts;
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (discounts ?? []).filter((discount) => {
      if (tab !== "all" && discount.status !== tab) return false;
      if (!needle) return true;
      return `${discount.code ?? ""} ${discount.title ?? ""}`.toLowerCase().includes(needle);
    });
  }, [discounts, query, tab]);

  return (
    <NightScreen title="הנחות">
      {loading ? <LoadingBlock /> : !allowed ? (
        <SheetEmpty icon="discount" text="אין הרשאה למסך הזה." />
      ) : (
        <>
          <SearchBar value={query} onChange={setQuery} placeholder="חיפוש" />
          <Chips items={TABS} value={tab} onChange={setTab} />
          {error ? <ErrorNote text={error} /> : null}
          <FlatList
            data={rows}
            keyExtractor={(discount) => discount.id}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: TAB_SPACE + 12 }}
            refreshControl={refreshControl(refreshing, () => void refresh())}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => <DiscountRow discount={item} onPress={() => router.push(`/more/discounts/${item.id}`)} />}
            ListEmptyComponent={error ? undefined : (
              <SheetEmpty icon="discount" text={!discounts ? "הסנאפשוט לא כולל הנחות." : query.trim() ? "אין תוצאות לחיפוש" : "אין הנחות בסינון הזה"} />
            )}
          />
        </>
      )}
    </NightScreen>
  );
}

function DiscountRow({ discount, onPress }: { discount: DiscountRecord; onPress: () => void }) {
  const fonts = useFontSet();
  const badge = knownBadge(DISCOUNT_STATUS, discount.status);
  const kind = discount.kind ? DISCOUNT_KIND[discount.kind] ?? discount.kind : "";
  const value = discount.value == null ? "" : discount.valueType === "fixed" ? formatIls(discount.value) : discount.valueType === "pct" ? `${discount.value}%` : String(discount.value);
  const detail = [kind, value, discount.method === "auto" ? "אוטומטית" : ""].filter(Boolean).join(" • ");
  return (
    <FlatRow onPress={onPress}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <AppText style={{ fontFamily: fonts.bold, fontSize: 15, color: tokens.inkStrong }} numberOfLines={1}>{discount.code || discount.title || ""}</AppText>
          {detail ? <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }}>{detail}</AppText> : null}
        </View>
        {badge ? <Badge {...badge} /> : null}
      </View>
    </FlatRow>
  );
}
