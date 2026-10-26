import { useCallback, useEffect, useState } from "react";
import { hebrewError } from "@/lib/errors";
import { getSupabase } from "@/lib/supabase";
import { useSession } from "@/lib/session";

export type ReviewRow = {
  id: string;
  productTitle: string;
  name: string;
  body: string;
  rating: number;
  status: string;
  createdAt: string;
  orderNumber: number;
};

export type ChannelRow = {
  channel: string;
  type: string;
  visits: number;
  orders: number;
  sales: number;
};

export type TrafficPlace = { label: string; count: number };

export type TrafficSnapshot = {
  now: {
    visitors: number;
    visits: number;
    orders: number;
    sales: number;
    carts: number;
    checkouts: number;
    purchased: number;
    newVisitors: number;
    returningVisitors: number;
    locations: TrafficPlace[];
  };
  today: HourlyDay & { locations: TrafficPlace[] };
  yesterday: HourlyDay;
  days: { sales: number[]; orders: number[]; visits: number[] };
};

export type HourlyDay = {
  visits: number;
  orders: number;
  sales: number;
  visitsByHour: number[];
  ordersByHour: number[];
  salesByHour: number[];
};

export type CampaignRow = {
  id: string;
  name: string;
  status: string;
  scheduledAt: string | null;
  audience: string;
};

export type PopupRow = {
  id: string;
  name: string;
  status: string;
  leads: number;
  updatedAt: string;
};

export type EventRow = {
  id: string;
  title: string;
  short: string;
  body: string;
  date: string;
  from: string;
  to: string;
  online: boolean;
  address: string;
  price: number;
  status: string;
};

export type UserRow = {
  userId: string;
  name: string;
  email: string;
  roleName: string;
  status: string;
  primary: boolean;
  areas: string[];
};

export type ConnectionRow = {
  id: string;
  name: string;
  tokenPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

function count(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function places(value: unknown): TrafficPlace[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.label !== "string" || !row.label.trim()) return [];
    return [{ label: row.label, count: count(row.count) }];
  });
}

function series(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(count);
}

export function parseTraffic(value: unknown): TrafficSnapshot {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const now = row.now && typeof row.now === "object" ? (row.now as Record<string, unknown>) : {};
  const today = row.today && typeof row.today === "object" ? (row.today as Record<string, unknown>) : {};
  const yesterday = row.yesterday && typeof row.yesterday === "object" ? (row.yesterday as Record<string, unknown>) : {};
  const days = row.days && typeof row.days === "object" ? (row.days as Record<string, unknown>) : {};
  const hourly = (day: Record<string, unknown>): HourlyDay => ({
    visits: count(day.visits),
    orders: count(day.orders),
    sales: count(day.sales),
    visitsByHour: series(day.visitsByHour),
    ordersByHour: series(day.ordersByHour),
    salesByHour: series(day.salesByHour),
  });
  return {
    now: {
      visitors: count(now.visitors),
      visits: count(now.visits),
      orders: count(now.orders),
      sales: count(now.sales),
      carts: count(now.carts),
      checkouts: count(now.checkouts),
      purchased: count(now.purchased),
      newVisitors: count(now.newVisitors),
      returningVisitors: count(now.returningVisitors),
      locations: places(now.locations),
    },
    today: { ...hourly(today), locations: places(today.locations) },
    yesterday: hourly(yesterday),
    days: { sales: series(days.sales), orders: series(days.orders), visits: series(days.visits) },
  };
}

async function client() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("אין חיבור לשרת.");
  return supabase;
}

export async function loadReviews(storeId: string, status: "pending" | "published" | "rejected") {
  const supabase = await client();
  const { data, error } = await supabase.rpc("list_store_product_reviews", {
    target_store: storeId,
    wanted_status: status,
  });
  if (error) throw new Error(hebrewError(error));
  const payload = Array.isArray(data) ? data : [];
  return payload.flatMap((item): ReviewRow[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const rating = Number(row.rating);
    if (typeof row.id !== "string" || typeof row.productTitle !== "string" || typeof row.name !== "string") return [];
    if (!Number.isInteger(rating)) return [];
    return [{
      id: row.id,
      productTitle: row.productTitle,
      name: row.name,
      body: typeof row.body === "string" ? row.body : "",
      rating,
      status: typeof row.status === "string" ? row.status : status,
      createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
      orderNumber: Number.isInteger(Number(row.orderNumber)) ? Number(row.orderNumber) : 0,
    }];
  });
}

