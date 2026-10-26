import { useState, type ReactNode } from "react";
import { Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Switch, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/icon";
import { OrderRow } from "@/components/rows";
import { SheetEmpty, useStatusBar } from "@/components/shell";
import { AppText, Badge, ErrorNote, PrimaryButton } from "@/components/ui";
import { formatCount, formatIls, hebrewDate, hebrewTime } from "@/lib/format";
import { updateStoreCustomer } from "@/lib/remote";
import { useSession } from "@/lib/session";
import { sortedOrders, type CustomerRecord, type OrderRecord } from "@/lib/snapshot";
import { useAllowed, useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, tokens } from "@/theme/tokens";

const BAND = "#f1f1f1";

type Panel = "note" | "tags" | "marketing" | "credit";
type Draft = { note: string; tags: string; subscribed: boolean; sms: boolean; whatsapp: boolean; credit: string };

function CircleButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: tokens.field, opacity: pressed ? 0.6 : 1 })}
    >
      <Icon name={icon} size={18} color={tokens.inkStrong} strokeWidth={2} />
    </Pressable>
  );
}

function Band() {
  return <View style={{ height: 10, backgroundColor: BAND }} />;
}

function Block({ title, subtitle, action, children }: { title?: string; subtitle?: string; action?: ReactNode; children?: ReactNode }) {
  const fonts = useFontSet();
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: title ? 14 : 4, paddingBottom: 6, backgroundColor: tokens.card }}>
      {title ? (
        <View style={{ flexDirection: "row", alignItems: "center", paddingBottom: 6 }}>
          <View style={{ flex: 1 }}>
            <AppText style={{ fontFamily: fonts.bold, fontSize: 17, color: tokens.inkStrong }}>{title}</AppText>
            {subtitle ? <AppText style={{ fontSize: 13, color: tokens.inkSecondary, marginTop: 2 }}>{subtitle}</AppText> : null}
          </View>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

function StatRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={{ minHeight: 50, flexDirection: "row", alignItems: "center", borderBottomWidth: last ? 0 : 1, borderBottomColor: tokens.line }}>
      <AppText style={{ flex: 1, fontSize: 16, color: tokens.inkStrong }}>{label}</AppText>
      <AppText style={{ fontSize: 16, color: tokens.inkStrong, writingDirection: "ltr" }}>{value}</AppText>
    </View>
  );
}

function LinkRow({ icon, label, value, onPress, last = false }: { icon: IconName; label: string; value?: string; onPress?: () => void; last?: boolean }) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: tokens.line, opacity: pressed ? 0.6 : 1 })}
    >
      <Icon name={icon} size={20} color={tokens.inkStrong} strokeWidth={1.7} />
      <AppText style={{ flex: 1, fontSize: 16, color: tokens.inkStrong }}>{label}</AppText>
      {value ? <AppText style={{ maxWidth: "45%", fontSize: 14, color: tokens.inkSecondary }} numberOfLines={1}>{value}</AppText> : null}
      {onPress ? <Icon name="forward" size={16} color="#b5b5b5" strokeWidth={2} /> : null}
    </Pressable>
  );
}

function ContactButton({ icon, label, onPress }: { icon: IconName; label: string; onPress?: () => void }) {
  const fonts = useFontSet();
  const off = !onPress;
  return (
    <Pressable
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, height: 44, borderRadius: 12, borderWidth: off ? 0 : 1, borderColor: tokens.lineStrong, backgroundColor: off ? tokens.field : tokens.card, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: pressed ? 0.6 : 1 })}
    >
      <Icon name={icon} size={17} color={off ? tokens.inkDisabled : tokens.inkStrong} strokeWidth={1.8} />
      <AppText style={{ fontFamily: fonts.semibold, fontSize: 15, color: off ? tokens.inkDisabled : tokens.inkStrong }}>{label}</AppText>
    </Pressable>
  );
}

type TimelineItem = { key: string; at?: string; text: string; order?: number };

