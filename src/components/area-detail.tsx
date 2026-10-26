import { useCallback, useState, type ReactNode } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { FactList } from "@/components/browse";
import { AppText, EmptyState, ErrorNote, LoadingBlock, PrimaryButton } from "@/components/ui";
import { formatCount, formatIls, hebrewDate, hebrewWhen } from "@/lib/format";
import { ACCESS_AREA_LABEL, SEGMENTS, type AreaKey } from "@/lib/menu";
import { buildReport, reportById } from "@/lib/reports";
import {
  addUser,
  decideReview,
  loadCampaigns,
  loadEvents,
  loadPopups,
  loadReviews,
  loadTraffic,
  loadUsers,
  saveUser,
  useStoreCall,
} from "@/lib/remote";
import { useSession } from "@/lib/session";
import { useAllowed, useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, cardShadow, tokens } from "@/theme/tokens";

function Page({ children }: { children: ReactNode }) {
  return <ScrollView style={{ flex: 1, backgroundColor: tokens.card }} contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: TAB_SPACE + 20 }}>{children}</ScrollView>;
}

export function AreaDetail({ area, id }: { area: AreaKey; id: string }) {
  if (area === "abandoned") return <CheckoutDetail id={id} />;
  if (area === "collections") return <CollectionDetail id={id} />;
  if (area === "gift-cards") return <GiftDetail id={id} />;
  if (area === "segments") return <SegmentDetail id={id} />;
  if (area === "messages") return <MessageDetail id={id} />;
  if (area === "automations") return <FlowDetail id={id} />;
  if (area === "posts") return <PostDetail id={id} />;
  if (area === "policies") return <PolicyDetail id={id} />;
  if (area === "reviews") return <ReviewDetail id={id} />;
  if (area === "campaigns") return <CampaignDetail id={id} />;
  if (area === "popups") return <PopupDetail id={id} />;
  if (area === "events") return <EventDetail id={id} />;
  if (area === "reports") return <ReportDetail id={id} />;
  if (area === "users") return id === "new" ? <NewUser /> : <UserDetail id={id} />;
  return <EmptyState text="אין פרטים למסך הזה." />;
}

function CheckoutDetail({ id }: { id: string }) {
  const { snapshot, loading } = useStoreData();
  if (loading) return <LoadingBlock />;
  const item = snapshot?.checkouts?.find((checkout) => checkout.id === id);
  if (!item) return <EmptyState text="העגלה לא נמצאה." />;
  return (
    <Page>
      <FactList rows={[
        { label: "שם", value: item.name },
        { label: "אימייל", value: item.email },
        { label: "טלפון", value: item.phone },
        { label: "כתובת", value: [item.street, item.city, item.zip].filter(Boolean).join(", ") },
        { label: "עודכן", value: hebrewWhen(item.updatedAt) },
        { label: "סכום", value: item.total != null ? formatIls(item.total) : undefined },
        { label: "משלוח", value: item.shippingAmount != null ? formatIls(item.shippingAmount) : undefined },
        { label: "סטטוס", value: item.recovered ? "שוחזרה" : item.reminded ? "נשלחה תזכורת" : "פתוחה" },
      ]} />
      {(item.lines ?? []).map((line, index) => (
        <View key={`${line.title ?? ""}-${index}`} style={[cardShadow, { padding: 14, gap: 4 }]}>
          <AppText>{line.title || ""}</AppText>
          <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }}>{[line.quantity != null ? `כמות ${formatCount(line.quantity)}` : "", line.unitPrice != null ? formatIls(line.unitPrice) : ""].filter(Boolean).join(" · ")}</AppText>
        </View>
      ))}
    </Page>
  );
}

function CollectionDetail({ id }: { id: string }) {
  const { snapshot, loading } = useStoreData();
  if (loading) return <LoadingBlock />;
  const item = snapshot?.collections?.find((collection) => collection.id === id);
  if (!item) return <EmptyState text="הקטגוריה לא נמצאה." />;
  const products = (snapshot?.products ?? []).filter((product) => item.productIds?.includes(product.id) || product.category === item.title);
  return (
    <Page>
      <FactList rows={[
        { label: "שם", value: item.title },
        { label: "תיאור", value: item.description },
        { label: "תצוגה", value: item.hidden ? "מוסתרת" : "גלויה" },
        { label: "תת קטגוריות", value: item.subcategories.length ? item.subcategories.join(" · ") : undefined },
      ]} />
      {products.map((product) => (
        <View key={product.id} style={[cardShadow, { padding: 14 }]}>
          <AppText>{product.title || ""}</AppText>
        </View>
      ))}
      {!products.length ? <EmptyState text="אין מוצרים בקטגוריה." /> : null}
    </Page>
  );
}

