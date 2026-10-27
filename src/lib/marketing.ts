import { hebrewError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase";

function client() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("אין חיבור לשרת.");
  return supabase;
}

let pending = Promise.resolve();

function enqueue(task: () => Promise<void>) {
  const run = pending.then(task, task);
  pending = run.then(() => undefined, () => undefined);
  return run;
}

async function loadMarketing(storeId: string) {
  const { data, error } = await client().rpc("store_admin_slice", { target_store: storeId, slice: "desk" });
  if (error) throw new Error(hebrewError(error));
  const desk = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : {};
  const marketing = desk.marketing && typeof desk.marketing === "object" && !Array.isArray(desk.marketing) ? { ...(desk.marketing as Record<string, unknown>) } : {};
  return marketing;
}

async function saveMarketing(storeId: string, marketing: Record<string, unknown>) {
  const { error } = await client().rpc("save_store_sections", { target_store: storeId, sections: { marketing } });
  if (error) throw new Error(hebrewError(error));
}

function sameId(item: unknown, id: string) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  return String((item as Record<string, unknown>).id ?? "") === id;
}

export function setAutomationEnabled(storeId: string, flowId: string, on: boolean) {
  return enqueue(async () => {
    const marketing = await loadMarketing(storeId);
    const flows = Array.isArray(marketing.flows) ? marketing.flows : [];
    let found = false;
    const next = flows.map((item) => {
      if (!sameId(item, flowId) || !item || typeof item !== "object" || Array.isArray(item)) return item;
      found = true;
      return { ...(item as Record<string, unknown>), on };
    });
    if (!found) throw new Error("האוטומציה לא נמצאה.");
    await saveMarketing(storeId, { ...marketing, flows: next });
  });
}

export function deleteAutomation(storeId: string, flowId: string) {
  return enqueue(async () => {
    const marketing = await loadMarketing(storeId);
    const flows = Array.isArray(marketing.flows) ? marketing.flows : [];
    const next = flows.filter((item) => !sameId(item, flowId));
    if (next.length === flows.length) throw new Error("האוטומציה לא נמצאה.");
    await saveMarketing(storeId, { ...marketing, flows: next });
  });
}

export function deleteMessage(storeId: string, kind: "email" | "sms", id: string) {
  return enqueue(async () => {
    const marketing = await loadMarketing(storeId);
    const key = kind === "email" ? "emails" : "sms";
    const rows = Array.isArray(marketing[key]) ? marketing[key] : [];
    const next = rows.filter((item) => !sameId(item, id));
    if (next.length === rows.length) throw new Error(kind === "email" ? "המייל לא נמצא." : "ה-SMS לא נמצא.");
    await saveMarketing(storeId, { ...marketing, [key]: next });
  });
}
