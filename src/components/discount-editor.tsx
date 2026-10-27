import { useRef, useState, type ReactNode } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/icon";
import { Thumb, useStatusBar } from "@/components/shell";
import { AppText, Badge, ErrorNote } from "@/components/ui";
import { discountKind, discountStatus, todayIso, type DiscountKind } from "@/lib/discounts";
import { formatCount, formatIls } from "@/lib/format";
import { DISCOUNT_KIND, DISCOUNT_STATUS, knownBadge } from "@/lib/orders";
import { isVideoMedia } from "@/lib/product-save";
import { saveStoreDiscount } from "@/lib/remote";
import { useSession } from "@/lib/session";
import { useStoreData } from "@/lib/store-data";
import type { DiscountRecord, ProductRecord } from "@/lib/snapshot";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, tokens } from "@/theme/tokens";

type ValueType = "pct" | "fixed";
type Method = "code" | "auto";
type MinType = "none" | "amount" | "qty";
type Applies = "all" | "colls" | "subs" | "prods";
type BxgyMode = "pair" | "qty" | "cats";
type Picker = "buy" | "get" | "prods" | "colls" | "subs" | "bxColl" | "bxGetColl" | null;

type Form = {
  code: string;
  kind: DiscountKind;
  valueType: ValueType;
  value: string;
  method: Method;
  eligibility: "all" | "seg";
  segment: string;
  minType: MinType;
  minValue: string;
  once: boolean;
  limit: boolean;
  limitN: string;
  start: string;
  hasEnd: boolean;
  end: string;
  combProduct: boolean;
  combOrder: boolean;
  combShip: boolean;
  combBundle: boolean;
  blockGift: boolean;
  applies: Applies;
  collections: string[];
  bxMode: BxgyMode;
  bxBuy: string;
  bxGet: string;
  bxColl: string;
  bxGetColl: string;
  bxBuyIds: string[];
  bxGetIds: string[];
};

const BORDER = "#c9c9c9";
const PAGE = "#f6f6f6";
const dayLabel = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", timeZone: "Asia/Jerusalem" });

const APPLIES: { id: Applies; label: string }[] = [
  { id: "all", label: "כל המוצרים" },
  { id: "prods", label: "מוצרים ספציפיים" },
  { id: "colls", label: "קטגוריות מסוימות" },
  { id: "subs", label: "תתי קטגוריות" },
];

const BXGY: { id: BxgyMode; title: string; detail: string }[] = [
  { id: "pair", title: "מוצר תמורת מוצר", detail: "בוחרים מה קונים ומה מקבלים במתנה." },
  { id: "qty", title: "כמות על אותו מוצר", detail: "קונים כמה יחידות ומקבלים כמה במתנה." },
  { id: "cats", title: "קטגוריה תמורת קטגוריה", detail: "מתנה מקטגוריה אחת על קנייה מקטגוריה אחרת." },
];

function today() {
  return todayIso();
}

