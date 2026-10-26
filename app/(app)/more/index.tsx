import { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/icon";
import { initials, useStatusBar } from "@/components/shell";
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

export default function MenuScreen() {
  useStatusBar("light");
  const fonts = useFontSet();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const title = useStoreTitle();
  const { email, memberships, storeId, signOut } = useSession();
  const { access, snapshot } = useStoreData();
  const [open, setOpen] = useState<string>("");
  const [settings, setSettings] = useState(false);
  const member = memberships.find((item) => item.storeId === storeId);
  const name = access?.name?.trim() || member?.memberName || "";
  const mail = access?.email?.trim() || email;
  const host = snapshot?.hostname?.trim();
  const storeUrl = host ? (host.startsWith("http") ? host : `https://${host}`) : "";
  const settingsItems = (MENU.find((group) => group.title === "הגדרות")?.items ?? []).filter((item) => canSee(access, item));

  const go = (href: string) => router.navigate(href as Href);

  const items = NAV.flatMap((item) => {
    const children = item.children?.filter((child) => canSee(access, child));
    if (item.children && !children?.length) return [];
    if (!item.children && !canSee(access, item)) return [];
    return [{ ...item, children }];
  });

  return (
    <View style={{ flex: 1, backgroundColor: tokens.night }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingHorizontal: 8, paddingBottom: 120 }}>
        {items.map((item) => {
          const expanded = open === item.key;
          const hasChildren = Boolean(item.children && item.children.length > 1);
          return (
            <View key={item.key}>
              <Pressable
                onPress={() => (hasChildren ? setOpen(expanded ? "" : item.key) : go(item.children?.[0]?.href ?? item.href))}
                style={{ height: 44, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, backgroundColor: item.key === "home" ? tokens.menuActive : "transparent" }}
              >
                <Icon name={item.icon} size={19} color="#ffffff" strokeWidth={1.8} />
                <AppText style={{ flex: 1, color: "#ffffff", fontFamily: fonts.semibold, fontSize: 17 }}>{item.label}</AppText>
                {hasChildren ? (
                  <View style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}>
                    <Icon name="down" size={18} color="#ffffff" strokeWidth={2} />
                  </View>
                ) : null}
              </Pressable>
              {expanded && item.children ? (
                <View style={{ paddingStart: 43, paddingBottom: 4 }}>
                  {item.children.map((child) => (
                    <Pressable key={child.href} onPress={() => go(child.href)} style={{ height: 38, justifyContent: "center" }}>
                      <AppText style={{ color: "#d4d4d4", fontSize: 15 }}>{child.label}</AppText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}

        {storeUrl ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingTop: 22, paddingBottom: 8 }}>
              <AppText style={{ color: tokens.nightMuted, fontFamily: fonts.semibold, fontSize: 15 }}>ערוצי מכירה</AppText>
              <Icon name="forward" size={14} color={tokens.nightMuted} strokeWidth={2} />
            </View>
            <Pressable onPress={() => void Linking.openURL(storeUrl)} style={{ height: 44, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12 }}>
              <Icon name="store" size={19} color="#ffffff" strokeWidth={1.8} />
              <AppText style={{ flex: 1, color: "#ffffff", fontFamily: fonts.semibold, fontSize: 17 }}>חנות אונליין</AppText>
            </Pressable>
          </>
        ) : null}

        <View style={{ marginTop: 22, marginHorizontal: 4, borderRadius: 14, backgroundColor: tokens.nightRaised, padding: 14, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#b03bd1", alignItems: "center", justifyContent: "center" }}>
              <AppText style={{ color: "#ffffff", fontFamily: fonts.bold, fontSize: 13 }}>{initials(name || mail || title)}</AppText>
            </View>
            <View style={{ flex: 1 }}>
              {name ? <AppText style={{ color: "#ffffff", fontFamily: fonts.semibold }}>{name}</AppText> : null}
              {mail ? <AppText style={{ color: tokens.nightMuted, fontSize: 13, writingDirection: "ltr", textAlign: "right" }} numberOfLines={1}>{mail}</AppText> : null}
              <AppText style={{ color: tokens.nightMuted, fontSize: 13 }} numberOfLines={1}>{title}</AppText>
            </View>
          </View>
          <Pressable onPress={() => void signOut()} style={{ height: 40, borderRadius: 10, backgroundColor: tokens.nightField, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Icon name="logout" size={17} color="#ffffff" />
            <AppText style={{ color: "#ffffff", fontFamily: fonts.semibold }}>התנתקות</AppText>
          </Pressable>
        </View>
      </ScrollView>

      <View style={{ position: "absolute", left: 0, right: 0, bottom: Math.max(insets.bottom, 10) + 4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
        {settingsItems.length ? (
          <Pressable onPress={() => setSettings(true)} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: tokens.nightRaised, alignItems: "center", justifyContent: "center" }}>
            <Icon name="gear" size={20} color="#ffffff" strokeWidth={1.7} />
          </Pressable>
        ) : null}
        {memberships.length > 1 ? (
          <Pressable onPress={() => router.push("/pick-store")} style={{ height: 48, borderRadius: 24, paddingHorizontal: 22, backgroundColor: tokens.switchStore, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="switch" size={18} color="#ffffff" strokeWidth={1.9} />
            <AppText style={{ color: "#ffffff", fontFamily: fonts.semibold, fontSize: 16 }}>החלפת חנות</AppText>
          </Pressable>
        ) : null}
        <Pressable onPress={() => go("/")} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: tokens.nightRaised, alignItems: "center", justifyContent: "center" }}>
          <Icon name="close" size={18} color="#ffffff" strokeWidth={2} />
        </Pressable>
      </View>

      <Modal visible={settings} transparent animationType="slide" onRequestClose={() => setSettings(false)}>
        <Pressable onPress={() => setSettings(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: tokens.nightRaised, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12) + 8, paddingHorizontal: 8, direction: "rtl" }}>
            <AppText style={{ color: "#ffffff", fontFamily: fonts.bold, fontSize: 17, paddingHorizontal: 12, paddingVertical: 10 }}>הגדרות</AppText>
            {settingsItems.map((item) => (
              <Pressable key={item.key} onPress={() => { setSettings(false); go(`/more/area/${item.key}`); }} style={{ height: 46, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" }}>
                <AppText style={{ flex: 1, color: "#ffffff", fontSize: 16 }}>{item.label}</AppText>
                <Icon name="forward" size={16} color={tokens.nightMuted} />
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
