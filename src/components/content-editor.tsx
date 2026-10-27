import { useCallback, useRef, useState, type ReactNode } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View, type TextStyle } from "react-native";
import { useRouter, type Href } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/icon";
import { useStatusBar } from "@/components/shell";
import { AppText, EmptyState, ErrorNote, LoadingBlock } from "@/components/ui";
import {
  BLOGS,
  EVENT_STATUSES,
  TEMPLATES,
  blankEvent,
  deleteBlogPost,
  deleteStoreEvent,
  eventProblem,
  loadBlogPosts,
  loadStoreEvent,
  saveBlogPost,
  saveStoreEvent,
  uploadContentImage,
  type BlogPost,
  type EventStatus,
  type StoreEvent,
} from "@/lib/content";
import { useStoreCall } from "@/lib/remote";
import { useSession } from "@/lib/session";
import { useAllowed, useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, tokens } from "@/theme/tokens";

const PAGE = "#f6f6f6";
const BORDER = "#c9c9c9";

function slugify(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]+/gu, "").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function latinSlug(title: string, date: string) {
  const latin = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return latin || (date ? `event-${date}` : "");
}

function displayDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

function dateFromPost(value: string) {
  const trimmed = value.trim();
  const dotted = /(\d{1,2})[./](\d{1,2})[./](\d{2,4})/.exec(trimmed);
  if (dotted) {
    const year = dotted[3].length === 2 ? 2000 + Number(dotted[3]) : Number(dotted[3]);
    return new Date(year, Number(dotted[2]) - 1, Number(dotted[1]), 12, 0, 0, 0);
  }
  return dateFromIso(trimmed.slice(0, 10));
}

