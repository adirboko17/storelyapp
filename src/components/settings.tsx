import { useCallback, useState, type ReactNode } from "react";
import { Alert, Image, Pressable, ScrollView, Switch, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Icon } from "@/components/icon";
import { Chips } from "@/components/shell";
import { AppText, EmptyState, ErrorNote, LoadingBlock, PrimaryButton, refreshControl } from "@/components/ui";
import { hebrewWhen } from "@/lib/format";
import { ACCESS_AREA_LABEL } from "@/lib/menu";
import { addUser, loadConnections, loadUsers, saveUser, useStoreCall, type UserRow } from "@/lib/remote";
import { useSession } from "@/lib/session";
import {
  CURRENCIES,
  addressSummary,
  emptyContact,
  loadStoreSettings,
  plainToPolicy,
  policyPlacement,
  policyPlain,
  policyTemplate,
  profileSummary,
  saveBrandColors,
  saveMenuName,
  savePolicies,
  saveShipping,
  saveStoreCurrency,
  saveStoreLogo,
  saveStoreName,
  storePolicies,
  uploadStoreLogo,
  type EditablePolicy,
  type PolicySurface,
} from "@/lib/settings";
import type { ShipProfileRecord, ShipZoneRecord, ShippingRecord, StoreContact } from "@/lib/snapshot";
import { useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { cardShadow, tokens } from "@/theme/tokens";

const AREAS = Object.entries(ACCESS_AREA_LABEL);

function problemText(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}

function SettingsPage({
  children,
  refreshing,
  onRefresh,
  footer,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const clearance = Math.max(insets.bottom, 12) + 86;
  return (
    <View style={{ flex: 1, backgroundColor: "#f6f6f6" }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: footer ? 20 : clearance, gap: 18 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? refreshControl(Boolean(refreshing), onRefresh) : undefined}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: clearance, backgroundColor: "#f6f6f6", borderTopWidth: 1, borderTopColor: tokens.line }}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}

function Block({ title, detail, children }: { title: string; detail?: string; children: ReactNode }) {
  const fonts = useFontSet();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ gap: 2, paddingHorizontal: 4 }}>
        <AppText style={{ fontFamily: fonts.semibold, fontSize: 13, color: tokens.inkStrong }}>{title}</AppText>
        {detail ? <AppText style={{ color: tokens.inkSecondary, fontSize: 13, lineHeight: 18 }}>{detail}</AppText> : null}
      </View>
      <View style={[cardShadow, { overflow: "hidden" }]}>{children}</View>
    </View>
  );
}

function Pill({ label, tone }: { label: string; tone: "green" | "amber" | "plain" }) {
  const fonts = useFontSet();
  const background = tone === "green" ? tokens.activeBg : tone === "amber" ? "#ffd6a4" : tokens.neutralBg;
  const color = tone === "green" ? tokens.activeText : tone === "amber" ? "#5e4200" : tokens.ink;
  return (
    <View style={{ alignSelf: "flex-start", height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: background, justifyContent: "center" }}>
      <AppText style={{ fontFamily: fonts.semibold, fontSize: 12, color }}>{label}</AppText>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
  secure = false,
  email = false,
  multiline = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  secure?: boolean;
  email?: boolean;
  multiline?: boolean;
  disabled?: boolean;
}) {
  const fonts = useFontSet();
  return (
    <View style={{ gap: 6 }}>
      <AppText style={{ fontFamily: fonts.semibold, fontSize: 13 }}>{label}</AppText>
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        secureTextEntry={secure}
        autoCapitalize={email || secure ? "none" : "sentences"}
        keyboardType={email ? "email-address" : "default"}
        multiline={multiline}
        textAlign={email ? "left" : "right"}
        placeholderTextColor={tokens.inkDisabled}
        style={{
          minHeight: multiline ? 150 : 44,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: "#c9c9c9",
          backgroundColor: disabled ? "#f6f6f6" : "#fff",
          paddingHorizontal: 12,
          paddingVertical: multiline ? 10 : 0,
          fontFamily: fonts.regular,
          fontSize: 15,
          color: tokens.ink,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
      {hint ? <AppText style={{ color: tokens.inkSecondary, fontSize: 12, lineHeight: 17 }}>{hint}</AppText> : null}
    </View>
  );
}

function EditRow({ title, meta, onPress, last = false }: { title: string; meta?: string; onPress: () => void; last?: boolean }) {
  const fonts = useFontSet();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderBottomColor: tokens.line }}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={{ fontFamily: fonts.semibold, fontSize: 15, color: tokens.inkStrong }} numberOfLines={1}>{title}</AppText>
        {meta ? <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }} numberOfLines={2}>{meta}</AppText> : null}
      </View>
      <Icon name="chevron" size={16} color={tokens.inkSecondary} />
    </Pressable>
  );
}

