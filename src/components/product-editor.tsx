import { useRef, useState, type ReactNode } from "react";
import { Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Switch, TextInput, useWindowDimensions, View, type ScrollViewInstance, type TextInputProps } from "react-native";
import { useRouter, type Href } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/icon";
import { Thumb, useStatusBar } from "@/components/shell";
import { AppText, Badge, ErrorNote } from "@/components/ui";
import { formatCount, formatIls } from "@/lib/format";
import { PRODUCT_BADGE } from "@/lib/orders";
import { draftFrom, isVideoMedia, PartialSave, saveProduct, type PickedMedia, type ProductDraft, type ProductStatus, type RawPage } from "@/lib/product-save";
import { useSession } from "@/lib/session";
import type { ProductBundle, ProductRecord } from "@/lib/snapshot";
import { useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, tokens } from "@/theme/tokens";

const FIELD_BORDER = "#c9c9c9";
const BAND = "#f1f1f1";
const TILE = 96;
const STATUSES: ProductStatus[] = ["active", "draft", "archived"];

type Entry = Record<string, unknown>;
type Values = Record<string, string>;

type FieldDef = {
  key: string;
  label: string;
  max: number;
  multiline?: boolean;
  ltr?: boolean;
  optional?: boolean;
  numeric?: "int" | "price";
  placeholder?: string;
  options?: { id: string; label: string }[];
};

type ListDef = {
  key: string;
  title: string;
  hint: string;
  add: string;
  max: number;
  fields: FieldDef[];
  make?: Entry;
  check?: (values: Values) => string | null;
};

type Form = Omit<ProductDraft, "price" | "compareAt" | "cost" | "stock" | "tags"> & {
  price: string;
  compareAt: string;
  cost: string;
  stock: string;
  tags: string;
};

type Sheet = { kind: "entry"; list: string; index: number | null } | { kind: "intro" } | { kind: "category" };

const FAQ_TOPICS = [
  { id: "use", label: "שימוש" },
  { id: "ing", label: "רכיבים" },
  { id: "post", label: "אחרי לידה" },
  { id: "buy", label: "רכישה" },
];

const BUNDLES: ListDef = {
  key: "bundles",
  title: "באנדלים",
  hint: "אפשרויות כמות במחיר מיוחד",
  add: "הוספת באנדל",
  max: 20,
  fields: [
    { key: "qty", label: "כמות", max: 2, numeric: "int", placeholder: "2" },
    { key: "price", label: "מחיר הבאנדל", max: 10, numeric: "price", placeholder: "0.00" },
    { key: "label", label: "כיתוב", max: 80, optional: true, placeholder: "אם ריק יופיע «קנה» והכמות" },
    { key: "tag", label: "תגית", max: 24, optional: true, placeholder: "לדוגמה: הכי משתלם" },
  ],
  check: (values) => {
    const qty = Number(values.qty);
    return qty >= 1 && qty <= 99 ? null : "הכמות צריכה להיות בין 1 ל-99";
  },
};

