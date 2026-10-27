import { useMemo, useRef, useState } from "react";
import { Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/icon";
import { SheetEmpty, Thumb, useStatusBar } from "@/components/shell";
import { AppText, ErrorNote } from "@/components/ui";
import { formatCount, formatIls } from "@/lib/format";
import { saveStoreCollection, type CollectionWrite } from "@/lib/remote";
import { useSession } from "@/lib/session";
import { useStoreData } from "@/lib/store-data";
import type { CollectionRecord, ProductRecord } from "@/lib/snapshot";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, tokens } from "@/theme/tokens";

const PAGE = "#f7f7f7";

function sameName(left: string, right: string) {
  return left.trim().localeCompare(right.trim(), "he", { sensitivity: "accent" }) === 0;
}

function isPhoto(uri: string) {
  return /^https:\/\//i.test(uri) && !/\.(mp4|webm|mov)(\?|$)/i.test(uri);
}

function CircleButton({ icon, onPress, label, filled = false }: { icon: IconName; onPress: () => void; label: string; filled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: filled ? tokens.inkStrong : "#ffffff",
        opacity: pressed ? 0.65 : 1,
        shadowColor: "#000",
        shadowOpacity: filled ? 0 : 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: filled ? 0 : 2,
      })}
    >
      <Icon name={icon} size={18} color={filled ? "#ffffff" : tokens.inkStrong} strokeWidth={2} />
    </Pressable>
  );
}

function SectionTitle({ text }: { text: string }) {
  const fonts = useFontSet();
  return (
    <AppText style={{ fontFamily: fonts.bold, fontSize: 17, color: tokens.inkStrong, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 12 }}>{text}</AppText>
  );
}

function SettingRow({ icon, label, value, onPress, last = false }: { icon: IconName; label: string; value?: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 54, paddingHorizontal: 20, borderBottomWidth: last ? 0 : 1, borderBottomColor: "#ececec", opacity: pressed ? 0.55 : 1 })}
    >
      <Icon name={icon} size={20} color={tokens.inkStrong} strokeWidth={1.6} />
      <AppText style={{ flex: 1, fontSize: 16, color: tokens.inkStrong }}>{label}</AppText>
      {value ? <AppText style={{ maxWidth: "38%", fontSize: 15, color: "#8a8a8a" }} numberOfLines={1}>{value}</AppText> : null}
      <Icon name="forward" size={15} color="#c8c8c8" strokeWidth={2} />
    </Pressable>
  );
}