function GiftDetail({ id }: { id: string }) {
  const { snapshot, loading } = useStoreData();
  if (loading) return <LoadingBlock />;
  const item = snapshot?.giftCards?.find((card) => card.code === id);
  if (!item) return <EmptyState text="הכרטיס לא נמצא." />;
  return (
    <Page>
      <FactList rows={[
        { label: "קוד", value: item.code },
        { label: "ערך", value: item.value != null ? formatIls(item.value) : undefined },
        { label: "יתרה", value: item.balance != null ? formatIls(item.balance) : undefined },
        { label: "לקוח", value: item.customer },
        { label: "תוקף", value: item.expires },
        { label: "הערה", value: item.note },
      ]} />
    </Page>
  );
}

function SegmentDetail({ id }: { id: string }) {
  const { snapshot, loading } = useStoreData();
  if (loading) return <LoadingBlock />;
  const segment = SEGMENTS.find((item) => item.id === id);
  const customers = snapshot?.customers;
  const orders = snapshot?.orders;
  if (!segment) return <EmptyState text="הפלח לא נמצא." />;
  if (!customers || !orders) return <EmptyState text="הסנאפשוט לא כולל את הלקוחות או ההזמנות של הפלח." />;
  const rows = customers.filter((customer) => {
    const count = orders.filter((order) => order.customerId === customer.id).length;
    const spent = orders.filter((order) => order.customerId === customer.id).reduce((sum, order) => sum + (order.total ?? 0), 0);
    if (count < segment.minOrders || spent < segment.minSpent) return false;
    if (segment.subOnly && customer.subscribed !== true) return false;
    return true;
  });
  return (
    <Page>
      <AppText style={{ color: tokens.inkSecondary }}>{formatCount(rows.length)} לקוחות</AppText>
      {rows.map((customer) => (
        <View key={customer.id} style={[cardShadow, { padding: 14 }]}>
          <AppText>{customer.name || customer.email || ""}</AppText>
        </View>
      ))}
      {!rows.length ? <EmptyState text="אף לקוח לא עונה על התנאים." /> : null}
    </Page>
  );
}

function MessageDetail({ id }: { id: string }) {
  const { snapshot, loading } = useStoreData();
  if (loading) return <LoadingBlock />;
  const emailId = id.startsWith("email:") ? id.slice("email:".length) : "";
  const smsId = id.startsWith("sms:") ? id.slice("sms:".length) : "";
  const email = snapshot?.marketing?.emails?.find((item) => item.id === emailId);
  const sms = snapshot?.marketing?.sms?.find((item) => item.id === smsId);
  if (email) {
    return <Page><FactList rows={[{ label: "שם", value: email.name }, { label: "נושא", value: email.subject }, { label: "תצוגה מקדימה", value: email.preview }, { label: "תוכן", value: email.body }]} /></Page>;
  }
  if (sms) return <Page><FactList rows={[{ label: "שם", value: sms.name }, { label: "הודעה", value: sms.text }]} /></Page>;
  return <EmptyState text="ההודעה לא נמצאה." />;
}

function FlowDetail({ id }: { id: string }) {
  const { snapshot, loading } = useStoreData();
  if (loading) return <LoadingBlock />;
  const flow = snapshot?.marketing?.flows?.find((item) => item.id === id);
  if (!flow) return <EmptyState text="האוטומציה לא נמצאה." />;
  return (
    <Page>
      <FactList rows={[{ label: "שם", value: flow.name }, { label: "טריגר", value: flow.trigger }, { label: "מצב", value: flow.on === false ? "כבויה" : flow.on ? "פעילה" : undefined }]} />
      {(flow.steps ?? []).map((step, index) => (
        <View key={`${step}-${index}`} style={[cardShadow, { padding: 14 }]}>
          <AppText>{step}</AppText>
        </View>
      ))}
    </Page>
  );
}

function PostDetail({ id }: { id: string }) {
  const { snapshot, loading } = useStoreData();
  if (loading) return <LoadingBlock />;
  const post = snapshot?.posts?.find((item) => item.id === id);
  if (!post) return <EmptyState text="הפוסט לא נמצא." />;
  return (
    <Page>
      <FactList rows={[
        { label: "כותרת", value: post.title },
        { label: "בלוג", value: post.blog },
        { label: "כותב", value: post.author },
        { label: "עודכן", value: post.updated },
        { label: "תקציר", value: post.excerpt },
        { label: "תוכן", value: post.body },
      ]} />
    </Page>
  );
}