const PAGE_LISTS: ListDef[] = [
  {
    key: "highlights",
    title: "נקודות מפתח",
    hint: "מתחת לתיאור הראשון. עד 4 סימונים",
    add: "הוספת סימון",
    max: 4,
    fields: [{ key: "text", label: "הסימון", max: 40 }],
  },
  {
    key: "panels",
    title: "שורות מתחת לכפתור ההוספה לסל",
    hint: "שורות שנפתחות בלחיצה, כמו תיאור והוראות שימוש",
    add: "הוספת שורה",
    max: 8,
    fields: [
      { key: "title", label: "כותרת השורה", max: 80, placeholder: "לדוגמה: הוראות שימוש" },
      { key: "body", label: "הטקסט שנפתח בלחיצה", max: 4000, multiline: true },
    ],
  },
  {
    key: "steps",
    title: "מתי להתחיל?",
    hint: "כל שלב מופיע כנקודה על ציר הזמן",
    add: "הוספת שלב",
    max: 8,
    fields: [
      { key: "title", label: "שם השלב", max: 80 },
      { key: "body", label: "מה כתוב בשלב", max: 500, multiline: true },
    ],
  },
  {
    key: "ingredients",
    title: "רכיבי מפתח",
    hint: "משפט פתיחה, ואחריו הרכיבים לפי הסדר",
    add: "הוספת רכיב",
    max: 12,
    fields: [
      { key: "en", label: "שם באנגלית", max: 40, ltr: true, optional: true, placeholder: "Jojoba Oil" },
      { key: "he", label: "שם בעברית", max: 40, optional: true, placeholder: "שמן חוחובה" },
      { key: "body", label: "תיאור הרכיב", max: 500, multiline: true },
    ],
    check: (values) => (values.en.trim() || values.he.trim() ? null : "צריך שם באנגלית או בעברית"),
  },
  {
    key: "inci",
    title: "רשימת רכיבים מלאה",
    hint: "לפי הסדר שעל האריזה",
    add: "הוספת רכיב",
    max: 60,
    fields: [
      { key: "inci", label: "שם INCI", max: 240, ltr: true },
      { key: "he", label: "שם בעברית", max: 80, optional: true },
    ],
  },
  {
    key: "reviews",
    title: "לקוחות ממליצות",
    hint: "ההמלצה הראשונה מוצגת כציטוט גדול",
    add: "הוספת המלצה",
    max: 30,
    make: { rating: 5, verified: false },
    fields: [
      { key: "name", label: "שם", max: 80 },
      { key: "date", label: "תאריך", max: 40, optional: true, placeholder: "22 ביוני" },
      { key: "title", label: "כותרת קצרה", max: 120, optional: true },
      { key: "body", label: "ההמלצה", max: 1000, multiline: true },
    ],
  },
  {
    key: "faqs",
    title: "שאלות ותשובות",
    hint: "כל שאלה מקבלת נושא שמופיע כסינון באתר",
    add: "הוספת שאלה",
    max: 20,
    make: { tag: "use" },
    fields: [
      { key: "q", label: "השאלה", max: 180 },
      { key: "a", label: "התשובה", max: 1000, multiline: true },
      { key: "tag", label: "נושא", max: 4, options: FAQ_TOPICS },
    ],
  },
];

const INTRO_FIELDS: FieldDef[] = [{ key: "intro", label: "משפט פתיחה", max: 300, multiline: true }];

function toForm(draft: ProductDraft, fresh: boolean): Form {
  return {
    ...draft,
    price: fresh ? "" : String(draft.price),
    compareAt: draft.compareAt != null ? String(draft.compareAt) : "",
    cost: draft.cost ? String(draft.cost) : "",
    stock: draft.stock ? String(draft.stock) : "",
    tags: draft.tags.join(", "),
  };
}

function toNumber(value: string) {
  const clean = value.replace(/[,₪\s]/g, "");
  if (!clean) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function sameName(left: string, right: string) {
  return left.trim().localeCompare(right.trim(), "he", { sensitivity: "accent" }) === 0;
}

function pageItems(page: RawPage, key: string): Entry[] {
  const value = page[key];
  if (!Array.isArray(value)) return [];
  if (key === "highlights") return value.filter((item): item is string => typeof item === "string").map((text) => ({ text }));
  return value.filter((item): item is Entry => Boolean(item) && typeof item === "object" && !Array.isArray(item));
}

function withItems(page: RawPage, key: string, items: Entry[]): RawPage {
  return { ...page, [key]: key === "highlights" ? items.map((item) => String(item.text ?? "")) : items };
}

function bundleEntry(bundle: ProductBundle): Entry {
  return { qty: bundle.qty, price: bundle.price, label: bundle.label, tag: bundle.tag ?? "", image: bundle.image };
}

function entryText(entry: Entry, key: string) {
  const value = entry[key];
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function move<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items;
  const next = items.slice();
  const [item] = next.splice(from, 1);
  if (item === undefined) return items;
  next.splice(to, 0, item);
  return next;
}

function CircleButton({ icon, label, onPress, filled = false }: { icon: IconName; label: string; onPress: () => void; filled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: filled ? tokens.inkStrong : tokens.field, opacity: pressed ? 0.6 : 1 })}
    >
      <Icon name={icon} size={18} color={filled ? "#ffffff" : tokens.inkStrong} strokeWidth={2} />
    </Pressable>
  );
}

function Field({ ltr = false, style, ...props }: TextInputProps & { ltr?: boolean }) {
  const fonts = useFontSet();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor="#8a8a8a"
      selectionColor={tokens.focus}
      {...props}
      onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
      onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
      style={[{
        minHeight: 50,
        borderRadius: 12,
        borderWidth: focused ? 2 : 1,
        borderColor: focused ? tokens.inkStrong : FIELD_BORDER,
        paddingHorizontal: focused ? 13 : 14,
        paddingVertical: props.multiline ? 12 : 0,
        fontFamily: fonts.regular,
        fontSize: 16,
        color: tokens.inkStrong,
        backgroundColor: tokens.card,
        textAlign: ltr ? "left" : "right",
        writingDirection: ltr ? "ltr" : "rtl",
        textAlignVertical: props.multiline ? "top" : "center",
      }, style]}
    />
  );
}