export function GeneralSettings() {
  const fonts = useFontSet();
  const { storeId, menuName, email, refreshMemberships, setMenuName } = useSession();
  const { snapshot, loading, refreshing, refresh } = useStoreData();
  const settingsRow = useStoreCall(loadStoreSettings);
  const row = settingsRow.data;
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState("");
  const [panel, setPanel] = useState<"name" | "business" | "contact" | "address" | "color" | null>(null);
  const [draftName, setDraftName] = useState("");
  const [business, setBusiness] = useState("");
  const [contact, setContact] = useState<Required<StoreContact>>(emptyContact());
  const [colorIndex, setColorIndex] = useState(0);
  const [hex, setHex] = useState("");

  const storeName = row?.name || snapshot?.name || "";
  const savedContact = emptyContact(snapshot?.shipping?.contact);

  async function run(key: string, action: () => Promise<void>) {
    if (!storeId || busy) return;
    setBusy(key);
    setProblem("");
    try {
      await action();
    } catch (caught) {
      setProblem(problemText(caught, "השמירה נכשלה."));
    } finally {
      setBusy("");
    }
  }

  async function pickLogo() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setProblem("אין גישה לתמונות. אפשר לאשר גישה בהגדרות הטלפון.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    const asset = result.canceled ? undefined : result.assets[0];
    if (!asset || !storeId) return;
    await run("logo", async () => {
      await uploadStoreLogo(storeId, asset.uri, asset.mimeType);
      await settingsRow.refresh();
      await refreshMemberships(true);
    });
  }

  return (
    <SettingsPage
      refreshing={refreshing}
      onRefresh={() => {
        void refresh();
        void settingsRow.refresh();
      }}
    >
      {loading && !snapshot ? <LoadingBlock /> : null}
      {problem || settingsRow.error ? <ErrorNote text={problem || settingsRow.error} /> : null}

      <Block title="השם שלי" detail="מוצג רק לך, ומשנה את השם בתפריט.">
        {panel === "name" ? (
          <View style={{ padding: 14, gap: 12 }}>
            <Field label="השם שמופיע בתפריט" value={draftName} onChange={setDraftName} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><PrimaryButton label={busy === "name" ? "שומר…" : "שמירה"} disabled={Boolean(busy)} onPress={() => void run("name", async () => {
                const saved = await saveMenuName(draftName);
                setMenuName(saved);
                setPanel(null);
              })} /></View>
              <Pressable onPress={() => setPanel(null)} style={{ height: 44, paddingHorizontal: 16, borderRadius: 8, backgroundColor: tokens.field, justifyContent: "center" }}>
                <AppText style={{ fontFamily: fonts.semibold }}>ביטול</AppText>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: tokens.field, alignItems: "center", justifyContent: "center" }}>
              <Icon name="user" size={18} color={tokens.inkSecondary} />
            </View>
            <AppText style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15 }} numberOfLines={1}>{menuName || email || "לא הוגדר שם"}</AppText>
            <Pressable onPress={() => { setDraftName(menuName); setPanel("name"); }} style={softButton}>
              <AppText style={{ fontFamily: fonts.semibold, fontSize: 13 }}>עריכה</AppText>
            </Pressable>
          </View>
        )}
      </Block>

      <Block title="לוגו" detail="הלוגו שמופיע בתפריט ובמיילים.">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 14 }}>
          <View style={{ width: 96, height: 64, borderRadius: 12, backgroundColor: "#f6f6f6", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {row?.logo ? <Image source={{ uri: row.logo }} style={{ width: 84, height: 52 }} resizeMode="contain" accessibilityIgnoresInvertColors /> : <AppText style={{ color: tokens.inkSecondary, fontSize: 12 }}>אין לוגו</AppText>}
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <PrimaryButton label={busy === "logo" ? "מעלים…" : row?.logo ? "החלפת לוגו" : "העלאת לוגו"} disabled={Boolean(busy)} onPress={() => void pickLogo()} />
            {row?.logo ? (
              <Pressable disabled={Boolean(busy)} onPress={() => void run("logo", async () => {
                if (!storeId) return;
                await saveStoreLogo(storeId, "");
                await settingsRow.refresh();
                await refreshMemberships(true);
              })} style={{ height: 36, borderRadius: 8, backgroundColor: tokens.field, alignItems: "center", justifyContent: "center" }}>
                <AppText style={{ fontFamily: fonts.semibold, fontSize: 13 }}>הסרה</AppText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Block>

      <Block title="צבעי מותג" detail="שבעה צבעים שנשמרים לחנות ומופיעים בבחירת הצבע במיילים.">
        <View style={{ padding: 14, gap: 12 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {(row?.colors ?? []).map((color, index) => (
              <Pressable key={`${color}-${index}`} onPress={() => { setColorIndex(index); setHex(color); setPanel("color"); }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color, borderWidth: colorIndex === index && panel === "color" ? 2 : 1, borderColor: colorIndex === index && panel === "color" ? tokens.inkStrong : "rgba(0,0,0,0.16)" }} />
            ))}
          </View>
          {panel === "color" && row ? (
            <View style={{ gap: 8 }}>
              <Field label={`צבע ${colorIndex + 1}`} value={hex} onChange={setHex} email hint="הקלידו צבע כמו #1a1a1a" />
              <PrimaryButton label={busy === "color" ? "שומר…" : "שמירת הצבע"} disabled={Boolean(busy)} onPress={() => void run("color", async () => {
                if (!storeId || !/^#[0-9a-fA-F]{6}$/.test(hex.trim())) throw new Error("הזינו צבע בפורמט #000000");
                const colors = row.colors.slice();
                colors[colorIndex] = hex.trim().toLowerCase();
                await saveBrandColors(storeId, colors);
                await settingsRow.refresh();
                setPanel(null);
              })} />
            </View>
          ) : null}
        </View>
      </Block>

      <Block title="פרטי העסק" detail="השם שמופיע בחנות ובמיילים.">
        {panel === "business" ? (
          <View style={{ padding: 14, gap: 12 }}>
            <Field label="שם העסק" value={business} onChange={setBusiness} />
            <PrimaryButton label={busy === "business" ? "שומר…" : "שמירה"} disabled={Boolean(busy)} onPress={() => void run("business", async () => {
              if (!storeId) return;
              await saveStoreName(storeId, business);
              await refresh();
              await refreshMemberships(true);
              await settingsRow.refresh();
              setPanel(null);
            })} />
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText style={{ fontFamily: fonts.semibold, fontSize: 15 }}>{storeName || "חנות ללא שם"}</AppText>
              <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }}>ישראל</AppText>
            </View>
            <Pressable onPress={() => { setBusiness(storeName); setPanel("business"); }} style={softButton}>
              <AppText style={{ fontFamily: fonts.semibold, fontSize: 13 }}>עריכה</AppText>
            </Pressable>
          </View>
        )}
      </Block>

      <Block title="פרטי קשר של החנות">
        {panel === "contact" ? (
          <View style={{ padding: 14, gap: 12 }}>
            <Field label="שם החנות" value={business} onChange={setBusiness} hint="מופיע בחנות האונליין" />
            <Field label="אימייל החנות" value={contact.email} onChange={(value) => setContact((current) => ({ ...current, email: value }))} email hint="מקבל הודעות על החנות" />
            <Field label="טלפון החנות" value={contact.phone} onChange={(value) => setContact((current) => ({ ...current, phone: value }))} email />
            <AppText style={{ color: tokens.inkSecondary, fontSize: 12 }}>פרטי הקשר גלויים ללקוחות.</AppText>
            <PrimaryButton label={busy === "contact" ? "שומר…" : "שמירה"} disabled={Boolean(busy)} onPress={() => void run("contact", async () => {
              if (!storeId || !snapshot) return;
              if (business.trim().length < 2) throw new Error("הזינו שם לחנות");
              if (business.trim() !== storeName) await saveStoreName(storeId, business);
              await saveShipping(storeId, { ...(snapshot.shipping ?? {}), contact: { ...savedContact, email: contact.email.trim(), phone: contact.phone.trim() } });
              await refresh();
              await refreshMemberships(true);
              await settingsRow.refresh();
              setPanel(null);
            })} />
          </View>
        ) : (
          <EditRow title={storeName || "שם החנות"} meta={`${savedContact.email || "אין אימייל"} · ${savedContact.phone || "אין מספר טלפון"}`} onPress={() => { setBusiness(storeName); setContact(savedContact); setPanel("contact"); }} />
        )}
        {panel === "address" ? (
          <View style={{ padding: 14, gap: 12, borderTopWidth: 1, borderTopColor: tokens.line }}>
            <Choice title="חנות אונליין בלבד" detail="ללא כתובת פיזית" selected={contact.addressMode !== "physical"} onPress={() => setContact((current) => ({ ...current, addressMode: "none" }))} />
            <Choice title="כתובת פיזית" detail="רחוב, עיר ומיקוד" selected={contact.addressMode === "physical"} onPress={() => setContact((current) => ({ ...current, addressMode: "physical" }))} />
            {contact.addressMode === "physical" ? (
              <>
                <Field label="שם החברה" value={contact.company} onChange={(value) => setContact((current) => ({ ...current, company: value }))} />
                <Field label="כתובת" value={contact.street} onChange={(value) => setContact((current) => ({ ...current, street: value }))} />
                <Field label="דירה, כניסה וכו׳" value={contact.apartment} onChange={(value) => setContact((current) => ({ ...current, apartment: value }))} />
                <Field label="מיקוד" value={contact.zip} onChange={(value) => setContact((current) => ({ ...current, zip: value }))} email />
                <Field label="עיר" value={contact.city} onChange={(value) => setContact((current) => ({ ...current, city: value }))} />
              </>
            ) : null}
            <PrimaryButton label={busy === "address" ? "שומר…" : "שמירה"} disabled={Boolean(busy)} onPress={() => void run("address", async () => {
              if (!storeId || !snapshot) return;
              const physical = contact.addressMode === "physical";
              await saveShipping(storeId, {
                ...(snapshot.shipping ?? {}),
                contact: {
                  ...savedContact,
                  addressMode: physical ? "physical" : "none",
                  company: contact.company.trim(),
                  country: "ישראל",
                  street: physical ? contact.street.trim() : "",
                  apartment: physical ? contact.apartment.trim() : "",
                  zip: physical ? contact.zip.trim() : "",
                  city: physical ? contact.city.trim() : "",
                },
              });
              await refresh();
              setPanel(null);
            })} />
          </View>
        ) : (
          <EditRow title="כתובת החנות" meta={addressSummary(savedContact)} last onPress={() => { setContact(savedContact); setPanel("address"); }} />
        )}
      </Block>

      <Block title="מטבע" detail="המטבע שמוצג ללקוחות בחנות ובסל.">
        <View style={{ padding: 8, gap: 4 }}>
          {CURRENCIES.map((item) => {
            const on = (row?.currency ?? "ILS") === item.code;
            return (
              <Pressable key={item.code} disabled={Boolean(busy)} onPress={() => void run("currency", async () => {
                if (!storeId || !row || row.currency === item.code) return;
                await saveStoreCurrency(storeId, item.code);
                await settingsRow.refresh();
              })} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 10, backgroundColor: on ? tokens.field : "transparent" }}>
                <AppText style={{ flex: 1, fontFamily: on ? fonts.semibold : fonts.regular }}>{item.label}</AppText>
                {on ? <Icon name="check" size={16} color={tokens.inkStrong} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Block>
    </SettingsPage>
  );
}

function Choice({ title, detail, selected, onPress }: { title: string; detail: string; selected: boolean; onPress: () => void }) {
  const fonts = useFontSet();
  return (
    <Pressable onPress={onPress} style={{ flex: 1, minHeight: 84, borderWidth: selected ? 1.5 : 1, borderColor: selected ? tokens.inkStrong : "#e3e3e3", borderRadius: 14, padding: 12, gap: 6, backgroundColor: selected ? "#f7f7f7" : "#fff" }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <AppText style={{ fontFamily: fonts.semibold, fontSize: 15, color: tokens.inkStrong }}>{title}</AppText>
        <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: selected ? 0 : 1, borderColor: "#c9c9c9", backgroundColor: selected ? tokens.inkStrong : "#fff", alignItems: "center", justifyContent: "center" }}>
          {selected ? <Icon name="check" size={12} color="#fff" strokeWidth={2.4} /> : null}
        </View>
      </View>
      <AppText style={{ color: tokens.inkSecondary, fontSize: 12, lineHeight: 17 }}>{detail}</AppText>
    </Pressable>
  );
}

const softButton = { height: 32, paddingHorizontal: 12, borderRadius: 8, backgroundColor: tokens.field, justifyContent: "center" } as const;

export function ShippingSettings() {
  const fonts = useFontSet();
  const router = useRouter();
  const { storeId } = useSession();
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const shipping = snapshot?.shipping;
  const profiles = shipping?.profiles ?? [];
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState("");

  async function write(next: ShippingRecord, key: string) {
    if (!storeId || busy) return false;
    setBusy(key);
    setProblem("");
    try {
      await saveShipping(storeId, next);
      await refresh();
      return true;
    } catch (caught) {
      setProblem(problemText(caught, "שמירת המשלוח נכשלה."));
      return false;
    } finally {
      setBusy("");
    }
  }

  if (loading && !snapshot) return <LoadingBlock />;
  return (
    <SettingsPage refreshing={refreshing} onRefresh={() => void refresh()}>
      <AppText style={{ color: tokens.inkSecondary, fontSize: 14, lineHeight: 20, paddingHorizontal: 4 }}>כל משלוח הוא אפשרות שהלקוח רואה בקופה, למשל משלוח עד הבית.</AppText>
      {error ? <ErrorNote text={error} /> : null}
      {problem ? <ErrorNote text={problem} /> : null}
      <Block title="המשלוחים שלכם">
        {profiles.length ? profiles.map((profile, index) => (
          <EditRow key={profile.id} title={profile.name || "משלוח"} meta={profileSummary(profile)} last={index === profiles.length - 1 && !adding} onPress={() => router.push(`/more/area/shipping/${encodeURIComponent(profile.id)}` as Href)} />
        )) : <AppText style={{ color: tokens.inkSecondary, padding: 14 }}>אין משלוחים. הוסיפו משלוח כדי שהלקוח יוכל לבחור אותו בקופה.</AppText>}
        {adding ? (
          <View style={{ padding: 14, gap: 12, borderTopWidth: profiles.length ? 1 : 0, borderTopColor: tokens.line }}>
            <Field label="שם שיופיע ברשימה" value={name} onChange={setName} hint="לדוגמה: משלוח עד הבית" />
            <PrimaryButton label={busy === "add" ? "שומר…" : "המשך"} disabled={Boolean(busy)} onPress={() => {
              const id = `profile-${Date.now()}`;
              void write({
                ...(shipping ?? {}),
                profiles: [...profiles, { id, name: name.trim() || "משלוח חדש", location: null, zones: [] }],
              }, "add").then((saved) => {
                if (!saved) return;
                setAdding(false);
                setName("");
                router.push(`/more/area/shipping/${encodeURIComponent(id)}` as Href);
              });
            }} />
          </View>
        ) : null}
      </Block>
      {!adding ? (
        <Pressable onPress={() => setAdding(true)} style={[cardShadow, { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }]}>
          <Icon name="plus" size={16} color={tokens.inkStrong} />
          <AppText style={{ fontFamily: fonts.semibold }}>הוספת משלוח</AppText>
        </Pressable>
      ) : null}
      <Block title="דרכי מסירה נוספות" detail="אפשר להפעיל אותן בנוסף למשלוח הרגיל.">
        <FlagRow title="משלוח מקומי" on={shipping?.localDelivery === true} disabled={Boolean(busy)} onToggle={(value) => void write({ ...(shipping ?? {}), localDelivery: value }, "local")} />
        <FlagRow title="איסוף מהחנות" on={shipping?.pickup === true} disabled={Boolean(busy)} last onToggle={(value) => void write({ ...(shipping ?? {}), pickup: value }, "pickup")} />
      </Block>
    </SettingsPage>
  );
}

function FlagRow({ title, on, disabled, last = false, onToggle }: { title: string; on: boolean; disabled?: boolean; last?: boolean; onToggle: (value: boolean) => void }) {
  const fonts = useFontSet();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: tokens.line }}>
      <AppText style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15 }}>{title}</AppText>
      <Pill label={on ? "פעיל" : "כבוי"} tone={on ? "green" : "plain"} />
      <Switch value={on} disabled={disabled} onValueChange={onToggle} trackColor={{ false: "#d9d9d9", true: "#1f7a4d" }} thumbColor="#ffffff" ios_backgroundColor="#d9d9d9" />
    </View>
  );
}

