import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Keyboard, Modal, Platform, Pressable, ScrollView, Share, TextInput, View } from "react-native";
import QRCode from "qrcode";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import Svg, { Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/icon";
import { useStatusBar, Thumb } from "@/components/shell";
import { AppText, ErrorNote } from "@/components/ui";
import { formatIls } from "@/lib/format";
import {
  createPaymentLink,
  loadSaleCatalog,
  paymentLink,
  paymentLinkStatus,
  placeCashSale,
  type SaleProduct,
  type SaleVariant,
} from "@/lib/sale";
import { useSession } from "@/lib/session";
import { useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

type CartLine = {
  key: string;
  kind: "product" | "custom";
  variantId?: string;
  title: string;
  detail: string;
  image?: string;
  price: number;
  quantity: number;
  stock: number;
};

type Step = "cart" | "products" | "variants" | "sent";

const PAGE = "#f6f6f6";

function money(value: string, allowZero = false) {
  const amount = Number(value.replace(",", ".").trim());
  if (!Number.isFinite(amount) || amount < 0 || (!allowZero && amount === 0) || amount > 1000000) return null;
  return Math.round(amount * 100) / 100;
}

function QrMark({ value }: { value: string }) {
  const code = QRCode.create(value, { errorCorrectionLevel: "M" });
  const size = code.modules.size;
  const cells: { x: number; y: number }[] = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (code.modules.get(row, col)) cells.push({ x: col, y: row });
    }
  }
  const dim = size + 4;
  return (
    <Svg width={220} height={220} viewBox={`0 0 ${dim} ${dim}`}>
      <Rect width={dim} height={dim} fill="#ffffff" />
      {cells.map((cell) => <Rect key={`${cell.x}-${cell.y}`} x={cell.x + 2} y={cell.y + 2} width={1} height={1} fill="#111111" />)}
    </Svg>
  );
}

