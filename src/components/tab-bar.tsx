import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { usePathname } from "expo-router";
import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { interpolateColor, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Icon, type IconName } from "@/components/icon";
import { useMenu } from "@/components/menu-motion";
import { rememberSearchFrom } from "@/components/tab-header";
import { tokens } from "@/theme/tokens";

const PRESS_MS = 150;
const ACTIVE = "#ebebeb";
const IDLE = "#ffffff";

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

function softTap() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => undefined);
}

function TabButton({ name, selected, hot, commit = true, onAim, onPress, width, height, children }: { name: string; selected: SharedValue<string>; hot: boolean; commit?: boolean; onAim: (name: string) => void; onPress: () => void; width: number; height: number; children: ReactNode }) {
  const scale = useSharedValue(1);
  const lit = useSharedValue(hot ? 1 : 0);
  const switched = useRef(false);
  useAnimatedReaction(
    () => selected.get() === name,
    (on) => {
      lit.set(withTiming(on ? 1 : 0, { duration: PRESS_MS }));
    },
  );
  const face = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
    backgroundColor: interpolateColor(lit.get(), [0, 1], [IDLE, ACTIVE]),
  }));

  return (
    <Pressable
      onPressIn={() => {
        scale.set(withTiming(0.9, { duration: PRESS_MS }));
        switched.current = false;
        if (!commit || selected.get() === name) return;
        switched.current = true;
        selected.set(name);
        softTap();
        onPress();
        onAim(name);
      }}
      onPress={() => {
        if (switched.current) return;
        softTap();
        onPress();
      }}
      onPressOut={() => {
        scale.set(withTiming(1, { duration: PRESS_MS }));
      }}
    >
      <Animated.View style={[{ width, height, borderRadius: height / 2, alignItems: "center", justifyContent: "center" }, face]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export function FloatingTabBar({ state, navigateToTab, allowed }: BottomTabBarProps & { allowed: (name: string) => boolean }) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { openMenu } = useMenu();
  const active = state.routes[state.index]?.name ?? "index";
  const selected = useSharedValue(active);
  const [lit, setLit] = useState(active);
  const [seen, setSeen] = useState(active);
  if (seen !== active) {
    setSeen(active);
    setLit(active);
  }
  useEffect(() => {
    if (selected.get() !== active) selected.set(active);
  }, [active, selected]);
  if (pathname === "/more" || pathname.startsWith("/more/sale")) return null;
  const go = (name: string) => {
    const route = state.routes.find((item) => item.name === name);
    if (route) navigateToTab(route.key);
  };
  const pill = PILL.filter((item) => allowed(item.name));
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: Math.max(insets.bottom, 10) + 4, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }}>
      <View style={[float, { width: 48, height: 48, borderRadius: 24 }]}>
        <TabButton name="search" selected={selected} hot={active === "search"} onAim={setLit} width={48} height={48} onPress={() => { rememberSearchFrom(pathname); go("search"); }}>
          <Icon name="search" size={20} color={tokens.inkStrong} strokeWidth={lit === "search" ? 2.2 : 1.7} />
        </TabButton>
      </View>
      <View style={[float, { height: 52, borderRadius: 26, flexDirection: "row", alignItems: "center", paddingHorizontal: 6, gap: 2 }]}>
        {pill.map((item) => {
          const press = item.name === "more" ? openMenu : () => go(item.name);
          return (
            <TabButton key={item.name} name={item.name} selected={selected} hot={active === item.name} commit={item.name !== "more"} onAim={setLit} width={50} height={40} onPress={press}>
              <Icon name={item.icon} size={20} color={tokens.inkStrong} strokeWidth={lit === item.name ? 2.2 : 1.7} />
            </TabButton>
          );
        })}
      </View>
      {allowed("customers") ? (
        <View style={[float, { width: 48, height: 48, borderRadius: 24 }]}>
          <TabButton name="customers" selected={selected} hot={active === "customers"} onAim={setLit} width={48} height={48} onPress={() => go("customers")}>
            <Icon name="user" size={20} color={tokens.inkStrong} strokeWidth={lit === "customers" ? 2.2 : 1.7} />
          </TabButton>
        </View>
      ) : null}
    </View>
  );
}