export function ShippingEditor({ id }: { id: string }) {
  const fonts = useFontSet();
  const router = useRouter();
  const { storeId } = useSession();
  const { snapshot, loading, refresh } = useStoreData();
  const current = snapshot?.shipping?.profiles?.find((item) => item.id === id);
  const [draft, setDraft] = useState<ShipProfileRecord | null>(null);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const profile = draft ?? (current ? { ...current, location: current.location ?? null, zones: current.zones ?? [] } : null);

  if (loading && !snapshot) return <LoadingBlock />;
  if (!loading && snapshot && !profile) return <EmptyState text="המשלוח לא נמצא." />;
  if (!profile) return <LoadingBlock />;

  function updateZone(zoneId: string, patch: Partial<ShipZoneRecord>) {
    setDraft((item) => {
      const base = item ?? (current ? { ...current, location: current.location ?? null, zones: current.zones ?? [] } : null);
      if (!base) return item;
      return { ...base, zones: (base.zones ?? []).map((zone) => zone.id === zoneId ? { ...zone, ...patch } : zone) };
    });
  }

  async function save(nextProfiles: ShipProfileRecord[]) {
    if (!storeId || !snapshot || busy) return;
    setBusy(true);
    setProblem("");
    try {
      await saveShipping(storeId, { ...(snapshot.shipping ?? {}), profiles: nextProfiles });
      await refresh();
      router.back();
    } catch (caught) {
      setProblem(problemText(caught, "שמירת המשלוח נכשלה."));
      setBusy(false);
    }
  }

  return (
    <SettingsPage>
      {problem ? <ErrorNote text={problem} /> : null}
      <Block title="שם המשלוח">
        <View style={{ padding: 14 }}>
          <Field label="השם שהלקוח רואה" value={profile.name ?? ""} onChange={(value) => setDraft({ ...profile, name: value })} />
        </View>
      </Block>
      <Block title="מיקום אספקה" detail="הכתובת שממנה יוצאות ההזמנות.">
        <View style={{ padding: 14, gap: 12 }}>
          <Field label="שם המיקום" value={profile.location?.name ?? ""} onChange={(value) => setDraft({ ...profile, location: { name: value, address: profile.location?.address ?? "" } })} />
          <Field label="כתובת" value={profile.location?.address ?? ""} onChange={(value) => setDraft({ ...profile, location: { name: profile.location?.name ?? "", address: value } })} />
        </View>
      </Block>
      <Block title="אזורי משלוח">
        {(profile.zones ?? []).length ? (profile.zones ?? []).map((zone) => (
          <View key={zone.id} style={{ padding: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: tokens.line }}>
            <Field label="שם האזור" value={zone.name} onChange={(value) => updateZone(zone.id, { name: value })} />
            <Field label="מדינה" value={zone.country} onChange={(value) => updateZone(zone.id, { country: value })} />
            {zone.rates.map((rate) => (
              <View key={rate.id} style={{ gap: 10 }}>
                <Field label="שם האפשרות" value={rate.name} onChange={(value) => updateZone(zone.id, { rates: zone.rates.map((item) => item.id === rate.id ? { ...item, name: value } : item) })} />
                <Field label="מחיר" value={rate.price} onChange={(value) => updateZone(zone.id, { rates: zone.rates.map((item) => item.id === rate.id ? { ...item, price: value } : item) })} email hint="השאירו ריק למשלוח חינם" />
              </View>
            ))}
            <Pressable onPress={() => updateZone(zone.id, { rates: [...zone.rates, { id: `rate-${Date.now()}`, name: profile.name?.trim() || "משלוח", price: "" }] })}>
              <AppText style={{ fontFamily: fonts.semibold, color: tokens.link }}>הוספת אפשרות</AppText>
            </Pressable>
            <Pressable onPress={() => setDraft({ ...profile, zones: (profile.zones ?? []).filter((item) => item.id !== zone.id) })}>
              <AppText style={{ fontFamily: fonts.semibold, color: tokens.negative }}>הסרת האזור</AppText>
            </Pressable>
          </View>
        )) : <AppText style={{ color: tokens.inkSecondary, padding: 14 }}>אין אזורי משלוח. הוסיפו אזור כדי להגדיר תעריף.</AppText>}
        <Pressable onPress={() => setDraft({ ...profile, zones: [...(profile.zones ?? []), { id: `zone-${Date.now()}`, name: "ישראל", country: "ישראל", rates: [{ id: `rate-${Date.now()}`, name: profile.name?.trim() || "משלוח", price: "" }] }] })} style={{ padding: 14 }}>
          <AppText style={{ fontFamily: fonts.semibold }}>הוספת אזור</AppText>
        </Pressable>
      </Block>
      <PrimaryButton label={busy ? "שומר…" : "שמירה"} disabled={busy} onPress={() => void save((snapshot?.shipping?.profiles ?? []).map((item) => item.id === profile.id ? profile : item))} />
      <Pressable onPress={() => Alert.alert("הסרת משלוח", profile.name || "המשלוח", [
        { text: "ביטול", style: "cancel" },
        { text: "הסרה", style: "destructive", onPress: () => void save((snapshot?.shipping?.profiles ?? []).filter((item) => item.id !== profile.id)) },
      ])} style={{ alignItems: "center", paddingVertical: 8 }}>
        <AppText style={{ fontFamily: fonts.semibold, color: tokens.negative }}>הסרת המשלוח</AppText>
      </Pressable>
    </SettingsPage>
  );
}