export async function decideReview(storeId: string, reviewId: string, decision: "approve" | "reject") {
  const supabase = await client();
  const { error } = await supabase.rpc("decide_store_product_review", {
    target_store: storeId,
    review_id: reviewId,
    decision,
  });
  if (error) throw new Error(hebrewError(error));
}

export async function loadAttribution(storeId: string) {
  const supabase = await client();
  const { data, error } = await supabase.rpc("store_attribution_snapshot", { target_store: storeId });
  if (error) throw new Error(hebrewError(error));
  if (!Array.isArray(data)) return [];
  return data.flatMap((item): ChannelRow[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.channel !== "string" || !row.channel) return [];
    return [{
      channel: row.channel,
      type: typeof row.type === "string" ? row.type : "",
      visits: count(row.visits),
      orders: count(row.orders),
      sales: count(row.sales),
    }];
  });
}

export async function loadTraffic(storeId: string) {
  const supabase = await client();
  const { data, error } = await supabase.rpc("store_traffic_snapshot", { target_store: storeId });
  if (error) throw new Error(hebrewError(error));
  if (data == null) throw new Error("אין נתוני תנועה.");
  return parseTraffic(data);
}

const AUDIENCE: Record<string, string> = {
  subscribed: "כל המנויים לדיוור",
  all: "כל הלקוחות עם אימייל",
  fresh: "לקוחות חדשים",
  repeat: "רכשו יותר מפעמיים",
};

export async function loadCampaigns(storeId: string) {
  const supabase = await client();
  const { data, error } = await supabase
    .from("marketing_campaigns")
    .select("id, name, status, segment_id, scheduled_at")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(hebrewError(error));
  const rows = (data ?? []) as Record<string, unknown>[];
  const segmentIds = rows.map((row) => row.segment_id).filter((id): id is string => typeof id === "string");
  const audiences = new Map<string, string>();
  if (segmentIds.length) {
    const loaded = await supabase.from("marketing_segments").select("id, definition").in("id", segmentIds);
    if (loaded.error) throw new Error(hebrewError(loaded.error));
    for (const segment of (loaded.data ?? []) as Record<string, unknown>[]) {
      const definition = segment.definition && typeof segment.definition === "object" ? (segment.definition as Record<string, unknown>) : null;
      const key = typeof definition?.key === "string" ? definition.key : "";
      if (typeof segment.id === "string") audiences.set(segment.id, AUDIENCE[key] ?? "");
    }
  }
  return rows.flatMap((row): CampaignRow[] => {
    if (typeof row.id !== "string" || typeof row.name !== "string") return [];
    const segmentId = typeof row.segment_id === "string" ? row.segment_id : "";
    return [{
      id: row.id,
      name: row.name,
      status: typeof row.status === "string" ? row.status : "",
      scheduledAt: typeof row.scheduled_at === "string" ? row.scheduled_at : null,
      audience: audiences.get(segmentId) ?? "",
    }];
  });
}