export function QuickSaleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fonts = useFontSet();
  const { storeId } = useSession();
  const { snapshot, refresh } = useStoreData();
  useStatusBar("dark");
  const [step, setStep] = useState<Step>("cart");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [catalog, setCatalog] = useState<SaleProduct[] | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<SaleProduct | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState("");
  const [priceKey, setPriceKey] = useState<string | null>(null);
  const [priceText, setPriceText] = useState("");
  const [shipping, setShipping] = useState(0);
  const [shippingOpen, setShippingOpen] = useState(false);
  const [shippingText, setShippingText] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState<{ id: string; link: string; total: number; paid: boolean; orderNumber?: number; cash: boolean } | null>(null);

  const products = lines.filter((line) => line.kind === "product");
  const custom = lines.find((line) => line.kind === "custom");
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const total = subtotal + shipping;

  useEffect(() => {
    if (!sent || sent.cash || sent.paid || !storeId) return;
    let stop = false;
    async function tick() {
      if (!sent || !storeId) return;
      try {
        const status = await paymentLinkStatus(storeId, sent.id);
        if (stop || !status.recovered) return;
        setSent((current) => current ? { ...current, paid: true, orderNumber: status.orderNumber } : current);
        void refresh();
      } catch {
        // The next check tries again.
      }
    }
    void tick();
    const timer = setInterval(() => void tick(), 4000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [refresh, sent, storeId]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (catalog ?? []).filter((product) => !needle || `${product.title} ${product.variants.map((variant) => variant.title).join(" ")}`.toLowerCase().includes(needle));
  }, [catalog, query]);

  function tap() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }

  async function openProducts() {
    setStep("products");
    setProblem("");
    if (catalog || !storeId) return;
    try {
      setCatalog(await loadSaleCatalog(storeId));
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "לא הצלחנו לטעון את המוצרים.");
    }
  }

  function addVariant(product: SaleProduct, variant: SaleVariant) {
    if (variant.stock <= 0) {
      setProblem("המוצר אזל מהמלאי.");
      return;
    }
    tap();
    setProblem("");
    setLines((current) => {
      const existing = current.find((line) => line.variantId === variant.id);
      if (existing && existing.quantity >= variant.stock) return current;
      if (existing) return current.map((line) => line.variantId === variant.id ? { ...line, quantity: line.quantity + 1 } : line);
      const detail = variant.title && variant.title !== product.title ? variant.title : "";
      return [...current, { key: variant.id, kind: "product", variantId: variant.id, title: product.title, detail, image: product.image, price: variant.price, quantity: 1, stock: variant.stock }];
    });
  }

  function changeQty(key: string, next: number) {
    setLines((current) => current.flatMap((line) => {
      if (line.key !== key) return [line];
      if (next < 1) return [];
      return [{ ...line, quantity: Math.min(next, line.kind === "product" ? line.stock : 99) }];
    }));
  }

  function saveCustom() {
    const amount = money(customText);
    if (amount == null) {
      setProblem("הזינו סכום גדול מאפס.");
      return;
    }
    setProblem("");
    setLines((current) => {
      const rest = current.filter((line) => line.kind !== "custom");
      return [...rest, { key: "custom", kind: "custom", title: "סכום חופשי", detail: "", price: amount, quantity: 1, stock: 1 }];
    });
    setCustomOpen(false);
    setCustomText("");
  }

  function savePrice() {
    const amount = money(priceText);
    if (amount == null || !priceKey) {
      setProblem("הזינו מחיר גדול מאפס.");
      return;
    }
    setProblem("");
    setLines((current) => current.map((line) => line.key === priceKey ? { ...line, price: amount } : line));
    setPriceKey(null);
    setPriceText("");
  }

  function saveShipping(next: number | null) {
    if (next == null) {
      setProblem("הזינו סכום משלוח, או בחרו משלוח חינם.");
      return;
    }
    setProblem("");
    setShipping(next);
    setShippingOpen(false);
    setShippingText("");
  }

  function anotherSale() {
    setSent(null);
    setLines([]);
    setShipping(0);
    setProblem("");
    setCopied(false);
    setStep("cart");
  }

  async function collect(kind: "link" | "cash") {
    if (!storeId || busy || total <= 0) return;
    if (kind === "link" && !products.length) {
      setProblem("קישור לתשלום צריך לפחות מוצר אחד מהחנות. סכום חופשי לבד נגבה במזומן.");
      return;
    }
    if (kind === "link" && !snapshot?.hostname) {
      setProblem("לחנות עדיין אין כתובת, אז אין קישור לשלוח.");
      return;
    }
    setBusy(true);
    setProblem("");
    try {
      const payload = products.map((line) => ({ variantId: line.variantId ?? "", quantity: line.quantity, unitPrice: line.price }));
      if (kind === "cash") {
        const sale = await placeCashSale(storeId, payload, custom?.price ?? 0, shipping);
        setSent({ id: "", link: "", total: sale.total, paid: true, orderNumber: sale.orderNumber, cash: true });
        setLines([]);
        setStep("sent");
        setPayOpen(false);
        void refresh();
      } else {
        const created = await createPaymentLink(storeId, payload, custom?.price ?? 0, shipping);
        const url = paymentLink(snapshot?.hostname, created.id);
        if (!url) throw new Error("לחנות עדיין אין כתובת, אז אין קישור לשלוח.");
        setSent({ id: created.id, link: url, total: Number.isFinite(created.total) ? created.total : subtotal, paid: false, cash: false });
        setLines([]);
        setStep("sent");
        setPayOpen(false);
      }
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "לא הצלחנו לגבות.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!sent?.link) return;
    await Clipboard.setStringAsync(sent.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  const title = step === "products" ? "הוספת מוצר" : step === "variants" ? "בחירת אפשרות" : step === "sent" ? (sent?.cash ? "התשלום התקבל" : "קישור לתשלום") : "מכירה מהירה";

  return (
    <View style={{ flex: 1, backgroundColor: "#ffffff" }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: 12, height: insets.top + 52, flexDirection: "row", alignItems: "center" }}>
        <Pressable accessibilityLabel={step === "cart" || step === "sent" ? "סגירה" : "חזרה"} onPress={() => {
          if (step === "variants") setStep("products");
          else if (step === "products") setStep("cart");
          else router.back();
        }} hitSlop={8} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: tokens.field }}>
          <Icon name={step === "cart" || step === "sent" ? "close" : "chevron"} size={18} color={tokens.inkStrong} strokeWidth={1.8} />
        </Pressable>
        <AppText style={{ flex: 1, textAlign: "center", fontFamily: fonts.semibold, fontSize: 17, color: tokens.inkStrong }}>{title}</AppText>
        {step === "products" || step === "variants" ? (
          <Pressable onPress={() => setStep("cart")} style={{ height: 36, borderRadius: 18, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", backgroundColor: tokens.field }}>
            <AppText style={{ fontFamily: fonts.semibold, fontSize: 15 }}>סיום</AppText>
          </Pressable>
        ) : <View style={{ width: 36 }} />}
      </View>

      {problem ? <ErrorNote text={problem} /> : null}

      {step === "sent" && sent ? (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, alignItems: "center", gap: 12 }}>
          {sent.link ? (
            <View style={{ padding: 12, borderRadius: 16, backgroundColor: "#ffffff", borderWidth: 1, borderColor: tokens.line }}>
              <QrMark value={sent.link} />
            </View>
          ) : null}
          {sent.link ? (
            <>
              <Pressable onPress={() => void copyLink()} style={pillStyle}>
                <Icon name={copied ? "check" : "link"} size={16} color={tokens.inkStrong} />
                <AppText style={{ fontFamily: fonts.semibold, fontSize: 16 }}>{copied ? "הקישור הועתק" : "העתקת קישור"}</AppText>
              </Pressable>
              <Pressable onPress={() => void Share.share({ message: `אפשר לשלם כאן:\n${sent.link}` })} style={pillStyle}>
                <Icon name="share" size={16} color={tokens.inkStrong} />
                <AppText style={{ fontFamily: fonts.semibold, fontSize: 16 }}>שיתוף הקישור</AppText>
              </Pressable>
              <View style={{ alignSelf: "stretch", borderRadius: 14, backgroundColor: "#e7f6ff", padding: 12 }}>
                <AppText style={{ fontSize: 14, color: "#16324f" }}>הקישור נשאר פעיל גם אחרי שיוצאים מהמסך. המחיר והמשלוח שקבעתם נשמרים בו. הלקוח משלים פרטים באתר, והמסך מתעדכן כשהתשלום נקלט.</AppText>
              </View>
            </>
          ) : (
            <AppText style={{ fontFamily: fonts.bold, fontSize: 22, color: tokens.inkStrong, marginTop: 24 }}>המזומן נרשם</AppText>
          )}
          <View style={{ alignSelf: "stretch", marginTop: 8, gap: 8 }}>
            <AppText style={{ fontFamily: fonts.semibold, fontSize: 16 }}>סיכום</AppText>
            <View style={{ alignSelf: "flex-start", borderRadius: 8, backgroundColor: sent.paid ? "#cdfee1" : "#ffeb78", paddingHorizontal: 8, paddingVertical: 4 }}>
              <AppText style={{ fontFamily: fonts.semibold, fontSize: 13, color: sent.paid ? "#0c5132" : "#4f4700" }}>{sent.paid ? "שולם" : "ממתין לתשלום"}</AppText>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <AppText style={{ fontSize: 15 }}>{sent.cash ? "התקבל במזומן" : "ממתין בקישור"}</AppText>
              <AppText style={{ fontSize: 15, writingDirection: "ltr" }}>{formatIls(sent.total)}</AppText>
            </View>
            {sent.orderNumber ? <AppText style={{ fontSize: 15, color: tokens.inkSecondary }}>{`הזמנה #${sent.orderNumber}`}</AppText> : null}
          </View>
          <Pressable onPress={anotherSale} style={{ alignSelf: "stretch", height: 52, borderRadius: 26, backgroundColor: tokens.inkStrong, alignItems: "center", justifyContent: "center", marginTop: 8 }}>
            <AppText style={{ color: "#ffffff", fontFamily: fonts.semibold, fontSize: 16 }}>מכירה חדשה</AppText>
          </Pressable>
        </ScrollView>
      ) : null}

      {step === "cart" ? (
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
            <Pressable onPress={() => void openProducts()} style={actionPill(true)}>
              <Icon name="search" size={16} color="#ffffff" />
              <AppText style={{ color: "#ffffff", fontFamily: fonts.semibold, fontSize: 15 }}>הוספת מוצר</AppText>
            </Pressable>
            <Pressable onPress={() => { setCustomText(custom ? String(custom.price) : ""); setCustomOpen(true); }} style={actionPill(false)}>
              <Icon name="receipt" size={16} color={tokens.inkStrong} />
              <AppText style={{ fontFamily: fonts.semibold, fontSize: 15 }}>סכום חופשי</AppText>
            </Pressable>
          </View>
          {lines.length ? (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 96, gap: 10 }}>
              {lines.map((line) => (
                <View key={line.key} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: PAGE, borderRadius: 16, padding: 12 }}>
                  {line.kind === "product" ? <Thumb uri={line.image} size={52} /> : <View style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" }}><Icon name="receipt" size={20} color={tokens.inkSecondary} /></View>}
                  <View style={{ flex: 1, gap: 4 }}>
                    <AppText style={{ fontFamily: fonts.semibold, fontSize: 15, color: tokens.inkStrong }} numberOfLines={2}>{line.title}</AppText>
                    {line.detail ? <AppText style={{ fontSize: 13, color: tokens.inkSecondary }} numberOfLines={1}>{line.detail}</AppText> : null}
                    {line.kind === "product" ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Pressable onPress={() => changeQty(line.key, line.quantity - 1)} style={qtyButton}><AppText style={{ fontSize: 16 }}>−</AppText></Pressable>
                        <AppText style={{ minWidth: 16, textAlign: "center" }}>{line.quantity}</AppText>
                        <Pressable onPress={() => changeQty(line.key, line.quantity + 1)} style={qtyButton}><AppText style={{ fontSize: 16 }}>+</AppText></Pressable>
                      </View>
                    ) : (
                      <Pressable onPress={() => changeQty(line.key, 0)}><AppText style={{ fontSize: 13, color: tokens.negative }}>הסרה</AppText></Pressable>
                    )}
                  </View>
                  {line.kind === "product" ? (
                    <Pressable onPress={() => { setPriceText(String(line.price)); setPriceKey(line.key); }} hitSlop={8} style={editChip}>
                      <AppText style={{ fontSize: 15, writingDirection: "ltr" }}>{formatIls(line.price * line.quantity)}</AppText>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Icon name="edit" size={13} color={tokens.inkStrong} />
                        <AppText style={{ fontFamily: fonts.semibold, fontSize: 12, color: tokens.inkStrong }}>עריכת מחיר</AppText>
                      </View>
                    </Pressable>
                  ) : (
                    <AppText style={{ fontSize: 15, writingDirection: "ltr" }}>{formatIls(line.price * line.quantity)}</AppText>
                  )}
                </View>
              ))}
              <View style={{ marginTop: 6, borderRadius: 16, borderWidth: 1, borderColor: tokens.line, padding: 14, gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <AppText style={{ fontSize: 15 }}>סיכום ביניים</AppText>
                  <AppText style={{ fontSize: 15, writingDirection: "ltr" }}>{formatIls(subtotal)}</AppText>
                </View>
                <Pressable onPress={() => { setShippingText(shipping ? String(shipping) : ""); setShippingOpen(true); }} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: tokens.field, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
                  <View style={{ gap: 2 }}>
                    <AppText style={{ fontSize: 15 }}>משלוח</AppText>
                    <AppText style={{ fontSize: 12, color: tokens.inkSecondary }}>לחצו כדי לשנות</AppText>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <AppText style={{ fontFamily: fonts.semibold, fontSize: 15, writingDirection: "ltr" }}>{shipping === 0 ? "חינם" : formatIls(shipping)}</AppText>
                    <Icon name="edit" size={15} color={tokens.inkStrong} />
                  </View>
                </Pressable>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <AppText style={{ fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }}>סה״כ</AppText>
                  <AppText style={{ fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong, writingDirection: "ltr" }}>{formatIls(total)}</AppText>
                </View>
              </View>
            </ScrollView>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 }}>
              <View style={{ width: 88, height: 88, borderRadius: 24, backgroundColor: "#2f6bff", alignItems: "center", justifyContent: "center", marginBottom: 8, shadowColor: "#2f6bff", shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } }}>
                <Icon name="bolt" size={36} color="#ffffff" strokeWidth={1.7} />
              </View>
              <AppText style={{ fontFamily: fonts.bold, fontSize: 20, color: tokens.inkStrong }}>קבלו תשלום מכל מקום</AppText>
              <AppText style={{ fontSize: 15, color: tokens.inkSecondary, textAlign: "center" }}>הוסיפו מוצר או סכום, ושלחו ללקוח קישור לתשלום באתר</AppText>
            </View>
          )}
          {lines.length ? (
            <Pressable disabled={busy} onPress={() => setPayOpen(true)} style={{ position: "absolute", left: 16, right: 16, bottom: insets.bottom + 12, height: 52, borderRadius: 26, backgroundColor: tokens.inkStrong, alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}>
              <AppText style={{ color: "#ffffff", fontFamily: fonts.semibold, fontSize: 16 }}>{`גבייה ${formatIls(total)}`}</AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {step === "products" ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          <View style={{ margin: 16, height: 44, borderRadius: 12, backgroundColor: PAGE, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8 }}>
            <Icon name="search" size={16} color={tokens.inkSecondary} />
            <TextInput value={query} onChangeText={setQuery} placeholder="חיפוש" placeholderTextColor={tokens.inkSecondary} style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16, color: tokens.inkStrong, textAlign: "right" }} />
          </View>
          <AppText style={{ paddingHorizontal: 16, marginBottom: 8, fontFamily: fonts.semibold, fontSize: 16 }}>כל המוצרים</AppText>
          {catalog == null ? <AppText style={{ padding: 16, color: tokens.inkSecondary }}>טוען מוצרים…</AppText> : visible.map((product) => {
            const many = product.variants.length > 1;
            const only = product.variants[0];
            const count = product.variants.reduce((sum, variant) => sum + (lines.find((line) => line.variantId === variant.id)?.quantity ?? 0), 0);
            return (
              <Pressable key={product.id} onPress={() => { if (many) { setPicked(product); setStep("variants"); } else if (only) addVariant(product, only); }} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
                <Thumb uri={product.image} size={48} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText style={{ fontFamily: fonts.semibold, fontSize: 15, color: tokens.inkStrong }} numberOfLines={2}>{product.title}</AppText>
                  <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>{many ? `${product.variants.length} אפשרויות` : formatIls(only?.price ?? 0)}</AppText>
                </View>
                {many ? <Icon name="back" size={16} color={tokens.inkSecondary} /> : (
                  <View style={addButton}><AppText style={{ fontFamily: fonts.semibold, fontSize: 16 }}>{count || "+"}</AppText></View>
                )}
              </Pressable>
            );
          })}
          {catalog && !visible.length ? <AppText style={{ padding: 16, color: tokens.inkSecondary }}>אין מוצרים פעילים בחיפוש.</AppText> : null}
        </ScrollView>
      ) : null}

      {step === "variants" && picked ? (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          {picked.variants.map((variant) => {
            const count = lines.find((line) => line.variantId === variant.id)?.quantity ?? 0;
            const gone = variant.stock <= 0;
            return (
              <View key={variant.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
                <Thumb uri={picked.image} size={48} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText style={{ fontFamily: fonts.semibold, fontSize: 15 }}>{variant.title || picked.title}</AppText>
                  <AppText style={{ fontSize: 13, color: gone ? tokens.negative : tokens.inkSecondary, writingDirection: "ltr" }}>{gone ? "אזל" : formatIls(variant.price)}</AppText>
                </View>
                <Pressable disabled={gone} onPress={() => addVariant(picked, variant)} style={[addButton, { opacity: gone ? 0.35 : 1 }]}>
                  <AppText style={{ fontFamily: fonts.semibold, fontSize: 16 }}>{count || "+"}</AppText>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      ) : null}

      <LiftedSheet visible={customOpen} onClose={() => setCustomOpen(false)}>
        <AppText style={{ fontFamily: fonts.bold, fontSize: 18 }}>סכום חופשי</AppText>
        <TextInput value={customText} onChangeText={setCustomText} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={tokens.inkSecondary} style={[amountInput, { fontFamily: fonts.regular }]} />
        <Pressable onPress={saveCustom} style={sheetSave}>
          <AppText style={{ color: "#ffffff", fontFamily: fonts.semibold, fontSize: 16 }}>הוספה</AppText>
        </Pressable>
      </LiftedSheet>

      <LiftedSheet visible={priceKey != null} onClose={() => setPriceKey(null)}>
        <AppText style={{ fontFamily: fonts.bold, fontSize: 18 }}>מחיר המוצר</AppText>
        <TextInput value={priceText} onChangeText={setPriceText} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={tokens.inkSecondary} style={[amountInput, { fontFamily: fonts.regular }]} />
        <Pressable onPress={savePrice} style={sheetSave}>
          <AppText style={{ color: "#ffffff", fontFamily: fonts.semibold, fontSize: 16 }}>שמירה</AppText>
        </Pressable>
      </LiftedSheet>

      <LiftedSheet visible={shippingOpen} onClose={() => setShippingOpen(false)}>
        <AppText style={{ fontFamily: fonts.bold, fontSize: 18 }}>משלוח</AppText>
        <AppText style={{ fontSize: 14, color: tokens.inkSecondary }}>אפשר להשאיר משלוח חינם, או להקליד סכום.</AppText>
        <Pressable onPress={() => saveShipping(0)} style={[payRow, shippingText.trim() ? null : { borderWidth: 1.5, borderColor: tokens.inkStrong, backgroundColor: "#ffffff" }]}>
          {shippingText.trim() ? <View style={{ width: 18 }} /> : <Icon name="check" size={18} color={tokens.inkStrong} />}
          <AppText style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16 }}>משלוח חינם</AppText>
        </Pressable>
        <View style={{ gap: 6 }}>
          <AppText style={{ fontFamily: fonts.semibold, fontSize: 14 }}>סכום משלוח</AppText>
          <TextInput value={shippingText} onChangeText={setShippingText} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={tokens.inkSecondary} style={[amountInput, { fontFamily: fonts.regular }]} />
        </View>
        <Pressable onPress={() => saveShipping(money(shippingText))} style={sheetSave}>
          <AppText style={{ color: "#ffffff", fontFamily: fonts.semibold, fontSize: 16 }}>שמירת סכום</AppText>
        </Pressable>
      </LiftedSheet>

      <Modal visible={payOpen} transparent animationType="slide" onRequestClose={() => setPayOpen(false)}>
        <Pressable onPress={() => setPayOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}>
          <Pressable style={{ backgroundColor: "#ffffff", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: insets.bottom + 16, gap: 8 }}>
            <AppText style={{ fontFamily: fonts.bold, fontSize: 22, textAlign: "center", writingDirection: "ltr" }}>{formatIls(total)}</AppText>
            <Pressable disabled={busy || !products.length || !snapshot?.hostname} onPress={() => void collect("link")} style={payRow}>
              <Icon name="link" size={18} color={tokens.inkStrong} />
              <View style={{ flex: 1 }}>
                <AppText style={{ fontFamily: fonts.semibold, fontSize: 16 }}>קישור לתשלום</AppText>
                {!products.length ? <AppText style={{ fontSize: 12, color: tokens.inkSecondary }}>סכום חופשי לבד נגבה במזומן</AppText> : !snapshot?.hostname ? <AppText style={{ fontSize: 12, color: tokens.inkSecondary }}>לחנות אין כתובת</AppText> : null}
              </View>
            </Pressable>
            <Pressable disabled={busy} onPress={() => void collect("cash")} style={payRow}>
              <Icon name="receipt" size={18} color={tokens.inkStrong} />
              <AppText style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16 }}>מזומן</AppText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function useKeyboardLift() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) => setHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

function LiftedSheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardLift();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", paddingBottom: keyboard }}>
        <Pressable onPress={onClose} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.35)" }} />
        <View style={{ backgroundColor: "#ffffff", borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: keyboard > 0 ? 16 : Math.max(insets.bottom, 16), gap: 12 }}>
          <View style={{ alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "#d0d0d0" }} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

const pillStyle = { alignSelf: "stretch" as const, height: 48, borderRadius: 14, backgroundColor: PAGE, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 8 };
const editChip = { backgroundColor: "#ffffff", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, alignItems: "center" as const, gap: 4 };
const amountInput = { height: 56, borderRadius: 14, backgroundColor: PAGE, paddingHorizontal: 14, fontSize: 22, textAlign: "right" as const, color: tokens.inkStrong };
const sheetSave = { height: 48, borderRadius: 24, backgroundColor: tokens.inkStrong, alignItems: "center" as const, justifyContent: "center" as const };
const qtyButton = { width: 28, height: 28, borderRadius: 8, backgroundColor: "#ffffff", alignItems: "center" as const, justifyContent: "center" as const };
const addButton = { width: 36, height: 36, borderRadius: 18, backgroundColor: PAGE, alignItems: "center" as const, justifyContent: "center" as const };
const payRow = { height: 56, borderRadius: 14, backgroundColor: PAGE, paddingHorizontal: 14, flexDirection: "row" as const, alignItems: "center" as const, gap: 12 };

function actionPill(dark: boolean) {
  return { flex: 1, height: 44, borderRadius: 22, backgroundColor: dark ? tokens.inkStrong : "#ffffff", borderWidth: dark ? 0 : 1, borderColor: tokens.line, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 6 };
}
