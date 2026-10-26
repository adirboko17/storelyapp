import { useRef, useState, type ReactNode } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, TextInput, View, type TextInputProps } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/icon";
import { SheetEmpty, useStatusBar } from "@/components/shell";
import { AppText, ErrorNote } from "@/components/ui";
import { createStoreCustomer } from "@/lib/remote";
import { useSession } from "@/lib/session";
import { useAllowed, useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, tokens } from "@/theme/tokens";

const FIELD_BORDER = "#c9c9c9";
const BAND = "#f1f1f1";
const LANGUAGES = { he: "עברית", en: "English" } as const;

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
        height: 54,
        borderRadius: 12,
        borderWidth: focused ? 2 : 1,
        borderColor: focused ? tokens.inkStrong : FIELD_BORDER,
        paddingHorizontal: focused ? 13 : 14,
        fontFamily: fonts.regular,
        fontSize: 16,
        color: tokens.inkStrong,
        backgroundColor: tokens.card,
        textAlign: "right",
        writingDirection: ltr ? "ltr" : "rtl",
      }, style]}
    />
  );
}

function Band() {
  return <View style={{ height: 10, backgroundColor: BAND, marginVertical: 8 }} />;
}

function Heading({ text }: { text: string }) {
  const fonts = useFontSet();
  return <AppText style={{ fontFamily: fonts.bold, fontSize: 17, color: tokens.inkStrong, paddingTop: 10, paddingBottom: 4 }}>{text}</AppText>;
}

function LineRow({ icon, label, value, onPress, children }: { icon?: IconName; label: string; value?: string; onPress?: () => void; children?: ReactNode }) {
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => ({ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.6 : 1 })}>
      {icon ? <Icon name={icon} size={20} color={tokens.inkStrong} strokeWidth={1.7} /> : null}
      <AppText style={{ flex: 1, fontSize: 16, color: tokens.inkStrong }}>{label}</AppText>
      {value ? <AppText style={{ fontSize: 15, color: tokens.inkSecondary }}>{value}</AppText> : null}
      {children ?? (onPress ? <Icon name="forward" size={16} color="#b5b5b5" strokeWidth={2} /> : null)}
    </Pressable>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <LineRow label={label} onPress={() => onChange(!value)}>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: "#d4d4d4", true: tokens.inkStrong }} thumbColor="#ffffff" ios_backgroundColor="#d4d4d4" />
    </LineRow>
  );
}

