import { useEffect, useSyncExternalStore } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { getAlertPrefs, hydrateAlertPrefs, subscribeAlertPrefs, type AlertPrefs } from "@/lib/alert-prefs";
import { formatIls } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useStoreData } from "@/lib/store-data";
import type { CheckoutRecord, OrderRecord } from "@/lib/snapshot";

/** Bundled sale chime. Filename only; the file is listed in the expo-notifications plugin. */
export const SALE_SOUND = "sale.wav";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

let channels: Promise<void> | null = null;

function readyChannels() {
  if (Platform.OS !== "android") return Promise.resolve();
  channels ??= (async () => {
    // Android keeps the first sound assigned to a channel, so replace it when the chime changes.
    await Notifications.deleteNotificationChannelAsync("sales");
    await Notifications.setNotificationChannelAsync("sales", {
      name: "מכירות",
      importance: AndroidImportance.HIGH,
      sound: SALE_SOUND,
    });
    await Notifications.setNotificationChannelAsync("carts", {
      name: "עגלות נטושות",
      importance: AndroidImportance.HIGH,
      sound: "default",
    });
  })();
  return channels;
}

export async function ensureAlertPermission() {
  if (Platform.OS === "web") return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const next = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return next.granted;
}

async function ping(kind: "sale" | "abandoned", title: string, body: string) {
  if (Platform.OS === "web") return;
  await readyChannels();
  const channelId = kind === "sale" ? "sales" : "carts";
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: kind === "sale" ? SALE_SOUND : "default",
    },
    trigger: Platform.OS === "android" ? { channelId } : null,
  });
}

function saleBody(order: OrderRecord) {
  return [`הזמנה ${order.number}`, order.customerName, order.total != null ? formatIls(order.total) : ""].filter(Boolean).join(" · ");
}

function cartBody(cart: CheckoutRecord) {
  return cart.name?.trim() || cart.email?.trim() || cart.phone?.trim() || "לקוח נטש עגלה";
}

async function announce(prefs: AlertPrefs, orders: OrderRecord[], carts: CheckoutRecord[]) {
  if (prefs.sale && orders.length) {
    const shown = orders.slice(0, 3);
    for (const order of shown) await ping("sale", "מכירה חדשה", saleBody(order));
    if (orders.length > shown.length) await ping("sale", "מכירות חדשות", `עוד ${orders.length - shown.length} מכירות`);
  }
  if (prefs.abandoned && carts.length) {
    const shown = carts.slice(0, 3);
    for (const cart of shown) await ping("abandoned", "עגלה נטושה", cartBody(cart));
    if (carts.length > shown.length) await ping("abandoned", "עגלות נטושות", `עוד ${carts.length - shown.length} עגלות`);
  }
}

export function AlertWatcher() {
  const { storeId } = useSession();
  const { snapshot, sync } = useStoreData();
  const prefs = useSyncExternalStore(subscribeAlertPrefs, getAlertPrefs, getAlertPrefs);

  useEffect(() => {
    void hydrateAlertPrefs();
  }, []);

  useEffect(() => {
    if (!prefs.sale && !prefs.abandoned) return;
    const timer = setInterval(() => {
      if (AppState.currentState !== "active") return;
      void sync();
    }, 30_000);
    return () => clearInterval(timer);
  }, [prefs.abandoned, prefs.sale, sync]);

  useEffect(() => {
    if (!storeId || !snapshot) return;
    const bucket = seenFor(storeId);
    const freshOrders = snapshot.orders?.filter((order) => !bucket.orders.has(orderKey(order))) ?? [];
    const freshCarts = snapshot.checkouts?.filter((cart) => !bucket.carts.has(cart.id)) ?? [];
    if (snapshot.orders) bucket.orders = new Set(snapshot.orders.map(orderKey));
    if (snapshot.checkouts) bucket.carts = new Set(snapshot.checkouts.map((cart) => cart.id));
    if (!bucket.primed) {
      bucket.primed = true;
      return;
    }
    if (!freshOrders.length && !freshCarts.length) return;
    void announce(getAlertPrefs(), freshOrders, freshCarts);
  }, [snapshot, storeId]);

  return null;
}

function orderKey(order: OrderRecord) {
  return String(order.id ?? order.number);
}

const seen = new Map<string, { primed: boolean; orders: Set<string>; carts: Set<string> }>();

function seenFor(storeId: string) {
  const current = seen.get(storeId);
  if (current) return current;
  const next = { primed: false, orders: new Set<string>(), carts: new Set<string>() };
  seen.set(storeId, next);
  return next;
}
