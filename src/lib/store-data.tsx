import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { allows, parseAccess, type StoreAccess } from "@/lib/access";
import { hebrewError } from "@/lib/errors";
import { useSession } from "@/lib/session";
import { parseSnapshot, type AdminSnapshot } from "@/lib/snapshot";
import { getSupabase } from "@/lib/supabase";
import type { OrderPatch } from "@/lib/orders";

type StoreDataValue = {
  snapshot: AdminSnapshot | null;
  access: StoreAccess | null;
  loading: boolean;
  refreshing: boolean;
  error: string;
  refresh: () => Promise<void>;
  sync: () => Promise<void>;
  updateOrder: (orderNumber: number, patch: OrderPatch) => Promise<string | null>;
};

const StoreDataContext = createContext<StoreDataValue | null>(null);

export function StoreDataProvider({ children }: { children: ReactNode }) {
  const { storeId } = useSession();
  const [snapshot, setSnapshot] = useState<AdminSnapshot | null>(null);
  const [access, setAccess] = useState<StoreAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (mode: "replace" | "refresh" | "silent") => {
    const supabase = getSupabase();
    if (mode === "silent") {
      if (!supabase || !storeId) return;
      const [snap, acc] = await Promise.all([
        supabase.rpc("store_admin_snapshot", { target_store: storeId }),
        supabase.rpc("current_store_access", { target_store: storeId }),
      ]);
      if (snap.error || acc.error) return;
      const parsed = parseAccess(acc.data);
      if (!parsed) return;
      setSnapshot(parseSnapshot(snap.data));
      setAccess(parsed);
      setError("");
      return;
    }
    if (!supabase || !storeId) {
      setSnapshot(null);
      setAccess(null);
      setLoading(false);
      setError("אין חנות נבחרת.");
      return;
    }
    if (mode === "replace") {
      setSnapshot(null);
      setAccess(null);
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError("");
    const [snap, acc] = await Promise.all([
      supabase.rpc("store_admin_snapshot", { target_store: storeId }),
      supabase.rpc("current_store_access", { target_store: storeId }),
    ]);
    const problems: string[] = [];
    if (snap.error) {
      setSnapshot(null);
      problems.push(hebrewError(snap.error));
    } else {
      setSnapshot(parseSnapshot(snap.data));
    }
    if (acc.error) {
      setAccess(null);
      problems.push(hebrewError(acc.error));
    } else {
      const parsed = parseAccess(acc.data);
      setAccess(parsed);
      if (!parsed) problems.push("אין הרשאה לחנות הזו.");
    }
    setError(problems.join("\n"));
    setLoading(false);
    setRefreshing(false);
  }, [storeId]);

  useEffect(() => {
    void Promise.resolve().then(() => load("replace"));
  }, [load]);

  const value = useMemo<StoreDataValue>(() => ({
    snapshot,
    access,
    loading,
    refreshing,
    error,
    refresh: () => load("refresh"),
    sync: () => load("silent"),
    async updateOrder(orderNumber: number, patch: OrderPatch) {
      const supabase = getSupabase();
      if (!supabase || !storeId) return "אין חנות נבחרת.";
      if (!allows(access, "orders.update")) return "אין הרשאה לעדכן הזמנה.";
      const { error: updateError } = await supabase.rpc("update_store_order", {
        target_store: storeId,
        order_number: orderNumber,
        patch,
      });
      if (updateError) return hebrewError(updateError);
      await load("refresh");
      return null;
    },
  }), [snapshot, access, loading, refreshing, error, load, storeId]);

  return <StoreDataContext.Provider value={value}>{children}</StoreDataContext.Provider>;
}

export function useStoreData() {
  const value = useContext(StoreDataContext);
  if (!value) throw new Error("StoreDataProvider missing");
  return value;
}

export function useStoreTitle() {
  const { storeName } = useSession();
  const { snapshot } = useStoreData();
  const live = snapshot?.name?.trim();
  return live || storeName || "חנות ללא שם";
}

export function useAllowed(permission: string) {
  const { access, loading } = useStoreData();
  if (loading || !access) return false;
  return allows(access, permission);
}
