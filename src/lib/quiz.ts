import { defaultQuizFlow } from "@/lib/quiz-default";

export const QUIZ_FORM = "form";

export type QuizChoice = {
  id: string;
  label: string;
  next: string;
  products: string[];
};

export type QuizQuestion = {
  id: string;
  title: string;
  choices: QuizChoice[];
};

export type QuizFlow = {
  introEyebrow: string;
  introTitle: string;
  introText: string;
  pills: string[];
  startLabel: string;
  image: string;
  mediaPercent: string;
  mediaEyebrow: string;
  mediaLabel: string;
  formTitle: string;
  formText: string;
  submitLabel: string;
  legal: string;
  doneEyebrow: string;
  doneTitle: string;
  doneText: string;
  recoTitle: string;
  shopLabel: string;
  entry: string;
  questions: QuizQuestion[];
};

export type QuizRecord = {
  stored: boolean;
  status: "draft" | "active";
  updatedAt: string | null;
  flow: QuizFlow;
};

export function newQuizId(prefix: "q" | "a") {
  return `${prefix}${Math.random().toString(36).slice(2, 10)}`;
}

function clip(value: unknown, max: number, fallback = "") {
  return typeof value === "string" ? value.replace(/\u0000/g, "").slice(0, max) : fallback;
}

function keepId(value: unknown) {
  return typeof value === "string" && value.trim() && value.trim().length <= 40 ? value.trim() : "";
}