function Labeled({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <AppText style={{ fontSize: 14, color: tokens.ink }}>{label}</AppText>
      {children}
      {hint ? <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>{hint}</AppText> : null}
    </View>
  );
}

function Band() {
  return <View style={{ height: 10, backgroundColor: BAND, marginVertical: 8 }} />;
}

function Heading({ text, hint }: { text: string; hint?: string }) {
  const fonts = useFontSet();
  return (
    <View style={{ paddingTop: 10, paddingBottom: 6, gap: 2 }}>
      <AppText style={{ fontFamily: fonts.bold, fontSize: 17, color: tokens.inkStrong }}>{text}</AppText>
      {hint ? <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>{hint}</AppText> : null}
    </View>
  );
}

function LineRow({ icon, label, value, onPress, children }: { icon?: IconName; label: string; value?: string; onPress?: () => void; children?: ReactNode }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => ({ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.6 : 1 })}>
      {icon ? <Icon name={icon} size={20} color={tokens.inkStrong} strokeWidth={1.7} /> : null}
      <AppText style={{ flex: 1, fontSize: 16, color: tokens.inkStrong }}>{label}</AppText>
      {value ? <AppText style={{ maxWidth: "50%", fontSize: 15, color: tokens.inkSecondary }} numberOfLines={1}>{value}</AppText> : null}
      {children ?? (onPress ? <Icon name="forward" size={16} color="#b5b5b5" strokeWidth={2} /> : null)}
    </Pressable>
  );
}

function ItemRow({ title, detail, thumb, onPress }: { title: string; detail?: string; thumb?: string | null; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: tokens.line, opacity: pressed ? 0.6 : 1 })}>
      {thumb !== undefined ? <Thumb uri={thumb ?? undefined} size={40} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={{ fontSize: 15, color: tokens.inkStrong }} numberOfLines={2}>{title}</AppText>
        {detail ? <AppText style={{ fontSize: 13, color: tokens.inkSecondary }} numberOfLines={2}>{detail}</AppText> : null}
      </View>
      <Icon name="edit" size={16} color="#9a9a9a" strokeWidth={1.7} />
    </Pressable>
  );
}

function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  return <LineRow icon="circlePlus" label={label} onPress={onPress}>{null}</LineRow>;
}

