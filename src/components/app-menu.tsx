import { useEffect, useRef, useState, type ComponentRef, type ReactNode, type RefObject } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { BlurTargetView, BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { usePathname, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/icon";
import { initials } from "@/components/shell";
import { AppText } from "@/components/ui";
import { allows, type StoreAccess } from "@/lib/access";
import { MENU, areaByKey, type AreaItem } from "@/lib/menu";
import { useSession } from "@/lib/session";
import { useStoreData, useStoreTitle } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

type NavChild = { label: string; href: string; permission?: string; settings?: boolean };
type NavItem = { key: string; label: string; icon: IconName; href: string; permission?: string; children?: NavChild[] };

function area(key: string): NavChild {
  const item = areaByKey(key) as AreaItem;
  return { label: item.label, href: `/more/area/${item.key}`, permission: item.permission, settings: item.settings };
}

const NAV: NavItem[] = [
  { key: "home", label: "בית", icon: "home", href: "/" },
  { key: "orders", label: "הזמנות", icon: "orders", href: "/orders", permission: "orders.read", children: [{ label: "הזמנות", href: "/orders", permission: "orders.read" }, area("returns"), area("abandoned")] },
  { key: "products", label: "מוצרים", icon: "tag", href: "/products", permission: "products.read", children: [{ label: "מוצרים", href: "/products", permission: "products.read" }, area("collections"), area("inventory"), area("reviews"), area("gift-cards")] },
  { key: "customers", label: "לקוחות", icon: "user", href: "/customers", permission: "customers.read", children: [{ label: "לקוחות", href: "/customers", permission: "customers.read" }, area("segments")] },
  { key: "growth", label: "צמיחה", icon: "growth", href: "/more/area/growth", permission: "analytics.read", children: [area("growth"), area("attribution")] },
  { key: "marketing", label: "שיווק", icon: "megaphone", href: "/more/area/integrations", permission: "marketing.read", children: [area("integrations"), area("messages"), area("automations"), area("campaigns"), area("popups")] },
  { key: "discounts", label: "הנחות", icon: "discount", href: "/more/discounts", permission: "discounts.read" },
  { key: "content", label: "תוכן", icon: "content", href: "/more/area/posts", permission: "content.read", children: [area("posts"), area("events")] },
  { key: "analytics", label: "ניתוח נתונים", icon: "bars", href: "/more/area/analytics", children: [area("analytics"), area("reports"), area("live")] },
];

function canSee(access: StoreAccess | null, item: { permission?: string; settings?: boolean }) {
  if (item.settings) return Boolean(access?.settings);
  if (!item.permission) return true;
  return allows(access, item.permission);
}

const DOCK = 64;

function GlassControl({ target, onPress, width, children }: { target: RefObject<ComponentRef<typeof View> | null>; onPress: () => void; width?: number; children: ReactNode }) {
  const radius = DOCK / 2;
  return (
    <Pressable
      onPress={onPress}
      style={{
        height: DOCK,
        width,
        borderRadius: radius,
        shadowColor: "#000000",
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      }}
    >
      <View style={{ flex: 1, borderRadius: radius, overflow: "hidden" }}>
        <BlurView blurTarget={target} intensity={60} tint="systemChromeMaterialDark" blurMethod="dimezisBlurViewSdk31Plus" style={{ position: "absolute", top: -8, right: -8, bottom: -8, left: -8 }} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(72,72,72,0.38)" }]} />
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: width ? 0 : 22 }}>
          {children}
        </View>
      </View>
      <View pointerEvents="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: radius, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }} />
    </Pressable>
  );
}

