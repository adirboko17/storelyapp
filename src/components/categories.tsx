import { useMemo, useRef, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import * as Haptics from "expo-haptics";
import { Icon, type IconName } from "@/components/icon";
import { NightScreen, SearchBar, SheetEmpty, type SwitchOption } from "@/components/shell";
import { AppText, ErrorNote, LoadingBlock, refreshControl } from "@/components/ui";
import { formatCount } from "@/lib/format";
import { reorderStoreCollections } from "@/lib/remote";
import { useSession } from "@/lib/session";
import { useStoreData } from "@/lib/store-data";
import type { CollectionRecord } from "@/lib/snapshot";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, tokens } from "@/theme/tokens";

function HeaderButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: tokens.nightRaised,
        opacity: pressed ? 0.55 : 1,
      })}
    >
      <Icon name={icon} size={18} color="#ffffff" strokeWidth={2} />
    </Pressable>
  );
}

function MoveButton({ label, disabled, up, onPress }: { label: string; disabled: boolean; up?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: tokens.field, opacity: disabled ? 0.35 : 1 }}
    >
      <View style={up ? { transform: [{ rotate: "180deg" }] } : undefined}>
        <Icon name="down" size={18} color={tokens.inkStrong} strokeWidth={2} />
      </View>
    </Pressable>
  );
}

function CategoryRow({
  item,
  ordering,
  first,
  last,
  onOpen,
  onShift,
}: {
  item: CollectionRecord;
  ordering: boolean;
  first: boolean;
  last: boolean;
  onOpen: () => void;
  onShift: (delta: -1 | 1) => void;
}) {
  const fonts = useFontSet();
  const meta = [item.hidden ? "מוסתרת" : "גלויה", item.productIds ? `${formatCount(item.productIds.length)} מוצרים` : ""].filter(Boolean).join(" · ");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: tokens.line, backgroundColor: tokens.card }}>
      <Pressable disabled={ordering} onPress={onOpen} style={({ pressed }) => ({ flex: 1, gap: 4, opacity: pressed ? 0.6 : 1 })}>
        <AppText style={{ fontFamily: fonts.bold, fontSize: 17, color: tokens.inkStrong }} numberOfLines={2}>{item.title}</AppText>
        {meta ? <AppText style={{ color: tokens.inkSecondary, fontSize: 15 }} numberOfLines={2}>{meta}</AppText> : null}
        {item.subcategories.length ? (
          <AppText style={{ color: tokens.inkSecondary, fontSize: 15 }} numberOfLines={3}>{`תת קטגוריות · ${item.subcategories.join(" · ")}`}</AppText>
        ) : null}
      </Pressable>
      {ordering ? (
        <View style={{ gap: 6 }}>
          <MoveButton up label={`הזזת ${item.title} למעלה`} disabled={first} onPress={() => onShift(-1)} />
          <MoveButton label={`הזזת ${item.title} למטה`} disabled={last} onPress={() => onShift(1)} />
        </View>
      ) : null}
    </View>
  );
}