function timeline(person: CustomerRecord, orders: OrderRecord[] | undefined): TimelineItem[] {
  const items: TimelineItem[] = (orders ?? []).map((order) => ({
    key: `order-${order.number}`,
    at: order.createdAt,
    text: `הלקוח ביצע את הזמנה #${order.number}${order.total != null ? ` בסך ${formatIls(order.total)}` : ""}`,
    order: order.number,
  }));
  items.push({ key: "created", at: person.createdAt, text: "הלקוח נוצר בחנות" });
  return items;
}

export default function CustomerScreen() {
  useStatusBar("dark");
  const fonts = useFontSet();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { storeId } = useSession();
  const allowed = useAllowed("customers.read");
  const canOrders = useAllowed("orders.read");
  const canUpdate = useAllowed("customers.update");
  const { snapshot, error, refresh } = useStoreData();
  const [scrolled, setScrolled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [draft, setDraft] = useState<Draft>({ note: "", tags: "", subscribed: false, sms: false, whatsapp: false, credit: "" });
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const person = snapshot?.customers?.find((item) => item.id === id);

  const header = (title: string) => (
    <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 14, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: tokens.card, borderBottomWidth: scrolled ? 1 : 0, borderBottomColor: tokens.line }}>
      <CircleButton icon="back" label="חזרה" onPress={() => (router.canGoBack() ? router.back() : router.replace("/customers"))} />
      <AppText style={{ flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 17, color: tokens.inkStrong, opacity: scrolled ? 1 : 0 }} numberOfLines={1}>{title}</AppText>
      {person ? <CircleButton icon="dots" label="פעולות" onPress={() => more(person)} /> : <View style={{ width: 38 }} />}
    </View>
  );

  if (!allowed || !person) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.card }}>
        {header("לקוח")}
        <SheetEmpty icon="user" text={!allowed ? "אין הרשאה למסך הזה." : error || "הלקוח לא נמצא."} />
      </View>
    );
  }

  const name = person.name || person.email || "לקוח";
  const orders = canOrders && snapshot?.orders ? sortedOrders(snapshot.orders).filter((order) => order.customerId === person.id) : undefined;
  const spent = orders?.reduce((sum, order) => sum + (order.total ?? 0), 0) ?? 0;
  const lastOrder = orders?.[0];
  const place = [person.city, "ישראל"].filter(Boolean).join(", ");
  const since = hebrewDate(person.createdAt);
  const addressLines = [name, person.street, [person.zip, person.city].filter(Boolean).join(" "), "ישראל"].filter((line) => line && line.trim());
  const hasAddress = Boolean(person.street || person.city || person.zip);
  const editable = canUpdate && person.credit != null && person.language != null;
  const channels = [person.subscribed ? "אימייל" : "", person.sms ? "SMS" : "", person.whatsapp ? "WhatsApp" : ""].filter(Boolean);
  const events = timeline(person, orders);

  function more(target: CustomerRecord) {
    const buttons: { text: string; style?: "cancel" | "destructive"; onPress?: () => void }[] = [];
    if (target.email) buttons.push({ text: "העתקת אימייל", onPress: () => void Clipboard.setStringAsync(target.email ?? "") });
    if (target.phone) buttons.push({ text: "העתקת טלפון", onPress: () => void Clipboard.setStringAsync(target.phone ?? "") });
    buttons.push({ text: "ביטול", style: "cancel" });
    Alert.alert(target.name || "לקוח", undefined, buttons);
  }

  function contactEmail() {
    const mail = person?.email;
    if (!mail) return;
    Alert.alert(mail, undefined, [
      { text: "שליחת מייל", onPress: () => void Linking.openURL(`mailto:${mail}`) },
      { text: "העתקה", onPress: () => void Clipboard.setStringAsync(mail) },
      { text: "ביטול", style: "cancel" },
    ]);
  }

  function contactPhone() {
    const phone = person?.phone;
    if (!phone) return;
    const digits = phone.replace(/[^\d+]/g, "");
    const wa = digits.startsWith("0") ? `972${digits.slice(1)}` : digits.replace(/^\+/, "");
    Alert.alert(phone, undefined, [
      { text: "חיוג", onPress: () => void Linking.openURL(`tel:${digits}`) },
      { text: "WhatsApp", onPress: () => void Linking.openURL(`https://wa.me/${wa}`) },
      { text: "העתקה", onPress: () => void Clipboard.setStringAsync(phone) },
      { text: "ביטול", style: "cancel" },
    ]);
  }

  async function copyAddress() {
    await Clipboard.setStringAsync(addressLines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function open(next: Panel) {
    if (!editable || !person) return;
    setDraft({
      note: person.note ?? "",
      tags: (person.tags ?? []).join(", "),
      subscribed: Boolean(person.subscribed),
      sms: Boolean(person.sms),
      whatsapp: Boolean(person.whatsapp),
      credit: person.credit ? String(person.credit) : "",
    });
    setProblem("");
    setPanel(next);
  }

  async function save() {
    if (!person || !storeId || busy) return;
    const credit = draft.credit.trim() ? Number(draft.credit.replace(",", ".")) : 0;
    if (!Number.isFinite(credit) || credit < 0) {
      setProblem("יש להזין סכום תקין");
      return;
    }
    setBusy(true);
    setProblem("");
    try {
      await updateStoreCustomer(storeId, person.id, {
        name: person.name ?? "",
        email: person.email ?? "",
        phone: person.phone ?? "",
        street: person.street ?? "",
        city: person.city ?? "",
        zip: person.zip ?? "",
        note: draft.note.trim(),
        tags: [...new Set(draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean))],
        subscribed: draft.subscribed,
        sms: draft.sms,
        whatsapp: draft.whatsapp,
        credit,
        locale: person.language === "en" ? "en" : "he",
      });
      await refresh();
      setPanel(null);
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "השמירה נכשלה.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.card }}>
      {header(name)}
      <ScrollView
        scrollEventThrottle={32}
        onScroll={(event) => {
          const next = event.nativeEvent.contentOffset.y > 48;
          if (next !== scrolled) setScrolled(next);
        }}
        contentContainerStyle={{ paddingBottom: TAB_SPACE + 20 }}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16, gap: 6 }}>
          <AppText style={{ fontFamily: fonts.bold, fontSize: 26, lineHeight: 34, color: tokens.inkStrong }}>{name}</AppText>
          <AppText style={{ fontSize: 14, color: tokens.inkSecondary }}>{[since ? `לקוח מאז ${since}` : "", place].filter(Boolean).join(" • ")}</AppText>
          {person.subscribed != null ? (
            <View style={{ marginTop: 2 }}>
              <Badge label={person.subscribed ? "מנוי לדיוור" : "ללא דיוור"} background={person.subscribed ? tokens.activeBg : tokens.warnBg} color={person.subscribed ? tokens.activeText : tokens.warnText} />
            </View>
          ) : null}
        </View>

        {orders ? (
          <>
            <Band />
            <Block title="תובנות">
              <StatRow label="סך הוצאות" value={formatIls(spent)} />
              <StatRow label="הזמנה אחרונה" value={lastOrder ? hebrewDate(lastOrder.createdAt) || "—" : "—"} />
              <StatRow label="סך הזמנות" value={formatCount(orders.length)} last />
            </Block>
          </>
        ) : null}

        <Band />
        <Block title="פרטי קשר">
          <View style={{ flexDirection: "row", gap: 8, paddingTop: 4 }}>
            <ContactButton icon="mail" label="אימייל" onPress={person.email ? contactEmail : undefined} />
            <ContactButton icon="phone" label="טלפון" onPress={person.phone ? contactPhone : undefined} />
          </View>
          {person.email || person.phone ? (
            <View style={{ paddingTop: 12, gap: 2 }}>
              {person.email ? <AppText style={{ fontSize: 15, color: tokens.ink, writingDirection: "ltr", textAlign: "right" }}>{person.email}</AppText> : null}
              {person.phone ? <AppText style={{ fontSize: 15, color: tokens.ink, writingDirection: "ltr", textAlign: "right" }}>{person.phone}</AppText> : null}
            </View>
          ) : null}
          {hasAddress ? (
            <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 14, paddingBottom: 8 }}>
              <View style={{ flex: 1, gap: 3 }}>
                <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>כתובת ברירת מחדל</AppText>
                {addressLines.map((line, index) => (
                  <AppText key={`${index}-${line}`} style={{ fontSize: 16, color: tokens.inkStrong }}>{line}</AppText>
                ))}
              </View>
              <Pressable accessibilityLabel="העתקת כתובת" hitSlop={10} onPress={() => void copyAddress()}>
                <Icon name={copied ? "check" : "copy"} size={19} color={tokens.inkSecondary} strokeWidth={1.8} />
              </Pressable>
            </View>
          ) : null}
        </Block>

        <Band />
        <Block title="הערה">
          {person.note ? (
            <Pressable disabled={!editable} onPress={() => open("note")} style={({ pressed }) => ({ paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}>
              <AppText style={{ fontSize: 16, lineHeight: 24, color: tokens.ink }}>{person.note}</AppText>
            </Pressable>
          ) : (
            <LinkRow icon="circlePlus" label="הוספת הערה" onPress={editable ? () => open("note") : undefined} last />
          )}
        </Block>

        <Band />
        <Block>
          <LinkRow icon="hash" label="תגיות" value={person.tags?.length ? person.tags.join(", ") : undefined} onPress={editable ? () => open("tags") : undefined} />
          <LinkRow icon="megaphone" label="מנויי שיווק" value={channels.length ? channels.join(", ") : "אין"} onPress={editable ? () => open("marketing") : undefined} last />
        </Block>

        {orders ? (
          <>
            <Band />
            <Block title="היסטוריית הזמנות" subtitle={orders.length === 1 ? "הזמנה אחת" : `${formatCount(orders.length)} הזמנות`} />
            {orders.length ? (
              <View>
                {orders.map((order) => <OrderRow key={order.number} order={order} onPress={() => router.push(`/orders/${order.number}`)} />)}
              </View>
            ) : (
              <AppText style={{ paddingHorizontal: 16, paddingBottom: 14, color: tokens.inkSecondary }}>עדיין אין הזמנות</AppText>
            )}
          </>
        ) : null}

        <Band />
        <Block title="קרדיט בחנות">
          {person.credit ? (
            <LinkRow icon="receipt" label="יתרה" value={formatIls(person.credit)} onPress={editable ? () => open("credit") : undefined} last />
          ) : (
            <LinkRow icon="circlePlus" label="הוספת קרדיט" onPress={editable ? () => open("credit") : undefined} last />
          )}
        </Block>

        <View style={{ backgroundColor: BAND, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, marginTop: 10 }}>
          <AppText style={{ fontFamily: fonts.bold, fontSize: 17, color: tokens.inkStrong }}>ציר זמן</AppText>
          <AppText style={{ fontSize: 13, color: tokens.inkSecondary, marginTop: 2 }}>פעילות הלקוח בחנות</AppText>
          <View style={{ marginTop: 14 }}>
            {events.map((event, index) => {
              const last = index === events.length - 1;
              return (
                <View key={event.key} style={{ flexDirection: "row", gap: 14 }}>
                  <View style={{ width: 12, alignItems: "center" }}>
                    <View style={{ width: 2, height: 10, backgroundColor: index === 0 ? "transparent" : "#d4d4d4" }} />
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: tokens.ink }} />
                    <View style={{ width: 2, flex: 1, backgroundColor: last ? "transparent" : "#d4d4d4" }} />
                  </View>
                  <Pressable
                    disabled={event.order == null}
                    onPress={() => event.order != null && router.push(`/orders/${event.order}`)}
                    style={({ pressed }) => ({ flex: 1, paddingTop: 4, paddingBottom: last ? 0 : 18, opacity: pressed ? 0.6 : 1 })}
                  >
                    {event.at ? <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>{[hebrewDate(event.at), hebrewTime(event.at)].filter(Boolean).join(" · ")}</AppText> : null}
                    <AppText style={{ fontSize: 15, lineHeight: 22, color: event.order != null ? tokens.link : tokens.inkStrong, marginTop: 2 }}>{event.text}</AppText>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <Modal visible={panel != null} transparent animationType="slide" onRequestClose={() => setPanel(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable onPress={() => setPanel(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }} />
          <View style={{ backgroundColor: tokens.card, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 16, paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 16) + 8, gap: 14, direction: "rtl" }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <AppText style={{ flex: 1, fontFamily: fonts.bold, fontSize: 18, color: tokens.inkStrong }}>
                {panel === "note" ? "הערה" : panel === "tags" ? "תגיות" : panel === "marketing" ? "מנויי שיווק" : "קרדיט בחנות"}
              </AppText>
              <CircleButton icon="close" label="סגירה" onPress={() => setPanel(null)} />
            </View>
            {problem ? <ErrorNote text={problem} /> : null}
            {panel === "note" ? (
              <SheetInput value={draft.note} onChange={(note) => setDraft({ ...draft, note })} placeholder="הערה על הלקוח" multiline />
            ) : null}
            {panel === "tags" ? (
              <>
                <SheetInput value={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} placeholder="לדוגמה: VIP, סיטונאי" />
                <AppText style={{ fontSize: 13, color: tokens.inkSecondary, marginTop: -6 }}>אפשר להפריד כמה תגיות בפסיק</AppText>
              </>
            ) : null}
            {panel === "marketing" ? (
              <View>
                <SheetToggle label="דיוור באימייל" value={draft.subscribed} onChange={(subscribed) => setDraft({ ...draft, subscribed })} />
                <SheetToggle label="הודעות SMS" value={draft.sms} onChange={(sms) => setDraft({ ...draft, sms })} />
                <SheetToggle label="הודעות WhatsApp" value={draft.whatsapp} onChange={(whatsapp) => setDraft({ ...draft, whatsapp })} />
              </View>
            ) : null}
            {panel === "credit" ? (
              <SheetInput value={draft.credit} onChange={(credit) => setDraft({ ...draft, credit })} placeholder="סכום בשקלים" keyboard="decimal-pad" />
            ) : null}
            <PrimaryButton label={busy ? "שומר..." : "שמירה"} disabled={busy} onPress={() => void save()} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function SheetInput({ value, onChange, placeholder, multiline = false, keyboard }: { value: string; onChange: (value: string) => void; placeholder: string; multiline?: boolean; keyboard?: "decimal-pad" }) {
  const fonts = useFontSet();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#8a8a8a"
      autoFocus
      multiline={multiline}
      keyboardType={keyboard}
      selectionColor={tokens.focus}
      style={{
        minHeight: multiline ? 110 : 52,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#c9c9c9",
        paddingHorizontal: 14,
        paddingTop: multiline ? 14 : 0,
        fontFamily: fonts.regular,
        fontSize: 16,
        color: tokens.inkStrong,
        textAlign: "right",
        textAlignVertical: multiline ? "top" : "center",
        writingDirection: keyboard ? "ltr" : "rtl",
      }}
    />
  );
}

function SheetToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={{ minHeight: 52, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: tokens.line }}>
      <AppText style={{ flex: 1, fontSize: 16, color: tokens.inkStrong }}>{label}</AppText>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: "#d4d4d4", true: tokens.inkStrong }} thumbColor="#ffffff" ios_backgroundColor="#d4d4d4" />
    </View>
  );
}