export function PoliciesSettings() {
  const fonts = useFontSet();
  const router = useRouter();
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const policies = storePolicies(snapshot?.policies);
  if (loading && !snapshot) return <LoadingBlock />;
  return (
    <SettingsPage refreshing={refreshing} onRefresh={() => void refresh()}>
      {error ? <ErrorNote text={error} /> : null}
      <Block title="פוליסות ותקנונים" detail="לכל מסמך בוחרים איפה הוא מופיע: פוטר, עגלת קניות או דף תשלום.">
        {policies.map((policy, index) => {
          const written = policyPlain(policy.body).length > 0;
          return (
            <Pressable key={policy.id} onPress={() => router.push(`/more/area/policies/${encodeURIComponent(policy.id)}` as Href)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: index === policies.length - 1 ? 0 : 1, borderBottomColor: tokens.line }}>
              <Icon name="receipt" size={18} color={tokens.inkSecondary} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText style={{ fontFamily: fonts.semibold, fontSize: 15 }} numberOfLines={1}>{policy.title}</AppText>
                <AppText style={{ color: tokens.inkSecondary, fontSize: 12 }} numberOfLines={1}>{policyPlacement(policy)}</AppText>
              </View>
              {written ? <Pill label="פורסמה" tone="green" /> : policy.required ? <Pill label="נדרש" tone="amber" /> : <AppText style={{ color: tokens.inkSecondary, fontSize: 12 }}>לא הוגדרה</AppText>}
              <Icon name="chevron" size={16} color={tokens.inkSecondary} />
            </Pressable>
          );
        })}
      </Block>
      <Pressable onPress={() => router.push("/more/area/policies/new" as Href)} style={[cardShadow, { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }]}>
        <Icon name="plus" size={16} />
        <AppText style={{ fontFamily: fonts.semibold }}>הוספת פוליסיה או תקנון</AppText>
      </Pressable>
      <AppText style={{ color: tokens.inkSecondary, fontSize: 12, lineHeight: 18, paddingHorizontal: 4 }}>המלצות אינן ייעוץ משפטי. האחריות לדיוק הפוליסות היא של החנות.</AppText>
    </SettingsPage>
  );
}

