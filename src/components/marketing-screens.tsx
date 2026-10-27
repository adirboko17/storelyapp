import { useState, type ReactNode } from "react";
import { Alert, Pressable, ScrollView, Switch, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Chips, SearchBar } from "@/components/shell";
import { AppText, Badge, EmptyState, ErrorNote, LoadingBlock, refreshControl } from "@/components/ui";
import { deleteAutomation, deleteMessage, setAutomationEnabled } from "@/lib/marketing";
import { useSession } from "@/lib/session";
import { useStoreData } from "@/lib/store-data";
import type { FlowRecord, MarketingEmailRecord, MarketingSmsRecord } from "@/lib/snapshot";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, tokens } from "@/theme/tokens";

const PAGE = "#f6f6f6";
const ACTIVE = { label: "פעיל", background: "#cdfee1", color: "#0c5132" };
const IDLE = { label: "לא פעיל", background: "#e3e3e3", color: "#616161" };
const MAIL = { label: "מייל", background: "#e0f0ff", color: "#00527c" };
const SMS = { label: "SMS", background: "#ede7fb", color: "#5b3fc4" };

const CATALOG = [
  { key: "meta", name: "Meta Pixel", detail: "מעקב אחר צפיות, הוספות לעגלה ורכישות לפייסבוק ואינסטגרם.", group: "ads", mark: "f", color: "#1877f2" },
  { key: "gads", name: "Google Ads", detail: "שליחת רכישות כהמרות לקמפיינים בגוגל.", group: "ads", mark: "Ads", color: "#34a853" },
  { key: "tiktok", name: "TikTok Pixel", detail: "מעקב אחר אירועים מקמפיינים בטיקטוק.", group: "ads", mark: "♪", color: "#111111" },
  { key: "gtm", name: "Google Tag Manager", detail: "טעינת כל התגים שלכם ממקום אחד.", group: "measure", mark: "G", color: "#4285f4" },
  { key: "ga4", name: "Google Analytics 4", detail: "ניתוח תנועה והתנהגות גולשים, כולל אירועי מסחר.", group: "measure", mark: "GA", color: "#e37400" },
  { key: "clarity", name: "Microsoft Clarity", detail: "הקלטות גלישה ומפות חום.", group: "measure", mark: "C", color: "#5c2d91" },
  { key: "code", name: "קוד מותאם אישית", detail: "סקריפטים לכל עמודי החנות.", group: "code", mark: "</>", color: "#303030" },
] as const;

const GROUPS = [
  { id: "ads", title: "פרסום ורשתות חברתיות", hint: "מדידת המרות מקמפיינים ובניית קהלים" },
  { id: "measure", title: "ניתוח ומדידה", hint: "הבנת התנועה וההתנהגות בחנות" },
  { id: "code", title: "קוד מותאם", hint: "כלים שאין להם אינטגרציה מוכנה" },
] as const;

function Screen({ refreshing, onRefresh, children }: { refreshing: boolean; onRefresh: () => void; children: ReactNode }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: PAGE }} contentContainerStyle={{ paddingBottom: TAB_SPACE + 24 }} refreshControl={refreshControl(refreshing, onRefresh)}>
      {children}
    </ScrollView>
  );
}

