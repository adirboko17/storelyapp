import { useMemo, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/icon";
import { NightScreen, SearchBar, SheetEmpty, type SwitchOption } from "@/components/shell";
import { AppText, ErrorNote, LoadingBlock, refreshControl } from "@/components/ui";
import { formatCount } from "@/lib/format";
import { reorderStoreCollections, saveStoreCollection } from "@/lib/remote";
import { useSession } from "@/lib/session";
import { useStoreData } from "@/lib/store-data";
import type { CollectionRecord } from "@/lib/snapshot";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, tokens } from "@/theme/tokens";

type Sheet = "menu" | "subcategory";

function sameName(left: string, right: string) {
  return left.trim().localeCompare(right.trim(), "he", { sensitivity: "accent" }) === 0;
}

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
  const insets = useSafeAreaInsets();
  const { storeId } = useSession();
  const { snapshot, refreshing, error, refresh } = useStoreData();
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<string[] | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [menuNote, setMenuNote] = useState("");
  const [formError, setFormError] = useState("");
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

  function openCategory() {
    setSheet(null);
    router.push("/more/area/collections/new" as Href);
  }

  function openSubcategory() {
    if (!catalog?.length) {
      setMenuNote("קודם מוסיפים קטגוריה.");
      return;
    }
    setParentId(catalog[0]?.id ?? "");
    setName("");
    setFormError("");
    setSheet("subcategory");
  }

  async function submit() {
    if (saving.current) return;
    const title = name.trim();
    if (!title) {
      setFormError("הקלידו שם.");
      return;
    }
    if (!storeId) {
      setFormError("אין חנות נבחרת.");
      return;
    }
    const list = catalog ?? [];
    const parent = list.find((item) => item.id === parentId) ?? list[0];
    if (!parent) {
      setFormError("קודם מוסיפים קטגוריה.");
      return;
    }
    if (parent.subcategories.some((item) => sameName(item, title))) {
      setFormError("יש כבר תת קטגוריה בשם הזה.");
      return;
    }
    if (!parent.productIds || !parent.conditions) {
      setFormError("חסרים פרטי הקטגוריה. משכו את הרשימה לרענון ונסו שוב.");
      return;
    }
    const kept = parent.conditions.filter((rule) => !rule || typeof rule !== "object" || (rule as { field?: unknown }).field !== "subcategory");
    saving.current = true;
    setBusy(true);
    setFormError("");
    try {
      await saveStoreCollection(storeId, {
        title: parent.title,
        description: parent.description ?? "",
        productIds: parent.productIds,
        conditions: [...kept, ...[...parent.subcategories, title].map((value) => ({ field: "subcategory", op: "is", value }))],
        excludeOutOfStock: parent.excludeOutOfStock === true,
        image: parent.image ?? "",
        hidden: parent.hidden === true,
      });
      setSheet(null);
      setName("");
      await refresh();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "לא הצלחנו להוסיף את התת קטגוריה.");
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
        <HeaderButton icon="plus" label="הוספת קטגוריה או תת קטגוריה" onPress={() => { setMenuNote(""); setSheet("menu"); }} />
        <HeaderButton icon="dots" label="שינוי סדר הקטגוריות" onPress={beginOrder} />
      </View>
    )
  ) : undefined;

  const parent = catalog?.find((item) => item.id === parentId) ?? catalog?.[0];

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
      <Modal visible={sheet != null} transparent animationType="slide" onRequestClose={() => { if (!busy) setSheet(null); }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable onPress={() => { if (!busy) setSheet(null); }} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.35)" }} />
          <View style={{ backgroundColor: "#ffffff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) + 8, direction: "rtl" }}>
              <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "#d4d4d4", marginBottom: 8 }} />
              {sheet === "subcategory" ? (
                <View style={{ paddingHorizontal: 16, gap: 12, paddingTop: 8 }}>
                  <AppText style={{ fontFamily: fonts.bold, fontSize: 18, color: tokens.inkStrong }}>הוספת תת קטגוריה</AppText>
                  {sheet === "subcategory" && parent ? (
                    catalog && catalog.length > 1 ? (
                      <FlatList
                          style={{ maxHeight: 220 }}
                          data={catalog}
                          keyExtractor={(item) => item.id}
                          keyboardShouldPersistTaps="handled"
                          renderItem={({ item }) => {
                            const on = item.id === parent.id;
                            return (
                              <Pressable onPress={() => setParentId(item.id)} style={{ height: 48, flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <AppText style={{ flex: 1, fontSize: 16, fontFamily: on ? fonts.bold : fonts.regular, color: tokens.inkStrong }} numberOfLines={1}>{item.title}</AppText>
                                {on ? <Icon name="check" size={16} color={tokens.inkStrong} strokeWidth={2} /> : null}
                              </Pressable>
                            );
                          }}
                        />
                    ) : (
                      <AppText style={{ fontSize: 16, color: tokens.inkSecondary }}>{`בתוך ${parent.title}`}</AppText>
                    )
                  ) : null}
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    autoFocus
                    maxLength={80}
                    placeholder="שם התת קטגוריה"
                    placeholderTextColor="#8a8a8a"
                    onSubmitEditing={() => void submit()}
                    style={{ height: 52, borderRadius: 12, backgroundColor: tokens.field, paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 17, color: tokens.inkStrong, textAlign: "right", writingDirection: "rtl" }}
                  />
                  {formError ? <AppText style={{ color: tokens.negative, fontSize: 15 }}>{formError}</AppText> : null}
                  <Pressable accessibilityRole="button" onPress={() => void submit()} disabled={busy} style={{ height: 48, borderRadius: 12, backgroundColor: tokens.inkStrong, alignItems: "center", justifyContent: "center", opacity: busy ? 0.7 : 1 }}>
                    <AppText style={{ color: "#ffffff", fontFamily: fonts.bold, fontSize: 16 }}>{busy ? "שומר…" : "שמירה"}</AppText>
                  </Pressable>
                </View>
              ) : (
                <View style={{ paddingTop: 4 }}>
                  <AppText style={{ textAlign: "center", fontFamily: fonts.semibold, fontSize: 13, color: tokens.inkSecondary, paddingBottom: 14 }}>הוספה</AppText>
                  <AddOption icon="tag" title="קטגוריה" detail="קבוצת מוצרים חדשה בחנות" onPress={openCategory} />
                  <AddOption icon="layers" title="תת קטגוריה" detail="בתוך קטגוריה שכבר קיימת" onPress={openSubcategory} />
                  {menuNote ? <AppText style={{ color: tokens.negative, fontSize: 14, paddingHorizontal: 20, paddingBottom: 8 }}>{menuNote}</AppText> : null}
                </View>
              )}
            </View>
        </KeyboardAvoidingView>
      </Modal>
    </NightScreen>
  );
}

function AddOption({ icon, title, detail, onPress }: { icon: IconName; title: string; detail: string; onPress: () => void }) {
  const fonts = useFontSet();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        marginHorizontal: 16,
        marginBottom: 10,
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderRadius: 18,
        backgroundColor: pressed ? "#ececec" : "#f4f4f4",
      })}
    >
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={20} color={tokens.inkStrong} strokeWidth={1.7} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={{ fontFamily: fonts.semibold, fontSize: 16, color: tokens.inkStrong }}>{title}</AppText>
        <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>{detail}</AppText>
      </View>
      <Icon name="forward" size={16} color="#c4c4c4" strokeWidth={2} />
    </Pressable>
  );
}