export async function loadPopups(storeId: string) {
  const supabase = await client();
  const { data, error } = await supabase
    .from("store_popups")
    .select("id, name, status, updated_at")
    .eq("store_id", storeId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(hebrewError(error));
  const rows = (data ?? []) as Record<string, unknown>[];
  const counts = new Map<string, number>();
  if (rows.length) {
    const leads = await supabase.from("store_popup_leads").select("popup_id").eq("store_id", storeId);
    if (leads.error) throw new Error(hebrewError(leads.error));
    for (const lead of (leads.data ?? []) as { popup_id?: string }[]) {
      if (!lead.popup_id) continue;
      counts.set(lead.popup_id, (counts.get(lead.popup_id) ?? 0) + 1);
    }
  }
  return rows.flatMap((row): PopupRow[] => {
    if (typeof row.id !== "string" || typeof row.name !== "string") return [];
    return [{
      id: row.id,
      name: row.name,
      status: typeof row.status === "string" ? row.status : "",
      leads: counts.get(row.id) ?? 0,
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
    }];
  });
}

export async function loadEvents(storeId: string) {
  const supabase = await client();
  const { data, error } = await supabase
    .from("store_events")
    .select("id, title, short, body, event_date, starts_at, ends_at, online, address, price, status")
    .eq("store_id", storeId)
    .order("event_date", { ascending: true });
  if (error) throw new Error(hebrewError(error));
  return ((data ?? []) as Record<string, unknown>[]).flatMap((row): EventRow[] => {
    if (typeof row.id !== "string" || typeof row.title !== "string") return [];
    const body = Array.isArray(row.body) ? row.body.filter((item): item is string => typeof item === "string").join("\n\n") : "";
    return [{
      id: row.id,
      title: row.title,
      short: typeof row.short === "string" ? row.short : "",
      body,
      date: typeof row.event_date === "string" ? row.event_date.slice(0, 10) : "",
      from: typeof row.starts_at === "string" ? row.starts_at.slice(0, 5) : "",
      to: typeof row.ends_at === "string" ? row.ends_at.slice(0, 5) : "",
      online: row.online === true,
      address: typeof row.address === "string" ? row.address : "",
      price: count(row.price),
      status: typeof row.status === "string" ? row.status : "",
    }];
  });
}

export async function loadUsers(storeId: string) {
  const supabase = await client();
  const { data, error } = await supabase.rpc("list_store_users", { target_store: storeId });
  if (error) throw new Error(hebrewError(error));
  if (!Array.isArray(data)) return [];
  return data.flatMap((item): UserRow[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.userId !== "string" || typeof row.name !== "string") return [];
    return [{
      userId: row.userId,
      name: row.name,
      email: typeof row.email === "string" ? row.email : "",
      roleName: typeof row.roleName === "string" ? row.roleName : "",
      status: typeof row.status === "string" ? row.status : "",
      primary: row.primary === true || row.roleKey === "owner",
      areas: Array.isArray(row.areas) ? row.areas.filter((area): area is string => typeof area === "string") : [],
    }];
  });
}

export async function saveUser(storeId: string, user: UserRow, status: string) {
  const supabase = await client();
  const { error } = await supabase.rpc("update_store_user", {
    target_store: storeId,
    member_user: user.userId,
    member_name: user.name,
    role_title: user.roleName,
    access_areas: user.areas,
    member_status: status,
    member_password: "",
  });
  if (error) throw new Error(hebrewError(error));
}

export async function addUser(storeId: string, input: { name: string; email: string; password: string; role: string; areas: string[] }) {
  const supabase = await client();
  const { error } = await supabase.rpc("add_store_user", {
    target_store: storeId,
    member_name: input.name,
    member_email: input.email,
    member_password: input.password,
    role_title: input.role,
    access_areas: input.areas,
  });
  if (error) throw new Error(hebrewError(error));
}

export async function loadConnections(storeId: string) {
  const supabase = await client();
  const { data, error } = await supabase.rpc("list_my_mcp_connections", { target_store: storeId });
  if (error) throw new Error(hebrewError(error));
  if (!Array.isArray(data)) return [];
  return data.flatMap((item): ConnectionRow[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.name !== "string") return [];
    return [{
      id: row.id,
      name: row.name,
      tokenPrefix: typeof row.tokenPrefix === "string" ? row.tokenPrefix : "",
      createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
      lastUsedAt: typeof row.lastUsedAt === "string" ? row.lastUsedAt : null,
    }];
  });
}

export async function revokeConnection(storeId: string, connectionId: string) {
  const supabase = await client();
  const { error } = await supabase.rpc("revoke_my_mcp_connection", {
    target_store: storeId,
    connection_id: connectionId,
  });
  if (error) throw new Error(hebrewError(error));
}

export function useStoreCall<T>(load: (storeId: string) => Promise<T>) {
  const { storeId } = useSession();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const run = useCallback(async (mode: "replace" | "refresh" | "silent") => {
    if (mode === "silent") {
      if (!storeId) return;
      try {
        setData(await load(storeId));
        setError("");
      } catch {
        // A failed background sync keeps the last good data on screen.
      }
      return;
    }
    if (!storeId) {
      setData(null);
      setError("אין חנות נבחרת.");
      setLoading(false);
      return;
    }
    if (mode === "replace") setLoading(true);
    else setRefreshing(true);
    setError("");
    try {
      setData(await load(storeId));
    } catch (caught) {
      setData(null);
      setError(caught instanceof Error ? caught.message : "הפעולה נכשלה.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [load, storeId]);

  const refresh = useCallback(() => run("refresh"), [run]);
  const sync = useCallback(() => run("silent"), [run]);

  useEffect(() => {
    void Promise.resolve().then(() => run("replace"));
  }, [run]);

  return { data, error, loading, refreshing, refresh, sync, storeId };
}