export default function NewCustomerScreen() {
  useStatusBar("dark");
  const fonts = useFontSet();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { storeId } = useSession();
  const { snapshot, refresh } = useStoreData();
  const canCreate = useAllowed("customers.create");
  const saving = useRef(false);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [locale, setLocale] = useState<"he" | "en">("he");
  const [street, setStreet] = useState("");
  const [apartment, setApartment] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [tags, setTags] = useState("");
  const [tagsOpen, setTagsOpen] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [sms, setSms] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const name = `${first.trim()} ${last.trim()}`.trim();
  const dirty = Boolean(name || email.trim() || phone.trim() || street.trim() || apartment.trim() || zip.trim() || city.trim() || note.trim() || tags.trim() || subscribed || sms);
  const ready = Boolean(name) && !busy;

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

  function pickLanguage() {
    Alert.alert("שפת ההתראות", undefined, [
      { text: LANGUAGES.he, onPress: () => setLocale("he") },
      { text: LANGUAGES.en, onPress: () => setLocale("en") },
      { text: "ביטול", style: "cancel" },
    ]);
  }

  async function save() {
    if (saving.current) return;
    const mail = email.trim().toLowerCase();
    if (!name) {
      setError("יש להזין שם פרטי או שם משפחה");
      return;
    }
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setError("כתובת האימייל לא תקינה");
      return;
    }
    if (mail && (snapshot?.customers ?? []).some((person) => person.email?.trim().toLowerCase() === mail)) {
      setError("כבר קיים לקוח עם האימייל הזה");
      return;
    }
    if (!storeId) {
      setError("אין חנות נבחרת.");
      return;
    }
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const id = await createStoreCustomer(storeId, {
        name,
        email: mail,
        phone: phone.trim(),
        street: [street.trim(), apartment.trim()].filter(Boolean).join(", "),
        city: city.trim(),
        zip: zip.trim(),
        note: note.trim(),
        tags: [...new Set(tags.split(",").map((tag) => tag.trim()).filter(Boolean))],
        subscribed,
        sms,
        locale,
      });
      await refresh();
      if (id) router.replace(`/customers/${id}` as Href);
      else router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "לא הצלחנו לשמור את הלקוח.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.card }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 14, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <CircleButton icon="back" label="חזרה" onPress={close} />
        <AppText style={{ flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 17, color: tokens.inkStrong }}>לקוח חדש</AppText>
        {canCreate ? <CircleButton icon="check" label="שמירה" filled={ready} onPress={() => void save()} /> : <View style={{ width: 38 }} />}
      </View>

      {!canCreate ? <SheetEmpty icon="user" text="אין הרשאה להוסיף לקוחות." /> : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: TAB_SPACE + 24 }}>
            {error ? <ErrorNote text={error} /> : null}
            <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
              <Field value={first} onChangeText={(value) => { setFirst(value); setError(""); }} placeholder="שם פרטי" autoComplete="given-name" textContentType="givenName" returnKeyType="next" />
              <Field value={last} onChangeText={(value) => { setLast(value); setError(""); }} placeholder="שם משפחה" autoComplete="family-name" textContentType="familyName" returnKeyType="next" />
              <Field value={email} onChangeText={(value) => { setEmail(value); setError(""); }} placeholder="כתובת אימייל" ltr keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Field value={phone} onChangeText={setPhone} placeholder="טלפון" ltr keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" style={{ flex: 1 }} />
                <View style={{ height: 54, borderRadius: 12, borderWidth: 1, borderColor: FIELD_BORDER, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6, direction: "ltr" }}>
                  <AppText style={{ fontSize: 18 }}>🇮🇱</AppText>
                  <AppText style={{ fontSize: 16, color: tokens.inkStrong, writingDirection: "ltr" }}>+972</AppText>
                </View>
              </View>
              <Pressable onPress={pickLanguage} style={({ pressed }) => ({ height: 58, borderRadius: 12, backgroundColor: tokens.field, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", opacity: pressed ? 0.7 : 1 })}>
                <View style={{ flex: 1, gap: 1 }}>
                  <AppText style={{ fontSize: 12, color: tokens.inkSecondary }}>שפה</AppText>
                  <AppText style={{ fontSize: 16, color: tokens.inkStrong }}>{LANGUAGES[locale]}</AppText>
                </View>
                <Icon name="sort" size={16} color={tokens.inkSecondary} strokeWidth={1.8} />
              </Pressable>
              <AppText style={{ fontSize: 13, color: tokens.inkSecondary, marginTop: -6 }}>הלקוח יקבל התראות בשפה הזו</AppText>
            </View>

            <Band />

            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              <Heading text="כתובת" />
              <LineRow label="מדינה/אזור" value="ישראל" />
              <Field value={street} onChangeText={setStreet} placeholder="כתובת" autoComplete="street-address" textContentType="streetAddressLine1" />
              <Field value={apartment} onChangeText={setApartment} placeholder="דירה, כניסה וכו׳" textContentType="streetAddressLine2" />
              <Field value={zip} onChangeText={setZip} placeholder="מיקוד" ltr keyboardType="number-pad" autoComplete="postal-code" textContentType="postalCode" />
              <Field value={city} onChangeText={setCity} placeholder="עיר" textContentType="addressCity" />
            </View>

            <Band />

            <View style={{ paddingHorizontal: 16 }}>
              <Heading text="הערה" />
              {noteOpen ? (
                <Field value={note} onChangeText={setNote} placeholder="הערה על הלקוח" autoFocus multiline style={{ height: undefined, minHeight: 96, paddingTop: 14, textAlignVertical: "top" }} />
              ) : (
                <LineRow icon="circlePlus" label="הוספת הערה" onPress={() => setNoteOpen(true)} />
              )}
            </View>

            <Band />

            <View style={{ paddingHorizontal: 16 }}>
              <Heading text="שיווק" />
              <Toggle label="מנוי לדיוור באימייל" value={subscribed} onChange={setSubscribed} />
              <Toggle label="מנוי להודעות SMS" value={sms} onChange={setSms} />
            </View>

            <Band />

            <View style={{ paddingHorizontal: 16 }}>
              {tagsOpen ? (
                <View style={{ paddingTop: 6, gap: 6 }}>
                  <Heading text="תגיות" />
                  <Field value={tags} onChangeText={setTags} placeholder="לדוגמה: VIP, סיטונאי" autoFocus autoCapitalize="none" />
                  <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>אפשר להפריד כמה תגיות בפסיק</AppText>
                </View>
              ) : (
                <LineRow icon="hash" label="תגיות" onPress={() => setTagsOpen(true)} />
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}
