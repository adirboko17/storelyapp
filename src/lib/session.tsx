import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { publicConfigProblem } from "@/lib/config";
import { hebrewError } from "@/lib/errors";
import { secureGet, secureSet } from "@/lib/secure-store";
import { getSupabase } from "@/lib/supabase";

const SELECTED_STORE = "storely.selected-store";

export type Membership = {
  storeId: string;
  displayName: string;
  memberName: string;
  logoUrl: string;
};

type Phase = "booting" | "unconfigured" | "signed-out" | "resolving" | "no-store" | "pick-store" | "ready" | "blocked";

type SessionValue = {
  phase: Phase;
  error: string;
  email: string;
  userId: string | null;
  memberships: Membership[];
  storeId: string | null;
  storeName: string;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  menuName: string;
  selectStore: (storeId: string) => Promise<void>;
  refreshMemberships: (quiet?: boolean) => Promise<void>;
  setMenuName: (name: string) => void;
};

const SessionContext = createContext<SessionValue | null>(null);

type MemberRow = { store_id: string; display_name: string | null };
type SettingsRow = { store_id: string; display_name: string | null; logo_url: string | null };

function logoUrl(value: string | null | undefined) {
  const url = value?.trim() ?? "";
  return url.startsWith("https://") ? url : "";
}

function storeLabel(value: string | null | undefined) {
  const name = value?.trim();
  return name || "חנות ללא שם";
}

async function readSavedStore(userId: string) {
  const raw = await secureGet(SELECTED_STORE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { userId?: unknown; storeId?: unknown };
    if (parsed.userId === userId && typeof parsed.storeId === "string") return parsed.storeId;
  } catch {
    return null;
  }
  return null;
}

async function writeSavedStore(userId: string, storeId: string) {
  await secureSet(SELECTED_STORE, JSON.stringify({ userId, storeId }));
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(() => (publicConfigProblem() ? "unconfigured" : "booting"));
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState("");
  const [menuName, setMenuNameState] = useState("");
  const request = useRef(0);
  const userIdRef = useRef<string | null>(null);
  const phaseRef = useRef(phase);
  useEffect(() => {
    userIdRef.current = userId;
    phaseRef.current = phase;
  }, [userId, phase]);

  async function loadMemberships(nextUserId: string, quiet: boolean) {
    const token = ++request.current;
    const supabase = getSupabase();
    if (!supabase) {
      setPhase("unconfigured");
      return;
    }
    if (!quiet) setPhase("resolving");
    setError("");
    const members = await supabase
      .from("store_members")
      .select("store_id, display_name")
      .eq("user_id", nextUserId)
      .eq("status", "active")
      .returns<MemberRow[]>();
    if (request.current !== token) return;
    if (members.error) {
      setError(hebrewError(members.error));
      setPhase("blocked");
      return;
    }
    const rows = members.data ?? [];
    const names = new Map<string, string>();
    const logos = new Map<string, string>();
    if (rows.length > 0) {
      const settings = await supabase
        .from("store_settings")
        .select("store_id, display_name, logo_url")
        .in("store_id", rows.map((row) => row.store_id))
        .returns<SettingsRow[]>();
      if (request.current !== token) return;
      if (settings.error) {
        setError(hebrewError(settings.error));
        setPhase("blocked");
        return;
      }
      for (const row of settings.data ?? []) {
        names.set(row.store_id, storeLabel(row.display_name));
        logos.set(row.store_id, logoUrl(row.logo_url));
      }
    }
    const next = rows.map((row) => ({
      storeId: row.store_id,
      displayName: names.get(row.store_id) ?? "חנות ללא שם",
      memberName: row.display_name?.trim() || "",
      logoUrl: logos.get(row.store_id) ?? "",
    }));
    setMemberships(next);
    if (next.length === 0) {
      setStoreId(null);
      setStoreName("");
      setPhase("no-store");
      return;
    }
    const saved = await readSavedStore(nextUserId);
    if (request.current !== token) return;
    const chosen = next.length === 1 ? next[0] : next.find((item) => item.storeId === saved);
    if (!chosen) {
      setStoreId(null);
      setStoreName("");
      setPhase("pick-store");
      return;
    }
    await writeSavedStore(nextUserId, chosen.storeId);
    if (request.current !== token) return;
    setStoreId(chosen.storeId);
    setStoreName(chosen.displayName);
    setPhase("ready");
  }

  useEffect(() => {
    if (publicConfigProblem()) return undefined;
    const supabase = getSupabase();
    if (!supabase) return undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      setTimeout(() => {
        const user = session?.user;
        if (!user) {
          setUserId(null);
          setEmail("");
          setMenuNameState("");
          setMemberships([]);
          setStoreId(null);
          setStoreName("");
          setPhase("signed-out");
          return;
        }
        setUserId(user.id);
        setEmail(user.email ?? "");
        const savedName = user.user_metadata?.menu_name;
        setMenuNameState(typeof savedName === "string" ? savedName.trim() : "");
        if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
        void loadMemberships(user.id, false);
      }, 0);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && userIdRef.current && phaseRef.current === "ready") {
        void loadMemberships(userIdRef.current, true);
      }
    });
    return () => sub.remove();
  }, []);

  const value = useMemo<SessionValue>(() => ({
    phase,
    error,
    email,
    userId,
    memberships,
    storeId,
    storeName,
    menuName,
    async signIn(nextEmail: string, password: string) {
      const problem = publicConfigProblem();
      if (problem) return problem;
      const supabase = getSupabase();
      if (!supabase) return publicConfigProblem();
      const { error: authError } = await supabase.auth.signInWithPassword({ email: nextEmail, password });
      if (authError) {
        return authError.message.toLowerCase().includes("invalid") ? "האימייל או הסיסמה לא נכונים" : "לא הצלחנו להתחבר. נסו שוב";
      }
      setPhase("resolving");
      return null;
    },
    async signOut() {
      const supabase = getSupabase();
      if (supabase) await supabase.auth.signOut();
      setMemberships([]);
      setStoreId(null);
      setStoreName("");
      setMenuNameState("");
      setPhase(publicConfigProblem() ? "unconfigured" : "signed-out");
    },
    async selectStore(nextStoreId: string) {
      const membership = memberships.find((item) => item.storeId === nextStoreId);
      if (!membership || !userId) return;
      await writeSavedStore(userId, membership.storeId);
      setStoreId(membership.storeId);
      setStoreName(membership.displayName);
      setPhase("ready");
    },
    async refreshMemberships(quiet = false) {
      if (userId) await loadMemberships(userId, quiet);
    },
    setMenuName(name: string) {
      setMenuNameState(name.trim());
    },
  }), [phase, error, email, userId, memberships, storeId, storeName, menuName]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider missing");
  return value;
}