function Note({ text }: { text: string }) {
  return (
    <View style={{ marginHorizontal: 12, marginTop: 12, borderRadius: 12, backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 12 }}>
      <AppText style={{ fontSize: 13, lineHeight: 18, color: tokens.inkSecondary }}>{text}</AppText>
    </View>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  const fonts = useFontSet();
  return (
    <View style={{ marginHorizontal: 16, marginTop: 18, gap: 2 }}>
      <AppText style={{ fontFamily: fonts.bold, fontSize: 15, color: tokens.inkStrong }}>{title}</AppText>
      {hint ? <AppText style={{ fontSize: 13, lineHeight: 18, color: tokens.inkSecondary }}>{hint}</AppText> : null}
    </View>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <View style={{ marginHorizontal: 12, marginTop: 8, backgroundColor: "#fff", borderRadius: 16, overflow: "hidden" }}>{children}</View>;
}

function Mark({ label, color }: { label: string; color: string }) {
  const fonts = useFontSet();
  return (
    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
      <AppText style={{ color: "#fff", fontFamily: fonts.bold, fontSize: label.length > 2 ? 11 : 15 }}>{label}</AppText>
    </View>
  );
}

export function IntegrationsScreen() {
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  if (loading && !snapshot) return <LoadingBlock />;
  const marketing = snapshot?.marketing;
  if (!marketing) return <EmptyState text="הסנאפשוט לא כולל אינטגרציות." />;
  const connected = new Map((marketing.connected ?? []).map((item) => [item.key, item.label]));
  const live = CATALOG.filter((item) => connected.has(item.key));
  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      {error ? <ErrorNote text={error} /> : null}
      <Note text={`${live.length} מתוך ${CATALOG.length} אינטגרציות פעילות. חיבור וניתוק נעשים במחשב.`} />
      {live.length ? (
        <>
          <SectionTitle title="פעילות" />
          <Card>
            {live.map((item, index) => (
              <IntegrationRow key={item.key} item={item} label={connected.get(item.key)} active divider={index > 0} />
            ))}
          </Card>
        </>
      ) : null}
      {GROUPS.map((group) => {
        const rows = CATALOG.filter((item) => item.group === group.id && !connected.has(item.key));
        if (!rows.length) return null;
        return (
          <View key={group.id}>
            <SectionTitle title={group.title} hint={group.hint} />
            <Card>
              {rows.map((item, index) => (
                <IntegrationRow key={item.key} item={item} active={false} divider={index > 0} />
              ))}
            </Card>
          </View>
        );
      })}
    </Screen>
  );
}

function IntegrationRow({ item, label, active, divider }: { item: (typeof CATALOG)[number]; label?: string; active: boolean; divider: boolean }) {
  const fonts = useFontSet();
  const badge = active ? ACTIVE : IDLE;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderTopWidth: divider ? 1 : 0, borderTopColor: "#f1f1f1" }}>
      <Mark label={item.mark} color={item.color} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={{ fontFamily: fonts.semibold, fontSize: 15, color: tokens.inkStrong }}>{item.name}</AppText>
        <AppText style={{ fontSize: 13, lineHeight: 18, color: tokens.inkSecondary }}>{item.detail}</AppText>
        {label ? <AppText style={{ fontSize: 12, color: tokens.inkSecondary, writingDirection: "ltr", textAlign: "right" }}>{label}</AppText> : null}
      </View>
      <Badge label={badge.label} background={badge.background} color={badge.color} />
    </View>
  );
}

type MessageRow = { id: string; kind: "email" | "sms"; name: string; detail: string; used: boolean };

export function MessagesScreen() {
  const router = useRouter();
  const { storeId } = useSession();
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "email" | "sms">("all");
  const [problem, setProblem] = useState("");
  if (loading && !snapshot) return <LoadingBlock />;
  const marketing = snapshot?.marketing;
  if (!marketing || (marketing.emails == null && marketing.sms == null)) return <EmptyState text="הסנאפשוט לא כולל מיילים ו-SMS." />;
  const usedEmails = new Set(marketing.usedEmailIds ?? []);
  const usedSms = new Set(marketing.usedSmsIds ?? []);
  const emails = marketing.emails ?? [];
  const messages = marketing.sms ?? [];
  const usedCount = emails.filter((item) => usedEmails.has(item.id)).length + messages.filter((item) => usedSms.has(item.id)).length;
  const rows: MessageRow[] = [
    ...emails.map((item) => ({ id: `email:${item.id}`, kind: "email" as const, name: item.name || item.subject || "מייל", detail: item.subject || "בלי נושא", used: usedEmails.has(item.id) })),
    ...messages.map((item) => ({ id: `sms:${item.id}`, kind: "sms" as const, name: item.name || "SMS", detail: item.text || "הודעה ריקה", used: usedSms.has(item.id) })),
  ].filter((item) => (tab === "all" || item.kind === tab) && match(query, `${item.name} ${item.detail}`));
  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      {error ? <ErrorNote text={error} /> : null}
      {problem ? <ErrorNote text={problem} /> : null}
      <Note text="אפשר לראות כאן את המיילים ואת הודעות ה-SMS. עריכה נעשית רק במחשב. לחיצה ארוכה מוחקת." />
      <View style={{ flexDirection: "row", gap: 8, marginHorizontal: 12, marginTop: 12 }}>
        <Count label="מיילים" value={emails.length} />
        <Count label="SMS" value={messages.length} />
        <Count label="באוטומציה" value={usedCount} />
      </View>
      <Chips items={[{ id: "all", label: "הכל" }, { id: "email", label: "מייל" }, { id: "sms", label: "SMS" }]} value={tab} onChange={setTab} />
      <SearchBar value={query} onChange={setQuery} placeholder="חיפוש הודעות" />
      {rows.length ? (
        <Card>
          {rows.map((item, index) => (
            <MessageRowView
              key={item.id}
              item={item}
              divider={index > 0}
              onPress={() => router.push(`/more/area/messages/${encodeURIComponent(item.id)}` as Href)}
              onLongPress={() => confirmDelete(item.kind === "email" ? "למחוק את המייל?" : "למחוק את ה-SMS?", item.used ? `${item.name}\nההודעה מחוברת לאוטומציה, ואי אפשר לשחזר אותה.` : `${item.name}\nאי אפשר לשחזר את ההודעה.`, () => void removeMessage(storeId, item, refresh, setProblem))}
            />
          ))}
        </Card>
      ) : <EmptyState text={query.trim() ? "אין תוצאות לחיפוש" : "אין הודעות עדיין"} />}
    </Screen>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  const fonts = useFontSet();
  return (
    <View style={{ flex: 1, backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, gap: 2 }}>
      <AppText style={{ fontSize: 12, color: tokens.inkSecondary }}>{label}</AppText>
      <AppText style={{ fontFamily: fonts.bold, fontSize: 18, color: tokens.inkStrong }}>{value}</AppText>
    </View>
  );
}

