import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { Icon } from "@/components/icon";
import { DetailScreen } from "@/components/detail";
import { SheetEmpty } from "@/components/shell";
import { AppText, ErrorNote, LoadingBlock, PrimaryButton } from "@/components/ui";
import { formatCount } from "@/lib/format";
import {
  BASIC_PATHS,
  PAGE_CHOICES,
  copyPopup,
  deviceLabel,
  frequencyLabel,
  localDateValue,
  pagesSummary,
  parseLocalDate,
  popupStatusLabel,
  triggerSummary,
  type PopupDevice,
  type PopupFrequency,
  type PopupPages,
  type PopupRecord,
  type PopupStatus,
  type PopupTrigger,
} from "@/lib/popups";
import { loadPopups, loadQuiz, savePopupSettings, useStoreCall } from "@/lib/remote";
import { useSession } from "@/lib/session";
import { useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, tokens } from "@/theme/tokens";

const PAGE = "#f6f6f7";
const CARD = "#ffffff";
const LINE = "#ececec";
const MUTED = "#8a8a8a";

const TRIGGERS: { id: PopupTrigger; title: string; hint: string }[] = [
  { id: "immediate", title: "מיד", hint: "ברגע שנכנסים לעמוד" },
  { id: "delay", title: "אחרי המתנה", hint: "כמה שניות אחרי הכניסה" },
  { id: "scroll", title: "אחרי גלילה", hint: "כשמגיעים לעומק בעמוד" },
  { id: "exit", title: "לפני יציאה", hint: "כשהעכבר עוזב למעלה" },
];

const FREQUENCIES: { id: PopupFrequency; hint: string }[] = [
  { id: "always", hint: "שוב בכל מעבר עמוד" },
  { id: "session", hint: "פעם אחת בכל ביקור" },
  { id: "day", hint: "פעם ביום" },
  { id: "once", hint: "פעם אחת, ולא שוב" },
];

const DEVICES: { id: PopupDevice; label: string; hint: string }[] = [
  { id: "all", label: "כולם", hint: "מחשב וטלפון" },
  { id: "desktop", label: "מחשב", hint: "מסך רחב" },
  { id: "mobile", label: "טלפון", hint: "מסך צר" },
];

const STATUSES: PopupStatus[] = ["active", "paused", "draft"];

function statusTone(status: string) {
  if (status === "active") return { backgroundColor: tokens.activeBg, color: tokens.activeText };
  if (status === "paused") return { backgroundColor: tokens.payPendingBg, color: tokens.payPendingText };
  return { backgroundColor: tokens.neutralBg, color: tokens.inkSoft };
}

function Pill({ status, label }: { status: string; label: string }) {
  const fonts = useFontSet();
  const tone = statusTone(status);
  return (
    <View style={{ alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: tone.backgroundColor }}>
      <AppText style={{ fontFamily: fonts.semibold, fontSize: 12, color: tone.color }}>{label}</AppText>
    </View>
  );
}

function SectionTitle({ text }: { text: string }) {
  const fonts = useFontSet();
  return <AppText style={{ fontFamily: fonts.bold, fontSize: 18, color: tokens.inkStrong }}>{text}</AppText>;
}

function Card({ children }: { children: ReactNode }) {
  return <View style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 16, gap: 12 }}>{children}</View>;
}

function Option({ title, hint, on, onPress }: { title: string; hint?: string; on: boolean; onPress: () => void }) {
  const fonts = useFontSet();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: "48.5%",
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: CARD,
        borderWidth: 1.5,
        borderColor: on ? tokens.inkStrong : "#e3e3e3",
        opacity: pressed ? 0.7 : 1,
        gap: 2,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {on ? <Icon name="check" size={14} color={tokens.inkStrong} strokeWidth={2.2} /> : null}
        <AppText style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: tokens.inkStrong }}>{title}</AppText>
      </View>
      {hint ? <AppText style={{ fontSize: 12, lineHeight: 16, color: MUTED }}>{hint}</AppText> : null}
    </Pressable>
  );
}

