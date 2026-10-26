import { Pressable, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/icon";
import { tokens } from "@/theme/tokens";

const PILL: { name: string; icon: IconName }[] = [
  { name: "index", icon: "home" },
  { name: "orders", icon: "orders" },
  { name: "products", icon: "tag" },
  { name: "more", icon: "menu" },
];

const float = {
  backgroundColor: "#ffffff",
  shadowColor: "#000000",
  shadowOpacity: 0.14,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 4 },
  elevation: 8,
} as const;

export function FloatingTabBar({ state, navigateToTab, allowed }: BottomTabBarProps & { allowed: (name: string) => boolean }) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/more" || pathname === "/search") return null;
  const active = state.routes[state.index]?.name;
  const go = (name: string) => {
    const route = state.routes.find((item) => item.name === name);
    if (route) navigateToTab(route.key);
  };
  const pill = PILL.filter((item) => allowed(item.name));
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: Math.max(insets.bottom, 10) + 4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
      <Pressable onPress={() => router.push("/search")} style={[float, { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" }]}>
        <Icon name="search" size={20} color={tokens.inkStrong} strokeWidth={1.9} />
      </Pressable>
      <View style={[float, { height: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, gap: 2 }]}>
        {pill.map((item) => {
          const on = active === item.name;
          return (
            <Pressable key={item.name} onPress={() => go(item.name)} style={{ width: 50, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: on ? "#ebebeb" : "transparent" }}>
              <Icon name={item.icon} size={20} color={tokens.inkStrong} strokeWidth={on ? 2.2 : 1.7} />
            </Pressable>
          );
        })}
      </View>
      {allowed("customers") ? (
        <Pressable onPress={() => go("customers")} style={[float, { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: active === "customers" ? "#ebebeb" : "#ffffff" }]}>
          <Icon name="user" size={20} color={tokens.inkStrong} strokeWidth={active === "customers" ? 2.2 : 1.7} />
        </Pressable>
      ) : null}
    </View>
  );
}