function MessageRowView({ item, divider, onPress, onLongPress }: { item: MessageRow; divider: boolean; onPress: () => void; onLongPress: () => void }) {
  const fonts = useFontSet();
  const channel = item.kind === "email" ? MAIL : SMS;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={350} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderTopWidth: divider ? 1 : 0, borderTopColor: "#f1f1f1" }}>
      <Mark label={item.kind === "email" ? "✉" : "SMS"} color={item.kind === "email" ? "#00527c" : "#5b3fc4"} />
      <View style={{ flex: 1, gap: 3 }}>
        <AppText style={{ fontFamily: fonts.semibold, fontSize: 15, color: tokens.inkStrong }} numberOfLines={1}>{item.name}</AppText>
        <AppText style={{ fontSize: 13, color: tokens.inkSecondary }} numberOfLines={2}>{item.detail}</AppText>
      </View>
      <View style={{ gap: 6, alignItems: "flex-end" }}>
        <Badge label={channel.label} background={channel.background} color={channel.color} />
        <Badge label={item.used ? "באוטומציה" : "לא מחובר"} background={item.used ? "#e0f0ff" : "#e3e3e3"} color={item.used ? "#00527c" : "#616161"} />
      </View>
    </Pressable>
  );
}

function match(query: string, text: string) {
  const needle = query.trim().toLowerCase();
  return !needle || text.toLowerCase().includes(needle);
}

function confirmDelete(title: string, message: string, onDelete: () => void) {
  Alert.alert(title, message, [
    { text: "ביטול", style: "cancel" },
    { text: "מחיקה", style: "destructive", onPress: onDelete },
  ]);
}

async function removeMessage(storeId: string | null, item: MessageRow, refresh: () => Promise<void>, setProblem: (value: string) => void) {
  if (!storeId) return;
  const id = item.id.slice(item.kind === "email" ? "email:".length : "sms:".length);
  setProblem("");
  try {
    await deleteMessage(storeId, item.kind, id);
    await refresh();
  } catch (caught) {
    setProblem(caught instanceof Error ? caught.message : "לא הצלחנו למחוק את ההודעה.");
  }
}

async function removeAutomation(storeId: string | null, id: string, refresh: () => Promise<void>, setProblem: (value: string) => void) {
  if (!storeId) return;
  setProblem("");
  try {
    await deleteAutomation(storeId, id);
    await refresh();
  } catch (caught) {
    setProblem(caught instanceof Error ? caught.message : "לא הצלחנו למחוק את האוטומציה.");
  }
}

export function MessageView({ id }: { id: string }) {
  const { snapshot, loading } = useStoreData();
  if (loading && !snapshot) return <LoadingBlock />;
  const emailId = id.startsWith("email:") ? id.slice("email:".length) : "";
  const smsId = id.startsWith("sms:") ? id.slice("sms:".length) : "";
  const email = snapshot?.marketing?.emails?.find((item) => item.id === emailId);
  const sms = snapshot?.marketing?.sms?.find((item) => item.id === smsId);
  if (!email && !sms) return <EmptyState text="ההודעה לא נמצאה." />;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: PAGE }} contentContainerStyle={{ paddingBottom: TAB_SPACE + 24 }}>
      <Note text="ההודעה מוצגת לקריאה. עריכה נעשית רק במחשב." />
      {email ? <EmailBody email={email} used={(snapshot?.marketing?.usedEmailIds ?? []).includes(email.id)} /> : null}
      {sms ? <SmsBody sms={sms} used={(snapshot?.marketing?.usedSmsIds ?? []).includes(sms.id)} /> : null}
    </ScrollView>
  );
}

