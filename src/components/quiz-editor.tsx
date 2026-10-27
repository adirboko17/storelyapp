import { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { Icon } from "@/components/icon";
import { DetailScreen } from "@/components/detail";
import { SheetEmpty } from "@/components/shell";
import { AppText, ErrorNote, LoadingBlock, PrimaryButton } from "@/components/ui";
import {
  QUIZ_FORM,
  newQuizId,
  questionTitle,
  quizProblem,
  reaches,
  type QuizFlow,
  type QuizQuestion,
  type QuizRecord,
} from "@/lib/quiz";
import { loadQuiz, saveQuiz, useStoreCall } from "@/lib/remote";
import { useSession } from "@/lib/session";
import { useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, tokens } from "@/theme/tokens";

const PAGE = "#f6f6f7";
const CARD = "#ffffff";
const LINE = "#ececec";
const MUTED = "#8a8a8a";

type TrailStep = { questionId: string; viaChoiceId?: string; via?: string };

function cloneQuiz(quiz: QuizRecord): QuizRecord {
  return JSON.parse(JSON.stringify(quiz)) as QuizRecord;
}

function patchQuestion(flow: QuizFlow, questionId: string, change: (question: QuizQuestion) => QuizQuestion): QuizFlow {
  return { ...flow, questions: flow.questions.map((item) => (item.id === questionId ? change(item) : item)) };
}

export function QuizScreen() {
  const fonts = useFontSet();
  const { storeId } = useSession();
  const { snapshot } = useStoreData();
  const remote = useStoreCall(loadQuiz);
  const quiz = remote.data;
  const [draft, setDraft] = useState<QuizRecord | null>(null);
  const [trail, setTrail] = useState<TrailStep[]>([]);
  const [texts, setTexts] = useState(false);
  const [picking, setPicking] = useState<{ questionId: string; choiceId: string } | null>(null);
  const [productsFor, setProductsFor] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [problem, setProblem] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  if (quiz && !draft) {
    setDraft(cloneQuiz(quiz));
    setTrail([{ questionId: quiz.flow.entry }]);
  }

  const catalog = (snapshot?.products ?? []).flatMap((product) => {
    const handle = product.handle?.trim().toLowerCase() ?? "";
    if (!handle || !product.title) return [];
    return [{ handle, title: product.title }];
  });
  const productName = (handle: string) => catalog.find((item) => item.handle === handle)?.title ?? handle;

  function edit(change: (current: QuizRecord) => QuizRecord) {
    setDraft((current) => (current ? change(current) : current));
    setProblem("");
    setSaved("");
  }

  function setFlow(flow: QuizFlow) {
    edit((current) => ({ ...current, flow }));
  }

  async function save() {
    if (!draft || !storeId || busy) return;
    const issue = quizProblem(draft.flow);
    if (issue) {
      setProblem(issue);
      return;
    }
    setBusy(true);
    setProblem("");
    setSaved("");
    try {
      await saveQuiz(storeId, draft);
      setDraft((current) => (current ? { ...current, stored: true } : current));
      setSaved("נשמר");
      await remote.sync();
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "לא הצלחנו לשמור את השאלון.");
    } finally {
      setBusy(false);
    }
  }

  if (!draft) {
    return (
      <DetailScreen title="שאלון" scroll={false}>
        {remote.loading || quiz ? <LoadingBlock /> : remote.error ? <ErrorNote text={remote.error} /> : <SheetEmpty text="השאלון לא נמצא." />}
      </DetailScreen>
    );
  }

  const flow = draft.flow;
  const step = trail[trail.length - 1];
  const question = flow.questions.find((item) => item.id === step?.questionId);
  const pickingChoice = picking ? flow.questions.find((item) => item.id === picking.questionId)?.choices.find((item) => item.id === picking.choiceId) : undefined;

  function openNext(choiceId: string, nextId: string, via: string) {
    if (nextId === QUIZ_FORM) return;
    setTrail((current) => [...current, { questionId: nextId, viaChoiceId: choiceId, via }]);
    setProductsFor(null);
  }

  function pointAt(questionId: string, choiceId: string, next: string) {
    setFlow(patchQuestion(flow, questionId, (item) => ({
      ...item,
      choices: item.choices.map((choice) => (choice.id === choiceId ? { ...choice, next, products: next === QUIZ_FORM ? choice.products : [] } : choice)),
    })));
    setPicking(null);
  }

  function createNext(questionId: string, choiceId: string, via: string) {
    if (flow.questions.length >= 40) return;
    const created: QuizQuestion = { id: newQuizId("q"), title: "", choices: [{ id: newQuizId("a"), label: "", next: QUIZ_FORM, products: [] }] };
    setFlow({
      ...flow,
      questions: [
        ...flow.questions.map((item) => (item.id === questionId ? {
          ...item,
          choices: item.choices.map((choice) => (choice.id === choiceId ? { ...choice, next: created.id, products: [] } : choice)),
        } : item)),
        created,
      ],
    });
    setPicking(null);
    setTrail((current) => [...current, { questionId: created.id, viaChoiceId: choiceId, via }]);
  }

  function separate() {
    if (!question || trail.length < 2) return;
    const previous = trail[trail.length - 2];
    const viaChoiceId = step?.viaChoiceId;
    if (!previous || !viaChoiceId || flow.questions.length >= 40) return;
    const copy: QuizQuestion = {
      id: newQuizId("q"),
      title: question.title,
      choices: question.choices.map((choice) => ({ ...choice, id: newQuizId("a"), products: [...choice.products] })),
    };
    setFlow({
      ...flow,
      questions: [
        ...flow.questions.map((item) => (item.id === previous.questionId ? {
          ...item,
          choices: item.choices.map((choice) => (choice.id === viaChoiceId ? { ...choice, next: copy.id } : choice)),
        } : item)),
        copy,
      ],
    });
    setTrail((current) => current.map((item, index) => (index === current.length - 1 ? { ...item, questionId: copy.id } : item)));
  }

  function removeQuestion() {
    if (!question || question.id === flow.entry) return;
    Alert.alert("מחיקת השאלה", "התשובות שהובילו לכאן יסיימו בטופס.", [
      { text: "ביטול", style: "cancel" },
      {
        text: "מחיקה",
        style: "destructive",
        onPress: () => {
          const questions = flow.questions
            .filter((item) => item.id !== question.id)
            .map((item) => ({
              ...item,
              choices: item.choices.map((choice) => (choice.next === question.id ? { ...choice, next: QUIZ_FORM, products: [] } : choice)),
            }));
          setFlow({ ...flow, questions });
          setTrail((current) => current.slice(0, -1));
        },
      },
    ]);
  }

  const also = question
    ? flow.questions.flatMap((item) => item.choices.filter((choice) => choice.next === question.id && choice.label.trim() && choice.label.trim() !== step?.via).map((choice) => choice.label.trim()))
    : [];
  const targets = question
    ? flow.questions.filter((item) => item.id !== question.id && !reaches(flow.questions, item.id, question.id))
    : [];

  return (
    <DetailScreen title="שאלון 5% הנחה" scroll={false}>
      <ScrollView style={{ flex: 1, backgroundColor: PAGE }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: TAB_SPACE + 28 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["active", "draft"] as const).map((item) => {
            const on = draft.status === item;
            return (
              <Pressable key={item} onPress={() => edit((current) => ({ ...current, status: item }))} style={{ flex: 1, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: on ? tokens.inkStrong : CARD, borderWidth: 1, borderColor: on ? tokens.inkStrong : LINE }}>
                <AppText style={{ fontFamily: fonts.semibold, fontSize: 13, color: on ? "#ffffff" : tokens.inkStrong }}>{item === "active" ? "פעיל באתר" : "טיוטה"}</AppText>
              </Pressable>
            );
          })}
        </View>

        {texts ? (
          <TextsEditor flow={flow} onChange={setFlow} onBack={() => setTexts(false)} />
        ) : !question ? (
          <View style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 16, gap: 10 }}>
            <AppText style={{ color: tokens.inkSecondary }}>השאלה הזו כבר לא במסלול.</AppText>
            <Pressable onPress={() => setTrail([{ questionId: flow.entry }])}><AppText style={{ color: tokens.link, fontFamily: fonts.semibold }}>חזרה לשאלה הראשונה</AppText></Pressable>
          </View>
        ) : (
          <>
            {trail.length > 1 ? (
              <Pressable onPress={() => setTrail((current) => current.slice(0, -1))} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon name="back" size={16} color={tokens.link} strokeWidth={2} />
                <AppText style={{ color: tokens.link, fontFamily: fonts.semibold, fontSize: 14 }}>חזרה לשאלה הקודמת</AppText>
              </Pressable>
            ) : (
              <AppText style={{ color: tokens.inkSecondary, fontSize: 14, lineHeight: 20 }}>כל תשובה או ממשיכה לשאלה הבאה, או מסיימת בטופס.</AppText>
            )}
            <View style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 16, gap: 8 }}>
              <AppText style={{ fontFamily: fonts.semibold, fontSize: 13, color: MUTED }}>{trail.length === 1 ? "השאלה הראשונה" : `שאלה ${trail.length}`}</AppText>
              {step?.via ? <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>{`הגעת לכאן מהתשובה «${step.via}»`}</AppText> : null}
              <TextInput
                value={question.title}
                onChangeText={(title) => setFlow(patchQuestion(flow, question.id, (item) => ({ ...item, title: title.slice(0, 160) })))}
                placeholder="מה שואלים?"
                placeholderTextColor={MUTED}
                multiline
                style={{ minHeight: 52, fontFamily: fonts.bold, fontSize: 20, color: tokens.inkStrong, textAlign: "right", writingDirection: "rtl", padding: 0 }}
              />
            </View>
            {also.length ? (
              <View style={{ backgroundColor: "#fff8e8", borderRadius: 14, padding: 12, gap: 8 }}>
                <AppText style={{ fontSize: 13, lineHeight: 18, color: tokens.inkStrong }}>{`גם «${also[0]}» ממשיכה לכאן. שינוי בשאלה הזו ישנה את שתיהן.`}</AppText>
                <Pressable onPress={separate}><AppText style={{ color: tokens.link, fontFamily: fonts.semibold, fontSize: 14 }}>הפרידי לשאלה נפרדת</AppText></Pressable>
              </View>
            ) : null}

            <AppText style={{ fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }}>התשובות</AppText>
            {question.choices.map((choice, index) => {
              const ends = choice.next === QUIZ_FORM;
              const nextName = ends ? "" : questionTitle(flow, choice.next);
              return (
                <View key={choice.id} style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 14, gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <AppText style={{ fontFamily: fonts.semibold, color: MUTED }}>{index + 1}</AppText>
                    <TextInput
                      value={choice.label}
                      onChangeText={(label) => setFlow(patchQuestion(flow, question.id, (item) => ({
                        ...item,
                        choices: item.choices.map((option) => (option.id === choice.id ? { ...option, label: label.slice(0, 80) } : option)),
                      })))}
                      placeholder="מה הלקוחה עונה?"
                      placeholderTextColor={MUTED}
                      style={{ flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#e3e3e3", paddingHorizontal: 10, fontFamily: fonts.regular, fontSize: 15, color: tokens.inkStrong, textAlign: "right", writingDirection: "rtl" }}
                    />
                    <Pressable
                      accessibilityLabel="מחיקת תשובה"
                      disabled={question.choices.length < 2}
                      onPress={() => setFlow(patchQuestion(flow, question.id, (item) => ({ ...item, choices: item.choices.filter((option) => option.id !== choice.id) })))}
                      style={{ opacity: question.choices.length < 2 ? 0.3 : 1 }}
                    >
                      <Icon name="trash" size={18} color={tokens.inkSecondary} strokeWidth={1.8} />
                    </Pressable>
                  </View>
                  <Pressable onPress={() => setPicking({ questionId: question.id, choiceId: choice.id })} style={{ borderRadius: 12, backgroundColor: PAGE, paddingHorizontal: 12, paddingVertical: 10, gap: 2 }}>
                    <AppText style={{ fontSize: 12, color: MUTED }}>אחרי התשובה הזו</AppText>
                    <AppText style={{ fontFamily: fonts.semibold, fontSize: 15, color: tokens.inkStrong }}>{ends ? "מסיימים ועוברים לטופס" : `ממשיכים לשאלה: ${nextName}`}</AppText>
                    <AppText style={{ fontSize: 13, color: tokens.link }}>שינוי</AppText>
                  </Pressable>
                  {!ends ? (
                    <Pressable onPress={() => openNext(choice.id, choice.next, choice.label.trim() || `תשובה ${index + 1}`)} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <AppText style={{ color: tokens.link, fontFamily: fonts.semibold, fontSize: 14 }}>לעריכת השאלה הבאה</AppText>
                      <Icon name="forward" size={14} color={tokens.link} strokeWidth={2} />
                    </Pressable>
                  ) : (
                    <View style={{ gap: 8 }}>
                      <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>מוצרים שיופיעו אחרי הטופס, אם רוצים</AppText>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                        {choice.products.map((handle) => (
                          <Pressable key={handle} onPress={() => setFlow(patchQuestion(flow, question.id, (item) => ({
                            ...item,
                            choices: item.choices.map((option) => (option.id === choice.id ? { ...option, products: option.products.filter((product) => product !== handle) } : option)),
                          })))} style={{ borderRadius: 999, backgroundColor: tokens.inkStrong, paddingHorizontal: 10, paddingVertical: 6 }}>
                            <AppText style={{ color: "#ffffff", fontSize: 12, fontFamily: fonts.semibold }}>{`${productName(handle)}  ×`}</AppText>
                          </Pressable>
                        ))}
                        {choice.products.length < 4 ? (
                          <Pressable onPress={() => { setProductsFor(productsFor === choice.id ? null : choice.id); setProductQuery(""); }} style={{ borderRadius: 999, backgroundColor: PAGE, paddingHorizontal: 10, paddingVertical: 6 }}>
                            <AppText style={{ fontSize: 12, fontFamily: fonts.semibold, color: tokens.inkStrong }}>הוספת מוצר</AppText>
                          </Pressable>
                        ) : null}
                      </View>
                      {productsFor === choice.id ? (
                        <View style={{ gap: 6 }}>
                          <TextInput value={productQuery} onChangeText={setProductQuery} placeholder="חיפוש מוצר" placeholderTextColor={MUTED} style={{ height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#e3e3e3", paddingHorizontal: 10, textAlign: "right", writingDirection: "rtl", color: tokens.inkStrong }} />
                          {catalog.filter((item) => !choice.products.includes(item.handle) && (!productQuery.trim() || item.title.toLowerCase().includes(productQuery.trim().toLowerCase()))).slice(0, 8).map((item) => (
                            <Pressable key={item.handle} onPress={() => {
                              setFlow(patchQuestion(flow, question.id, (current) => ({
                                ...current,
                                choices: current.choices.map((option) => (option.id === choice.id ? { ...option, products: [...option.products, item.handle].slice(0, 4) } : option)),
                              })));
                              setProductQuery("");
                            }} style={{ minHeight: 36, justifyContent: "center" }}>
                              <AppText style={{ fontSize: 14 }}>{item.title}</AppText>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  )}
                </View>
              );
            })}
            {question.choices.length < 12 ? (
              <Pressable
                onPress={() => setFlow(patchQuestion(flow, question.id, (item) => ({ ...item, choices: [...item.choices, { id: newQuizId("a"), label: "", next: QUIZ_FORM, products: [] }] })))}
                style={{ height: 46, borderRadius: 14, backgroundColor: CARD, borderWidth: 1, borderColor: LINE, alignItems: "center", justifyContent: "center" }}
              >
                <AppText style={{ fontFamily: fonts.semibold, color: tokens.inkStrong }}>תשובה חדשה</AppText>
              </Pressable>
            ) : null}
            {question.id !== flow.entry ? (
              <Pressable onPress={removeQuestion} style={{ alignItems: "center", paddingVertical: 6 }}>
                <AppText style={{ color: tokens.negative, fontFamily: fonts.semibold }}>מחיקת השאלה הזו</AppText>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setTexts(true)} style={{ minHeight: 52, borderRadius: 16, backgroundColor: CARD, borderWidth: 1, borderColor: LINE, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <AppText style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: tokens.inkStrong }}>המילים שהלקוחה רואה</AppText>
              <Icon name="forward" size={16} color="#c4c4c4" strokeWidth={2} />
            </Pressable>
          </>
        )}

        {problem ? <AppText style={{ color: tokens.negative, fontSize: 13, lineHeight: 18 }}>{problem}</AppText> : null}
        {saved ? <AppText style={{ color: tokens.positive, fontSize: 13 }}>{saved}</AppText> : null}
        <PrimaryButton label={busy ? "שומרים..." : "שמירה"} disabled={busy} onPress={() => void save()} />
      </ScrollView>

      <Modal visible={Boolean(picking && pickingChoice)} transparent animationType="slide" onRequestClose={() => setPicking(null)}>
        <Pressable onPress={() => setPicking(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}>
          <View style={{ maxHeight: "82%", backgroundColor: CARD, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 10 }}>
            <AppText style={{ fontFamily: fonts.bold, fontSize: 18, color: tokens.inkStrong }}>לאן התשובה ממשיכה?</AppText>
            <AppText style={{ color: tokens.inkSecondary, fontSize: 14 }} numberOfLines={2}>{pickingChoice?.label.trim() || "התשובה הזו"}</AppText>
            <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
              <Destination
                title="לטופס הסיום"
                hint="הלקוחה משאירה פרטים ומקבלת את ההטבה"
                on={pickingChoice?.next === QUIZ_FORM}
                onPress={() => picking && pointAt(picking.questionId, picking.choiceId, QUIZ_FORM)}
              />
              <Destination
                title="לשאלה חדשה"
                hint="ניצור שאלה והיא תיפתח לעריכה"
                on={false}
                onPress={() => picking && pickingChoice && createNext(picking.questionId, picking.choiceId, pickingChoice.label.trim() || "התשובה")}
              />
              {targets.length ? <AppText style={{ fontFamily: fonts.semibold, fontSize: 13, color: MUTED, marginTop: 4 }}>לשאלה שכבר קיימת</AppText> : null}
              {targets.map((item) => (
                <Destination
                  key={item.id}
                  title={item.title.trim() || "שאלה בלי נוסח"}
                  on={pickingChoice?.next === item.id}
                  onPress={() => picking && pointAt(picking.questionId, picking.choiceId, item.id)}
                />
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </DetailScreen>
  );
}

function Destination({ title, hint, on, onPress }: { title: string; hint?: string; on: boolean; onPress: () => void }) {
  const fonts = useFontSet();
  return (
    <Pressable onPress={onPress} style={{ borderRadius: 14, borderWidth: 1.5, borderColor: on ? tokens.inkStrong : LINE, backgroundColor: CARD, paddingHorizontal: 14, paddingVertical: 12, gap: 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {on ? <Icon name="check" size={16} color={tokens.inkStrong} strokeWidth={2.2} /> : null}
        <AppText style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: tokens.inkStrong }}>{title}</AppText>
      </View>
      {hint ? <AppText style={{ fontSize: 13, color: MUTED }}>{hint}</AppText> : null}
    </Pressable>
  );
}

function TextsEditor({ flow, onChange, onBack }: { flow: QuizFlow; onChange: (flow: QuizFlow) => void; onBack: () => void }) {
  const fonts = useFontSet();
  const fields: { key: "introTitle" | "introText" | "startLabel" | "formTitle" | "formText" | "submitLabel" | "doneTitle" | "doneText"; label: string; max: number }[] = [
    { key: "introTitle", label: "כותרת הפתיחה", max: 120 },
    { key: "introText", label: "טקסט הפתיחה", max: 280 },
    { key: "startLabel", label: "כפתור ההתחלה", max: 40 },
    { key: "formTitle", label: "כותרת הטופס", max: 120 },
    { key: "formText", label: "טקסט הטופס", max: 240 },
    { key: "submitLabel", label: "כפתור הטופס", max: 40 },
    { key: "doneTitle", label: "כותרת הסיום", max: 80 },
    { key: "doneText", label: "טקסט הסיום", max: 240 },
  ];
  return (
    <View style={{ gap: 12 }}>
      <Pressable onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Icon name="back" size={16} color={tokens.link} strokeWidth={2} />
        <AppText style={{ color: tokens.link, fontFamily: fonts.semibold }}>חזרה לשאלות</AppText>
      </Pressable>
      <AppText style={{ fontFamily: fonts.bold, fontSize: 18, color: tokens.inkStrong }}>המילים שהלקוחה רואה</AppText>
      {fields.map((field) => (
        <View key={field.key} style={{ backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: LINE, padding: 14, gap: 6 }}>
          <AppText style={{ fontSize: 13, color: MUTED }}>{field.label}</AppText>
          <TextInput
            value={typeof flow[field.key] === "string" ? flow[field.key] : ""}
            onChangeText={(value) => onChange({ ...flow, [field.key]: value.slice(0, field.max) })}
            multiline
            placeholderTextColor={MUTED}
            style={{ minHeight: 40, fontFamily: fonts.regular, fontSize: 16, color: tokens.inkStrong, textAlign: "right", writingDirection: "rtl", padding: 0 }}
          />
        </View>
      ))}
    </View>
  );
}
