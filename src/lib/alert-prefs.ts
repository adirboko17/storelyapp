import { secureGet, secureSet } from "@/lib/secure-store";

export type AlertPrefs = {
  sale: boolean;
  abandoned: boolean;
};

const KEY = "storely.alert-prefs";
const EMPTY: AlertPrefs = { sale: false, abandoned: false };

let current = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function publish(next: AlertPrefs) {
  current = next;
  hydrated = true;
  listeners.forEach((listener) => listener());
}

export function subscribeAlertPrefs(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAlertPrefs() {
  return current;
}

export function alertPrefsHydrated() {
  return hydrated;
}

export async function hydrateAlertPrefs() {
  if (hydrated) return current;
  try {
    const raw = await secureGet(KEY);
    const parsed = raw ? JSON.parse(raw) as Partial<AlertPrefs> : {};
    publish({
      sale: parsed.sale === true,
      abandoned: parsed.abandoned === true,
    });
  } catch {
    publish(EMPTY);
  }
  return current;
}

export async function setAlertPref(key: keyof AlertPrefs, value: boolean) {
  const next = { ...current, [key]: value };
  publish(next);
  await secureSet(KEY, JSON.stringify(next));
}