function EmailBody({ email, used }: { email: MarketingEmailRecord; used: boolean }) {
  const fonts = useFontSet();
  return (
    <Card>
      <View style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Badge label={MAIL.label} background={MAIL.background} color={MAIL.color} />
          <Badge label={used ? "באוטומציה" : "לא מחובר"} background={used ? "#e0f0ff" : "#e3e3e3"} color={used ? "#00527c" : "#616161"} />
        </View>
        <AppText style={{ fontFamily: fonts.bold, fontSize: 18, color: tokens.inkStrong }}>{email.name || "מייל"}</AppText>
        <Fact label="נושא" value={email.subject || "בלי נושא"} />
        {email.preview ? <Fact label="תצוגה מקדימה" value={email.preview} /> : null}
        <Fact label="תוכן" value={email.body || "אין תוכן טקסטואלי"} />
      </View>
    </Card>
  );
}

function SmsBody({ sms, used }: { sms: MarketingSmsRecord; used: boolean }) {
  const fonts = useFontSet();
  const text = sms.text || "";
  return (
    <Card>
      <View style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Badge label={SMS.label} background={SMS.background} color={SMS.color} />
          <Badge label={used ? "באוטומציה" : "לא מחובר"} background={used ? "#e0f0ff" : "#e3e3e3"} color={used ? "#00527c" : "#616161"} />
        </View>
        <AppText style={{ fontFamily: fonts.bold, fontSize: 18, color: tokens.inkStrong }}>{sms.name || "SMS"}</AppText>
        <Fact label="הודעה" value={text || "הודעה ריקה"} />
        <AppText style={{ fontSize: 12, color: tokens.inkSecondary }}>{`${text.length} מתוך 250 תווים`}</AppText>
      </View>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const fonts = useFontSet();
  return (
    <View style={{ gap: 2 }}>
      <AppText style={{ fontSize: 12, color: tokens.inkSecondary }}>{label}</AppText>
      <AppText style={{ fontSize: 15, lineHeight: 22, color: tokens.inkStrong, fontFamily: fonts.regular }}>{value}</AppText>
    </View>
  );
}

export function AutomationsScreen() {
  const router = useRouter();
  const { storeId } = useSession();
  const { snapshot, loading, refreshing, error, refresh } = useStoreData();
  const toggle = useFlowToggle();
  const [problem, setProblem] = useState("");
  if (loading && !snapshot) return <LoadingBlock />;
  const flows = snapshot?.marketing?.flows;
  if (!flows) return <EmptyState text="הסנאפשוט לא כולל אוטומציות." />;
  const active = flows.filter((flow) => flowState(flow, toggle.pending)).length;
  return (
    <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
      {error ? <ErrorNote text={error} /> : null}
      {toggle.error ? <ErrorNote text={toggle.error} /> : null}
      {problem ? <ErrorNote text={problem} /> : null}
      <Note text="אפשר לראות את האוטומציות ולהדליק או לכבות אותן. עריכת השלבים נעשית רק במחשב. לחיצה ארוכה מוחקת." />
      <View style={{ flexDirection: "row", gap: 8, marginHorizontal: 12, marginTop: 12 }}>
        <Count label="פעילות" value={active} />
        <Count label="כבויות" value={flows.length - active} />
      </View>
      {flows.length ? (
        <Card>
          {flows.map((flow, index) => (
            <AutomationRow
              key={flow.id}
              flow={flow}
              on={flowState(flow, toggle.pending)}
              divider={index > 0}
              disabled={toggle.busy === flow.id}
              onPress={() => router.push(`/more/area/automations/${encodeURIComponent(flow.id)}` as Href)}
              onLongPress={() => confirmDelete("למחוק את האוטומציה?", `${flow.name}\nאי אפשר לשחזר אותה.`, () => void removeAutomation(storeId, flow.id, refresh, setProblem))}
              onToggle={(value) => void toggle.set(flow.id, value)}
            />
          ))}
        </Card>
      ) : <EmptyState text="אין אוטומציות עדיין" />}
    </Screen>
  );
}

function AutomationRow({ flow, on, divider, disabled, onPress, onLongPress, onToggle }: { flow: FlowRecord; on: boolean; divider: boolean; disabled: boolean; onPress: () => void; onLongPress: () => void; onToggle: (value: boolean) => void }) {
  const fonts = useFontSet();
  const channels = channelsOf(flow);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", borderTopWidth: divider ? 1 : 0, borderTopColor: "#f1f1f1" }}>
      <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={350} style={{ flex: 1, gap: 6, paddingHorizontal: 14, paddingVertical: 14 }}>
        <AppText style={{ fontFamily: fonts.semibold, fontSize: 15, color: tokens.inkStrong }}>{flow.name}</AppText>
        {flow.trigger ? <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>{flow.trigger}</AppText> : null}
        <View style={{ flexDirection: "row", gap: 6 }}>
          {channels.map((channel) => <Badge key={channel} label={channel === "email" ? MAIL.label : SMS.label} background={channel === "email" ? MAIL.background : SMS.background} color={channel === "email" ? MAIL.color : SMS.color} />)}
          <Badge label={on ? ACTIVE.label : IDLE.label} background={on ? ACTIVE.background : IDLE.background} color={on ? ACTIVE.color : IDLE.color} />
        </View>
      </Pressable>
      <View style={{ paddingEnd: 12 }}>
        <Switch
          accessibilityLabel={on ? "כיבוי האוטומציה" : "הפעלת האוטומציה"}
          value={on}
          disabled={disabled}
          onValueChange={onToggle}
          trackColor={{ false: "#d4d4d4", true: tokens.inkStrong }}
          thumbColor="#ffffff"
          ios_backgroundColor="#d4d4d4"
        />
      </View>
    </View>
  );
}