export function CategoriesScreen({
  title,
  options,
  allowed,
  loading,
}: {
  title: string;
  options: SwitchOption[];
  allowed: boolean;
  loading: boolean;
}) {
  const fonts = useFontSet();
  const router = useRouter();
  const { storeId } = useSession();
  const { snapshot, refreshing, error, refresh } = useStoreData();
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<string[] | null>(null);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const catalog = snapshot?.collections;
  const ordering = order != null;
  const arranged = useMemo(() => {
    if (!catalog) return [];
    if (!order) return catalog;
    const byId = new Map(catalog.map((item) => [item.id, item]));
    const ranked = order.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
    return [...ranked, ...catalog.filter((item) => !order.includes(item.id))];
  }, [catalog, order]);
  const needle = query.trim().toLowerCase();
  const shown = ordering || !needle ? arranged : arranged.filter((item) => `${item.title} ${item.subcategories.join(" ")}`.toLowerCase().includes(needle));

  function beginOrder() {
    if (!catalog || catalog.length < 2) {
      setProblem("צריך לפחות שתי קטגוריות כדי לשנות את הסדר.");
      return;
    }
    setProblem("");
    setQuery("");
    setOrder(catalog.map((item) => item.id));
  }

  function shift(id: string, delta: -1 | 1) {
    if (!order) return;
    const from = order.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= order.length) return;
    setOrder((current) => {
      if (!current) return current;
      const start = current.indexOf(id);
      const dest = start + delta;
      if (start < 0 || dest < 0 || dest >= current.length) return current;
      const next = current.slice();
      const [item] = next.splice(start, 1);
      if (!item) return current;
      next.splice(dest, 0, item);
      return next;
    });
    void Haptics.selectionAsync().catch(() => undefined);
  }

  async function saveOrder() {
    if (saving.current || !order || !catalog) return;
    const titles = arranged.map((item) => item.title);
    if (titles.join("\0") === catalog.map((item) => item.title).join("\0")) {
      setOrder(null);
      return;
    }
    if (!storeId) {
      setProblem("אין חנות נבחרת.");
      return;
    }
    saving.current = true;
    setBusy(true);
    setProblem("");
    try {
      await reorderStoreCollections(storeId, titles);
      setOrder(null);
      await refresh();
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "לא הצלחנו לשמור את הסדר.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const actions = !loading && allowed ? (
    ordering ? (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <Pressable accessibilityRole="button" onPress={() => { if (!busy) setOrder(null); }} disabled={busy} hitSlop={8}>
          <AppText style={{ color: "#ffffff", fontSize: 16, fontFamily: fonts.medium }}>ביטול</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => void saveOrder()} disabled={busy} hitSlop={8}>
          <AppText style={{ color: "#ffffff", fontSize: 16, fontFamily: fonts.bold }}>{busy ? "שומר…" : "שמירה"}</AppText>
        </Pressable>
      </View>
    ) : (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <HeaderButton icon="plus" label="הוספת קטגוריה" onPress={() => router.push("/more/area/collections/new" as Href)} />
        <HeaderButton icon="dots" label="שינוי סדר הקטגוריות" onPress={beginOrder} />
      </View>
    )
  ) : undefined;

  return (
    <NightScreen title={title} options={options} actions={actions}>
      {loading ? <LoadingBlock /> : !allowed ? <SheetEmpty text="אין הרשאה למסך הזה." /> : (
        <View style={{ flex: 1, backgroundColor: tokens.card }}>
          {ordering ? (
            <AppText style={{ color: tokens.inkSecondary, fontSize: 15, paddingHorizontal: 16, paddingTop: 14 }}>הזיזו את הקטגוריות, ואז שמרו. הסדר יופיע גם באתר.</AppText>
          ) : (
            <SearchBar size="large" value={query} onChange={setQuery} placeholder="חיפוש קטגוריות" />
          )}
          {problem ? <ErrorNote text={problem} /> : null}
          {error ? <ErrorNote text={error} /> : null}
          <FlatList
            data={shown}
            keyExtractor={(item) => item.id}
            extraData={order}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ flexGrow: 1, paddingBottom: TAB_SPACE + 12 }}
            refreshControl={ordering ? undefined : refreshControl(refreshing, () => void refresh())}
            ListEmptyComponent={error ? undefined : (
              <SheetEmpty text={!catalog ? "הסנאפשוט לא כולל קטגוריות." : needle ? "אין תוצאות לחיפוש" : "אין קטגוריות עדיין"} />
            )}
            renderItem={({ item, index }) => (
              <CategoryRow
                item={item}
                ordering={ordering}
                first={index === 0}
                last={index === shown.length - 1}
                onOpen={() => router.push(`/more/area/collections/${encodeURIComponent(item.id)}` as Href)}
                onShift={(delta) => shift(item.id, delta)}
              />
            )}
          />
        </View>
      )}
    </NightScreen>
  );
}