export function PolicyEditor({ id }: { id: string }) {
  const fonts = useFontSet();
  const router = useRouter();
  const { storeId } = useSession();
  const { snapshot, loading, refresh } = useStoreData();
  const [created] = useState<EditablePolicy | null>(() => id === "new" ? {
    id: `policy-${Date.now()}`,
    kind: "custom",
    title: "",
    body: "",
    footer: true,
    cart: "hidden",
    checkout: "hidden",
    required: false,
  } : null);
  const [draft, setDraft] = useState<EditablePolicy | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const found = id === "new" ? undefined : storePolicies(snapshot?.policies).find((item) => item.id === id);
  const policy = draft ?? created ?? found ?? null;

  if (id !== "new" && loading && !snapshot) return <LoadingBlock />;
  if (id !== "new" && snapshot && !policy) return <EmptyState text="הפוליסה לא נמצאה." />;
  if (!policy) return <LoadingBlock />;
  const document = policy;

  async function write(next: EditablePolicy[], leaving = true) {
    if (!storeId || busy) return;
    setBusy(true);
    setProblem("");
    try {
      await savePolicies(storeId, next);
      await refresh();
      if (leaving) router.back();
    } catch (caught) {
      setProblem(problemText(caught, "שמירת הפוליסה נכשלה."));
      setBusy(false);
    }
  }

  function body() {
    if (text == null) return document.body;
    return policyPlain(document.body) === text.trim() ? document.body : plainToPolicy(text);
  }

  return (
    <SettingsPage>
      {problem ? <ErrorNote text={problem} /> : null}
      <Block title="המסמך">
        <View style={{ padding: 14, gap: 12 }}>
          <Field label="שם" value={policy.title} onChange={(value) => setDraft({ ...policy, title: value })} />
          <Field label="תוכן" value={text ?? policyPlain(policy.body)} onChange={setText} multiline />
          <Pressable onPress={() => {
            const next = policyTemplate(policy.kind, snapshot?.name ?? "", emptyContact(snapshot?.shipping?.contact).email);
            setDraft({ ...policy, body: next });
            setText(policyPlain(next));
          }}>
            <AppText style={{ fontFamily: fonts.semibold, color: tokens.link }}>הכנסת תבנית</AppText>
          </Pressable>
          <AppText style={{ color: tokens.inkSecondary, fontSize: 12, lineHeight: 17 }}>תבנית אינה ייעוץ משפטי. היא נפתחת עם שם החנות, ואפשר לערוך אותה.</AppText>
        </View>
      </Block>
      <Block title="איפה להציג" detail="האתר מציג את המסמך במקומות שסימנתם.">
        <FlagRow title="פוטר" on={policy.footer} onToggle={(value) => setDraft({ ...policy, footer: value })} />
        <SurfaceRow label="עגלת קניות" mode={policy.cart} onChange={(cart) => setDraft({ ...policy, cart })} />
        <SurfaceRow label="דף תשלום" mode={policy.checkout} last onChange={(checkout) => setDraft({ ...policy, checkout })} />
      </Block>
      <PrimaryButton label={busy ? "שומר…" : "שמירה"} disabled={busy} onPress={() => {
        const saved = { ...policy, title: policy.title.trim() || "תקנון", body: body() };
        const list = storePolicies(snapshot?.policies);
        const next = list.some((item) => item.id === saved.id) ? list.map((item) => item.id === saved.id ? saved : item) : [...list, saved];
        void write(next);
      }} />
      {policy.kind === "custom" && id !== "new" ? (
        <Pressable onPress={() => void write(storePolicies(snapshot?.policies).filter((item) => item.id !== policy.id))} style={{ alignItems: "center", paddingVertical: 8 }}>
          <AppText style={{ fontFamily: fonts.semibold, color: tokens.negative }}>מחיקה</AppText>
        </Pressable>
      ) : null}
    </SettingsPage>
  );
}