function PolicyDetail({ id }: { id: string }) {
  const { snapshot, loading } = useStoreData();
  if (loading) return <LoadingBlock />;
  const policy = snapshot?.policies?.find((item) => item.id === id);
  if (!policy) return <EmptyState text="הפוליסה לא נמצאה." />;
  return <Page><FactList rows={[{ label: "שם", value: policy.title }, { label: "תוכן", value: policy.body }]} /></Page>;
}

function ReviewDetail({ id }: { id: string }) {
  const canUpdate = useAllowed("products.update");
  const load = useCallback(async (storeId: string) => {
    for (const status of ["pending", "published", "rejected"] as const) {
      const rows = await loadReviews(storeId, status);
      const found = rows.find((review) => review.id === id);
      if (found) return found;
    }
    return null;
  }, [id]);
  const remote = useStoreCall(load);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  if (remote.loading) return <LoadingBlock />;
  if (remote.error) return <ErrorNote text={remote.error} />;
  const review = remote.data;
  if (!review) return <EmptyState text="הביקורת לא נמצאה." />;
  const current = review;
  const decide = async (decision: "approve" | "reject") => {
    if (!remote.storeId || busy) return;
    setBusy(true);
    setProblem("");
    try {
      await decideReview(remote.storeId, current.id, decision);
      await remote.refresh();
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "לא הצלחנו לעדכן את הביקורת.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <FactList rows={[
        { label: "מוצר", value: review.productTitle },
        { label: "שם", value: review.name },
        { label: "דירוג", value: `${review.rating}/5` },
        { label: "תאריך", value: hebrewWhen(review.createdAt) },
        { label: "תוכן", value: review.body },
      ]} />
      {problem ? <ErrorNote text={problem} /> : null}
      {canUpdate && current.status === "pending" ? (
        <View style={{ gap: 8 }}>
          <PrimaryButton label="אישור הביקורת" disabled={busy} onPress={() => void decide("approve")} />
          <PrimaryButton label="דחיית הביקורת" disabled={busy} onPress={() => void decide("reject")} />
        </View>
      ) : null}
    </Page>
  );
}

function CampaignDetail({ id }: { id: string }) {
  const load = useCallback((storeId: string) => loadCampaigns(storeId), []);
  const remote = useStoreCall(load);
  if (remote.loading) return <LoadingBlock />;
  if (remote.error) return <ErrorNote text={remote.error} />;
  const item = remote.data?.find((campaign) => campaign.id === id);
  if (!item) return <EmptyState text="הקמפיין לא נמצא." />;
  return <Page><FactList rows={[{ label: "שם", value: item.name }, { label: "סטטוס", value: item.status }, { label: "קהל", value: item.audience }, { label: "תזמון", value: hebrewDate(item.scheduledAt ?? undefined) }]} /></Page>;
}

function PopupDetail({ id }: { id: string }) {
  const load = useCallback((storeId: string) => loadPopups(storeId), []);
  const remote = useStoreCall(load);
  if (remote.loading) return <LoadingBlock />;
  if (remote.error) return <ErrorNote text={remote.error} />;
  const item = remote.data?.find((popup) => popup.id === id);
  if (!item) return <EmptyState text="הפופאפ לא נמצא." />;
  return <Page><FactList rows={[{ label: "שם", value: item.name }, { label: "סטטוס", value: item.status }, { label: "לידים", value: formatCount(item.leads) }, { label: "עודכן", value: hebrewWhen(item.updatedAt) }]} /></Page>;
}

function EventDetail({ id }: { id: string }) {
  const load = useCallback((storeId: string) => loadEvents(storeId), []);
  const remote = useStoreCall(load);
  if (remote.loading) return <LoadingBlock />;
  if (remote.error) return <ErrorNote text={remote.error} />;
  const item = remote.data?.find((event) => event.id === id);
  if (!item) return <EmptyState text="האירוע לא נמצא." />;
  return (
    <Page>
      <FactList rows={[
        { label: "שם", value: item.title },
        { label: "תאריך", value: [item.date, item.from && item.to ? `${item.from}–${item.to}` : ""].filter(Boolean).join(" · ") },
        { label: "מיקום", value: item.online ? "אונליין" : item.address },
        { label: "מחיר", value: formatIls(item.price) },
        { label: "סטטוס", value: item.status },
        { label: "תקציר", value: item.short },
        { label: "תוכן", value: item.body },
      ]} />
    </Page>
  );
}