function isCurrent(pathname: string, item: NavItem) {
  if (item.key === "home") return pathname === "/" || pathname === "";
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  return item.children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`)) ?? false;
}

const ROW = 44;
const REVEAL = { duration: 240, easing: Easing.bezier(0.22, 1, 0.36, 1) };

function MenuBranch({ item, expanded, current, fontFamily, onToggle, onOpen }: { item: NavItem; expanded: boolean; current: boolean; fontFamily: string; onToggle: () => void; onOpen: (href: string) => void }) {
  const children = item.children ?? [];
  const hasChildren = children.length > 1;
  const full = useSharedValue(children.length * ROW + 4);
  const progress = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    full.set(children.length * ROW + 4);
  }, [children.length, full]);

  useEffect(() => {
    progress.set(withTiming(expanded ? 1 : 0, REVEAL));
  }, [expanded, progress]);

  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(progress.get(), [0, 1], [0, 180])}deg` }],
  }));

  const clip = useAnimatedStyle(() => ({
    height: full.get() * progress.get(),
  }));

  const reveal = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.4, 1], [0, 1, 1]),
    transform: [{ translateY: interpolate(progress.get(), [0, 1], [-8, 0]) }],
  }));

  return (
    <View>
      <Pressable
        onPress={() => {
          if (!hasChildren) {
            onOpen(children[0]?.href ?? item.href);
            return;
          }
          void Haptics.selectionAsync().catch(() => undefined);
          onToggle();
        }}
        style={{ height: 56, borderRadius: 28, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, backgroundColor: current ? "#3a3a3a" : "transparent" }}
      >
        <Icon name={item.icon} size={24} color="#ffffff" strokeWidth={1.8} />
        <AppText style={{ flex: 1, color: "#ffffff", fontFamily, fontSize: 20 }}>{item.label}</AppText>
        {hasChildren ? (
          <Animated.View style={chevron}>
            <Icon name="down" size={18} color="#ffffff" strokeWidth={2} />
          </Animated.View>
        ) : null}
      </Pressable>
      {hasChildren ? (
        <Animated.View style={[{ overflow: "hidden" }, clip]} pointerEvents={expanded ? "auto" : "none"}>
          <Animated.View style={reveal}>
            <View style={{ paddingStart: 43, paddingBottom: 4 }}>
              {children.map((child) => (
                <Pressable key={child.href} onPress={() => onOpen(child.href)} style={{ height: ROW, justifyContent: "center" }}>
                  <AppText style={{ color: "#d4d4d4", fontSize: 18 }} numberOfLines={1}>{child.label}</AppText>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

export function AppMenu({ onDismiss, onNavigate }: { onDismiss: () => void; onNavigate?: (href: string) => void }) {
  const fonts = useFontSet();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const title = useStoreTitle();
  const { email, memberships, storeId, signOut } = useSession();
  const { access, snapshot } = useStoreData();
  const [open, setOpen] = useState<string>("");
  const [settings, setSettings] = useState(false);
  const blurTarget = useRef<ComponentRef<typeof View> | null>(null);
  const member = memberships.find((item) => item.storeId === storeId);
  const name = access?.name?.trim() || member?.memberName || "";
  const mail = access?.email?.trim() || email;
  const host = snapshot?.hostname?.trim();
  const storeUrl = host ? (host.startsWith("http") ? host : `https://${host}`) : "";
  const settingsItems = (MENU.find((group) => group.title === "הגדרות")?.items ?? []).filter((item) => canSee(access, item));

  const go = (href: string) => {
    if (onNavigate) onNavigate(href);
    else router.navigate(href as Href);
  };

  const items = NAV.flatMap((item) => {
    const children = item.children?.filter((child) => canSee(access, child));
    if (item.children && !children?.length) return [];
    if (!item.children && !canSee(access, item)) return [];
    return [{ ...item, children }];
  });

  return (
    <View style={{ flex: 1, backgroundColor: tokens.night }}>
      <BlurTargetView ref={blurTarget} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingHorizontal: 8, paddingBottom: DOCK + Math.max(insets.bottom, 12) + 28 }}>
        {items.map((item) => (
          <MenuBranch
            key={item.key}
            item={item}
            expanded={open === item.key}
            current={isCurrent(pathname, item)}
            fontFamily={fonts.semibold}
            onToggle={() => setOpen(open === item.key ? "" : item.key)}
            onOpen={go}
          />
        ))}

        {storeUrl ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingTop: 22, paddingBottom: 8 }}>
              <AppText style={{ color: tokens.nightMuted, fontFamily: fonts.semibold, fontSize: 17 }}>ערוצי מכירה</AppText>
              <Icon name="forward" size={14} color={tokens.nightMuted} strokeWidth={2} />
            </View>
            <Pressable onPress={() => void Linking.openURL(storeUrl)} style={{ height: 56, borderRadius: 28, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16 }}>
              <Icon name="store" size={24} color="#ffffff" strokeWidth={1.8} />
              <AppText style={{ flex: 1, color: "#ffffff", fontFamily: fonts.semibold, fontSize: 20 }}>חנות אונליין</AppText>
            </Pressable>
          </>
        ) : null}

      </ScrollView>
      </BlurTargetView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: Math.max(insets.bottom, 14), overflow: "visible", flexDirection: "row", direction: "ltr", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <GlassControl target={blurTarget} width={DOCK} onPress={() => setSettings(true)}>
          <Icon name="gear" size={24} color="#ffffff" strokeWidth={1.7} />
        </GlassControl>
        <GlassControl target={blurTarget} onPress={() => { if (storeUrl) void Linking.openURL(storeUrl); }}>
          <Icon name="broadcast" size={20} color="#ffffff" strokeWidth={1.8} />
          <AppText style={{ color: "#ffffff", fontFamily: fonts.semibold, fontSize: 17 }}>Quick Sale</AppText>
        </GlassControl>
        <GlassControl target={blurTarget} width={DOCK} onPress={onDismiss}>
          <Icon name="close" size={20} color="#ffffff" strokeWidth={2.2} />
        </GlassControl>
      </View>

      <Modal visible={settings} transparent animationType="slide" onRequestClose={() => setSettings(false)}>
        <Pressable onPress={() => setSettings(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: tokens.nightRaised, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12) + 8, paddingHorizontal: 8, direction: "rtl" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#b03bd1", alignItems: "center", justifyContent: "center" }}>
                <AppText style={{ color: "#ffffff", fontFamily: fonts.bold, fontSize: 13 }}>{initials(name || mail || title)}</AppText>
              </View>
              <View style={{ flex: 1 }}>
                {name ? <AppText style={{ color: "#ffffff", fontFamily: fonts.semibold }}>{name}</AppText> : null}
                {mail ? <AppText style={{ color: tokens.nightMuted, fontSize: 13, writingDirection: "ltr", textAlign: "right" }} numberOfLines={1}>{mail}</AppText> : null}
                <AppText style={{ color: tokens.nightMuted, fontSize: 13 }} numberOfLines={1}>{title}</AppText>
              </View>
            </View>
            {settingsItems.map((item) => (
              <Pressable key={item.key} onPress={() => { setSettings(false); go(`/more/area/${item.key}`); }} style={{ height: 46, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" }}>
                <AppText style={{ flex: 1, color: "#ffffff", fontSize: 16 }}>{item.label}</AppText>
                <Icon name="forward" size={16} color={tokens.nightMuted} />
              </Pressable>
            ))}
            {memberships.length > 1 ? (
              <Pressable onPress={() => { setSettings(false); go("/pick-store"); }} style={{ height: 46, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name="switch" size={18} color="#ffffff" />
                <AppText style={{ flex: 1, color: "#ffffff", fontSize: 16 }}>החלפת חנות</AppText>
              </Pressable>
            ) : null}
            <Pressable onPress={() => { setSettings(false); void signOut(); }} style={{ height: 46, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Icon name="logout" size={18} color="#ffffff" />
              <AppText style={{ flex: 1, color: "#ffffff", fontSize: 16 }}>התנתקות</AppText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