function SurfaceRow({ label, mode, last = false, onChange }: { label: string; mode: PolicySurface; last?: boolean; onChange: (mode: PolicySurface) => void }) {
  const fonts = useFontSet();
  const options: { id: PolicySurface; label: string }[] = [
    { id: "hidden", label: "מוסתר" },
    { id: "link", label: "קישור" },
    { id: "checkbox", label: "קראתי" },
  ];
  return (
    <View style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 8, borderBottomWidth: last ? 0 : 1, borderBottomColor: tokens.line }}>
      <AppText style={{ fontFamily: fonts.semibold }}>{label}</AppText>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {options.map((option) => {
          const on = mode === option.id;
          return (
            <Pressable key={option.id} onPress={() => onChange(option.id)} style={{ height: 32, paddingHorizontal: 12, borderRadius: 8, backgroundColor: on ? tokens.inkStrong : tokens.field, justifyContent: "center" }}>
              <AppText style={{ fontFamily: fonts.semibold, fontSize: 13, color: on ? "#fff" : tokens.ink }}>{option.label}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function UsersSettings() {
  const fonts = useFontSet();
  const router = useRouter();
  const remote = useStoreCall(loadUsers);
  const [tab, setTab] = useState<"all" | "active" | "disabled">("all");
  const [query, setQuery] = useState("");
  const syncUsers = remote.sync;
  useFocusEffect(useCallback(() => {
    void syncUsers();
  }, [syncUsers]));
  const needle = query.trim();
  const rows = (remote.data ?? []).filter((user) => {
    if (tab === "active" && user.status === "disabled") return false;
    if (tab === "disabled" && user.status !== "disabled") return false;
    if (!needle) return true;
    return `${user.name} ${user.email} ${user.roleName}`.includes(needle);
  });
  return (
    <SettingsPage refreshing={remote.refreshing} onRefresh={() => void remote.refresh()}>
      {remote.loading && !remote.data ? <LoadingBlock /> : null}
      {remote.error ? <ErrorNote text={remote.error} /> : null}
      <Pressable onPress={() => router.push("/more/area/users/new" as Href)} style={{ alignSelf: "flex-start", height: 36, paddingHorizontal: 14, borderRadius: 8, backgroundColor: tokens.inkStrong, justifyContent: "center" }}>
        <AppText style={{ color: "#fff", fontFamily: fonts.semibold, fontSize: 13 }}>הוספת משתמש</AppText>
      </Pressable>
      <View style={[cardShadow, { overflow: "hidden" }]}>
        <Chips items={[{ id: "all", label: "הכל" }, { id: "active", label: "פעילים" }, { id: "disabled", label: "מושבתים" }]} value={tab} onChange={setTab} />
        <TextInput value={query} onChangeText={setQuery} placeholder="חיפוש" placeholderTextColor={tokens.inkDisabled} style={{ height: 40, marginHorizontal: 12, marginBottom: 8, borderRadius: 8, backgroundColor: tokens.field, paddingHorizontal: 12, textAlign: "right", fontFamily: fonts.regular, color: tokens.ink }} />
        {rows.map((user) => (
          <Pressable key={user.userId} onPress={() => router.push(`/more/area/users/${encodeURIComponent(user.userId)}` as Href)} style={{ paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: tokens.line, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <AppText style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15 }} numberOfLines={1}>{user.name}</AppText>
              <Pill label={user.status === "disabled" ? "מושבת" : "פעיל"} tone={user.status === "disabled" ? "amber" : "green"} />
            </View>
            <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }} numberOfLines={1}>{user.email || "אין אימייל"}</AppText>
            <AppText style={{ color: tokens.ink, fontSize: 13 }} numberOfLines={1}>{roleDetail(user)}</AppText>
          </Pressable>
        ))}
        {!remote.loading && rows.length === 0 ? <AppText style={{ color: tokens.inkSecondary, textAlign: "center", padding: 24 }}>אין משתמשים להצגה</AppText> : null}
      </View>
    </SettingsPage>
  );
}

type UserForm = {
  name: string;
  email: string;
  password: string;
  role: string;
  everything: boolean;
  areas: string[];
  active: boolean;
};

function userForm(user: UserRow): UserForm {
  const full = user.primary || user.areas.includes("all");
  return {
    name: user.name,
    email: user.email,
    password: "",
    role: user.primary || !user.roleName.trim() || user.roleName === "צוות" ? "" : user.roleName,
    everything: full,
    areas: full ? [] : user.areas.filter((area) => AREAS.some(([key]) => key === area)),
    active: user.status !== "disabled",
  };
}

function roleDetail(user: UserRow) {
  if (user.primary || user.areas.includes("all")) return user.primary ? "מנהל" : user.roleName.trim() || "מנהל";
  const areas = AREAS.filter(([key]) => user.areas.includes(key)).map(([, label]) => label);
  const role = user.roleName.trim() || "צוות";
  return areas.length ? `${role} · ${areas.join(", ")}` : role;
}

export function UserEditor({ id }: { id: string }) {
  const fonts = useFontSet();
  const router = useRouter();
  const { storeId } = useSession();
  const remote = useStoreCall(loadUsers);
  const creating = id === "new";
  const user = remote.data?.find((item) => item.userId === id);
  const [draft, setDraft] = useState<UserForm | null>(creating ? { name: "", email: "", password: "", role: "", everything: true, areas: [], active: true } : null);
  const form = draft ?? (user ? userForm(user) : null);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);

  function edit(patch: Partial<UserForm>) {
    if (!form) return;
    setDraft({ ...form, ...patch });
  }

  if (!creating && remote.loading) return <LoadingBlock />;
  if (!creating && remote.error) return <ErrorNote text={remote.error} />;
  if (!creating && remote.data && !user) return <EmptyState text="המשתמש לא נמצא." />;
  if (!form) return <LoadingBlock />;
  const primary = user?.primary === true;
  const { name, email, password, role, everything, areas, active } = form;

  async function save() {
    if (!storeId || busy || primary) return;
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const access = everything ? ["all"] : areas;
    if (cleanName.length < 2) {
      setProblem("הזינו שם");
      return;
    }
    if (creating && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setProblem("הזינו כתובת אימייל תקינה");
      return;
    }
    if ((creating || password) && password.length < 8) {
      setProblem("הסיסמה צריכה 8 תווים לפחות");
      return;
    }
    if (!access.length) {
      setProblem("בחרו מה המשתמש יכול לראות");
      return;
    }
    setBusy(true);
    setProblem("");
    try {
      if (creating) await addUser(storeId, { name: cleanName, email: cleanEmail, password, role: role.trim(), areas: access });
      else if (user) await saveUser(storeId, { ...user, name: cleanName, roleName: role.trim(), areas: access }, active ? "active" : "disabled", password);
      router.back();
    } catch (caught) {
      setProblem(problemText(caught, "שמירת המשתמש נכשלה."));
      setBusy(false);
    }
  }

  return (
    <SettingsPage footer={primary ? undefined : <PrimaryButton label={busy ? "שומר…" : "שמירה"} disabled={busy} onPress={() => void save()} />}>
      {problem ? <ErrorNote text={problem} /> : null}
      <Block title="סוג הגישה">
        <View style={{ flexDirection: "row", padding: 12, gap: 8 }}>
          <Choice title="מנהל" detail="רואה את כל הממשק" selected={everything} onPress={() => { if (!primary) edit({ everything: true, areas: [] }); }} />
          <Choice title="חלקית" detail="בוחרים מה הוא רואה" selected={!everything} onPress={() => { if (!primary) edit({ everything: false }); }} />
        </View>
      </Block>
      <Block title="פרטי המשתמש">
        <View style={{ padding: 14, gap: 12 }}>
          <Field label="שם" value={name} onChange={(value) => edit({ name: value })} disabled={primary} />
          <Field label="תפקיד" value={role} onChange={(value) => edit({ role: value })} hint="לא חובה" disabled={primary} />
          <Field label="אימייל" value={email} onChange={(value) => edit({ email: value })} email disabled={!creating} />
          {primary ? <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }}>בעל החנות נערך מחשבון הבעלים.</AppText> : (
            <Field label={creating ? "סיסמה" : "סיסמה חדשה"} value={password} onChange={(value) => edit({ password: value })} secure hint={creating ? "8 תווים לפחות" : "השאירו ריק כדי לא לשנות"} />
          )}
        </View>
      </Block>
      {!everything && !primary ? (
        <Block title="מה הוא יכול לראות">
          <View style={{ padding: 8 }}>
            {AREAS.map(([key, label]) => {
              const on = areas.includes(key);
              return (
                <Pressable key={key} onPress={() => edit({ areas: on ? areas.filter((item) => item !== key) : [...areas, key] })} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 8, paddingVertical: 10 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: on ? tokens.inkStrong : "#c9c9c9", backgroundColor: on ? tokens.inkStrong : "#fff", alignItems: "center", justifyContent: "center" }}>
                    {on ? <Icon name="check" size={14} color="#fff" strokeWidth={2} /> : null}
                  </View>
                  <AppText style={{ fontFamily: on ? fonts.semibold : fonts.regular }}>{label}</AppText>
                </Pressable>
              );
            })}
          </View>
        </Block>
      ) : null}
      {!creating && !primary ? <View style={cardShadow}><FlagRow title="המשתמש פעיל" on={active} onToggle={(value) => edit({ active: value })} last /></View> : null}
    </SettingsPage>
  );
}