function ReportDetail({ id }: { id: string }) {
  const fonts = useFontSet();
  const { snapshot, loading } = useStoreData();
  const load = useCallback(async (storeId: string) => {
    try {
      return await loadTraffic(storeId);
    } catch {
      return null;
    }
  }, []);
  const remote = useStoreCall(load);
  if (loading || remote.loading) return <LoadingBlock />;
  const report = reportById(id);
  if (!report || !snapshot) return <EmptyState text="הדוח לא נמצא." />;
  const built = buildReport(id, snapshot, remote.data);
  return (
    <Page>
      <AppText style={{ fontFamily: fonts.bold, fontSize: 18 }}>{report.name}</AppText>
      {built.missing ? <EmptyState text={built.missing} /> : null}
      {built.rows.map((row) => (
        <View key={row.label} style={[cardShadow, { padding: 14, flexDirection: "row", gap: 8 }]}>
          <AppText style={{ flex: 1 }}>{row.label}</AppText>
          <AppText>{row.value}</AppText>
        </View>
      ))}
      {!built.missing && !built.rows.length ? <EmptyState text="אין נתונים בטווח הזה." /> : null}
    </Page>
  );
}

function UserDetail({ id }: { id: string }) {
  const load = useCallback((storeId: string) => loadUsers(storeId), []);
  const remote = useStoreCall(load);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  if (remote.loading) return <LoadingBlock />;
  if (remote.error) return <ErrorNote text={remote.error} />;
  const user = remote.data?.find((item) => item.userId === id);
  if (!user) return <EmptyState text="המשתמש לא נמצא." />;
  const current = user;
  const setStatus = async (status: string) => {
    if (!remote.storeId || current.primary || busy) return;
    setBusy(true);
    setProblem("");
    try {
      await saveUser(remote.storeId, current, status);
      await remote.refresh();
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "לא הצלחנו לעדכן את המשתמש.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page>
      <FactList rows={[
        { label: "שם", value: current.name },
        { label: "אימייל", value: current.email },
        { label: "תפקיד", value: current.roleName },
        { label: "סטטוס", value: current.status === "active" ? "פעיל" : current.status },
        { label: "הרשאות", value: current.areas.map((area) => ACCESS_AREA_LABEL[area] ?? area).join(" · ") },
      ]} />
      {problem ? <ErrorNote text={problem} /> : null}
      {!current.primary && current.status === "active" ? <PrimaryButton label="השבתת משתמש" disabled={busy} onPress={() => void setStatus("disabled")} /> : null}
      {!current.primary && current.status !== "active" ? <PrimaryButton label="הפעלת משתמש" disabled={busy} onPress={() => void setStatus("active")} /> : null}
    </Page>
  );
}

function NewUser() {
  const fonts = useFontSet();
  const { storeId } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [areas, setAreas] = useState<string[]>([]);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const options = Object.entries(ACCESS_AREA_LABEL);
  async function submit() {
    if (!storeId || busy) return;
    setBusy(true);
    setProblem("");
    try {
      await addUser(storeId, { name: name.trim(), email: email.trim(), password, role: role.trim(), areas });
      setDone(true);
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "לא הצלחנו להוסיף את המשתמש.");
    } finally {
      setBusy(false);
    }
  }
  if (done) return <EmptyState text="המשתמש נוסף." />;
  return (
    <Page>
      <Field label="שם" value={name} onChange={setName} />
      <Field label="אימייל" value={email} onChange={setEmail} />
      <Field label="סיסמה" value={password} onChange={setPassword} secure />
      <Field label="שם התפקיד" value={role} onChange={setRole} />
      <View style={{ gap: 8 }}>
        {options.map(([key, label]) => {
          const on = areas.includes(key);
          return (
            <Pressable key={key} onPress={() => setAreas((current) => on ? current.filter((item) => item !== key) : [...current, key])} style={[cardShadow, { padding: 14 }]}>
              <AppText style={{ fontFamily: on ? fonts.semibold : fonts.regular }}>{on ? `נבחר · ${label}` : label}</AppText>
            </Pressable>
          );
        })}
      </View>
      {problem ? <ErrorNote text={problem} /> : null}
      <PrimaryButton label="הוספת משתמש" disabled={busy} onPress={() => void submit()} />
    </Page>
  );
}

function Field({ label, value, onChange, secure = false }: { label: string; value: string; onChange: (value: string) => void; secure?: boolean }) {
  const fonts = useFontSet();
  return (
    <View style={{ gap: 6 }}>
      <AppText style={{ fontSize: 13 }}>{label}</AppText>
      <TextInput
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        autoCapitalize="none"
        style={{ height: 44, borderRadius: 8, borderWidth: 1, borderColor: tokens.fieldBorder, backgroundColor: "#fff", paddingHorizontal: 12, textAlign: "right", fontFamily: fonts.regular, color: tokens.ink }}
      />
    </View>
  );
}