function parseQuestions(value: unknown) {
  if (!Array.isArray(value)) return [];
  const questions: QuizQuestion[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (questions.length >= 40 || !item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    let id = keepId(record.id);
    if (!id || seen.has(id)) id = newQuizId("q");
    seen.add(id);
    const choices: QuizChoice[] = [];
    const seenChoices = new Set<string>();
    const raw = Array.isArray(record.choices) ? record.choices : [];
    for (const choice of raw) {
      if (choices.length >= 12 || !choice || typeof choice !== "object") continue;
      const row = choice as Record<string, unknown>;
      let choiceId = keepId(row.id);
      if (!choiceId || seenChoices.has(choiceId) || choiceId === QUIZ_FORM) choiceId = newQuizId("a");
      seenChoices.add(choiceId);
      const products: string[] = [];
      if (Array.isArray(row.products)) {
        for (const product of row.products) {
          if (typeof product !== "string") continue;
          const handle = product.trim().toLowerCase();
          if (!handle || products.includes(handle)) continue;
          products.push(handle);
          if (products.length >= 4) break;
        }
      }
      const next = keepId(row.next) || QUIZ_FORM;
      choices.push({
        id: choiceId,
        label: clip(row.label, 80),
        next: next === id ? QUIZ_FORM : next,
        products,
      });
    }
    if (!choices.length) choices.push({ id: newQuizId("a"), label: "", next: QUIZ_FORM, products: [] });
    questions.push({ id, title: clip(record.title, 160), choices });
  }
  const ids = new Set(questions.map((item) => item.id));
  return questions.map((question) => ({
    ...question,
    choices: question.choices.map((choice) => {
      const next = choice.next !== QUIZ_FORM && !ids.has(choice.next) ? QUIZ_FORM : choice.next;
      return { ...choice, next, products: next === QUIZ_FORM ? choice.products : [] };
    }),
  }));
}

function pillsOf(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const pills: string[] = [];
  for (const item of value) {
    const label = clip(item, 40).trim();
    if (!label || pills.includes(label)) continue;
    pills.push(label);
    if (pills.length >= 6) break;
  }
  return pills;
}

export function unsavedQuiz(): QuizRecord {
  return { stored: false, status: "draft", updatedAt: null, flow: defaultQuizFlow() };
}

export function quizFromRow(row: { status?: unknown; flow?: unknown; updated_at?: unknown }): QuizRecord {
  const base = defaultQuizFlow();
  const raw = row.flow && typeof row.flow === "object" ? row.flow as Record<string, unknown> : {};
  const questions = parseQuestions(raw.questions);
  const ready = questions.length ? questions : base.questions;
  const ids = new Set(ready.map((item) => item.id));
  const entry = typeof raw.entry === "string" && ids.has(raw.entry) ? raw.entry : ready[0]?.id ?? "q1";
  return {
    stored: true,
    status: row.status === "active" ? "active" : "draft",
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    flow: {
      introEyebrow: clip(raw.introEyebrow, 40, base.introEyebrow),
      introTitle: clip(raw.introTitle, 120, base.introTitle),
      introText: clip(raw.introText, 280, base.introText),
      pills: pillsOf(raw.pills, base.pills),
      startLabel: clip(raw.startLabel, 40, base.startLabel),
      image: /^https:\/\/[^\s"'()<>]+$/i.test(clip(raw.image, 800)) ? clip(raw.image, 800) : base.image,
      mediaPercent: clip(raw.mediaPercent, 8, base.mediaPercent),
      mediaEyebrow: clip(raw.mediaEyebrow, 40, base.mediaEyebrow),
      mediaLabel: clip(raw.mediaLabel, 80, base.mediaLabel),
      formTitle: clip(raw.formTitle, 120, base.formTitle),
      formText: clip(raw.formText, 240, base.formText),
      submitLabel: clip(raw.submitLabel, 40, base.submitLabel),
      legal: clip(raw.legal, 240, base.legal),
      doneEyebrow: clip(raw.doneEyebrow, 80, base.doneEyebrow),
      doneTitle: clip(raw.doneTitle, 80, base.doneTitle),
      doneText: clip(raw.doneText, 240, base.doneText),
      recoTitle: clip(raw.recoTitle, 80, base.recoTitle),
      shopLabel: clip(raw.shopLabel, 40, base.shopLabel),
      entry,
      questions: ready,
    },
  };
}

export function quizProblem(flow: QuizFlow) {
  if (!flow.questions.length) return "צריך לפחות שאלה אחת";
  if (!flow.questions.some((item) => item.id === flow.entry)) return "בחרו את השאלה הראשונה";
  const ids = new Set(flow.questions.map((item) => item.id));
  for (const item of flow.questions) {
    if (!item.title.trim()) return "לכל שאלה צריך נוסח";
    if (!item.choices.length) return "לכל שאלה צריכה להיות לפחות תשובה אחת";
    const choiceIds = new Set<string>();
    for (const option of item.choices) {
      if (!option.label.trim()) return "לכל תשובה צריך טקסט";
      if (choiceIds.has(option.id)) return "לכל תשובה צריך מזהה שונה";
      choiceIds.add(option.id);
      if (option.next !== QUIZ_FORM && !ids.has(option.next)) return "יש תשובה שמובילה לשאלה שלא קיימת";
      if (option.next === item.id) return "תשובה לא יכולה להוביל לאותה שאלה";
    }
  }
  const started = new Set<string>();
  const stack = new Set<string>();
  function walk(id: string): string | null {
    if (id === QUIZ_FORM) return null;
    if (stack.has(id)) return "השאלות מפנות אחת לשנייה במעגל";
    if (started.has(id)) return null;
    const item = flow.questions.find((question) => question.id === id);
    if (!item) return "יש תשובה שמובילה לשאלה שלא קיימת";
    stack.add(id);
    for (const option of item.choices) {
      const problem = walk(option.next);
      if (problem) return problem;
    }
    stack.delete(id);
    started.add(id);
    return null;
  }
  return walk(flow.entry);
}

export function reaches(questions: QuizQuestion[], fromId: string, targetId: string) {
  const seen = new Set<string>();
  const pending = [fromId];
  while (pending.length) {
    const id = pending.pop();
    if (!id || id === QUIZ_FORM || seen.has(id)) continue;
    if (id === targetId) return true;
    seen.add(id);
    const question = questions.find((item) => item.id === id);
    if (!question) continue;
    for (const choice of question.choices) pending.push(choice.next);
  }
  return false;
}

export function questionTitle(flow: QuizFlow, id: string) {
  return flow.questions.find((item) => item.id === id)?.title.trim() || "שאלה בלי נוסח";
}