export function AiSettings() {
  const fonts = useFontSet();
  const remote = useStoreCall(loadConnections);
  const syncConnections = remote.sync;
  useFocusEffect(useCallback(() => {
    void syncConnections();
  }, [syncConnections]));
  const rows = remote.data ?? [];
  const active = rows.length > 0;
  return (
    <SettingsPage refreshing={remote.refreshing} onRefresh={() => void remote.refresh()}>
      {remote.loading && !remote.data ? <LoadingBlock /> : null}
      {remote.error ? <ErrorNote text={remote.error} /> : null}
      <View style={[cardShadow, { padding: 16, gap: 14 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: active ? tokens.activeBg : tokens.field, alignItems: "center", justifyContent: "center" }}>
            <Icon name="pulse" size={22} color={active ? tokens.activeText : tokens.inkSecondary} strokeWidth={1.7} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Pill label={active ? "פעיל" : "לא פעיל"} tone={active ? "green" : "plain"} />
            <AppText style={{ fontFamily: fonts.bold, fontSize: 18, color: tokens.inkStrong }}>{active ? "החיבור פעיל" : "אין חיבור פעיל"}</AppText>
          </View>
        </View>
        <AppText style={{ color: tokens.inkSecondary, fontSize: 14, lineHeight: 21 }}>
          {active ? "יש כלי שמחובר לחנות. יצירה וביטול של חיבור נעשים מהאתר." : "אין כלי שמחובר לחנות. אפשר לחבר כלי מהאתר."}
        </AppText>
      </View>
      {rows.length ? (
        <Block title="החיבורים">
          {rows.map((item, index) => (
            <View key={item.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: index === rows.length - 1 ? 0 : 1, borderBottomColor: tokens.line }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: tokens.field, alignItems: "center", justifyContent: "center" }}>
                <AppText style={{ fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }}>{item.name.trim().slice(0, 1) || "A"}</AppText>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText style={{ fontFamily: fonts.semibold, fontSize: 15 }} numberOfLines={1}>{item.name}</AppText>
                <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }} numberOfLines={1}>{item.lastUsedAt ? `שימוש אחרון ${hebrewWhen(item.lastUsedAt)}` : "עדיין לא בשימוש"}</AppText>
              </View>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: active ? "#1f7a4d" : "#b5b5b5" }} />
            </View>
          ))}
        </Block>
      ) : null}
    </SettingsPage>
  );
}