export function CategoryEditor() {
  const fonts = useFontSet();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { storeId } = useSession();
  const { snapshot, refresh } = useStoreData();
  const saving = useRef(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [hidden, setHidden] = useState(false);
  const [excludeOutOfStock, setExcludeOutOfStock] = useState(false);
  const [image, setImage] = useState("");
  const [panel, setPanel] = useState<"products" | "visibility" | "stock" | "image" | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [error, setError] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  useStatusBar("dark");

  const products = snapshot?.products ?? [];
  const photos = useMemo(() => {
    const urls = (snapshot?.products ?? []).flatMap((product) => product.media ?? []).filter(isPhoto);
    return [...new Set(urls)].slice(0, 80);
  }, [snapshot?.products]);
  const selected = productIds.flatMap((id) => {
    const product = products.find((item) => item.id === id);
    return product ? [product] : [];
  });
  const dirty = Boolean(title.trim() || description.trim() || productIds.length || hidden || excludeOutOfStock || image);
  const ready = Boolean(title.trim()) && !busy;

  function close() {
    if (!dirty || busy) {
      router.back();
      return;
    }
    Alert.alert("לצאת בלי שמירה?", undefined, [
      { text: "המשך עריכה", style: "cancel" },
      { text: "יציאה", style: "destructive", onPress: () => router.back() },
    ]);
  }

  async function save() {
    if (saving.current) return;
    const clean = title.trim();
    if (!clean) {
      setError("יש להזין שם לקטגוריה");
      return;
    }
    if ((snapshot?.collections ?? []).some((item) => sameName(item.title, clean))) {
      setError("יש כבר קטגוריה בשם הזה");
      return;
    }
    if (!storeId) {
      setProblem("אין חנות נבחרת.");
      return;
    }
    saving.current = true;
    setBusy(true);
    setError("");
    setProblem("");
    try {
      await saveStoreCollection(storeId, {
        title: clean,
        description: description.trim(),
        productIds,
        conditions: [],
        excludeOutOfStock,
        image,
        hidden,
      });
      await refresh();
      router.back();
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "לא הצלחנו לשמור את הקטגוריה.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: PAGE }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 16, paddingBottom: 4, flexDirection: "row", alignItems: "center" }}>
        <CircleButton icon="back" label="חזרה" onPress={close} />
        <View style={{ flex: 1 }} />
        <CircleButton icon="check" label="שמירה" filled={ready} onPress={() => void save()} />
      </View>
      {problem ? <ErrorNote text={problem} /> : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: TAB_SPACE + 24 }}>
          <Pressable onPress={() => setPanel("image")} style={{ alignItems: "center", paddingTop: 28, paddingBottom: 6 }}>
            <View style={{ width: 104, height: 104, borderRadius: 26, backgroundColor: "#efefef", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {isPhoto(image) ? <Image source={{ uri: image }} style={{ width: 104, height: 104 }} /> : <Icon name="image" size={28} color="#bdbdbd" strokeWidth={1.5} />}
            </View>
            <AppText style={{ marginTop: 8, fontSize: 14, color: "#8a8a8a" }}>{image ? "החלפת תמונה" : "הוספת תמונה"}</AppText>
          </Pressable>

          <TextInput
            value={title}
            onChangeText={(value) => { setTitle(value); setError(""); }}
            placeholder="כותרת"
            placeholderTextColor={tokens.inkStrong}
            style={{ marginTop: 28, paddingHorizontal: 20, paddingVertical: 6, fontFamily: fonts.bold, fontSize: 20, color: tokens.inkStrong, textAlign: "right", writingDirection: "rtl" }}
          />
          {error ? <AppText style={{ color: tokens.negative, fontSize: 13, paddingHorizontal: 20, paddingBottom: 4 }}>{error}</AppText> : null}

          {descriptionOpen ? (
            <TextInput
              value={description}
              onChangeText={setDescription}
              autoFocus
              multiline
              placeholder="תיאור"
              placeholderTextColor="#8a8a8a"
              style={{ minHeight: 84, marginTop: 4, paddingHorizontal: 20, paddingVertical: 10, fontFamily: fonts.regular, fontSize: 16, color: tokens.inkStrong, textAlign: "right", writingDirection: "rtl" }}
            />
          ) : (
            <Pressable onPress={() => setDescriptionOpen(true)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, marginTop: 2, paddingHorizontal: 20, opacity: pressed ? 0.55 : 1 })}>
              <AppText style={{ flex: 1, fontSize: 16, color: description.trim() ? tokens.inkStrong : "#8a8a8a" }} numberOfLines={2}>{description.trim() || "תיאור"}</AppText>
              <Icon name="forward" size={15} color="#c8c8c8" strokeWidth={2} />
            </Pressable>
          )}

          <SectionTitle text="מוצרים" />
          <Pressable
            onPress={() => setPanel("products")}
            style={({ pressed }) => ({
              marginHorizontal: 20,
              height: 56,
              borderRadius: 16,
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: "#d6d6d6",
              backgroundColor: "#ffffff",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon name="circlePlus" size={18} color={tokens.inkStrong} strokeWidth={1.6} />
            <AppText style={{ fontFamily: fonts.medium, fontSize: 16, color: tokens.inkStrong }}>הוספה לקטגוריה</AppText>
          </Pressable>
          {selected.map((product) => (
            <ProductLine key={product.id} product={product} onRemove={() => setProductIds((current) => current.filter((id) => id !== product.id))} />
          ))}

          <SectionTitle text="הגדרות" />
          <View>
            <SettingRow icon="store" label="תצוגה בחנות" value={hidden ? "מוסתרת" : "גלויה"} onPress={() => setPanel("visibility")} />
            <SettingRow icon="box" label="מוצרים שאזלו" value={excludeOutOfStock ? "מוסתרים" : "מוצגים"} onPress={() => setPanel("stock")} last />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={panel === "products"} animationType="slide" onRequestClose={() => setPanel(null)}>
        <ProductPicker
          products={products}
          selected={productIds}
          query={productQuery}
          onQuery={setProductQuery}
          onClose={() => setPanel(null)}
          onToggle={(id) => setProductIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
        />
      </Modal>

      <Modal visible={panel === "image"} animationType="slide" onRequestClose={() => setPanel(null)}>
        <ImagePicker photos={photos} onClose={() => setPanel(null)} onPick={(uri) => { setImage(uri); setPanel(null); }} />
      </Modal>

      <Modal visible={panel === "visibility" || panel === "stock"} transparent animationType="slide" onRequestClose={() => setPanel(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable onPress={() => setPanel(null)} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.35)" }} />
          <View style={{ backgroundColor: "#ffffff", borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) + 8, direction: "rtl" }}>
            <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "#d4d4d4", marginBottom: 8 }} />
            {panel === "visibility" ? (
              <View>
                <Choice label="גלויה בחנות" on={hidden === false} onPress={() => { setHidden(false); setPanel(null); }} />
                <Choice label="מוסתרת" on={hidden === true} onPress={() => { setHidden(true); setPanel(null); }} />
              </View>
            ) : null}
            {panel === "stock" ? (
              <View>
                <Choice label="להציג גם מוצרים שאזלו" on={!excludeOutOfStock} onPress={() => { setExcludeOutOfStock(false); setPanel(null); }} />
                <Choice label="להסתיר מוצרים שאזלו" on={excludeOutOfStock} onPress={() => { setExcludeOutOfStock(true); setPanel(null); }} />
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function ProductLine({ product, onRemove }: { product: ProductRecord; onRemove: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 10 }}>
      <Thumb uri={product.media?.[0]} />
      <AppText style={{ flex: 1, fontSize: 16, color: tokens.inkStrong }} numberOfLines={2}>{product.title || "ללא שם"}</AppText>
      <Pressable accessibilityLabel={`הסרת ${product.title || "מוצר"}`} onPress={onRemove} hitSlop={8}>
        <Icon name="close" size={16} color={tokens.inkSecondary} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

function Choice({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const fonts = useFontSet();
  return (
    <Pressable onPress={onPress} style={{ height: 54, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 8 }}>
      <AppText style={{ flex: 1, fontSize: 16, fontFamily: on ? fonts.bold : fonts.regular, color: tokens.inkStrong }}>{label}</AppText>
      {on ? <Icon name="check" size={16} color={tokens.inkStrong} strokeWidth={2} /> : null}
    </Pressable>
  );
}

function ProductPicker({
  products,
  selected,
  query,
  onQuery,
  onClose,
  onToggle,
}: {
  products: ProductRecord[];
  selected: string[];
  query: string;
  onQuery: (value: string) => void;
  onClose: () => void;
  onToggle: (id: string) => void;
}) {
  const fonts = useFontSet();
  const insets = useSafeAreaInsets();
  const needle = query.trim().toLowerCase();
  const rows = products.filter((product) => !needle || `${product.title ?? ""} ${product.sku ?? ""}`.toLowerCase().includes(needle));
  return (
    <View style={{ flex: 1, backgroundColor: "#ffffff", paddingTop: insets.top + 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8 }}>
        <CircleButton icon="close" label="סגירה" onPress={onClose} />
        <AppText style={{ flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 17, color: tokens.inkStrong }}>הוספה לקטגוריה</AppText>
        <View style={{ width: 36 }} />
      </View>
      <View style={{ marginHorizontal: 16, marginBottom: 8, height: 44, borderRadius: 12, backgroundColor: tokens.field, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 }}>
        <Icon name="search" size={16} color={tokens.inkSecondary} strokeWidth={1.8} />
        <TextInput
          value={query}
          onChangeText={onQuery}
          placeholder="חיפוש מוצרים"
          placeholderTextColor="#8a8a8a"
          style={{ flex: 1, height: 44, fontFamily: fonts.regular, fontSize: 16, color: tokens.inkStrong, textAlign: "right", writingDirection: "rtl" }}
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ListEmptyComponent={<AppText style={{ textAlign: "center", color: tokens.inkSecondary, paddingTop: 40 }}>{products.length ? "אין תוצאות לחיפוש" : "אין מוצרים בחנות."}</AppText>}
        renderItem={({ item }) => {
          const on = selected.includes(item.id);
          return (
            <Pressable onPress={() => onToggle(item.id)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
              <Thumb uri={item.media?.[0]} />
              <AppText style={{ flex: 1, fontSize: 16, color: tokens.inkStrong }} numberOfLines={2}>{item.title || "ללא שם"}</AppText>
              <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: on ? 0 : 1, borderColor: "#cfcfcf", backgroundColor: on ? tokens.inkStrong : "#ffffff", alignItems: "center", justifyContent: "center" }}>
                {on ? <Icon name="check" size={14} color="#ffffff" strokeWidth={2} /> : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function ImagePicker({ photos, onClose, onPick }: { photos: string[]; onClose: () => void; onPick: (uri: string) => void }) {
  const fonts = useFontSet();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: "#ffffff", paddingTop: insets.top + 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12 }}>
        <CircleButton icon="close" label="סגירה" onPress={onClose} />
        <AppText style={{ flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 17, color: tokens.inkStrong }}>תמונת קטגוריה</AppText>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 12 }}>
        <Pressable onPress={() => onPick("")} style={{ height: 48, justifyContent: "center" }}>
          <AppText style={{ fontSize: 16, color: tokens.inkStrong }}>בלי תמונה</AppText>
        </Pressable>
        {photos.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {photos.map((uri) => (
              <Pressable key={uri} onPress={() => onPick(uri)}>
                <Image source={{ uri }} style={{ width: 104, height: 104, borderRadius: 16, backgroundColor: "#ececec" }} />
              </Pressable>
            ))}
          </View>
        ) : (
          <AppText style={{ color: tokens.inkSecondary, fontSize: 15, textAlign: "center", paddingTop: 24 }}>אין תמונות במוצרים.</AppText>
        )}
      </ScrollView>
    </View>
  );
}

type CategoryDraft = {
  title: string;
  description: string;
  productIds: string[];
  subcategories: string[];
  hidden: boolean;
  excludeOutOfStock: boolean;
  image: string;
  baseConditions: unknown[];
  writable: boolean;
};

function otherConditions(rules: unknown[] | undefined) {
  return (rules ?? []).filter((rule) => !rule || typeof rule !== "object" || (rule as { field?: unknown }).field !== "subcategory");
}

function buildDraft(item: CollectionRecord, products: ProductRecord[]): CategoryDraft {
  const ids = new Set(item.productIds ?? []);
  products.forEach((product) => {
    if (product.category && sameName(product.category, item.title)) ids.add(product.id);
  });
  return {
    title: item.title,
    description: item.description ?? "",
    productIds: [...ids],
    subcategories: [...item.subcategories],
    hidden: item.hidden === true,
    excludeOutOfStock: item.excludeOutOfStock === true,
    image: item.image ?? "",
    baseConditions: otherConditions(item.conditions),
    writable: item.productIds != null && item.conditions != null,
  };
}

function toWrite(draft: CategoryDraft): CollectionWrite {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    productIds: draft.productIds,
    conditions: [...draft.baseConditions, ...draft.subcategories.map((value) => ({ field: "subcategory", op: "is", value }))],
    excludeOutOfStock: draft.excludeOutOfStock,
    image: draft.image,
    hidden: draft.hidden,
  };
}

function productMeta(product: ProductRecord) {
  if (product.variant?.trim()) return product.variant.trim();
  if (product.stock != null) return `${formatCount(product.stock)} במלאי`;
  if (product.price != null) return formatIls(product.price);
  return "";
}

function countLabel(count: number, noun: string, empty: string) {
  return count ? `${formatCount(count)} ${noun}` : empty;
}

export function CategoryPage({ id }: { id: string }) {
  const fonts = useFontSet();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { storeId } = useSession();
  const { snapshot, refresh } = useStoreData();
  const saving = useRef(false);
  const pending = useRef<CategoryDraft | null>(null);
  const [draft, setDraft] = useState<CategoryDraft | null>(null);
  const [saved, setSaved] = useState<CategoryDraft | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [panel, setPanel] = useState<"desc" | "products" | "subs" | "visibility" | "stock" | "image" | "all" | null>(null);
  const [descDraft, setDescDraft] = useState("");
  const [subName, setSubName] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [formError, setFormError] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  useStatusBar("dark");
  const item = snapshot?.collections?.find((collection) => collection.id === id) ?? null;
  if (draftId !== id) {
    setDraftId(id);
    setPanel(null);
    if (item) {
      const next = buildDraft(item, snapshot?.products ?? []);
      setSaved(next);
      setDraft(next);
    } else {
      setSaved(null);
      setDraft(null);
    }
  }

  const products = useMemo(() => snapshot?.products ?? [], [snapshot?.products]);
  const photos = useMemo(() => {
    const urls = products.flatMap((product) => product.media ?? []).filter(isPhoto);
    return [...new Set(urls)].slice(0, 80);
  }, [products]);
  const selected = draft ? draft.productIds.flatMap((productId) => {
    const product = products.find((item) => item.id === productId);
    return product ? [product] : [];
  }) : [];

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace("/more/area/collections" as Href);
  }

  async function persist(next: CategoryDraft) {
    if (!next.writable) {
      setProblem("חסרים פרטי הקטגוריה. חזרו אחורה ורעננו את הרשימה.");
      return;
    }
    if (!next.title.trim()) {
      setProblem("יש להזין שם לקטגוריה");
      return;
    }
    if (!storeId) {
      setProblem("אין חנות נבחרת.");
      return;
    }
    pending.current = next;
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setProblem("");
    let stored = saved;
    try {
      while (pending.current) {
        const current = pending.current;
        pending.current = null;
        await saveStoreCollection(storeId, toWrite(current));
        stored = current;
        setSaved(current);
      }
      await refresh();
    } catch (caught) {
      pending.current = null;
      if (stored) setDraft(stored);
      setProblem(caught instanceof Error ? caught.message : "לא הצלחנו לשמור את הקטגוריה.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  function commit(next: CategoryDraft) {
    if (!next.writable) {
      setProblem("חסרים פרטי הקטגוריה. חזרו אחורה ורעננו את הרשימה.");
      if (saved) setDraft(saved);
      return;
    }
    setDraft(next);
    void persist(next);
  }

  function commitTitle(value: string) {
    if (!draft || !saved) return;
    const clean = value.trim();
    if (!clean) {
      setProblem("יש להזין שם לקטגוריה");
      setDraft(saved);
      return;
    }
    if (sameName(clean, saved.title)) {
      if (draft.title !== saved.title) setDraft(saved);
      return;
    }
    if ((snapshot?.collections ?? []).some((entry) => entry.id !== id && sameName(entry.title, clean))) {
      setProblem("יש כבר קטגוריה בשם הזה");
      setDraft(saved);
      return;
    }
    commit({ ...draft, title: clean });
  }

  function openDescription() {
    if (!draft) return;
    setDescDraft(draft.description);
    setPanel("desc");
  }

  function saveDescription() {
    setPanel(null);
    if (!draft || descDraft.trim() === draft.description.trim()) return;
    commit({ ...draft, description: descDraft.trim() });
  }

  function addSubcategory() {
    if (!draft) return;
    const name = subName.trim();
    if (!name) {
      setFormError("הקלידו שם.");
      return;
    }
    if (draft.subcategories.some((entry) => sameName(entry, name))) {
      setFormError("יש כבר תת קטגוריה בשם הזה.");
      return;
    }
    setSubName("");
    setFormError("");
    setPanel(null);
    commit({ ...draft, subcategories: [...draft.subcategories, name] });
  }

  function removeSubcategory(name: string) {
    if (!draft) return;
    commit({ ...draft, subcategories: draft.subcategories.filter((entry) => entry !== name) });
  }

  function closeProducts() {
    setPanel(null);
    if (!draft || !saved) return;
    if (draft.productIds.join("\0") === saved.productIds.join("\0")) return;
    if (!draft.writable) {
      setDraft(saved);
      setProblem("חסרים פרטי הקטגוריה. חזרו אחורה ורעננו את הרשימה.");
      return;
    }
    void persist(draft);
  }

  if (!draft) {
    return (
      <View style={{ flex: 1, backgroundColor: PAGE }}>
        <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 16 }}>
          <CircleButton icon="back" label="חזרה" onPress={close} />
        </View>
        <SheetEmpty text="הקטגוריה לא נמצאה." />
      </View>
    );
  }

  const shown = draft;

  return (
    <View style={{ flex: 1, backgroundColor: PAGE }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 16, paddingBottom: 4, flexDirection: "row", alignItems: "center" }}>
        <CircleButton icon="back" label="חזרה" onPress={close} />
        <View style={{ flex: 1 }} />
        {busy ? <AppText style={{ fontSize: 14, color: "#8a8a8a" }}>שומר…</AppText> : <View style={{ width: 40 }} />}
      </View>
      {problem ? <ErrorNote text={problem} /> : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: TAB_SPACE + 24 }}>
          <Pressable onPress={() => setPanel("image")} style={{ alignItems: "center", paddingTop: 18 }}>
            <View style={{ width: 108, height: 108, borderRadius: 26, backgroundColor: "#ececec", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {isPhoto(shown.image) ? <Image source={{ uri: shown.image }} style={{ width: 108, height: 108 }} /> : <Icon name="image" size={28} color="#bdbdbd" strokeWidth={1.5} />}
            </View>
            <AppText style={{ marginTop: 10, fontSize: 14, color: "#8a8a8a" }}>{shown.image ? "החלפת תמונה" : "הוספת תמונת קטגוריה"}</AppText>
          </Pressable>

          <TextInput
            value={shown.title}
            onChangeText={(title) => setDraft({ ...shown, title })}
            onEndEditing={(event) => commitTitle(event.nativeEvent.text)}
            placeholder="שם הקטגוריה"
            placeholderTextColor="#8a8a8a"
            style={{ marginTop: 26, paddingHorizontal: 20, paddingVertical: 4, fontFamily: fonts.bold, fontSize: 22, color: tokens.inkStrong, textAlign: "right", writingDirection: "rtl" }}
          />

          <Pressable onPress={openDescription} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, marginTop: 6, paddingHorizontal: 20, opacity: pressed ? 0.55 : 1 })}>
            <AppText style={{ flex: 1, fontSize: 16, color: shown.description.trim() ? tokens.inkStrong : "#8a8a8a" }} numberOfLines={2}>{shown.description.trim() || "תיאור"}</AppText>
            <Icon name="forward" size={16} color="#c4c4c4" strokeWidth={2} />
          </Pressable>

          <SectionHead title="פריטים בקטגוריה" action={selected.length ? "הצג הכל" : undefined} onAction={selected.length ? () => setPanel("all") : undefined} />
          <AppText style={{ paddingHorizontal: 20, paddingTop: 2, fontSize: 14, color: "#8a8a8a" }}>{countLabel(selected.length, "פריטים", "אין פריטים")}</AppText>
          {selected.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: 12 }} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
              {selected.map((product) => {
                const meta = productMeta(product);
                const uri = (product.media ?? []).find(isPhoto);
                return (
                  <Pressable key={product.id} onPress={() => router.push(`/products/${product.id}` as Href)} style={{ width: 116, gap: 6 }}>
                    <View style={{ width: 116, height: 116, borderRadius: 12, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#ececec", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {uri ? <Image source={{ uri }} style={{ width: 116, height: 116 }} /> : <Icon name="image" size={22} color="#c8c8c8" strokeWidth={1.5} />}
                    </View>
                    <AppText style={{ fontSize: 13, color: tokens.inkStrong, lineHeight: 18 }} numberOfLines={2}>{product.title || "ללא שם"}</AppText>
                    {meta ? <AppText style={{ fontSize: 12, color: "#8a8a8a" }} numberOfLines={1}>{meta}</AppText> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          <SectionHead title="תת קטגוריות" action="הוספה" onAction={() => { setSubName(""); setFormError(""); setPanel("subs"); }} />
          <AppText style={{ paddingHorizontal: 20, paddingTop: 2, fontSize: 14, color: "#8a8a8a" }}>{countLabel(shown.subcategories.length, "תת קטגוריות", "אין תת קטגוריות")}</AppText>
          {shown.subcategories.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20, paddingTop: 12 }}>
              {shown.subcategories.map((name) => (
                <View key={name} style={{ minHeight: 36, paddingStart: 12, paddingEnd: 8, borderRadius: 18, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#ececec", flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <AppText style={{ fontSize: 14, color: tokens.inkStrong }}>{name}</AppText>
                  <Pressable accessibilityRole="button" accessibilityLabel={`הסרת ${name}`} onPress={() => removeSubcategory(name)} hitSlop={6} style={{ width: 22, height: 22, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="close" size={13} color="#8a8a8a" strokeWidth={2} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          <SectionHead title="מקורות" action="הוספה" onAction={() => { setProductQuery(""); setPanel("products"); }} />
          <Pressable onPress={() => { setProductQuery(""); setPanel("products"); }} style={({ pressed }) => ({ marginTop: 12, marginHorizontal: 16, minHeight: 72, borderRadius: 18, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#ececec", paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.7 : 1 })}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#f3f3f3", alignItems: "center", justifyContent: "center" }}>
              <Icon name="tag" size={18} color={tokens.inkStrong} strokeWidth={1.6} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText style={{ fontFamily: fonts.semibold, fontSize: 16, color: tokens.inkStrong }}>מוצרים</AppText>
              <AppText style={{ fontSize: 14, color: "#8a8a8a" }}>{countLabel(selected.length, "מוצרים", "אין מוצרים")}</AppText>
            </View>
            <Icon name="filter" size={18} color={tokens.inkStrong} strokeWidth={1.7} />
          </Pressable>

          <AppText style={{ fontFamily: fonts.bold, fontSize: 18, color: tokens.inkStrong, paddingHorizontal: 20, paddingTop: 32, paddingBottom: 8 }}>הגדרות</AppText>
          <SettingRow icon="store" label="תצוגה בחנות" value={shown.hidden ? "מוסתרת" : "גלויה"} onPress={() => setPanel("visibility")} />
          <SettingRow icon="box" label="מוצרים שאזלו" value={shown.excludeOutOfStock ? "מוסתרים" : "מוצגים"} onPress={() => setPanel("stock")} last />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={panel === "products"} animationType="slide" onRequestClose={closeProducts}>
        <ProductPicker
          products={products}
          selected={shown.productIds}
          query={productQuery}
          onQuery={setProductQuery}
          onClose={closeProducts}
          onToggle={(productId) => setDraft((current) => current ? { ...current, productIds: current.productIds.includes(productId) ? current.productIds.filter((item) => item !== productId) : [...current.productIds, productId] } : current)}
        />
      </Modal>

      <Modal visible={panel === "image"} animationType="slide" onRequestClose={() => setPanel(null)}>
        <ImagePicker photos={photos} onClose={() => setPanel(null)} onPick={(uri) => {
          setPanel(null);
          if (draft && uri !== draft.image) commit({ ...draft, image: uri });
        }} />
      </Modal>

      <Modal visible={panel === "all"} animationType="slide" onRequestClose={() => setPanel(null)}>
        <View style={{ flex: 1, backgroundColor: "#ffffff", paddingTop: insets.top + 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8 }}>
            <CircleButton icon="close" label="סגירה" onPress={() => setPanel(null)} />
            <AppText style={{ flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 17, color: tokens.inkStrong }}>פריטים בקטגוריה</AppText>
            <View style={{ width: 40 }} />
          </View>
          <FlatList
            data={selected}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            renderItem={({ item }) => (
              <Pressable onPress={() => { setPanel(null); router.push(`/products/${item.id}` as Href); }} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
                <Thumb uri={(item.media ?? []).find(isPhoto)} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText style={{ fontSize: 16, color: tokens.inkStrong }} numberOfLines={2}>{item.title || "ללא שם"}</AppText>
                  {productMeta(item) ? <AppText style={{ fontSize: 13, color: "#8a8a8a" }}>{productMeta(item)}</AppText> : null}
                </View>
              </Pressable>
            )}
          />
        </View>
      </Modal>

      <Modal visible={panel === "desc" || panel === "subs" || panel === "visibility" || panel === "stock"} transparent animationType="slide" onRequestClose={() => setPanel(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable onPress={() => setPanel(null)} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.35)" }} />
          <View style={{ backgroundColor: "#ffffff", borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) + 8, direction: "rtl" }}>
            <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "#d4d4d4", marginBottom: 8 }} />
            {panel === "desc" ? (
              <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 8 }}>
                <AppText style={{ fontFamily: fonts.bold, fontSize: 18, color: tokens.inkStrong }}>תיאור</AppText>
                <TextInput
                  value={descDraft}
                  onChangeText={setDescDraft}
                  autoFocus
                  multiline
                  placeholder="תיאור הקטגוריה"
                  placeholderTextColor="#8a8a8a"
                  style={{ minHeight: 120, borderRadius: 12, backgroundColor: tokens.field, paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.regular, fontSize: 16, color: tokens.inkStrong, textAlign: "right", writingDirection: "rtl" }}
                />
                <Pressable onPress={saveDescription} style={{ height: 48, borderRadius: 12, backgroundColor: tokens.inkStrong, alignItems: "center", justifyContent: "center" }}>
                  <AppText style={{ color: "#ffffff", fontFamily: fonts.bold, fontSize: 16 }}>שמירה</AppText>
                </Pressable>
              </View>
            ) : null}
            {panel === "subs" ? (
              <View style={{ paddingHorizontal: 16, gap: 12, paddingBottom: 8 }}>
                <AppText style={{ fontFamily: fonts.bold, fontSize: 18, color: tokens.inkStrong }}>הוספת תת קטגוריה</AppText>
                <AppText style={{ fontSize: 14, color: "#8a8a8a" }}>{`בתוך ${shown.title}`}</AppText>
                <TextInput
                  value={subName}
                  onChangeText={(value) => { setSubName(value); setFormError(""); }}
                  autoFocus
                  maxLength={80}
                  placeholder="שם התת קטגוריה"
                  placeholderTextColor="#8a8a8a"
                  onSubmitEditing={addSubcategory}
                  style={{ height: 52, borderRadius: 12, backgroundColor: tokens.field, paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 17, color: tokens.inkStrong, textAlign: "right", writingDirection: "rtl" }}
                />
                {formError ? <AppText style={{ color: tokens.negative, fontSize: 15 }}>{formError}</AppText> : null}
                <Pressable onPress={addSubcategory} disabled={busy} style={{ height: 48, borderRadius: 12, backgroundColor: tokens.inkStrong, alignItems: "center", justifyContent: "center", opacity: busy ? 0.7 : 1 }}>
                  <AppText style={{ color: "#ffffff", fontFamily: fonts.bold, fontSize: 16 }}>{busy ? "שומר…" : "הוספה"}</AppText>
                </Pressable>
              </View>
            ) : null}
            {panel === "visibility" ? (
              <View>
                <Choice label="גלויה בחנות" on={shown.hidden === false} onPress={() => { setPanel(null); if (shown.hidden) commit({ ...shown, hidden: false }); }} />
                <Choice label="מוסתרת" on={shown.hidden === true} onPress={() => { setPanel(null); if (!shown.hidden) commit({ ...shown, hidden: true }); }} />
              </View>
            ) : null}
            {panel === "stock" ? (
              <View>
                <Choice label="להציג גם מוצרים שאזלו" on={!shown.excludeOutOfStock} onPress={() => { setPanel(null); if (shown.excludeOutOfStock) commit({ ...shown, excludeOutOfStock: false }); }} />
                <Choice label="להסתיר מוצרים שאזלו" on={shown.excludeOutOfStock} onPress={() => { setPanel(null); if (!shown.excludeOutOfStock) commit({ ...shown, excludeOutOfStock: true }); }} />
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const fonts = useFontSet();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 28 }}>
      <AppText style={{ fontFamily: fonts.bold, fontSize: 18, color: tokens.inkStrong }}>{title}</AppText>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <AppText style={{ fontFamily: fonts.medium, fontSize: 16, color: tokens.link }}>{action}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