export function AutomationView({ id }: { id: string }) {
  const fonts = useFontSet();
  const { snapshot, loading } = useStoreData();
  const toggle = useFlowToggle();
  if (loading && !snapshot) return <LoadingBlock />;
  const flow = snapshot?.marketing?.flows?.find((item) => item.id === id);
  if (!flow) return <EmptyState text="האוטומציה לא נמצאה." />;
  const on = flowState(flow, toggle.pending);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: PAGE }} contentContainerStyle={{ paddingBottom: TAB_SPACE + 24 }}>
      <Note text="אפשר להדליק או לכבות את האוטומציה. עריכת השלבים נעשית רק במחשב." />
      {toggle.error ? <ErrorNote text={toggle.error} /> : null}
      <Card>
        <View style={{ padding: 16, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <AppText style={{ fontFamily: fonts.bold, fontSize: 18, color: tokens.inkStrong }}>{flow.name}</AppText>
              {flow.trigger ? <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>{`טריגר: ${flow.trigger}`}</AppText> : null}
            </View>
            <Switch
              accessibilityLabel={on ? "כיבוי האוטומציה" : "הפעלת האוטומציה"}
              value={on}
              disabled={toggle.busy === flow.id}
              onValueChange={(value) => void toggle.set(flow.id, value)}
              trackColor={{ false: "#d4d4d4", true: tokens.inkStrong }}
              thumbColor="#ffffff"
              ios_backgroundColor="#d4d4d4"
            />
          </View>
          <Badge label={on ? ACTIVE.label : IDLE.label} background={on ? ACTIVE.background : IDLE.background} color={on ? ACTIVE.color : IDLE.color} />
        </View>
      </Card>
      <SectionTitle title="שלבים" />
      <Card>
        {(flow.steps ?? []).length ? (flow.steps ?? []).map((step, index) => (
          <View key={`${step}-${index}`} style={{ flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderTopColor: "#f1f1f1" }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#f1f1f1", alignItems: "center", justifyContent: "center" }}>
              <AppText style={{ fontFamily: fonts.semibold, fontSize: 12, color: tokens.inkStrong }}>{index + 1}</AppText>
            </View>
            <AppText style={{ flex: 1, fontSize: 15, color: tokens.inkStrong, paddingTop: 2 }}>{step}</AppText>
          </View>
        )) : <View style={{ padding: 16 }}><AppText style={{ color: tokens.inkSecondary }}>אין שלבים להצגה.</AppText></View>}
      </Card>
    </ScrollView>
  );
}

function channelsOf(flow: FlowRecord) {
  const channels: ("email" | "sms")[] = [];
  for (const step of flow.steps ?? []) {
    if (step === "מייל" && !channels.includes("email")) channels.push("email");
    if (step === "SMS" && !channels.includes("sms")) channels.push("sms");
  }
  return channels;
}

function flowState(flow: FlowRecord, pending: Record<string, boolean>) {
  if (flow.id in pending) return pending[flow.id] ?? false;
  return flow.on === true;
}

function useFlowToggle() {
  const { storeId } = useSession();
  const { refresh } = useStoreData();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Record<string, boolean>>({});
  async function set(id: string, on: boolean) {
    if (!storeId || busy) return;
    setPending((current) => ({ ...current, [id]: on }));
    setBusy(id);
    setError("");
    try {
      await setAutomationEnabled(storeId, id, on);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "לא הצלחנו לעדכן את האוטומציה.");
    } finally {
      setBusy(null);
      setPending((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }
  }
  return { set, busy, error, pending };
}