function showDay(iso: string) {
  const day = iso.slice(0, 10);
  const date = new Date(`${day}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(date.getTime())) return "בחירת תאריך";
  return dayLabel.format(date);
}

function shiftDay(iso: string, days: number) {
  const date = new Date(`${(iso || today()).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return today();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function zoneLabel() {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", timeZoneName: "shortOffset" }).formatToParts(new Date()).find((item) => item.type === "timeZoneName");
  return part?.value ?? "GMT+2";
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function modeOf(record: DiscountRecord): BxgyMode {
  if (record.bxMode === "pair" || record.bxMode === "qty" || record.bxMode === "cats") return record.bxMode;
  if ((record.bxColl ?? "").trim()) return "cats";
  const buy = record.bxBuyIds?.[0];
  const gift = record.bxGetIds?.[0];
  if (buy && gift && buy !== gift) return "pair";
  return "qty";
}

function blank(kind: DiscountKind): Form {
  return {
    code: "",
    kind,
    valueType: "pct",
    value: kind === "ship" ? "100" : "10",
    method: "code",
    eligibility: "all",
    segment: "",
    minType: "none",
    minValue: "",
    once: false,
    limit: false,
    limitN: "",
    start: today(),
    hasEnd: false,
    end: "",
    combProduct: false,
    combOrder: false,
    combShip: false,
    combBundle: false,
    blockGift: false,
    applies: "all",
    collections: [],
    bxMode: "pair",
    bxBuy: "2",
    bxGet: "1",
    bxColl: "",
    bxGetColl: "",
    bxBuyIds: [],
    bxGetIds: [],
  };
}

function fromRecord(record: DiscountRecord): Form {
  const kind = discountKind(record.kind);
  return {
    ...blank(kind),
    code: record.code || record.title || "",
    kind,
    valueType: record.valueType === "fixed" ? "fixed" : "pct",
    value: record.value == null ? "" : String(record.value),
    method: record.method === "auto" ? "auto" : "code",
    eligibility: record.eligibility === "seg" ? "seg" : "all",
    segment: record.segment ?? "",
    minType: record.minType === "amount" || record.minType === "qty" ? record.minType : "none",
    minValue: record.minValue ? String(record.minValue) : "",
    once: Boolean(record.once),
    limit: Boolean(record.limit),
    limitN: record.limitN ? String(record.limitN) : "",
    start: (record.start ?? "").slice(0, 10) || today(),
    hasEnd: Boolean(record.hasEnd),
    end: (record.end ?? "").slice(0, 10),
    combProduct: Boolean(record.combProduct),
    combOrder: Boolean(record.combOrder),
    combShip: Boolean(record.combShip),
    combBundle: Boolean(record.combBundle),
    blockGift: Boolean(record.blockGift),
    applies: record.applies === "colls" || record.applies === "subs" || record.applies === "prods" ? record.applies : "all",
    collections: record.collections ?? [],
    bxMode: modeOf(record),
    bxBuy: record.bxBuy || "2",
    bxGet: record.bxGet || "1",
    bxColl: record.bxColl ?? "",
    bxGetColl: record.bxGetColl ?? "",
    bxBuyIds: record.bxBuyIds ?? [],
    bxGetIds: record.bxGetIds ?? [],
  };
}

function payload(form: Form, id?: string) {
  const qty = form.bxMode === "qty";
  return {
    id: id ?? null,
    code: form.method === "code" ? form.code.trim().toUpperCase() : form.code.trim(),
    kind: form.kind,
    valueType: form.kind === "order" || form.kind === "product" ? form.valueType : "pct",
    value: form.kind === "ship" ? 100 : Number(form.value) || 0,
    method: form.method,
    eligibility: form.eligibility,
    segment: form.segment.trim(),
    minType: form.minType,
    minValue: Number(form.minValue) || 0,
    once: form.once,
    limit: form.limit,
    limitN: Number(form.limitN) || 0,
    start: form.start,
    hasEnd: form.hasEnd,
    end: form.end,
    combProduct: form.combProduct,
    combOrder: form.combOrder,
    combShip: form.combShip,
    combBundle: form.combBundle,
    blockGift: form.blockGift,
    applies: form.kind === "product" ? form.applies : "all",
    collections: form.kind === "product" ? form.collections : [],
    bxMode: form.bxMode,
    bxBuy: form.bxBuy,
    bxGet: form.bxGet,
    bxColl: form.bxColl,
    bxGetColl: form.bxGetColl,
    bxBuyIds: form.bxBuyIds,
    bxGetIds: qty ? form.bxBuyIds : form.bxGetIds,
  };
}

function validate(form: Form) {
  if (!form.code.trim()) return form.method === "code" ? "יש להזין קוד הנחה" : "יש להזין כותרת";
  if (form.eligibility === "seg" && !form.segment.trim()) return "יש להזין שם פלח";
  if ((form.minType === "amount" || form.minType === "qty") && !(Number(form.minValue) > 0)) return "יש להזין מינימום";
  if (form.limit && !(Number(form.limitN) > 0)) return "יש להזין מגבלת שימושים";
  if (form.hasEnd && !/^\d{4}-\d{2}-\d{2}$/.test(form.end)) return "יש לבחור תאריך סיום";
  if (form.kind === "product" && form.applies === "prods" && form.collections.length === 0) return "יש לבחור מוצר";
  if (form.kind === "product" && (form.applies === "colls" || form.applies === "subs") && form.collections.length === 0) return "יש לבחור קטגוריה";
  if (form.kind === "bxgy" && form.bxMode === "pair" && (form.bxBuyIds.length !== 1 || form.bxGetIds.length !== 1 || form.bxBuyIds[0] === form.bxGetIds[0])) return "יש לבחור מוצר לקנייה ומוצר מתנה";
  if (form.kind === "bxgy" && form.bxMode === "qty" && (form.bxBuyIds.length !== 1 || !/^[1-9]\d*$/.test(form.bxBuy) || !/^[1-9]\d*$/.test(form.bxGet))) return "יש לבחור מוצר וכמות";
  if (form.kind === "bxgy" && form.bxMode === "cats" && (!form.bxColl.trim() || !form.bxGetColl.trim())) return "יש לבחור קטגוריות";
  return "";
}

function productPhoto(products: ProductRecord[], id: string) {
  return products.find((item) => item.id === id)?.media?.find((uri) => uri && !isVideoMedia(uri));
}

function productName(products: ProductRecord[], id: string) {
  const product = products.find((item) => item.id === id);
  if (!product) return "מוצר";
  const title = product.title?.trim() || "מוצר";
  const variant = product.variant?.trim();
  const shared = products.filter((item) => (item.title ?? "").trim() === (product.title ?? "").trim()).length > 1;
  if (!shared || !variant || variant === "Default Title" || variant === "ברירת מחדל") return title;
  return `${title} · ${variant}`;
}

function summaryLines(form: Form, products: ProductRecord[]) {
  const lines = [form.eligibility === "all" ? "כל הלקוחות" : form.segment.trim() || "פלח לקוחות"];
  if (form.kind === "order") lines.push("על כל ההזמנה");
  else if (form.kind === "ship") lines.push("משלוח חינם");
  else if (form.kind === "product") {
    const label = APPLIES.find((item) => item.id === form.applies)?.label ?? "כל המוצרים";
    lines.push(form.collections.length ? `${label}: ${form.collections.map((item) => form.applies === "prods" ? productName(products, item) : item).join(", ")}` : label);
  } else if (form.bxMode === "pair") {
    lines.push(`קונים את ${productName(products, form.bxBuyIds[0] ?? "")}`);
    lines.push(`מקבלים את ${productName(products, form.bxGetIds[0] ?? "")} במתנה`);
  } else if (form.bxMode === "cats") {
    lines.push(`קונים מ${form.bxColl.trim() || "קטגוריה"}`);
    lines.push(`מתנה מ${form.bxGetColl.trim() || "קטגוריה"}`);
  } else {
    lines.push(`קונים ${form.bxBuy || "0"} ומקבלים ${form.bxGet || "0"} במתנה`);
  }
  if (form.minType === "amount") lines.push(`מינימום ${formatIls(Number(form.minValue) || 0)}`);
  else if (form.minType === "qty") lines.push(`מינימום ${form.minValue || "0"} פריטים`);
  else lines.push("בלי דרישת מינימום");
  if (form.limit) lines.push(form.limitN.trim() ? `עד ${form.limitN} שימושים` : "הגבלת שימושים");
  if (form.once) lines.push("שימוש אחד לכל לקוח");
  if (!form.limit && !form.once) lines.push("בלי הגבלת שימושים");
  const combos = [form.combProduct && "מוצרים", form.combOrder && "הזמנה", form.combShip && "משלוח"].filter(Boolean);
  lines.push(combos.length ? `משתלבת עם הנחות ${combos.join(", ")}` : "לא משתלבת עם הנחות אחרות");
  lines.push(form.hasEnd && form.end ? `מ-${showDay(form.start)} עד ${showDay(form.end)}` : `פעילה מ-${showDay(form.start)}`);
  return lines;
}

function Card({ title, children }: { title?: string; children: ReactNode }) {
  const fonts = useFontSet();
  return (
    <View style={{ marginHorizontal: 12, marginTop: 10, backgroundColor: tokens.card, borderRadius: 16, padding: 16, gap: 12 }}>
      {title ? <AppText style={{ fontFamily: fonts.bold, fontSize: 17, color: tokens.inkStrong }}>{title}</AppText> : null}
      {children}
    </View>
  );
}

function FieldLabel({ text }: { text: string }) {
  const fonts = useFontSet();
  return <AppText style={{ fontFamily: fonts.semibold, fontSize: 14, color: tokens.inkStrong }}>{text}</AppText>;
}

function Segment<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  const fonts = useFontSet();
  return (
    <View style={{ flexDirection: "row", borderRadius: 12, borderWidth: 1, borderColor: BORDER, overflow: "hidden" }}>
      {options.map((option) => {
        const on = option.id === value;
        return (
          <Pressable key={option.id} onPress={() => onChange(option.id)} style={{ flex: 1, height: 42, alignItems: "center", justifyContent: "center", backgroundColor: on ? "#e3e3e3" : tokens.card }}>
            <AppText style={{ fontFamily: on ? fonts.bold : fonts.medium, fontSize: 14, color: tokens.inkStrong }}>{option.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function Choice({ on, radio, label, children, onPress }: { on: boolean; radio?: boolean; label: string; children?: ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 6 }}>
      <View style={{ width: 22, height: 22, borderRadius: radio ? 11 : 6, borderWidth: on ? 0 : 1.5, borderColor: "#8a8a8a", backgroundColor: on ? tokens.inkStrong : tokens.card, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
        {on && !radio ? <Icon name="check" size={14} color="#ffffff" strokeWidth={2.4} /> : null}
        {on && radio ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#ffffff" }} /> : null}
      </View>
      <View style={{ flex: 1, gap: 8 }}>
        <AppText style={{ fontSize: 15, color: tokens.inkStrong }}>{label}</AppText>
        {children}
      </View>
    </Pressable>
  );
}

function SelectBox({ caption, value, image, onPress }: { caption: string; value: string; image?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
      {image != null ? <Thumb uri={image || undefined} size={40} /> : null}
      <View style={{ flex: 1, gap: 1 }}>
        <AppText style={{ fontSize: 12, color: tokens.inkSecondary }}>{caption}</AppText>
        <AppText style={{ fontSize: 16, color: tokens.inkStrong }} numberOfLines={1}>{value}</AppText>
      </View>
      <Icon name="down" size={16} color="#8a8a8a" strokeWidth={2} />
    </Pressable>
  );
}

function Stepper({ value, suffix, onChange }: { value: string; suffix: string; onChange: (value: string) => void }) {
  const fonts = useFontSet();
  function step(delta: number) {
    const next = Math.max(0, (Number(value) || 0) + delta);
    onChange(String(suffix === "%" ? Math.min(100, next) : next));
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: BORDER, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 }}>
        <TextInput
          value={value}
          onChangeText={(next) => onChange(next.replace(/[^\d.]/g, ""))}
          keyboardType="decimal-pad"
          style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16, color: tokens.inkStrong, textAlign: "right" }}
        />
        <AppText style={{ color: tokens.inkSecondary, fontSize: 16 }}>{suffix}</AppText>
      </View>
      <View style={{ flexDirection: "row", height: 48, borderRadius: 12, borderWidth: 1, borderColor: BORDER, overflow: "hidden" }}>
        <Pressable accessibilityLabel="הפחתה" onPress={() => step(-1)} style={{ width: 44, alignItems: "center", justifyContent: "center" }}><AppText style={{ fontSize: 20, color: tokens.inkStrong }}>−</AppText></Pressable>
        <View style={{ width: 1, backgroundColor: BORDER }} />
        <Pressable accessibilityLabel="הוספה" onPress={() => step(1)} style={{ width: 44, alignItems: "center", justifyContent: "center" }}><AppText style={{ fontSize: 20, color: tokens.inkStrong }}>+</AppText></Pressable>
      </View>
    </View>
  );
}

export function DiscountEditor({ record, kind = "order" }: { record: DiscountRecord | null; kind?: DiscountKind }) {
  useStatusBar("dark");
  const fonts = useFontSet();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { storeId } = useSession();
  const { snapshot, refresh } = useStoreData();
  const saving = useRef(false);
  const [form, setForm] = useState<Form>(() => record ? fromRecord(record) : blank(kind));
  const [baseline, setBaseline] = useState(() => JSON.stringify(record ? fromRecord(record) : blank(kind)));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [combosOpen, setCombosOpen] = useState(() => Boolean(record && (record.combProduct || record.combOrder || record.combShip || record.combBundle || record.blockGift)));
  const [picker, setPicker] = useState<Picker>(null);
  const [menu, setMenu] = useState<"eligibility" | "applies" | null>(null);
  const [search, setSearch] = useState("");
  const dirty = JSON.stringify(form) !== baseline;
  const ready = dirty && Boolean(form.code.trim()) && !busy;
  const products = snapshot?.products ?? [];
  const categories = [...new Set((snapshot?.collections ?? []).map((item) => item.title.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right, "he"));
  const subcategories = [...new Set(products.flatMap((item) => item.subcategories ?? []).map((item) => item.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right, "he"));
  const status = knownBadge(DISCOUNT_STATUS, discountStatus({ ...record, start: form.start, hasEnd: form.hasEnd, end: form.end }));
  const title = record ? form.code.trim() || DISCOUNT_KIND[form.kind] : "הנחה חדשה";
  const zone = zoneLabel();

  function patch(next: Partial<Form>) {
    setForm((current) => ({ ...current, ...next }));
    setError("");
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

  async function save() {
    const problem = validate(form);
    if (problem) {
      setError(problem);
      return;
    }
    if (!storeId) {
      setError("אין חנות נבחרת.");
      return;
    }
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      const id = await saveStoreDiscount(storeId, payload(form, record?.id));
      await refresh();
      setBaseline(JSON.stringify(form));
      if (!record && id) router.replace(`/more/discounts/${id}` as Href);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "שמירת ההנחה נכשלה");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  function openPicker(next: Picker) {
    setSearch("");
    setPicker(next);
  }

  function namesFor(target: Picker) {
    return target === "subs" ? subcategories : categories;
  }

  const needle = search.trim().toLowerCase();
  const productHits = products.filter((product) => {
    if (!product.id) return false;
    if (!needle) return true;
    return `${product.title ?? ""} ${product.variant ?? ""} ${product.sku ?? ""}`.toLowerCase().includes(needle);
  });
  const nameHits = namesFor(picker).filter((name) => !needle || name.toLowerCase().includes(needle));
  const pickingProducts = picker === "buy" || picker === "get" || picker === "prods";
  const lines = summaryLines(form, products);
  const comboText = form.combProduct || form.combOrder || form.combShip
    ? `${form.code.trim() || "ההנחה"} יכולה להשתלב עם ${[form.combProduct && "הנחות מוצר", form.combOrder && "הנחות הזמנה", form.combShip && "הנחות משלוח"].filter(Boolean).join(", ")}.`
    : `${form.code.trim() || "ההנחה"} לא תשתלב עם הנחות אחרות על מוצר, הזמנה או משלוח.`;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.card }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 14, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable accessibilityLabel="חזרה" onPress={close} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: tokens.field, alignItems: "center", justifyContent: "center" }}>
          <Icon name="back" size={18} color={tokens.inkStrong} strokeWidth={1.8} />
        </Pressable>
        <AppText style={{ flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 17, color: tokens.inkStrong }} numberOfLines={1}>{busy ? "שומר…" : title}</AppText>
        <Pressable accessibilityLabel="שמירה" disabled={!ready} onPress={() => void save()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: ready ? tokens.inkStrong : tokens.field, alignItems: "center", justifyContent: "center" }}>
          <Icon name="check" size={18} color={ready ? "#ffffff" : "#b5b5b5"} strokeWidth={2} />
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: PAGE }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: TAB_SPACE + insets.bottom + 24 }}>
          {record ? (
            <View style={{ backgroundColor: tokens.card, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <AppText style={{ fontFamily: fonts.bold, fontSize: 28, color: tokens.inkStrong }} numberOfLines={1}>{form.code.trim() || DISCOUNT_KIND[form.kind]}</AppText>
              {status ? <Badge {...status} /> : null}
            </View>
          ) : null}
          {error ? <ErrorNote text={error} /> : null}

          <Card title={DISCOUNT_KIND[form.kind]}>
            <Segment options={[{ id: "code" as const, label: "קוד הנחה" }, { id: "auto" as const, label: "אוטומטית" }]} value={form.method} onChange={(method) => patch({ method })} />
            <FieldLabel text={form.method === "code" ? "קוד הנחה" : "כותרת"} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TextInput
                value={form.code}
                onChangeText={(code) => patch({ code: form.method === "code" ? code.toUpperCase() : code })}
                autoCapitalize={form.method === "code" ? "characters" : "sentences"}
                placeholder={form.method === "code" ? "SUMMER10" : "משלוח חינם מעל 200"}
                placeholderTextColor="#8a8a8a"
                style={{ flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 16, color: tokens.inkStrong, textAlign: form.method === "code" ? "left" : "right", writingDirection: form.method === "code" ? "ltr" : "rtl" }}
              />
              {form.method === "code" ? (
                <Pressable accessibilityLabel="יצירת קוד" onPress={() => patch({ code: randomCode() })} style={{ width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="switch" size={18} color={tokens.inkStrong} strokeWidth={1.8} />
                </Pressable>
              ) : null}
            </View>
            <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>{form.method === "code" ? "הלקוחות צריכים להזין את הקוד בקופה." : "ההנחה מופעלת לבד, בלי קוד."}</AppText>
          </Card>

          <Card title={form.kind === "bxgy" ? "מה מקבלים" : form.kind === "ship" ? "ההנחה" : "ערך ההנחה"}>
            {form.kind === "ship" ? <AppText style={{ fontSize: 15, color: tokens.inkStrong }}>דמי המשלוח מתבטלים כשהתנאים למטה מתקיימים.</AppText> : null}
            {form.kind === "order" || form.kind === "product" ? (
              <>
                <Segment options={[{ id: "pct" as const, label: "אחוז" }, { id: "fixed" as const, label: "סכום קבוע" }]} value={form.valueType} onChange={(valueType) => patch({ valueType })} />
                <FieldLabel text={form.valueType === "pct" ? "אחוז ההנחה" : "סכום ההנחה"} />
                <Stepper value={form.value} suffix={form.valueType === "pct" ? "%" : "₪"} onChange={(value) => patch({ value })} />
                {form.kind === "order" ? <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>האחוז או הסכום יורדים מכלל ההזמנה.</AppText> : (
                  <SelectBox caption="חל על" value={APPLIES.find((item) => item.id === form.applies)?.label ?? "כל המוצרים"} onPress={() => setMenu("applies")} />
                )}
                {form.kind === "product" && form.applies === "prods" ? <Chosen items={form.collections.map((id) => productName(products, id))} images={form.collections.map((id) => productPhoto(products, id) ?? "")} onRemove={(index) => patch({ collections: form.collections.filter((_, item) => item !== index) })} onAdd={() => openPicker("prods")} addLabel="בחירת מוצרים" /> : null}
                {form.kind === "product" && (form.applies === "colls" || form.applies === "subs") ? <Chosen items={form.collections} onRemove={(index) => patch({ collections: form.collections.filter((_, item) => item !== index) })} onAdd={() => openPicker(form.applies === "subs" ? "subs" : "colls")} addLabel={form.applies === "subs" ? "בחירת תתי קטגוריות" : "בחירת קטגוריות"} /> : null}
              </>
            ) : null}
            {form.kind === "bxgy" ? (
              <>
                {BXGY.map((mode) => (
                  <Choice key={mode.id} radio on={form.bxMode === mode.id} label={mode.title} onPress={() => patch({ bxMode: mode.id })}>
                    <AppText style={{ fontSize: 13, color: tokens.inkSecondary, marginTop: -6 }}>{mode.detail}</AppText>
                  </Choice>
                ))}
                {form.bxMode === "pair" ? (
                  <>
                    <SelectBox caption="המוצר שקונים" value={form.bxBuyIds[0] ? productName(products, form.bxBuyIds[0]) : "בחירת מוצר"} image={form.bxBuyIds[0] ? productPhoto(products, form.bxBuyIds[0]) ?? "" : undefined} onPress={() => openPicker("buy")} />
                    <SelectBox caption="המוצר במתנה" value={form.bxGetIds[0] ? productName(products, form.bxGetIds[0]) : "בחירת מוצר"} image={form.bxGetIds[0] ? productPhoto(products, form.bxGetIds[0]) ?? "" : undefined} onPress={() => openPicker("get")} />
                  </>
                ) : null}
                {form.bxMode === "qty" ? (
                  <>
                    <SelectBox caption="המוצר" value={form.bxBuyIds[0] ? productName(products, form.bxBuyIds[0]) : "בחירת מוצר"} image={form.bxBuyIds[0] ? productPhoto(products, form.bxBuyIds[0]) ?? "" : undefined} onPress={() => openPicker("buy")} />
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <View style={{ flex: 1, gap: 6 }}>
                        <FieldLabel text="כמות לקנייה" />
                        <Stepper value={form.bxBuy} suffix="" onChange={(bxBuy) => patch({ bxBuy: bxBuy.replace(/[^\d]/g, "") })} />
                      </View>
                    </View>
                    <FieldLabel text="כמות במתנה" />
                    <Stepper value={form.bxGet} suffix="" onChange={(bxGet) => patch({ bxGet: bxGet.replace(/[^\d]/g, "") })} />
                  </>
                ) : null}
                {form.bxMode === "cats" ? (
                  <>
                    <SelectBox caption="קטגוריית הקנייה" value={form.bxColl || "בחירת קטגוריה"} onPress={() => openPicker("bxColl")} />
                    <SelectBox caption="קטגוריית המתנה" value={form.bxGetColl || "בחירת קטגוריה"} onPress={() => openPicker("bxGetColl")} />
                  </>
                ) : null}
              </>
            ) : null}
          </Card>

          <Card title="זכאות">
            <SelectBox caption="מי יכול להשתמש" value={form.eligibility === "all" ? "כל הלקוחות" : form.segment.trim() || "פלח לקוחות"} onPress={() => setMenu("eligibility")} />
            {form.eligibility === "seg" ? (
              <TextInput value={form.segment} onChangeText={(segment) => patch({ segment })} placeholder="שם הפלח" placeholderTextColor="#8a8a8a" style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 16, color: tokens.inkStrong, textAlign: "right" }} />
            ) : null}
          </Card>

          <Card title="דרישת מינימום לקנייה">
            <Choice radio on={form.minType === "none"} label="בלי דרישת מינימום" onPress={() => patch({ minType: "none" })} />
            <Choice radio on={form.minType === "amount"} label="סכום מינימום" onPress={() => patch({ minType: "amount" })}>
              {form.minType === "amount" ? <Stepper value={form.minValue} suffix="₪" onChange={(minValue) => patch({ minValue })} /> : null}
            </Choice>
            <Choice radio on={form.minType === "qty"} label="כמות מינימלית של פריטים" onPress={() => patch({ minType: "qty" })}>
              {form.minType === "qty" ? <Stepper value={form.minValue} suffix="" onChange={(minValue) => patch({ minValue: minValue.replace(/[^\d]/g, "") })} /> : null}
            </Choice>
          </Card>

          <Card title="מגבלת שימושים">
            <Choice on={form.limit} label="הגבלת מספר הפעמים שאפשר להשתמש בהנחה" onPress={() => patch({ limit: !form.limit })}>
              {form.limit ? <Stepper value={form.limitN} suffix="" onChange={(limitN) => patch({ limitN: limitN.replace(/[^\d]/g, "") })} /> : null}
            </Choice>
            <Choice on={form.once} label="שימוש אחד לכל לקוח" onPress={() => patch({ once: !form.once })} />
          </Card>

          <Card title="שילובים">
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <AppText style={{ flex: 1, fontSize: 15, color: tokens.inkStrong }}>{comboText}</AppText>
              <Pressable accessibilityLabel="עריכת שילובים" onPress={() => setCombosOpen((open) => !open)} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: tokens.field, alignItems: "center", justifyContent: "center" }}>
                <Icon name={combosOpen ? "close" : "plus"} size={14} color={tokens.inkStrong} strokeWidth={2} />
              </Pressable>
            </View>
            {combosOpen ? (
              <>
                <Choice on={form.combProduct} label="הנחות על מוצרים" onPress={() => patch({ combProduct: !form.combProduct })} />
                <Choice on={form.combOrder} label="הנחות על ההזמנה" onPress={() => patch({ combOrder: !form.combOrder })} />
                <Choice on={form.combShip} label="הנחות משלוח" onPress={() => patch({ combShip: !form.combShip })} />
                {form.kind === "bxgy" ? <Choice on={form.combBundle} label="משתלבת עם באנדלים" onPress={() => patch({ combBundle: !form.combBundle })} /> : null}
                <Choice on={form.blockGift} label="לא תשתלב עם כרטיסי מתנה" onPress={() => patch({ blockGift: !form.blockGift })} />
              </>
            ) : null}
          </Card>

          <Card title="לוח זמנים">
            <View style={{ minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable accessibilityLabel="יום קודם" onPress={() => patch({ start: shiftDay(form.start, -1) })}><AppText style={{ fontSize: 18 }}>−</AppText></Pressable>
              <AppText style={{ flex: 1, fontSize: 16, color: tokens.inkStrong }}>{showDay(form.start)}</AppText>
              <Pressable accessibilityLabel="יום הבא" onPress={() => patch({ start: shiftDay(form.start, 1) })}><AppText style={{ fontSize: 18 }}>+</AppText></Pressable>
              <AppText style={{ color: tokens.inkSecondary, fontSize: 14 }}>{zone}</AppText>
            </View>
            {form.hasEnd ? (
              <View style={{ minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Pressable onPress={() => patch({ end: shiftDay(form.end || form.start, -1) })}><AppText style={{ fontSize: 18 }}>−</AppText></Pressable>
                <AppText style={{ flex: 1, fontSize: 16, color: tokens.inkStrong }}>{form.end ? showDay(form.end) : "תאריך סיום"}</AppText>
                <Pressable onPress={() => patch({ end: shiftDay(form.end || form.start, 1) })}><AppText style={{ fontSize: 18 }}>+</AppText></Pressable>
                <Pressable onPress={() => patch({ hasEnd: false, end: "" })}><AppText style={{ color: tokens.link, fontSize: 14 }}>הסרה</AppText></Pressable>
              </View>
            ) : (
              <Pressable onPress={() => patch({ hasEnd: true, end: shiftDay(form.start, 7) })}>
                <AppText style={{ color: tokens.link, fontFamily: fonts.semibold, fontSize: 15 }}>+ הגדרת תאריך סיום</AppText>
              </Pressable>
            )}
          </Card>

          <Card title="סיכום">
            {lines.map((line) => (
              <AppText key={line} style={{ fontSize: 15, color: tokens.inkStrong }}>{`•  ${line}`}</AppText>
            ))}
          </Card>

          {record ? (
            <Card title="ביצועים">
              <AppText style={{ fontSize: 15, color: tokens.inkStrong }}>{`${formatCount(record.uses ?? 0)} שימושים`}</AppText>
              <AppText style={{ fontSize: 13, color: tokens.inkSecondary, marginTop: -6 }}>נוצלו עד עכשיו</AppText>
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={menu != null} transparent animationType="fade" onRequestClose={() => setMenu(null)}>
        <Pressable onPress={() => setMenu(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}>
          <Pressable style={{ backgroundColor: tokens.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 8, paddingBottom: insets.bottom + 12 }}>
            <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "#e3e3e3", marginBottom: 8 }} />
            {(menu === "eligibility" ? [{ id: "all", label: "כל הלקוחות" }, { id: "seg", label: "פלח לקוחות" }] : APPLIES).map((option) => {
              const on = menu === "eligibility" ? form.eligibility === option.id : form.applies === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    if (menu === "eligibility") patch({ eligibility: option.id === "seg" ? "seg" : "all" });
                    else patch({ applies: option.id as Applies, collections: option.id === form.applies ? form.collections : [] });
                    setMenu(null);
                  }}
                  style={{ height: 48, paddingHorizontal: 20, flexDirection: "row", alignItems: "center" }}
                >
                  <AppText style={{ flex: 1, fontFamily: on ? fonts.bold : fonts.regular, fontSize: 16 }}>{option.label}</AppText>
                  {on ? <Icon name="check" size={18} color={tokens.inkStrong} strokeWidth={2} /> : null}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={picker != null} animationType="slide" onRequestClose={() => setPicker(null)}>
        <View style={{ flex: 1, backgroundColor: tokens.card, paddingTop: insets.top + 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8 }}>
            <Pressable onPress={() => setPicker(null)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: tokens.field, alignItems: "center", justifyContent: "center" }}>
              <Icon name="close" size={16} color={tokens.inkStrong} strokeWidth={2} />
            </Pressable>
            <AppText style={{ flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 17 }}>{pickingProducts ? "בחירת מוצרים" : "בחירת קטגוריה"}</AppText>
            <View style={{ width: 36 }} />
          </View>
          <TextInput value={search} onChangeText={setSearch} placeholder="חיפוש" placeholderTextColor="#8a8a8a" style={{ marginHorizontal: 16, height: 42, borderRadius: 12, backgroundColor: tokens.field, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 16, textAlign: "right" }} />
          {pickingProducts ? (
            <FlatList
              data={productHits}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
              renderItem={({ item }) => {
                const selected = picker === "prods" ? form.collections.includes(item.id) : picker === "buy" ? form.bxBuyIds[0] === item.id : form.bxGetIds[0] === item.id;
                return (
                  <Pressable
                    onPress={() => {
                      if (picker === "prods") patch({ collections: selected ? form.collections.filter((id) => id !== item.id) : [...form.collections, item.id].slice(0, 40) });
                      else if (picker === "buy") {
                        patch(form.bxMode === "qty" ? { bxBuyIds: [item.id], bxGetIds: [item.id] } : { bxBuyIds: [item.id] });
                        setPicker(null);
                      } else {
                        patch({ bxGetIds: [item.id] });
                        setPicker(null);
                      }
                    }}
                    style={{ minHeight: 64, paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: tokens.line }}
                  >
                    <Thumb uri={productPhoto(products, item.id)} size={44} />
                    <AppText style={{ flex: 1, fontSize: 16 }} numberOfLines={1}>{productName(products, item.id)}</AppText>
                    {selected ? <Icon name="check" size={16} color={tokens.inkStrong} strokeWidth={2} /> : null}
                  </Pressable>
                );
              }}
            />
          ) : (
            <FlatList
              data={nameHits}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
              renderItem={({ item }) => {
                const multi = picker === "colls" || picker === "subs";
                const selected = multi ? form.collections.includes(item) : picker === "bxColl" ? form.bxColl === item : form.bxGetColl === item;
                return (
                  <Pressable
                    onPress={() => {
                      if (multi) patch({ collections: selected ? form.collections.filter((name) => name !== item) : [...form.collections, item] });
                      else if (picker === "bxColl") {
                        patch({ bxColl: item });
                        setPicker(null);
                      } else {
                        patch({ bxGetColl: item });
                        setPicker(null);
                      }
                    }}
                    style={{ minHeight: 48, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: tokens.line }}
                  >
                    <AppText style={{ flex: 1, fontSize: 16 }}>{item}</AppText>
                    {selected ? <Icon name="check" size={16} color={tokens.inkStrong} strokeWidth={2} /> : null}
                  </Pressable>
                );
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

function Chosen({ items, images, onRemove, onAdd, addLabel }: { items: string[]; images?: string[]; onRemove: (index: number) => void; onAdd: () => void; addLabel: string }) {
  const fonts = useFontSet();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {items.map((item, index) => (
          <Pressable key={`${item}-${index}`} onPress={() => onRemove(index)} style={{ height: 36, borderRadius: 18, backgroundColor: tokens.field, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 6 }}>
            {images ? <Thumb uri={images[index] || undefined} size={24} /> : null}
            <AppText style={{ fontSize: 13, fontFamily: fonts.semibold }}>{item}</AppText>
            <Icon name="close" size={12} color={tokens.inkStrong} strokeWidth={2} />
          </Pressable>
        ))}
      </View>
      <Pressable onPress={onAdd}><AppText style={{ color: tokens.link, fontFamily: fonts.semibold, fontSize: 15 }}>{addLabel}</AppText></Pressable>
    </View>
  );
}