export function ProductEditor({ product }: { product: ProductRecord | null }) {
  useStatusBar("dark");
  const fonts = useFontSet();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { storeId } = useSession();
  const { snapshot, refresh } = useStoreData();
  const saving = useRef(false);
  const scroller = useRef<ScrollViewInstance>(null);
  const [initial] = useState(() => toForm(draftFrom(product), !product));
  const [form, setForm] = useState(initial);
  const [picked, setPicked] = useState<PickedMedia>({});
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const ready = dirty && Boolean(form.title.trim()) && !busy;
  const badge = PRODUCT_BADGE[form.status];
  const collections = snapshot?.collections ?? [];
  const categoryNames = [...new Set([
    ...collections.map((item) => item.title.trim()),
    ...(snapshot?.products ?? []).map((item) => item.category?.trim() ?? ""),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b, "he"));
  const parent = collections.find((item) => sameName(item.title, form.category));
  const subOptions = [...new Set([...(parent?.subcategories ?? []), ...form.subcategories])];
  const pageOn = Object.keys(form.page).length > 0 || (snapshot?.products ?? []).some((item) => item.page && Object.values(item.page).some((list) => list.length > 0));
  const price = toNumber(form.price);
  const cost = toNumber(form.cost);
  const profit = price != null && cost != null && !Number.isNaN(price) && !Number.isNaN(cost) && price > 0 ? price - cost : null;
  const url = snapshot?.hostname && form.handle.trim() ? `${snapshot.hostname.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/product/${form.handle.trim()}` : "";

  function patch(next: Partial<Form>) {
    setForm((current) => ({ ...current, ...next }));
    setError("");
  }

  function fail(message: string) {
    setError(message);
    scroller.current?.scrollTo({ y: 0, animated: true });
  }

  function close() {
    if (!dirty || busy) {
      router.back();
      return;
    }
    Alert.alert("לצאת בלי שמירה?", "השינויים שלא נשמרו יימחקו.", [
      { text: "המשך עריכה", style: "cancel" },
      { text: "יציאה", style: "destructive", onPress: () => router.back() },
    ]);
  }

  function pickStatus() {
    Alert.alert("סטטוס מוצר", "רק מוצר פעיל מופיע באתר.", [
      ...STATUSES.map((status) => ({ text: PRODUCT_BADGE[status]?.label ?? status, onPress: () => patch({ status }) })),
      { text: "ביטול", style: "cancel" as const },
    ]);
  }

  async function addPhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      fail("אין גישה לתמונות. אפשר לאשר גישה בהגדרות הטלפון.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 10, orderedSelection: true, quality: 0.85 });
    if (result.canceled || !result.assets.length) return;
    const added = result.assets.filter((asset) => !form.media.includes(asset.uri));
    setPicked((current) => ({ ...current, ...Object.fromEntries(added.map((asset) => [asset.uri, asset.mimeType ?? ""])) }));
    patch({ media: [...form.media, ...added.map((asset) => asset.uri)] });
  }

  function mediaActions(index: number) {
    Alert.alert(index === 0 ? "התמונה הראשית" : `תמונה ${index + 1}`, undefined, [
      ...(index > 0 ? [{ text: "הגדרה כתמונה ראשית", onPress: () => patch({ media: move(form.media, index, 0) }) }] : []),
      { text: "הסרה", style: "destructive" as const, onPress: () => patch({ media: form.media.filter((_, item) => item !== index) }) },
      { text: "ביטול", style: "cancel" as const },
    ]);
  }

  function listDef(key: string) {
    return key === BUNDLES.key ? BUNDLES : PAGE_LISTS.find((list) => list.key === key);
  }

  function listItems(key: string) {
    return key === BUNDLES.key ? form.bundles.map(bundleEntry) : pageItems(form.page, key);
  }

  function writeList(key: string, items: Entry[]) {
    if (key === BUNDLES.key) {
      patch({
        bundles: items.map((item) => ({
          qty: Number(item.qty),
          price: Number(item.price),
          label: entryText(item, "label"),
          tag: entryText(item, "tag") || undefined,
          image: typeof item.image === "string" && item.image ? item.image : undefined,
        })),
      });
      return;
    }
    patch({ page: withItems(form.page, key, items) });
  }

  function saveEntry(key: string, index: number | null, values: Values) {
    const def = listDef(key);
    if (!def) return "";
    const items = listItems(key);
    if (key === BUNDLES.key && items.some((item, position) => position !== index && Number(item.qty) === Number(values.qty))) {
      return "כבר יש באנדל לכמות הזו";
    }
    const base = index == null ? { ...def.make } : items[index] ?? {};
    const typed = Object.fromEntries(def.fields.map((field) => {
      const raw = values[field.key]?.trim() ?? "";
      return [field.key, field.numeric ? toNumber(raw) ?? 0 : raw];
    }));
    const next = { ...base, ...typed };
    writeList(key, index == null ? [...items, next] : items.map((item, position) => (position === index ? next : item)));
    setSheet(null);
    return "";
  }

  function removeEntry(key: string, index: number) {
    writeList(key, listItems(key).filter((_, position) => position !== index));
    setSheet(null);
  }

  function shiftEntry(key: string, index: number, delta: -1 | 1) {
    writeList(key, move(listItems(key), index, index + delta));
    setSheet((current) => (current?.kind === "entry" ? { ...current, index: index + delta } : current));
  }

  function chooseCategory(name: string) {
    const allowed = collections.find((item) => sameName(item.title, name))?.subcategories ?? [];
    patch({ category: name, subcategories: form.subcategories.filter((sub) => allowed.some((item) => sameName(item, sub))) });
    setSheet(null);
  }

  function toggleSub(name: string) {
    patch({ subcategories: form.subcategories.includes(name) ? form.subcategories.filter((item) => item !== name) : [...form.subcategories, name] });
  }

  async function save() {
    if (saving.current) return;
    if (product && !dirty) {
      router.back();
      return;
    }
    const title = form.title.trim();
    const compareAt = toNumber(form.compareAt);
    const stock = toNumber(form.stock);
    if (!title) return fail("יש להזין כותרת למוצר");
    if (price == null || Number.isNaN(price) || price < 0) return fail("יש להזין מחיר תקין");
    if (compareAt != null && (Number.isNaN(compareAt) || compareAt < 0)) return fail("המחיר לפני הנחה לא תקין");
    if (cost != null && (Number.isNaN(cost) || cost < 0)) return fail("העלות לא תקינה");
    if (stock != null && (Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock))) return fail("כמות המלאי צריכה להיות מספר שלם");
    if (!storeId) return fail("אין חנות נבחרת.");
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const id = await saveProduct(storeId, product, {
        ...form,
        title,
        price,
        compareAt,
        cost: cost ?? 0,
        stock: stock ?? 0,
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      }, picked);
      await refresh();
      if (product) router.back();
      else router.replace(`/products/${id}` as Href);
    } catch (caught) {
      if (caught instanceof PartialSave) {
        await refresh();
        Alert.alert("המוצר נוצר", `חלק מהפרטים לא נשמרו: ${caught.message}`);
        router.replace(`/products/${caught.productId}` as Href);
        return;
      }
      fail(caught instanceof Error ? caught.message : "לא הצלחנו לשמור את המוצר.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const entry = sheet?.kind === "entry" ? sheet : null;
  const entryDef = entry ? listDef(entry.list) : undefined;
  const entryItems = entry ? listItems(entry.list) : [];
  const entryValue = entry && entry.index != null ? entryItems[entry.index] : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.card }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 14, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <CircleButton icon="back" label="חזרה" onPress={close} />
        <AppText style={{ flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 17, color: tokens.inkStrong }} numberOfLines={1}>
          {busy ? "שומר…" : product ? "עריכת מוצר" : "מוצר חדש"}
        </AppText>
        <CircleButton icon="check" label="שמירה" filled={ready} onPress={() => void save()} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView ref={scroller} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: TAB_SPACE + insets.bottom + 24 }}>
          {error ? <ErrorNote text={error} /> : null}

          <View style={{ paddingTop: 8 }}>
            <View style={{ paddingHorizontal: 16 }}>
              <Heading text={`מדיה${form.media.length ? ` (${formatCount(form.media.length)})` : ""}`} hint={form.media.length > 1 ? "לחיצה על תמונה כדי להגדיר אותה כראשית או להסיר" : undefined} />
            </View>
            <ScrollView horizontal directionalLockEnabled showsHorizontalScrollIndicator={false} style={{ width, flexGrow: 0 }} contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingVertical: 4 }}>
              {form.media.map((uri, index) => (
                <Pressable key={uri} onPress={() => mediaActions(index)} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  {isVideoMedia(uri) ? (
                    <View style={{ width: TILE, height: TILE, borderRadius: 14, backgroundColor: tokens.inkStrong, alignItems: "center", justifyContent: "center" }}>
                      <AppText style={{ color: "#ffffff", fontSize: 13 }}>וידאו</AppText>
                    </View>
                  ) : (
                    <Image source={{ uri }} style={{ width: TILE, height: TILE, borderRadius: 14, borderWidth: 1, borderColor: tokens.line, backgroundColor: tokens.field }} resizeMode="cover" />
                  )}
                  {index === 0 ? (
                    <View style={{ position: "absolute", bottom: 6, start: 6, paddingHorizontal: 6, height: 20, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center" }}>
                      <AppText style={{ color: "#ffffff", fontSize: 11 }}>ראשית</AppText>
                    </View>
                  ) : null}
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="הוספת תמונות"
                onPress={() => void addPhotos()}
                style={({ pressed }) => ({ width: TILE, height: TILE, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#c9c9c9", backgroundColor: "#fafafa", alignItems: "center", justifyContent: "center", gap: 4, opacity: pressed ? 0.6 : 1 })}
              >
                <Icon name="plus" size={22} color={tokens.inkStrong} strokeWidth={1.8} />
                <AppText style={{ fontSize: 12, color: tokens.inkSecondary }}>הוספה</AppText>
              </Pressable>
            </ScrollView>
          </View>

          <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
            <Labeled label="כותרת">
              <Field value={form.title} onChangeText={(title) => patch({ title })} placeholder="לדוגמה: קרם גוף מזין" maxLength={200} />
            </Labeled>
            <Labeled label="תיאור">
              <Field value={form.description} onChangeText={(description) => patch({ description })} placeholder="מה חשוב לדעת על המוצר" multiline style={{ minHeight: 120 }} />
            </Labeled>
          </View>

          <Band />

          <View style={{ paddingHorizontal: 16 }}>
            <LineRow label="סטטוס" onPress={pickStatus}>
              {badge ? <Badge {...badge} /> : null}
              <Icon name="down" size={16} color="#b5b5b5" strokeWidth={2} />
            </LineRow>
          </View>

          <Band />

          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            <Heading text="תמחור" />
            <Labeled label="מחיר">
              <Field value={form.price} onChangeText={(value) => patch({ price: value })} placeholder="₪ 0.00" ltr keyboardType="decimal-pad" />
            </Labeled>
            <Labeled label="מחיר לפני הנחה" hint="אם גבוה מהמחיר, יופיע מחוק באתר">
              <Field value={form.compareAt} onChangeText={(value) => patch({ compareAt: value })} placeholder="₪ 0.00" ltr keyboardType="decimal-pad" />
            </Labeled>
            <Labeled label="עלות לפריט" hint="הלקוחות לא רואים את זה">
              <Field value={form.cost} onChangeText={(value) => patch({ cost: value })} placeholder="₪ 0.00" ltr keyboardType="decimal-pad" />
            </Labeled>
            {profit != null && price ? (
              <AppText style={{ fontSize: 14, color: tokens.inkSecondary }}>{`רווח ${formatIls(profit)} · שולי רווח ${Math.round((profit / price) * 100)}%`}</AppText>
            ) : null}
          </View>

          <Band />

          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            <Heading text="מלאי" />
            <Labeled label="כמות במלאי">
              <Field value={form.stock} onChangeText={(value) => patch({ stock: value.replace(/[^\d]/g, "") })} placeholder="0" ltr keyboardType="number-pad" />
            </Labeled>
            <Labeled label="מק״ט (SKU)">
              <Field value={form.sku} onChangeText={(sku) => patch({ sku })} ltr autoCapitalize="characters" autoCorrect={false} />
            </Labeled>
            <Labeled label="ברקוד">
              <Field value={form.barcode} onChangeText={(barcode) => patch({ barcode })} ltr keyboardType="number-pad" />
            </Labeled>
          </View>

          <Band />

          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            <Heading text="ארגון המוצר" />
            <LineRow icon="layers" label="קטגוריה" value={form.category || "ללא קטגוריה"} onPress={() => setSheet({ kind: "category" })} />
            {subOptions.length ? (
              <Labeled label="תת קטגוריה">
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {subOptions.map((name) => {
                    const on = form.subcategories.includes(name);
                    return (
                      <Pressable key={name} onPress={() => toggleSub(name)} style={{ height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: on ? tokens.inkStrong : FIELD_BORDER, backgroundColor: on ? tokens.inkStrong : tokens.card, flexDirection: "row", alignItems: "center", gap: 6 }}>
                        {on ? <Icon name="check" size={13} color="#ffffff" strokeWidth={2.2} /> : null}
                        <AppText style={{ fontSize: 14, color: on ? "#ffffff" : tokens.inkStrong }}>{name}</AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </Labeled>
            ) : form.category ? (
              <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>לקטגוריה הזו אין תתי קטגוריה. מוסיפים אותן מתוך עמוד הקטגוריה.</AppText>
            ) : null}
            <Labeled label="ספק">
              <Field value={form.vendor} onChangeText={(vendor) => patch({ vendor })} placeholder={snapshot?.name ?? ""} />
            </Labeled>
            <Labeled label="סוג">
              <Field value={form.variant} onChangeText={(variant) => patch({ variant })} placeholder="לדוגמה: 200 מ״ל" />
            </Labeled>
            <Labeled label="תגיות" hint="אפשר להפריד כמה תגיות בפסיק">
              <Field value={form.tags} onChangeText={(tags) => patch({ tags })} placeholder="לדוגמה: מבצע, חדש" autoCapitalize="none" />
            </Labeled>
          </View>

          <Band />

          <View style={{ paddingHorizontal: 16 }}>
            <Heading text={BUNDLES.title} hint={BUNDLES.hint} />
            {form.bundles.map((bundle, index) => (
              <ItemRow
                key={`${bundle.qty}-${index}`}
                thumb={bundle.image ?? null}
                title={bundle.label || `קנה ${bundle.qty}`}
                detail={[`${formatCount(bundle.qty)} יח׳`, formatIls(bundle.price), bundle.tag].filter(Boolean).join(" · ")}
                onPress={() => setSheet({ kind: "entry", list: BUNDLES.key, index })}
              />
            ))}
            {form.bundles.length < BUNDLES.max ? <AddRow label={BUNDLES.add} onPress={() => setSheet({ kind: "entry", list: BUNDLES.key, index: null })} /> : null}
          </View>

          {pageOn ? (
            <>
              <Band />
              <View style={{ paddingHorizontal: 16 }}>
                <AppText style={{ fontFamily: fonts.bold, fontSize: 19, color: tokens.inkStrong, paddingTop: 6 }}>תוכן עמוד המוצר</AppText>
              </View>
              {PAGE_LISTS.map((list) => {
                const items = pageItems(form.page, list.key);
                const intro = typeof form.page.ingredientsIntro === "string" ? form.page.ingredientsIntro : "";
                return (
                  <View key={list.key} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                    <Heading text={`${list.title}${items.length ? ` (${formatCount(items.length)})` : ""}`} hint={list.hint} />
                    {list.key === "ingredients" ? (
                      <ItemRow title={intro || "משפט פתיחה"} detail={intro ? "משפט פתיחה" : "לא חובה"} onPress={() => setSheet({ kind: "intro" })} />
                    ) : null}
                    {items.map((item, index) => {
                      const texts = list.fields.filter((field) => !field.options).map((field) => entryText(item, field.key)).filter(Boolean);
                      return (
                        <ItemRow
                          key={`${list.key}-${index}`}
                          title={texts[0] ?? "ללא כותרת"}
                          detail={texts.slice(1).join(" · ") || undefined}
                          onPress={() => setSheet({ kind: "entry", list: list.key, index })}
                        />
                      );
                    })}
                    {items.length < list.max ? <AddRow label={list.add} onPress={() => setSheet({ kind: "entry", list: list.key, index: null })} /> : null}
                  </View>
                );
              })}
            </>
          ) : null}

          <Band />

          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            <Heading text="תווית על המוצר" hint="מופיעה על תמונת המוצר באתר" />
            <Field value={form.badge} onChangeText={(value) => patch({ badge: value })} placeholder="לדוגמה: חדש" maxLength={24} />
            <LineRow label="להסתיר את התווית" onPress={() => patch({ badgeHidden: !form.badgeHidden })}>
              <Switch value={form.badgeHidden} onValueChange={(badgeHidden) => patch({ badgeHidden })} trackColor={{ false: "#d4d4d4", true: tokens.inkStrong }} thumbColor="#ffffff" ios_backgroundColor="#d4d4d4" />
            </LineRow>
          </View>

          <Band />

          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            <Heading text="מנועי חיפוש (SEO)" hint="איך המוצר מופיע בגוגל" />
            <Labeled label="כותרת לעמוד" hint={`${form.seoTitle.length}/70`}>
              <Field value={form.seoTitle} onChangeText={(seoTitle) => patch({ seoTitle })} placeholder={form.title} maxLength={70} />
            </Labeled>
            <Labeled label="תיאור" hint={`${form.seoDescription.length}/160`}>
              <Field value={form.seoDescription} onChangeText={(seoDescription) => patch({ seoDescription })} multiline maxLength={160} style={{ minHeight: 90 }} />
            </Labeled>
            <Labeled label="כתובת המוצר" hint={url || undefined}>
              <Field value={form.handle} onChangeText={(handle) => patch({ handle })} placeholder={product ? "" : "נוצרת מהכותרת"} ltr autoCapitalize="none" autoCorrect={false} maxLength={80} />
            </Labeled>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={entry != null || sheet?.kind === "intro"} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        {entry && entryDef ? (
          <EntrySheet
            key={`${entry.list}-${entry.index ?? "new"}`}
            title={entry.index == null ? entryDef.add : entryDef.title}
            fields={entryDef.fields}
            initial={entryValue ?? entryDef.make ?? {}}
            check={entryDef.check}
            onClose={() => setSheet(null)}
            onSave={(values) => saveEntry(entry.list, entry.index, values)}
            onDelete={entry.index != null ? () => removeEntry(entry.list, entry.index ?? 0) : undefined}
            onUp={entry.index != null && entry.index > 0 ? () => shiftEntry(entry.list, entry.index ?? 0, -1) : undefined}
            onDown={entry.index != null && entry.index < entryItems.length - 1 ? () => shiftEntry(entry.list, entry.index ?? 0, 1) : undefined}
          />
        ) : sheet?.kind === "intro" ? (
          <EntrySheet
            key="intro"
            title="משפט פתיחה לרכיבי המפתח"
            fields={INTRO_FIELDS.map((field) => ({ ...field, optional: true }))}
            initial={{ intro: typeof form.page.ingredientsIntro === "string" ? form.page.ingredientsIntro : "" }}
            onClose={() => setSheet(null)}
            onSave={(values) => {
              patch({ page: { ...form.page, ingredientsIntro: values.intro?.trim() ?? "" } });
              setSheet(null);
              return "";
            }}
          />
        ) : null}
      </Modal>

      <Modal visible={sheet?.kind === "category"} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable onPress={() => setSheet(null)} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.35)" }} />
          <View style={{ maxHeight: "75%", backgroundColor: tokens.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) + 8, direction: "rtl" }}>
            <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "#d4d4d4", marginBottom: 8 }} />
            <AppText style={{ fontFamily: fonts.bold, fontSize: 18, color: tokens.inkStrong, paddingHorizontal: 20, paddingBottom: 6 }}>קטגוריה</AppText>
            <FlatList
              style={{ flexShrink: 1 }}
              data={["", ...categoryNames]}
              keyExtractor={(item) => item || "none"}
              renderItem={({ item }) => {
                const on = item ? sameName(item, form.category) : !form.category;
                return (
                  <Pressable onPress={() => chooseCategory(item)} style={({ pressed }) => ({ minHeight: 52, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 8, opacity: pressed ? 0.6 : 1 })}>
                    <AppText style={{ flex: 1, fontSize: 16, fontFamily: on ? fonts.bold : fonts.regular, color: item ? tokens.inkStrong : tokens.inkSecondary }}>{item || "ללא קטגוריה"}</AppText>
                    {on ? <Icon name="check" size={16} color={tokens.inkStrong} strokeWidth={2} /> : null}
                  </Pressable>
                );
              }}
              ListFooterComponent={<AppText style={{ fontSize: 13, color: tokens.inkSecondary, paddingHorizontal: 20, paddingTop: 8 }}>קטגוריה חדשה מוסיפים במסך הקטגוריות.</AppText>}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function EntrySheet({
  title,
  fields,
  initial,
  check,
  onClose,
  onSave,
  onDelete,
  onUp,
  onDown,
}: {
  title: string;
  fields: FieldDef[];
  initial: Entry;
  check?: (values: Values) => string | null;
  onClose: () => void;
  onSave: (values: Values) => string;
  onDelete?: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const fonts = useFontSet();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState<Values>(() => Object.fromEntries(fields.map((field) => [field.key, entryText(initial, field.key)])));
  const [error, setError] = useState("");

  function submit() {
    for (const field of fields) {
      const value = values[field.key]?.trim() ?? "";
      if (!field.optional && !value) {
        setError(`חסר: ${field.label}`);
        return;
      }
      if (field.numeric && value) {
        const parsed = toNumber(value);
        if (parsed == null || Number.isNaN(parsed) || parsed < 0 || (field.numeric === "int" && !Number.isInteger(parsed))) {
          setError(`${field.label} לא תקין`);
          return;
        }
      }
    }
    const problem = check?.(values) ?? onSave(values);
    if (problem) setError(problem);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
      <Pressable onPress={onClose} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.35)" }} />
      <View style={{ maxHeight: "88%", backgroundColor: tokens.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12) + 8, direction: "rtl" }}>
        <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "#d4d4d4", marginBottom: 8 }} />
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}>
          <AppText style={{ flex: 1, fontFamily: fonts.bold, fontSize: 18, color: tokens.inkStrong }} numberOfLines={1}>{title}</AppText>
          {onUp ? <CircleButton icon="up" label="הזזה למעלה" onPress={onUp} /> : null}
          {onDown ? <CircleButton icon="down" label="הזזה למטה" onPress={onDown} /> : null}
          {onDelete ? <CircleButton icon="trash" label="מחיקה" onPress={onDelete} /> : null}
        </View>
        <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 8 }}>
          {fields.map((field) => (
            <Labeled key={field.key} label={field.optional ? `${field.label} (לא חובה)` : field.label} hint={field.max > 60 && !field.options ? `${values[field.key]?.length ?? 0}/${field.max}` : undefined}>
              {field.options ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {field.options.map((option) => {
                    const on = values[field.key] === option.id;
                    return (
                      <Pressable key={option.id} onPress={() => setValues((current) => ({ ...current, [field.key]: option.id }))} style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: on ? tokens.inkStrong : FIELD_BORDER, backgroundColor: on ? tokens.inkStrong : tokens.card, justifyContent: "center" }}>
                        <AppText style={{ fontSize: 14, color: on ? "#ffffff" : tokens.inkStrong }}>{option.label}</AppText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Field
                  value={values[field.key] ?? ""}
                  onChangeText={(value) => { setValues((current) => ({ ...current, [field.key]: value })); setError(""); }}
                  placeholder={field.placeholder}
                  maxLength={field.max}
                  multiline={field.multiline}
                  ltr={field.ltr || Boolean(field.numeric)}
                  keyboardType={field.numeric === "int" ? "number-pad" : field.numeric === "price" ? "decimal-pad" : "default"}
                  style={field.multiline ? { minHeight: 110, maxHeight: 260 } : undefined}
                />
              )}
            </Labeled>
          ))}
          {error ? <AppText style={{ color: tokens.negative, fontSize: 14 }}>{error}</AppText> : null}
          <Pressable accessibilityRole="button" onPress={submit} style={({ pressed }) => ({ height: 50, borderRadius: 12, backgroundColor: tokens.inkStrong, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.8 : 1 })}>
            <AppText style={{ color: "#ffffff", fontFamily: fonts.bold, fontSize: 16 }}>אישור</AppText>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
