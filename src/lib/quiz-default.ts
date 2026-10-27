import type { QuizRecord } from "@/lib/popups";

const FORM = "form";

const NEED: Record<string, string> = {
  belly: "טיפוח עור הבטן וסימני מתיחה",
  legs: "הקלה על תחושת כבדות ברגליים",
  face: "טיפוח עור הפנים",
  birth: "הכנת הגוף ללידה",
  post: "טיפוח והקלה אחרי לידה",
  baby: "טיפוח עור התינוק",
  self: "פינוק וטיפוח עצמי",
};

const RECOMMEND: Record<string, string[]> = {
  belly: ["olilastic", "olineum"],
  legs: ["olilax", "olilastic"],
  face: ["facioli", "oliglow"],
  birth: ["olineum", "olilastic"],
  post: ["nippoli", "olineum"],
  baby: ["babyspa", "bottle"],
  self: ["bestof", "oliglow"],
};

function choice(id: string, label: string, next: string, products: string[] = []) {
  return { id, label, next, products };
}

function need(ids: string[]) {
  return ids.map((id) => choice(id, NEED[id] ?? id, FORM, RECOMMEND[id] ?? []));
}

function question(id: string, title: string, choices: ReturnType<typeof choice>[]) {
  return { id, title, choices };
}

/** The homepage quiz the website editor opens before a row is stored. */
export function defaultQuizFlow() {
  return {
    introEyebrow: "מתנת הצטרפות",
    introTitle: "ענו על 3 שאלות\nוקבלו 5% הנחה",
    introText: "לרכישה הקרובה שלכן באתר. ובדרך נתאים לכן את המוצרים שהכי מתאימים לתקופה שלכן.",
    pills: ["3 שאלות קצרות", "פחות מדקה", "המלצות אישיות"],
    startLabel: "בואו נתחיל",
    image: "https://static.wixstatic.com/media/db159b_023efbddb9054a1695b0af97979b8d28f000.jpg",
    mediaPercent: "5%",
    mediaEyebrow: "מתנת הצטרפות",
    mediaLabel: "על ההזמנה הראשונה",
    formTitle: "יש לנו משהו במיוחד בשבילך 🤎",
    formText: "השאירי פרטים, קבלי 5% הנחה וגלי את המוצרים שמתאימים לך.",
    submitLabel: "קבלי את ההטבה שלי",
    legal: "בהשארת הפרטים את מאשרת לקבל מאיתנו עדכונים והטבות. אפשר להסיר בכל עת.",
    doneEyebrow: "ברוכה הבאה, {name}",
    doneTitle: "ההטבה שלך מוכנה",
    doneText: "שלחנו את הקוד גם למייל. מזינים אותו בקופה.",
    recoTitle: "המוצרים שמתאימים לך",
    shopLabel: "לכל המוצרים",
    entry: "q1",
    questions: [
      question("q1", "למי אנחנו מתאימות את שגרת הטיפוח?", [
        choice("preg", "אני בהריון", "q_preg"),
        choice("post", "אני אחרי לידה", "q_post"),
        choice("plan", "אני מתכננת הריון", "q_plan"),
        choice("baby", "אני מחפשת מוצרים לתינוק שלי", "q_baby"),
        choice("gift", "אני מחפשת מתנה", "q_gift"),
        choice("self", "אני מחפשת טיפוח לעצמי", "q_self"),
      ]),
      question("q_preg", "באיזה שלב את נמצאת?", [
        choice("t1", "שליש ראשון – שבועות 1–13", "q3_preg"),
        choice("t2", "שליש שני – שבועות 14–27", "q3_preg"),
        choice("t3", "שליש שלישי – שבוע 28 ומעלה", "q3_preg_late"),
      ]),
      question("q_post", "כמה זמן עבר מהלידה?", [
        choice("w6", "עד 6 שבועות", "q3_post"),
        choice("m6", "6 שבועות עד חצי שנה", "q3_post"),
        choice("y1", "יותר מחצי שנה", "q3_post"),
      ]),
      question("q_plan", "מתי את מתכננת להיכנס להריון?", [
        choice("soon", "בחודשים הקרובים", "q3_plan"),
        choice("year", "במהלך השנה הקרובה", "q3_plan"),
        choice("unk", "עוד לא בטוח", "q3_plan"),
      ]),
      question("q_baby", "בן או בת כמה התינוק?", [
        choice("nb", "יילוד, עד 3 חודשים", "q3_baby"),
        choice("b12", "3–12 חודשים", "q3_baby"),
        choice("b1", "מעל שנה", "q3_baby"),
      ]),
      question("q_gift", "למי המתנה?", [
        choice("gpreg", "לאישה בהריון", "q3_gift_preg"),
        choice("gpost", "ליולדת טרייה", "q3_gift_post"),
        choice("gbaby", "לתינוק החדש", "q3_gift_baby"),
      ]),
      question("q_self", "איך היית מתארת את העור שלך?", [
        choice("dry", "יבש ומבקש לחות", "q3_self"),
        choice("sens", "רגיש", "q3_self"),
        choice("norm", "רגיל", "q3_self"),
      ]),
      question("q3_preg", "מה הכי חשוב לך כרגע?", need(["belly", "legs", "face", "self"])),
      question("q3_preg_late", "מה הכי חשוב לך כרגע?", need(["belly", "birth", "legs", "face", "self"])),
      question("q3_post", "מה הכי חשוב לך כרגע?", need(["post", "belly", "face", "baby", "self"])),
      question("q3_plan", "מה הכי חשוב לך כרגע?", need(["belly", "face", "self"])),
      question("q3_baby", "מה הכי חשוב לך כרגע?", need(["baby", "post", "self"])),
      question("q3_gift_preg", "מה הכי חשוב לך כרגע?", need(["belly", "legs", "self"])),
      question("q3_gift_post", "מה הכי חשוב לך כרגע?", need(["post", "baby", "self"])),
      question("q3_gift_baby", "מה הכי חשוב לך כרגע?", need(["baby", "self"])),
      question("q3_self", "מה הכי חשוב לך כרגע?", need(["face", "legs", "belly", "self"])),
    ],
  };
}

export function unsavedQuiz(): QuizRecord {
  const flow = defaultQuizFlow();
  return {
    stored: false,
    status: "draft",
    updatedAt: null,
    introTitle: flow.introTitle,
    introText: flow.introText,
    questions: flow.questions.map((item) => ({
      id: item.id,
      title: item.title,
      choices: item.choices.map((option) => ({ id: option.id, label: option.label })),
    })),
  };
}
