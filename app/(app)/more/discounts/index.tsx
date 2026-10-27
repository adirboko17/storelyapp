import { useMemo, useState } from "react";
import { Alert, Modal, Pressable, SectionList, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/icon";
import { Chips, FlatRow, NightScreen, SearchBar, SheetEmpty } from "@/components/shell";
import { AppText, Badge, ErrorNote, LoadingBlock, refreshControl } from "@/components/ui";
import { DISCOUNT_TYPES, discountDay, discountLine, discountStamp, discountStatus, type DiscountKind } from "@/lib/discounts";
import { DISCOUNT_STATUS, knownBadge } from "@/lib/orders";
import { deleteStoreDiscounts } from "@/lib/remote";
import { useSession } from "@/lib/session";
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
  const insets = useSafeAreaInsets();
  const fonts = useFontSet();
  const allowed = useAllowed("discounts.read");
  const { storeId } = useSession();
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [oldest, setOldest] = useState(false);
  const [filters, setFilters] = useState(false);
  const [picker, setPicker] = useState(false);
  const [problem, setProblem] = useState("");
  const discounts = snapshot?.discounts;
  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = (discounts ?? []).filter((discount) => {
      if (tab !== "all" && discountStatus(discount) !== tab) return false;
      if (!needle) return true;
      return `${discount.code ?? ""} ${discount.title ?? ""} ${discountLine(discount)}`.toLowerCase().includes(needle);
    });
    list.sort((left, right) => (oldest ? discountStamp(left.start) - discountStamp(right.start) : discountStamp(right.start) - discountStamp(left.start)));
    const groups: { title: string; data: DiscountRecord[] }[] = [];
    list.forEach((discount) => {
      const title = discountDay(discount.start);
      const last = groups[groups.length - 1];
      if (last && last.title === title) last.data.push(discount);
      else groups.push({ title, data: [discount] });
    });
    return groups;
  }, [discounts, oldest, query, tab]);

  function create(kind: DiscountKind) {
    setPicker(false);
    router.push(`/more/discounts/new?kind=${kind}` as Href);
  }

  function askDelete(discount: DiscountRecord) {
    const name = discount.code || discount.title || "ההנחה";
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    Alert.alert("למחוק את ההנחה?", name, [
      { text: "ביטול", style: "cancel" },
      { text: "מחיקה", style: "destructive", onPress: () => void remove(discount.id) },
    ]);
  }

  async function remove(id: string) {
    if (!storeId) {
      setProblem("אין חנות נבחרת.");
      return;
    }
    setProblem("");
    try {
      await deleteStoreDiscounts(storeId, [id]);
      await refresh();
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "לא הצלחנו למחוק את ההנחה.");
    }
  }

  const actions = !loading && allowed ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="הוספת הנחה"
      onPress={() => setPicker(true)}
      hitSlop={6}
      style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: tokens.nightRaised, opacity: pressed ? 0.55 : 1 })}
    >
      <Icon name="plus" size={18} color="#ffffff" strokeWidth={2} />
    </Pressable>
  ) : undefined;

  return (
    <NightScreen title="הנחות" actions={actions}>
      {loading ? <LoadingBlock /> : !allowed ? (
        <SheetEmpty icon="discount" text="אין הרשאה למסך הזה." />
      ) : (
        <>
          <SearchBar value={query} onChange={setQuery} placeholder="חיפוש" onSort={() => setOldest((value) => !value)} sortActive={oldest} onFilter={() => setFilters(true)} filterActive={tab !== "all"} />
          <Chips items={TABS} value={tab} onChange={setTab} />
          {error ? <ErrorNote text={error} /> : null}
          {problem ? <ErrorNote text={problem} /> : null}
          <SectionList
            style={{ flex: 1 }}
            sections={sections}
            keyExtractor={(discount) => discount.id}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: TAB_SPACE + 12 }}
            refreshControl={refreshControl(refreshing, () => void refresh())}
            keyboardShouldPersistTaps="handled"
            renderSectionHeader={({ section }) => (
              <View style={{ backgroundColor: tokens.card, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
                <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }}>{section.title}</AppText>
              </View>
            )}
            renderItem={({ item }) => <DiscountRow discount={item} onPress={() => router.push(`/more/discounts/${item.id}` as Href)} onLongPress={() => askDelete(item)} />}
            ListEmptyComponent={error ? undefined : (
              <SheetEmpty icon="discount" text={!discounts ? "הסנאפשוט לא כולל הנחות." : query.trim() ? "אין תוצאות לחיפוש" : "אין הנחות בסינון הזה"} />
            )}
          />
        </>
      )}
      <Modal visible={filters} transparent animationType="fade" onRequestClose={() => setFilters(false)}>
        <Pressable onPress={() => setFilters(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}>
          <Pressable style={{ backgroundColor: tokens.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 8, paddingBottom: insets.bottom + 12 }}>
            <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "#e3e3e3", marginBottom: 8 }} />
            {TABS.map((item) => (
              <Pressable key={item.id} onPress={() => { setTab(item.id); setFilters(false); }} style={{ height: 48, paddingHorizontal: 20, flexDirection: "row", alignItems: "center" }}>
                <AppText style={{ flex: 1, fontFamily: item.id === tab ? fonts.bold : fonts.regular, fontSize: 16 }}>{item.label}</AppText>
                {item.id === tab ? <Icon name="check" size={18} color={tokens.inkStrong} strokeWidth={2} /> : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={picker} transparent animationType="slide" onRequestClose={() => setPicker(false)}>
        <Pressable onPress={() => setPicker(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}>
          <Pressable style={{ backgroundColor: tokens.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 8, paddingBottom: insets.bottom + 16, paddingHorizontal: 16 }}>
            <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "#e3e3e3", marginBottom: 14 }} />
            <AppText style={{ fontFamily: fonts.bold, fontSize: 18, color: tokens.inkStrong, marginBottom: 12 }}>הוספת הנחה</AppText>
            {DISCOUNT_TYPES.map((type) => (
              <Pressable key={type.kind} onPress={() => create(type.kind)} style={({ pressed }) => ({ borderRadius: 14, backgroundColor: pressed ? "#ebebeb" : tokens.field, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 })}>
                <AppText style={{ fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }}>{type.label}</AppText>
                <AppText style={{ color: tokens.inkSecondary, fontSize: 13, marginTop: 2 }}>{type.detail}</AppText>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </NightScreen>
  );
}

function DiscountRow({ discount, onPress, onLongPress }: { discount: DiscountRecord; onPress: () => void; onLongPress: () => void }) {
  const fonts = useFontSet();
  const badge = knownBadge(DISCOUNT_STATUS, discountStatus(discount));
  const detail = discountLine(discount);
  return (
    <FlatRow onPress={onPress} onLongPress={onLongPress}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <AppText style={{ fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }} numberOfLines={1}>{discount.code || discount.title || "הנחה"}</AppText>
          {detail ? <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }} numberOfLines={2}>{detail}</AppText> : null}
        </View>
        {badge ? <Badge {...badge} /> : null}
      </View>
    </FlatRow>
  );
}