function Stepper({ label, value, text, min, max, step, onChange }: { label: string; value: number; text: string; min: number; max: number; step: number; onChange: (value: number) => void }) {
  const fonts = useFontSet();
  return (
    <View style={{ borderRadius: 14, backgroundColor: PAGE, paddingHorizontal: 12, paddingVertical: 12, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <AppText style={{ flex: 1, fontSize: 14, color: tokens.inkStrong }}>{label}</AppText>
        <AppText style={{ fontFamily: fonts.semibold, fontSize: 14, color: tokens.inkStrong }}>{text}</AppText>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable onPress={() => onChange(Math.max(min, value - step))} style={stepStyle} accessibilityLabel="פחות">
          <AppText style={{ fontFamily: fonts.semibold, fontSize: 18, color: tokens.inkStrong }}>−</AppText>
        </Pressable>
        <Pressable onPress={() => onChange(Math.min(max, value + step))} style={stepStyle} accessibilityLabel="עוד">
          <AppText style={{ fontFamily: fonts.semibold, fontSize: 18, color: tokens.inkStrong }}>+</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const stepStyle = { width: 44, height: 36, borderRadius: 10, backgroundColor: CARD, borderWidth: 1, borderColor: "#e3e3e3", alignItems: "center" as const, justifyContent: "center" as const };

export function PopupsHome() {
  const fonts = useFontSet();
  const router = useRouter();
  const popups = useStoreCall(loadPopups);
  const quiz = useStoreCall(loadQuiz);
  const syncPopups = popups.sync;
  const syncQuiz = quiz.sync;
  const opened = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!opened.current) {
      opened.current = true;
      return;
    }
    void syncPopups();
    void syncQuiz();
  }, [syncPopups, syncQuiz]));
  const rows = popups.data ?? [];
  const quizRow = quiz.data;

  if (popups.loading && !popups.data) return <LoadingBlock />;

  return (
    <View style={{ flex: 1, backgroundColor: PAGE }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={popups.refreshing || quiz.refreshing} onRefresh={() => { void popups.refresh(); void quiz.refresh(); }} tintColor={tokens.inkStrong} colors={[tokens.inkStrong]} />}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: TAB_SPACE + 28 }}
      >
        {popups.error ? <ErrorNote text={popups.error} /> : null}
        <SectionTitle text="פופאפים" />
        {rows.length === 0 && !popups.error ? (
          <View style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE, paddingHorizontal: 24, paddingVertical: 28, alignItems: "center", gap: 8 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: "#f3f3f3", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
              <Icon name="layers" size={24} color={tokens.inkStrong} strokeWidth={1.6} />
            </View>
            <AppText style={{ fontFamily: fonts.bold, fontSize: 17, color: tokens.inkStrong, textAlign: "center" }}>אין פופאפים עדיין</AppText>
            <AppText style={{ color: tokens.inkSecondary, fontSize: 14, lineHeight: 20, textAlign: "center" }}>חלון שקופץ למבקרים באתר. פופאפ חדש מוסיפים בעורך של האתר, עם הכפתור + למעלה.</AppText>
          </View>
        ) : rows.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => router.push(`/more/area/popups/${encodeURIComponent(item.id)}` as Href)}
            style={({ pressed }) => ({ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE, paddingHorizontal: 16, paddingVertical: 14, gap: 8, opacity: pressed ? 0.7 : 1 })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <AppText style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: tokens.inkStrong }} numberOfLines={1}>{item.name}</AppText>
              <Icon name="forward" size={16} color="#c4c4c4" strokeWidth={2} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pill status={item.status} label={popupStatusLabel(item.status)} />
              <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }}>{`${formatCount(item.leads)} לידים`}</AppText>
            </View>
            <AppText style={{ color: MUTED, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>{[pagesSummary(item.pages), triggerSummary(item)].join(" · ")}</AppText>
          </Pressable>
        ))}

        <View style={{ gap: 8, marginTop: 8 }}>
          <SectionTitle text="שאלון" />
          <AppText style={{ color: tokens.inkSoft, fontSize: 14, lineHeight: 20 }}>השאלון של 5% הנחה בדף הבית.</AppText>
        </View>
        {quiz.loading && !quizRow ? <LoadingBlock /> : null}
        {quiz.error ? <ErrorNote text={quiz.error} /> : null}
        {quizRow ? (
          <Pressable
            onPress={() => router.push("/more/area/popups/quiz" as Href)}
            style={({ pressed }) => ({ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE, paddingHorizontal: 16, paddingVertical: 14, gap: 8, opacity: pressed ? 0.7 : 1 })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <AppText style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: tokens.inkStrong }} numberOfLines={1}>שאלון 5% הנחה</AppText>
              <Icon name="forward" size={16} color="#c4c4c4" strokeWidth={2} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pill status={quizRow.status === "active" ? "active" : "draft"} label={quizRow.status === "active" ? "פעיל" : "טיוטה"} />
              <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }}>{`${quizRow.flow.questions.length} שאלות`}</AppText>
            </View>
            {quizRow.flow.introTitle.trim() ? <AppText style={{ color: MUTED, fontSize: 13 }} numberOfLines={1}>{quizRow.flow.introTitle.split("\n")[0]}</AppText> : null}
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