function postedDate(line: string) {
  const match = /(\d{1,2})[./](\d{1,2})[./](\d{2,4})/.exec(line);
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${match[1].padStart(2, "0")}.${match[2].padStart(2, "0")}.${year}`;
  }
  const glued = /^עודכן:?\s*(\d{2})(\d{2})\.(\d{4})$/.exec(line.trim());
  return glued ? `${glued[1]}.${glued[2]}.${glued[3]}` : "";
}

function isByline(line: string) {
  const text = line.trim();
  if (!text || text.length > 180 || /[?？]$/.test(text)) return false;
  if (/^(?:מאת[:\s]+|אני )/.test(text)) return true;
  if (/פרופ|ד[״"']ר|מיילדת|פיזיותרפיסט|גינקולוג|יועצת |יועץ |אחות |מנהלת |מנהל |רופא|נטע צמח|אוסטאופת|נטורופת|IBCLC|מדריכ/.test(text)) return true;
  return /(?:^|[^\u0590-\u05FF])דולה/.test(text);
}

function isAuthorName(line: string) {
  const text = line.trim();
  const words = text.split(/\s+/);
  return /^[\u0590-\u05FF"'׳\- ]{2,40}$/.test(text) && words.length >= 2 && words.length <= 4;
}

function hydratePost(post: BlogPost): BlogPost {
  if (post.author.trim() && post.updated.trim()) return post;
  const lines = post.body.split("\n");
  let dateAt = -1;
  const limit = Math.min(lines.length, 30);
  for (let index = 0; index < limit; index += 1) {
    if (lines[index].trim().startsWith("עודכן") && postedDate(lines[index])) {
      dateAt = index;
      break;
    }
  }
  if (dateAt < 0) return post;
  const updated = post.updated.trim() || postedDate(lines[dateAt]);
  const parts: string[] = [];
  const drop = new Set<number>();
  if (!post.updated.trim()) drop.add(dateAt);
  let sawByline = false;
  for (let index = dateAt - 1; index >= Math.max(0, dateAt - 6); index -= 1) {
    const text = lines[index].trim();
    if (!text) continue;
    if (isByline(text)) {
      parts.unshift(text);
      sawByline = true;
      if (!post.author.trim()) drop.add(index);
      continue;
    }
    if (isAuthorName(text) && sawByline) {
      parts.unshift(text);
      if (!post.author.trim()) drop.add(index);
    }
    break;
  }
  sawByline = false;
  for (let index = dateAt + 1; index < Math.min(lines.length, dateAt + 6); index += 1) {
    const text = lines[index].trim();
    if (!text) continue;
    if (isAuthorName(text) && !sawByline) {
      const next = lines.slice(index + 1, index + 3).find((line) => line.trim());
      if (next && isByline(next)) {
        parts.push(text);
        if (!post.author.trim()) drop.add(index);
        continue;
      }
    }
    if (isByline(text)) {
      parts.push(text);
      sawByline = true;
      if (!post.author.trim()) drop.add(index);
      continue;
    }
    break;
  }
  const author = post.author.trim() || parts.join(" · ");
  if (!author && updated === post.updated.trim()) return post;
  const body = lines.filter((_, index) => !drop.has(index)).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { ...post, author, updated, body };
}

function postDateFromDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

function dateFromIso(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0, 0);
}

function isoFromDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function dateFromClock(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const date = new Date();
  date.setHours(match ? Number(match[1]) : 20, match ? Number(match[2]) : 0, 0, 0);
  return date;
}

function clockFromDate(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function blankPost(): BlogPost {
  return {
    id: "",
    title: "",
    excerpt: "",
    body: "",
    author: "",
    updated: "",
    blog: BLOGS[0] ?? "חדשות",
    visible: false,
    tags: [],
    seoTitle: "",
    seoDescription: "",
    handle: "",
    template: TEMPLATES[0] ?? "פוסט בלוג ברירת מחדל",
    image: "",
  };
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

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const fonts = useFontSet();
  return (
    <View style={{ gap: 6 }}>
      <AppText style={{ fontFamily: fonts.semibold, fontSize: 13, color: tokens.inkStrong }}>{label}</AppText>
      {children}
      {hint ? <AppText style={{ fontSize: 12, lineHeight: 18, color: tokens.inkSecondary }}>{hint}</AppText> : null}
    </View>
  );
}

function inputStyle(fontFamily: string, multiline: boolean, ltr: boolean, tall: boolean, grow: boolean): TextStyle {
  return {
    minHeight: multiline ? (grow ? 48 : tall ? 220 : 96) : 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: multiline ? 12 : 0,
    fontFamily,
    fontSize: 16,
    lineHeight: grow ? 22 : undefined,
    color: tokens.inkStrong,
    textAlign: ltr ? "left" : "right",
    writingDirection: ltr ? "ltr" : "rtl",
  };
}

function Entry({
  value,
  onChange,
  placeholder,
  multiline = false,
  ltr = false,
  maxLength,
  keyboard,
  tall = false,
  grow = false,
  onSelection,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  ltr?: boolean;
  maxLength?: number;
  keyboard?: "default" | "numeric";
  tall?: boolean;
  grow?: boolean;
  onSelection?: (start: number, end: number) => void;
}) {
  const fonts = useFontSet();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#8a8a8a"
      multiline={multiline}
      scrollEnabled={!grow}
      maxLength={maxLength}
      keyboardType={keyboard === "numeric" ? "number-pad" : "default"}
      textAlignVertical={multiline ? "top" : "center"}
      onSelectionChange={onSelection ? (event) => onSelection(event.nativeEvent.selection.start, event.nativeEvent.selection.end) : undefined}
      style={inputStyle(fonts.regular, multiline, ltr, tall, grow)}
    />
  );
}

function Radio({ on, label, hint, onPress }: { on: boolean; label: string; hint?: string; onPress: () => void }) {
  const fonts = useFontSet();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 7 }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: on ? 6 : 1.5, borderColor: on ? tokens.inkStrong : "#8a8a8a", marginTop: 1 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={{ fontFamily: on ? fonts.semibold : fonts.regular, fontSize: 15, color: tokens.inkStrong }}>{label}</AppText>
        {hint ? <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>{hint}</AppText> : null}
      </View>
    </Pressable>
  );
}

function Pills({ options, value, onChange }: { options: string[]; value: string; onChange: (value: string) => void }) {
  const fonts = useFontSet();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((option) => {
        const on = option === value;
        return (
          <Pressable key={option} onPress={() => onChange(option)} style={{ minHeight: 34, borderRadius: 8, paddingHorizontal: 12, justifyContent: "center", backgroundColor: on ? tokens.inkStrong : tokens.field }}>
            <AppText style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 14, color: on ? "#fff" : tokens.inkStrong }}>{option}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function ImageWell({
  uri,
  busy,
  hint,
  onPick,
  onClear,
}: {
  uri: string;
  busy: boolean;
  hint: string;
  onPick: () => void;
  onClear: () => void;
}) {
  const fonts = useFontSet();
  return (
    <View style={{ gap: 8 }}>
      <AppText style={{ fontSize: 12, lineHeight: 18, color: tokens.inkSecondary }}>{hint}</AppText>
      {uri ? (
        <View style={{ borderRadius: 12, overflow: "hidden", backgroundColor: tokens.field }}>
          <Image source={{ uri }} style={{ width: "100%", height: 180 }} resizeMode="cover" accessibilityIgnoresInvertColors />
          <View style={{ flexDirection: "row", gap: 8, padding: 10 }}>
            <Pressable onPress={onPick} disabled={busy} style={{ height: 34, borderRadius: 8, paddingHorizontal: 12, justifyContent: "center", backgroundColor: "#fff" }}>
              <AppText style={{ fontFamily: fonts.semibold, fontSize: 13 }}>{busy ? "מעלה…" : "החלפה"}</AppText>
            </Pressable>
            <Pressable onPress={onClear} disabled={busy} style={{ height: 34, borderRadius: 8, paddingHorizontal: 12, justifyContent: "center", backgroundColor: "#fff" }}>
              <AppText style={{ fontFamily: fonts.semibold, fontSize: 13 }}>הסרה</AppText>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable onPress={onPick} disabled={busy} style={{ height: 120, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#c9c9c9", backgroundColor: "#fafafa", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Icon name="image" size={22} color="#b5b5b5" strokeWidth={1.6} />
          <AppText style={{ fontFamily: fonts.semibold, fontSize: 14, color: tokens.inkStrong }}>{busy ? "מעלה…" : "הוספת תמונה"}</AppText>
        </Pressable>
      )}
    </View>
  );
}

function WhenButton({ value, placeholder, onPress }: { value: string; placeholder: string; onPress: () => void }) {
  const fonts = useFontSet();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: BORDER, backgroundColor: "#fff", paddingHorizontal: 12, justifyContent: "center" }}>
      <AppText style={{ fontFamily: fonts.regular, fontSize: 16, color: value ? tokens.inkStrong : "#8a8a8a", textAlign: "right", writingDirection: "ltr" }}>{value || placeholder}</AppText>
    </Pressable>
  );
}

function AppleWhen({ mode, value, disabled, onChange }: { mode: "date" | "time"; value: Date; disabled: boolean; onChange: (date: Date) => void }) {
  const [open, setOpen] = useState(false);
  if (Platform.OS === "ios") {
    return (
      <View pointerEvents={disabled ? "none" : "auto"} style={{ alignItems: "flex-start", opacity: disabled ? 0.45 : 1 }}>
        <DateTimePicker
          value={value}
          mode={mode}
          display="compact"
          locale="he-IL"
          themeVariant="light"
          accentColor={tokens.inkStrong}
          disabled={disabled}
          style={{ minHeight: 34 }}
          onValueChange={(_, date) => { if (date) onChange(date); }}
        />
      </View>
    );
  }
  const label = mode === "date" ? displayDate(isoFromDate(value)) : clockFromDate(value);
  return (
    <>
      <WhenButton value={label} placeholder={mode === "date" ? "DD/MM/YYYY" : "HH:MM"} onPress={() => { if (!disabled) setOpen(true); }} />
      {open && mode === "date" ? (
        <DateTimePicker value={value} mode="date" display="calendar" onValueChange={(_, date) => { onChange(date); setOpen(false); }} onDismiss={() => setOpen(false)} />
      ) : null}
      {open && mode === "time" ? (
        <DateTimePicker value={value} mode="time" display="clock" is24Hour onValueChange={(_, date) => { onChange(date); setOpen(false); }} onDismiss={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function EditorChrome({
  title,
  ready,
  busy,
  onBack,
  onSave,
  children,
}: {
  title: string;
  ready: boolean;
  busy: boolean;
  onBack: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  useStatusBar("dark");
  const fonts = useFontSet();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: tokens.card }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 14, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable accessibilityLabel="חזרה" onPress={onBack} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: tokens.field, alignItems: "center", justifyContent: "center" }}>
          <Icon name="back" size={18} color={tokens.inkStrong} strokeWidth={1.8} />
        </Pressable>
        <AppText style={{ flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 17, color: tokens.inkStrong }} numberOfLines={1}>{busy ? "שומר…" : title}</AppText>
        <Pressable accessibilityLabel="שמירה" disabled={!ready} onPress={onSave} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: ready ? tokens.inkStrong : tokens.field, alignItems: "center", justifyContent: "center" }}>
          <Icon name="check" size={18} color={ready ? "#ffffff" : "#b5b5b5"} strokeWidth={2} />
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: PAGE }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: TAB_SPACE + insets.bottom + 28 }}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function useImageUpload(folder: "posts" | "events", onUrl: (url: string) => void, onProblem: (message: string) => void) {
  const { storeId } = useSession();
  const [busy, setBusy] = useState(false);
  async function pick() {
    if (!storeId || busy) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      onProblem("התמונה גדולה מ-5MB");
      return;
    }
    setBusy(true);
    try {
      onUrl(await uploadContentImage(storeId, folder, asset.uri, asset.mimeType ?? undefined));
    } catch (caught) {
      onProblem(caught instanceof Error ? caught.message : "העלאת התמונה נכשלה.");
    } finally {
      setBusy(false);
    }
  }
  return { busy, pick };
}

export function PostEditor({ id }: { id: string | null }) {
  const canWrite = useAllowed("content.update");
  const remote = useStoreCall(loadBlogPosts);
  const blogs = [...new Set([...(remote.data ?? []).map((post) => post.blog), ...BLOGS])];
  if (!id && !canWrite) return <EmptyState text="אין הרשאה להוסיף פוסט." />;
  if (id && remote.loading) return <LoadingBlock />;
  if (id && remote.error) return <ErrorNote text={remote.error} />;
  const post = id ? remote.data?.find((item) => item.id === id) ?? null : null;
  if (id && !post) return <EmptyState text="הפוסט לא נמצא." />;
  return <PostForm key={post?.id || "new"} post={post} blogs={blogs} canWrite={canWrite} />;
}

function PostForm({ post, blogs, canWrite }: { post: BlogPost | null; blogs: string[]; canWrite: boolean }) {
  const router = useRouter();
  const fonts = useFontSet();
  const { storeId } = useSession();
  const { refresh } = useStoreData();
  const [storedId, setStoredId] = useState(post?.id ?? "");
  const seeded = post ? hydratePost(post) : { ...blankPost(), updated: postDateFromDate(new Date()) };
  const [form, setForm] = useState<BlogPost>(seeded);
  const [baseline, setBaseline] = useState(() => JSON.stringify(seeded));
  const [tag, setTag] = useState("");
  const [seoOpen, setSeoOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selection = useRef({ start: 0, end: 0 });
  const dirty = JSON.stringify(form) !== baseline;
  const image = useImageUpload("posts", (url) => setForm((current) => ({ ...current, image: url })), setError);

  function leave() {
    if (!dirty || busy) {
      if (router.canGoBack()) router.back();
      else router.replace("/more/area/posts" as Href);
      return;
    }
    Alert.alert("לצאת בלי שמירה?", "השינויים שלא נשמרו יימחקו.", [
      { text: "המשך עריכה", style: "cancel" },
      { text: "יציאה", style: "destructive", onPress: () => router.back() },
    ]);
  }

  function patch(next: Partial<BlogPost>) {
    if (!canWrite) return;
    setForm((current) => ({ ...current, ...next }));
    setError("");
  }

  function changeTitle(title: string) {
    if (!canWrite) return;
    setForm((current) => {
      const auto = !current.handle || current.handle === slugify(current.title);
      return { ...current, title, handle: auto ? slugify(title) : current.handle };
    });
    setError("");
  }

  function wrap(marker: string) {
    if (!canWrite) return;
    const { start, end } = selection.current;
    setForm((current) => {
      const selected = current.body.slice(start, end) || "טקסט";
      return { ...current, body: `${current.body.slice(0, start)}${marker}${selected}${marker}${current.body.slice(end)}` };
    });
  }

  function heading() {
    if (!canWrite) return;
    const { start } = selection.current;
    setForm((current) => {
      const line = current.body.lastIndexOf("\n", Math.max(0, start - 1));
      const at = line < 0 ? 0 : line + 1;
      if (current.body.slice(at, at + 3) === "## ") return current;
      return { ...current, body: `${current.body.slice(0, at)}## ${current.body.slice(at)}` };
    });
  }

  function addTag() {
    const value = tag.trim();
    if (!value || form.tags.includes(value)) {
      setTag("");
      return;
    }
    patch({ tags: [...form.tags, value] });
    setTag("");
  }

  async function save() {
    if (!canWrite || !storeId || busy || image.busy) return;
    if (!form.title.trim()) {
      setError("יש להזין כותרת");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const savedId = await saveBlogPost(storeId, { ...form, id: storedId }, !storedId);
      const next = { ...form, id: savedId, title: form.title.trim() };
      setForm(next);
      setStoredId(savedId);
      setBaseline(JSON.stringify(next));
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "לא הצלחנו לשמור את הפוסט.");
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (!storedId || !storeId || busy) return;
    Alert.alert("מחיקת פוסט", `למחוק את "${form.title || "הפוסט"}"?`, [
      { text: "ביטול", style: "cancel" },
      {
        text: "מחיקה",
        style: "destructive",
        onPress: () => {
          setBusy(true);
          void deleteBlogPost(storeId, storedId)
            .then(() => refresh())
            .then(() => router.replace("/more/area/posts" as Href))
            .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "לא הצלחנו למחוק את הפוסט."))
            .finally(() => setBusy(false));
        },
      },
    ]);
  }

  const previewUrl = form.handle || slugify(form.title) || "post";
  const previewText = form.seoDescription || form.excerpt || form.body.replace(/[#*]/g, "").trim().slice(0, 155);
  const blogOptions = form.blog && !blogs.includes(form.blog) ? [form.blog, ...blogs] : blogs;

  return (
    <EditorChrome title={storedId ? form.title.trim() || "עריכת פוסט" : "פוסט חדש"} ready={canWrite && dirty && !busy && !image.busy} busy={busy} onBack={leave} onSave={() => void save()}>
      {error ? <ErrorNote text={error} /> : null}
      <Card>
        <Field label="כותרת">
          <Entry value={form.title} onChange={changeTitle} placeholder="לדוגמה: בלוג על המוצרים או המבצעים האחרונים שלכם" />
        </Field>
        <Field label="פסקה מתחת לכותרת" hint="מופיעה מתחת לכותרת, לפני המחבר.">
          <Entry value={form.excerpt} onChange={(excerpt) => patch({ excerpt })} placeholder="הפסקה שמופיעה מתחת לכותרת" multiline />
        </Field>
        <Field label="מחבר">
          <Entry value={form.author} onChange={(author) => patch({ author })} placeholder="שם המחבר" multiline grow />
        </Field>
        <Field label="תאריך">
          <AppleWhen mode="date" disabled={!canWrite} value={dateFromPost(form.updated)} onChange={(date) => patch({ updated: postDateFromDate(date) })} />
        </Field>
        <Field label="תמונה">
          <ImageWell uri={form.image} busy={image.busy} hint="מופיעה בראש הפוסט ובכרטיס ברשימה." onPick={() => { if (canWrite) void image.pick(); }} onClear={() => patch({ image: "" })} />
        </Field>
        <Field label="גוף המאמר" hint="סמנו טקסט ואז לחצו על מודגש או נטוי. שורה שמתחילה ב־## היא כותרת.">
          <View style={{ flexDirection: "row", gap: 6 }}>
            {[
              { label: "מודגש", run: () => wrap("**") },
              { label: "נטוי", run: () => wrap("*") },
              { label: "כותרת", run: heading },
            ].map((tool) => (
              <Pressable key={tool.label} onPress={tool.run} style={{ height: 32, borderRadius: 8, paddingHorizontal: 10, justifyContent: "center", backgroundColor: tokens.field }}>
                <AppText style={{ fontFamily: fonts.semibold, fontSize: 13, color: tokens.inkStrong }}>{tool.label}</AppText>
              </Pressable>
            ))}
          </View>
          <Entry
            value={form.body}
            onChange={(body) => patch({ body })}
            placeholder="כתבו את הפוסט כאן"
            multiline
            tall
            onSelection={(start, end) => { selection.current = { start, end }; }}
          />
        </Field>
      </Card>

      <Card title="רישום במנועי חיפוש">
        <Pressable onPress={() => setSeoOpen((open) => !open)} style={{ borderRadius: 12, borderWidth: 1, borderColor: BORDER, padding: 12, gap: 2 }}>
          <AppText style={{ fontSize: 13, color: tokens.inkSecondary, textAlign: "left", writingDirection: "ltr" }}>{`/blogs/${previewUrl}`}</AppText>
          <AppText style={{ fontSize: 16, color: tokens.link }} numberOfLines={2}>{form.seoTitle || form.title || "כותרת"}</AppText>
          <AppText style={{ fontSize: 13, lineHeight: 18, color: tokens.inkSoft }} numberOfLines={3}>{previewText || "הוסיפו כותרת ותיאור כדי לראות איך הפוסט יופיע בחיפוש"}</AppText>
        </Pressable>
        {seoOpen ? (
          <>
            <Field label="כותרת העמוד" hint={`${form.seoTitle.length} / 70`}>
              <Entry value={form.seoTitle} onChange={(seoTitle) => patch({ seoTitle: seoTitle.slice(0, 70) })} placeholder={form.title || "כותרת הפוסט"} maxLength={70} />
            </Field>
            <Field label="תיאור מטא" hint={`${form.seoDescription.length} / 160`}>
              <Entry value={form.seoDescription} onChange={(seoDescription) => patch({ seoDescription: seoDescription.slice(0, 160) })} placeholder="תיאור קצר שיופיע בתוצאת החיפוש" multiline maxLength={160} />
            </Field>
            <Field label="כתובת">
              <Entry value={form.handle} onChange={(handle) => patch({ handle })} placeholder="post" ltr />
            </Field>
          </>
        ) : null}
      </Card>

      <Card title="נראות">
        <Radio on={form.visible} label="גלוי" hint="הפוסט מופיע בחנות" onPress={() => patch({ visible: true })} />
        <Radio on={!form.visible} label="מוסתר" hint="הפוסט לא יוצג בחנות" onPress={() => patch({ visible: false })} />
      </Card>

      <Card title="ארגון">
        <Field label="בלוג">
          <Pills options={blogOptions} value={form.blog} onChange={(blog) => patch({ blog })} />
          <Entry value={form.blog} onChange={(blog) => patch({ blog })} placeholder="שם הבלוג" />
        </Field>
        <Field label="תגיות" hint="אנטר מוסיף תגית.">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {form.tags.map((item) => (
              <Pressable key={item} onPress={() => patch({ tags: form.tags.filter((tagItem) => tagItem !== item) })} style={{ minHeight: 30, borderRadius: 8, paddingHorizontal: 10, justifyContent: "center", backgroundColor: tokens.field }}>
                <AppText style={{ fontSize: 13, color: tokens.inkStrong }}>{`${item}  ×`}</AppText>
              </Pressable>
            ))}
          </View>
          <Entry value={tag} onChange={setTag} placeholder="הוספת תגית" />
          <Pressable onPress={addTag} style={{ alignSelf: "flex-start", height: 34, borderRadius: 8, paddingHorizontal: 12, justifyContent: "center", backgroundColor: tokens.field }}>
            <AppText style={{ fontFamily: fonts.semibold, fontSize: 13 }}>הוספת תגית</AppText>
          </Pressable>
        </Field>
        <Field label="תבנית ערכת נושא" hint="התבנית קובעת איך הפוסט נראה בחנות.">
          <Pills options={form.template && !TEMPLATES.includes(form.template) ? [form.template, ...TEMPLATES] : [...TEMPLATES]} value={form.template} onChange={(template) => patch({ template })} />
        </Field>
      </Card>

      {storedId && canWrite ? (
        <Pressable onPress={remove} disabled={busy} style={{ marginTop: 18, alignItems: "center" }}>
          <AppText style={{ color: tokens.negative, fontFamily: fonts.semibold, fontSize: 15 }}>מחיקת פוסט</AppText>
        </Pressable>
      ) : null}
    </EditorChrome>
  );
}

export function EventEditor({ id }: { id: string | null }) {
  const canWrite = useAllowed("content.update");
  const load = useCallback((storeId: string) => (id ? loadStoreEvent(storeId, id) : Promise.resolve(null)), [id]);
  const remote = useStoreCall(load);
  if (!id && !canWrite) return <EmptyState text="אין הרשאה להוסיף אירוע." />;
  if (id && remote.loading) return <LoadingBlock />;
  if (id && remote.error) return <ErrorNote text={remote.error} />;
  if (id && !remote.data) return <EmptyState text="האירוע לא נמצא." />;
  return <EventForm key={remote.data?.id || "new"} event={remote.data ?? blankEvent()} creating={!id} canWrite={canWrite} />;
}

function EventForm({ event, creating, canWrite }: { event: StoreEvent; creating: boolean; canWrite: boolean }) {
  const router = useRouter();
  const fonts = useFontSet();
  const { storeId } = useSession();
  const seeded = creating && !event.date ? { ...event, date: isoFromDate(new Date()) } : event;
  const [form, setForm] = useState(() => ({ ...seeded, paid: seeded.price > 0 }));
  const [baseline, setBaseline] = useState(() => JSON.stringify({ ...seeded, paid: seeded.price > 0 }));
  const [slugTouched, setSlugTouched] = useState(!creating);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(form) !== baseline;
  const image = useImageUpload("events", (url) => setForm((current) => ({ ...current, image: url })), setError);

  function leave() {
    if (!dirty || busy) {
      if (router.canGoBack()) router.back();
      else router.replace("/more/area/events" as Href);
      return;
    }
    Alert.alert("לצאת בלי שמירה?", "השינויים שלא נשמרו יימחקו.", [
      { text: "המשך עריכה", style: "cancel" },
      { text: "יציאה", style: "destructive", onPress: () => router.back() },
    ]);
  }

  function patch(next: Partial<StoreEvent>) {
    if (!canWrite) return;
    setForm((current) => {
      const merged = { ...current, ...next };
      if (!slugTouched && ("title" in next || "date" in next)) merged.slug = latinSlug(merged.title, merged.date);
      return merged;
    });
    setError("");
  }

  async function save() {
    if (!canWrite || !storeId || busy || image.busy) return;
    const next = { ...form, price: form.paid ? form.price : 0, slug: form.slug.trim().toLowerCase() };
    if (form.paid && next.price < 1) {
      setError("צריך מחיר");
      return;
    }
    const problem = eventProblem(next);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const savedId = await saveStoreEvent(storeId, next);
      const saved = { ...next, id: savedId };
      setForm(saved);
      setBaseline(JSON.stringify(saved));
      setSlugTouched(true);
      if (creating) router.replace(`/more/area/events/${encodeURIComponent(savedId)}` as Href);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "לא הצלחנו לשמור את האירוע.");
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    if (creating || !storeId || busy) return;
    Alert.alert("מחיקת אירוע", `למחוק את "${form.title || "האירוע"}"? גם ההרשמות יימחקו.`, [
      { text: "ביטול", style: "cancel" },
      {
        text: "מחיקה",
        style: "destructive",
        onPress: () => {
          setBusy(true);
          void deleteStoreEvent(storeId, form.id)
            .then(() => router.replace("/more/area/events" as Href))
            .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "לא הצלחנו למחוק את האירוע."))
            .finally(() => setBusy(false));
        },
      },
    ]);
  }

  return (
    <EditorChrome title={creating ? "אירוע חדש" : form.title.trim() || "אירוע"} ready={canWrite && dirty && !busy && !image.busy} busy={busy} onBack={leave} onSave={() => void save()}>
      {error ? <ErrorNote text={error} /> : null}
      <Card>
        <Field label="שם האירוע" hint={`${form.title.length} / 120`}>
          <Entry value={form.title} onChange={(title) => patch({ title })} placeholder="לדוגמה: סדנת הכנה ללידה" maxLength={120} />
        </Field>
        <Field label="תיאור קצר" hint={`${form.short.length} / 280 · מופיע בכרטיס האירוע`}>
          <Entry value={form.short} onChange={(short) => patch({ short })} placeholder="משפט או שניים על האירוע" multiline maxLength={280} />
        </Field>
        <Field label="תיאור מלא" hint="מופיע בעמוד האירוע. שורה ריקה מתחילה פסקה חדשה.">
          <Entry value={form.body} onChange={(body) => patch({ body })} placeholder={"מה עושים במפגש, למי הוא מתאים ומה כדאי להביא.\n\nפסקה נוספת אחרי שורה ריקה."} multiline tall />
        </Field>
      </Card>

      <Card title="תמונה">
        <ImageWell uri={form.image} busy={image.busy} hint="מופיעה בכרטיס ובראש עמוד האירוע. עד 5MB." onPick={() => { if (canWrite) void image.pick(); }} onClear={() => patch({ image: "" })} />
      </Card>

      <Card title="מתי">
        <Field label="תאריך">
          <AppleWhen mode="date" disabled={!canWrite} value={dateFromIso(form.date)} onChange={(date) => patch({ date: isoFromDate(date) })} />
        </Field>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="שעת התחלה">
              <AppleWhen mode="time" disabled={!canWrite} value={dateFromClock(form.from)} onChange={(date) => patch({ from: clockFromDate(date) })} />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="שעת סיום">
              <AppleWhen mode="time" disabled={!canWrite} value={dateFromClock(form.to)} onChange={(date) => patch({ to: clockFromDate(date) })} />
            </Field>
          </View>
        </View>
      </Card>

      <Card title="איפה">
        <Radio on={form.online} label="אונליין בזום" hint="הקישור נשלח במייל לנרשמות" onPress={() => patch({ online: true })} />
        <Radio on={!form.online} label="מפגש פרונטלי" hint="הכתובת מופיעה באתר ובמייל" onPress={() => patch({ online: false })} />
        {form.online ? (
          <Field label="קישור זום" hint="לא מוצג באתר. נשלח רק במייל האישור ובתזכורות.">
            <Entry value={form.zoomUrl} onChange={(zoomUrl) => patch({ zoomUrl })} placeholder="https://zoom.us/j/…" ltr />
          </Field>
        ) : (
          <Field label="כתובת" hint="רחוב, מספר ועיר.">
            <Entry value={form.address} onChange={(address) => patch({ address })} placeholder="לדוגמה: הרצל 12, תל אביב" />
          </Field>
        )}
      </Card>

      <Card title="מחיר">
        <Radio on={!form.paid} label="חינם" hint="ההרשמה נסגרת מיד ונשלח מייל אישור" onPress={() => { if (canWrite) setForm((current) => ({ ...current, paid: false })); }} />
        <Radio on={form.paid} label="בתשלום" hint="ההרשמה נסגרת רק אחרי תשלום שהצליח" onPress={() => { if (canWrite) setForm((current) => ({ ...current, paid: true })); }} />
        {form.paid ? (
          <Field label="מחיר להשתתפות" hint="מספר שלם. התשלום עובר דרך הסליקה של החנות.">
            <Entry value={form.price ? String(form.price) : ""} onChange={(value) => patch({ price: Number(value.replace(/\D/g, "").slice(0, 7)) || 0 })} placeholder="0" keyboard="numeric" ltr />
          </Field>
        ) : null}
      </Card>

      <Card title="סטטוס">
        {EVENT_STATUSES.map((option) => (
          <Radio key={option.id} on={form.status === option.id} label={option.label} hint={option.hint} onPress={() => patch({ status: option.id as EventStatus })} />
        ))}
      </Card>

      <Card title="כתובת העמוד">
        <Field label="כתובת באתר" hint={slugTouched ? "אותיות באנגלית, מספרים ומקף." : "נוצרת לבד. אפשר לשנות."}>
          <Entry
            value={form.slug}
            onChange={(slug) => {
              if (!canWrite) return;
              setSlugTouched(true);
              setForm((current) => ({ ...current, slug: slug.toLowerCase().replace(/\s+/g, "-") }));
              setError("");
            }}
            placeholder="birth-prep"
            ltr
          />
        </Field>
      </Card>

      <Card title="כך זה ייראה באתר">
        <View style={{ borderRadius: 12, overflow: "hidden", backgroundColor: tokens.field }}>
          {form.image ? <Image source={{ uri: form.image }} style={{ width: "100%", height: 140 }} resizeMode="cover" accessibilityIgnoresInvertColors /> : <View style={{ height: 90, alignItems: "center", justifyContent: "center" }}><AppText style={{ color: "#8a8a8a" }}>בלי תמונה</AppText></View>}
        </View>
        <AppText style={{ fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }}>{form.title.trim() || "שם האירוע"}</AppText>
        <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>{[displayDate(form.date), `${form.from}–${form.to}`, form.online ? "בזום" : form.address.trim() || "מפגש פרונטלי"].filter(Boolean).join(" · ")}</AppText>
        {form.short.trim() ? <AppText style={{ fontSize: 14, lineHeight: 20, color: tokens.inkSoft }} numberOfLines={3}>{form.short.trim()}</AppText> : null}
        <AppText style={{ fontFamily: fonts.bold, fontSize: 15 }}>{form.paid && form.price > 0 ? `₪${form.price}` : "חינם"}</AppText>
        {form.status === "draft" ? <AppText style={{ fontSize: 12, color: tokens.inkSecondary }}>טיוטה לא מופיעה באתר. כדי לפרסם, בוחרים «פתוח».</AppText> : null}
      </Card>

      {!creating && canWrite ? (
        <Pressable onPress={remove} disabled={busy} style={{ marginTop: 18, alignItems: "center" }}>
          <AppText style={{ color: tokens.negative, fontFamily: fonts.semibold, fontSize: 15 }}>מחיקת אירוע</AppText>
        </Pressable>
      ) : null}
    </EditorChrome>
  );
}
