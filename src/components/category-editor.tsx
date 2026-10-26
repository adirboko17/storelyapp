import { useMemo, useRef, useState } from "react";
import { Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/icon";
import { Thumb, useStatusBar } from "@/components/shell";
import { AppText, ErrorNote } from "@/components/ui";
import { saveStoreCollection } from "@/lib/remote";
import { useSession } from "@/lib/session";
import { useStoreData } from "@/lib/store-data";
import type { ProductRecord } from "@/lib/snapshot";
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
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [hidden, setHidden] = useState(false);
  const [excludeOutOfStock, setExcludeOutOfStock] = useState(false);
  const [image, setImage] = useState("");
  const [panel, setPanel] = useState<"products" | "subs" | "visibility" | "stock" | "image" | null>(null);
  const [subName, setSubName] = useState("");
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
  const dirty = Boolean(title.trim() || description.trim() || productIds.length || subcategories.length || hidden || excludeOutOfStock || image);
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

  function addSubcategory() {
    const name = subName.trim();
    if (!name) return;
    if (subcategories.some((item) => sameName(item, name))) {
      setSubName("");
      return;
    }
    setSubcategories((current) => [...current, name]);
    setSubName("");
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
        conditions: subcategories.map((value) => ({ field: "subcategory", op: "is", value })),
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
            <SettingRow icon="layers" label="תת קטגוריות" value={subcategories.length ? subcategories.join(" · ") : "אין"} onPress={() => setPanel("subs")} />
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

      <Modal visible={panel === "subs" || panel === "visibility" || panel === "stock"} transparent animationType="slide" onRequestClose={() => setPanel(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable onPress={() => setPanel(null)} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.35)" }} />
          <View style={{ backgroundColor: "#ffffff", borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) + 8, direction: "rtl" }}>
            <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "#d4d4d4", marginBottom: 8 }} />
            {panel === "subs" ? (
              <View style={{ paddingHorizontal: 16, gap: 10, paddingBottom: 8 }}>
                <AppText style={{ fontFamily: fonts.bold, fontSize: 18, color: tokens.inkStrong }}>תת קטגוריות</AppText>
                {subcategories.map((name) => (
                  <View key={name} style={{ flexDirection: "row", alignItems: "center", minHeight: 44, gap: 8 }}>
                    <AppText style={{ flex: 1, fontSize: 16, color: tokens.inkStrong }}>{name}</AppText>
                    <Pressable accessibilityLabel={`הסרת ${name}`} onPress={() => setSubcategories((current) => current.filter((item) => item !== name))} hitSlop={8}>
                      <Icon name="close" size={16} color={tokens.inkSecondary} strokeWidth={2} />
                    </Pressable>
                  </View>
                ))}
                <TextInput
                  value={subName}
                  onChangeText={setSubName}
                  placeholder="שם התת קטגוריה"
                  placeholderTextColor="#8a8a8a"
                  onSubmitEditing={addSubcategory}
                  style={{ height: 48, borderRadius: 12, backgroundColor: tokens.field, paddingHorizontal: 14, fontFamily: fonts.regular, fontSize: 16, color: tokens.inkStrong, textAlign: "right", writingDirection: "rtl" }}
                />
                <Pressable onPress={addSubcategory} style={{ height: 48, borderRadius: 12, backgroundColor: tokens.inkStrong, alignItems: "center", justifyContent: "center" }}>
                  <AppText style={{ color: "#ffffff", fontFamily: fonts.bold, fontSize: 16 }}>הוספה</AppText>
                </Pressable>
              </View>
            ) : null}
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