export function PopupEditor({ id }: { id: string }) {
  const fonts = useFontSet();
  const { storeId } = useSession();
  const { snapshot } = useStoreData();
  const remote = useStoreCall(loadPopups);
  const item = remote.data?.find((popup) => popup.id === id) ?? null;
  const [draft, setDraft] = useState<PopupRecord | null>(null);
  const [seen, setSeen] = useState("");
  const [startText, setStartText] = useState("");
  const [endText, setEndText] = useState("");
  const [datesOpen, setDatesOpen] = useState(false);
  const [kind, setKind] = useState<"product" | "article" | "event">("product");
  const [query, setQuery] = useState("");
  const [problem, setProblem] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  if (item && item.id !== seen) {
    setDraft(copyPopup(item));
    setSeen(item.id);
    setStartText(localDateValue(item.startsAt));
    setEndText(localDateValue(item.endsAt));
    setDatesOpen(Boolean(item.startsAt || item.endsAt));
  }

  const catalog = useMemo(() => {
    const products = (snapshot?.products ?? []).flatMap((product) => {
      if (!product.title) return [];
      const key = product.handle?.trim() || product.id;
      return [{ id: product.id, title: product.title, path: `/product/${encodeURIComponent(key)}`, active: product.status === "active" }];
    });
    const posts = (snapshot?.posts ?? []).filter((post) => post.visible && post.handle && post.title);
    const articles = posts.filter((post) => !(post.blog ?? "").includes("אירוע")).map((post) => ({ id: post.id, title: post.title ?? "", path: `/articles/${post.handle}` }));
    const events = posts.filter((post) => (post.blog ?? "").includes("אירוע")).map((post) => ({ id: post.id, title: post.title ?? "", path: `/events/${post.handle}` }));
    return { products, articles, events };
  }, [snapshot]);

  function titleFor(path: string) {
    return catalog.products.find((page) => page.path === path)?.title
      ?? catalog.articles.find((page) => page.path === path)?.title
      ?? catalog.events.find((page) => page.path === path)?.title
      ?? path;
  }

  function change(next: Partial<PopupRecord>) {
    setDraft((current) => (current ? { ...current, ...next } : current));
    setProblem("");
    setSaved("");
  }

  function changePages(next: Partial<PopupPages>) {
    setDraft((current) => (current ? { ...current, pages: { ...current.pages, ...next } } : current));
    setProblem("");
    setSaved("");
  }

  function togglePath(path: string) {
    setDraft((current) => {
      if (!current) return current;
      const has = current.pages.paths.includes(path);
      const paths = has ? current.pages.paths.filter((entry) => entry !== path) : [...current.pages.paths, path].slice(0, 20);
      return { ...current, pages: { ...current.pages, paths } };
    });
    setProblem("");
    setSaved("");
  }

  async function save() {
    if (!draft || !storeId || busy) return;
    let startsAt: string | null;
    let endsAt: string | null;
    try {
      startsAt = parseLocalDate(startText);
      endsAt = parseLocalDate(endText);
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "התאריך לא תקין");
      return;
    }
    const next = { ...draft, name: draft.name.trim().slice(0, 80), startsAt, endsAt };
    setBusy(true);
    setProblem("");
    setSaved("");
    try {
      await savePopupSettings(storeId, next);
      setDraft(copyPopup(next));
      setSaved("נשמר");
      await remote.sync();
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "לא הצלחנו לשמור את הפופאפ.");
    } finally {
      setBusy(false);
    }
  }

  if (remote.loading && !item) return <DetailScreen title="פופאפ" scroll={false}><LoadingBlock /></DetailScreen>;
  if (remote.error && !item) return <DetailScreen title="פופאפ" scroll={false}><ErrorNote text={remote.error} /></DetailScreen>;
  if (!item) return <DetailScreen title="פופאפ" scroll={false}><SheetEmpty text="הפופאפ לא נמצא." /></DetailScreen>;
  if (!draft || draft.id !== item.id) return <DetailScreen title="פופאפ" scroll={false}><LoadingBlock /></DetailScreen>;

  const pages = draft.pages;
  const picked = pages.paths.filter((path) => !BASIC_PATHS.includes(path as (typeof BASIC_PATHS)[number]));
  const sitePages = kind === "product" ? catalog.products.filter((page) => page.active) : kind === "article" ? catalog.articles : catalog.events;
  const needle = query.trim().toLowerCase();
  const shown = sitePages.filter((page) => !needle || page.title.toLowerCase().includes(needle)).slice(0, 12);

  return (
    <DetailScreen title={draft.name.trim() || "פופאפ"} scroll={false}>
      <ScrollView style={{ flex: 1, backgroundColor: PAGE }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: TAB_SPACE + 28 }}>
        <Card>
          <TextInput
            value={draft.name}
            onChangeText={(name) => change({ name })}
            placeholder="שם הפופאפ"
            placeholderTextColor={MUTED}
            style={{ fontFamily: fonts.bold, fontSize: 22, color: tokens.inkStrong, textAlign: "right", writingDirection: "rtl", padding: 0 }}
          />
          <AppText style={{ color: MUTED, fontSize: 13, lineHeight: 18 }}>העיצוב של החלון נערך בעורך של האתר. כאן משנים איפה הוא מופיע ומתי.</AppText>
          <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }}>{`${formatCount(draft.leads)} לידים`}</AppText>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {STATUSES.map((status) => {
              const on = draft.status === status;
              return (
                <Pressable key={status} onPress={() => change({ status })} style={{ flex: 1, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: on ? tokens.inkStrong : PAGE }}>
                  <AppText style={{ fontFamily: fonts.semibold, fontSize: 13, color: on ? "#ffffff" : tokens.inkStrong }}>{popupStatusLabel(status)}</AppText>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Card>
          <AppText style={{ fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }}>איפה זה מופיע</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Option title="כל האתר" hint="בכל עמוד שהמבקר פותח" on={pages.all} onPress={() => changePages({ all: true })} />
            <Option title="עמודים שאני בוחר" hint="אזור באתר, או עמוד אחד" on={!pages.all} onPress={() => changePages({ all: false })} />
          </View>
          {pages.all ? <AppText style={{ color: tokens.inkSecondary, fontSize: 14 }}>החלון יכול להופיע בכל עמוד באתר.</AppText> : (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {PAGE_CHOICES.map((choice) => {
                  const on = choice.flag ? pages[choice.flag] : pages.paths.includes(choice.path ?? "");
                  return (
                    <Option
                      key={choice.id}
                      title={choice.label}
                      hint={choice.hint}
                      on={on}
                      onPress={() => (choice.flag ? changePages({ [choice.flag]: !pages[choice.flag] }) : togglePath(choice.path ?? ""))}
                    />
                  );
                })}
              </View>
              <AppText style={{ fontFamily: fonts.semibold, fontSize: 15, color: tokens.inkStrong }}>עמוד מסוים</AppText>
              <AppText style={{ color: MUTED, fontSize: 12, lineHeight: 16 }}>אפשר לבחור כמה. למשל רק מוצר אחד, או מאמר אחד, או אירוע אחד.</AppText>
              {picked.length ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {picked.map((path) => (
                    <Pressable key={path} onPress={() => togglePath(path)} style={{ borderRadius: 999, backgroundColor: tokens.inkStrong, paddingHorizontal: 12, paddingVertical: 6 }}>
                      <AppText style={{ color: "#ffffff", fontFamily: fonts.semibold, fontSize: 12 }} numberOfLines={1}>{`${titleFor(path)}  ×`}</AppText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <View style={{ flexDirection: "row", backgroundColor: "#f3f3f3", borderRadius: 999, padding: 3 }}>
                {([
                  ["product", "מוצרים"],
                  ["article", "מאמרים"],
                  ["event", "אירועים"],
                ] as const).map(([id, label]) => {
                  const on = kind === id;
                  return (
                    <Pressable key={id} onPress={() => { setKind(id); setQuery(""); }} style={{ flex: 1, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: on ? CARD : "transparent" }}>
                      <AppText style={{ fontFamily: fonts.semibold, fontSize: 13, color: on ? tokens.inkStrong : tokens.inkSecondary }}>{label}</AppText>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={kind === "product" ? "חיפוש מוצר" : kind === "article" ? "חיפוש מאמר" : "חיפוש אירוע"}
                placeholderTextColor={MUTED}
                style={{ height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#e3e3e3", paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 14, color: tokens.inkStrong, textAlign: "right", writingDirection: "rtl" }}
              />
              {shown.length === 0 ? <AppText style={{ color: tokens.inkSecondary, fontSize: 14 }}>{kind === "event" ? "אין עדיין אירועים באתר." : "אין תוצאות."}</AppText> : shown.map((page) => {
                const on = pages.paths.includes(page.path);
                return (
                  <Pressable key={page.id} onPress={() => togglePath(page.path)} style={{ minHeight: 42, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: on ? tokens.inkStrong : PAGE }}>
                    <AppText style={{ flex: 1, fontSize: 14, color: on ? "#ffffff" : tokens.inkStrong }} numberOfLines={1}>{page.title}</AppText>
                    <AppText style={{ fontSize: 12, color: on ? "rgba(255,255,255,0.75)" : MUTED }}>{on ? "נבחר" : "בחירה"}</AppText>
                  </Pressable>
                );
              })}
            </>
          )}
        </Card>

        <Card>
          <AppText style={{ fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }}>מתי הוא נפתח</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {TRIGGERS.map((choice) => (
              <Option key={choice.id} title={choice.title} hint={choice.hint} on={draft.trigger === choice.id} onPress={() => change({ trigger: choice.id })} />
            ))}
          </View>
          {draft.trigger === "immediate" ? <AppText style={{ color: tokens.inkSecondary, fontSize: 14 }}>החלון מופיע ברגע שהעמוד נטען.</AppText> : null}
          {draft.trigger === "delay" ? (
            <Stepper label="שניות אחרי הכניסה לעמוד" min={0} max={180} step={1} value={draft.delaySeconds} text={draft.delaySeconds === 0 ? "מיד" : `${draft.delaySeconds} שניות`} onChange={(delaySeconds) => change({ delaySeconds })} />
          ) : null}
          {draft.trigger === "scroll" ? (
            <Stepper label="כמה מהעמוד צריך לגלול" min={5} max={100} step={5} value={draft.scrollPercent} text={`${draft.scrollPercent}%`} onChange={(scrollPercent) => change({ scrollPercent })} />
          ) : null}
          {draft.trigger === "exit" ? (
            <>
              <AppText style={{ color: tokens.inkSecondary, fontSize: 14, lineHeight: 20 }}>במחשב החלון נפתח כשהעכבר יוצא מהחלק העליון. בטלפון הוא נפתח אחרי ההמתנה.</AppText>
              <Stepper label="בטלפון, אחרי כמה שניות" min={0} max={180} step={1} value={draft.delaySeconds} text={draft.delaySeconds === 0 ? "מיד" : `${draft.delaySeconds} שניות`} onChange={(delaySeconds) => change({ delaySeconds })} />
            </>
          ) : null}
        </Card>

        <Card>
          <AppText style={{ fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }}>כל כמה זמן</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {FREQUENCIES.map((choice) => (
              <Option key={choice.id} title={frequencyLabel(choice.id)} hint={choice.hint} on={draft.frequency === choice.id} onPress={() => change({ frequency: choice.id })} />
            ))}
          </View>
          <AppText style={{ fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }}>באיזה מסך</AppText>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {DEVICES.map((choice) => {
              const on = draft.device === choice.id;
              return (
                <Pressable key={choice.id} onPress={() => change({ device: choice.id })} style={{ flex: 1, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 12, borderWidth: 1.5, borderColor: on ? tokens.inkStrong : "#e3e3e3", backgroundColor: CARD, gap: 2 }}>
                  <AppText style={{ fontFamily: fonts.semibold, fontSize: 14, color: tokens.inkStrong, textAlign: "center" }}>{choice.label}</AppText>
                  <AppText style={{ fontSize: 11, color: MUTED, textAlign: "center" }}>{choice.hint}</AppText>
                </Pressable>
              );
            })}
          </View>
          <AppText style={{ color: MUTED, fontSize: 12 }}>{deviceLabel(draft.device)}</AppText>
        </Card>

        <View style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE }}>
          <Pressable onPress={() => setDatesOpen((open) => !open)} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 14 }}>
            <AppText style={{ fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }}>תאריכים</AppText>
            <AppText style={{ flex: 1, fontSize: 13, color: MUTED }}>{startText.trim() || endText.trim() ? "מוגבל" : "בלי הגבלה"}</AppText>
            <Icon name="down" size={16} color={MUTED} strokeWidth={2} />
          </Pressable>
          {datesOpen ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>
              <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>התחלה</AppText>
              <TextInput value={startText} onChangeText={(value) => { setStartText(value); setProblem(""); setSaved(""); }} placeholder="2026-10-27 18:00" placeholderTextColor={MUTED} style={dateField} />
              <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>סיום</AppText>
              <TextInput value={endText} onChangeText={(value) => { setEndText(value); setProblem(""); setSaved(""); }} placeholder="2026-10-27 18:00" placeholderTextColor={MUTED} style={dateField} />
              <AppText style={{ fontSize: 12, color: MUTED }}>ריק אומר שהחלון לא מוגבל בתאריך.</AppText>
            </View>
          ) : null}
        </View>

        {problem ? <AppText style={{ color: tokens.negative, fontSize: 13, lineHeight: 18 }}>{problem}</AppText> : null}
        {saved ? <AppText style={{ color: tokens.positive, fontSize: 13 }}>{saved}</AppText> : null}
        <PrimaryButton label={busy ? "שומרים..." : "שמירה"} disabled={busy} onPress={() => void save()} />
      </ScrollView>
    </DetailScreen>
  );
}

const dateField = { height: 42, borderRadius: 10, borderWidth: 1, borderColor: "#e3e3e3", paddingHorizontal: 12, fontSize: 15, color: tokens.inkStrong, textAlign: "left" as const, writingDirection: "ltr" as const };
