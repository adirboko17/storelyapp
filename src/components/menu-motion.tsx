import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { BackHandler, StyleSheet, useWindowDimensions } from "react-native";
import { usePathname, useRouter, type Href } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { AppMenu } from "@/components/app-menu";
import { tokens } from "@/theme/tokens";

export const MENU_SPRING = { damping: 130, stiffness: 1400 };

function softTap() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => undefined);
}

function statusForPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "orders" && parts.length > 1) return "dark" as const;
  if (parts[0] === "products" && parts.length > 1) return "dark" as const;
  if (parts[0] === "customers" && parts.length > 1) return "dark" as const;
  if (parts[0] === "more" && parts[1] === "discounts" && parts.length > 2) return "dark" as const;
  if (parts[0] === "more" && parts[1] === "area" && parts.length > 3) return "dark" as const;
  return "light" as const;
}

type MenuApi = {
  openMenu: () => void;
  closeMenu: (haptic?: boolean) => void;
  blocking: boolean;
  menuProgress: SharedValue<number>;
};

const MenuContext = createContext<MenuApi | null>(null);

export function MenuProvider({ children }: { children: ReactNode }) {
  const menuProgress = useSharedValue(0);
  const [blocking, setBlocking] = useState(false);
  const pathname = usePathname();

  const openMenu = useCallback(() => {
    setStatusBarStyle("light");
    setBlocking(true);
    menuProgress.set(withSpring(1, MENU_SPRING));
  }, [menuProgress]);

  const closeMenu = useCallback((haptic = true) => {
    if (haptic) softTap();
    setBlocking(false);
    setStatusBarStyle(statusForPath(pathname));
    menuProgress.set(withSpring(0, MENU_SPRING));
  }, [menuProgress, pathname]);

  const value = useMemo(() => ({ openMenu, closeMenu, blocking, menuProgress }), [openMenu, closeMenu, blocking, menuProgress]);

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export function useMenu() {
  const value = useContext(MenuContext);
  if (!value) throw new Error("useMenu must be used within MenuProvider");
  return value;
}

export function AnimatedTabsContainer({ children }: { children: ReactNode }) {
  const { menuProgress } = useMenu();
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(menuProgress.get(), [0, 1], [0, 20]) }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

export function MenuOverlay() {
  const { closeMenu, blocking, menuProgress } = useMenu();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const distance = height * 0.15;

  useEffect(() => {
    if (!blocking) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeMenu();
      return true;
    });
    return () => sub.remove();
  }, [blocking, closeMenu]);

  const fade = useAnimatedStyle(() => ({
    opacity: interpolate(menuProgress.get(), [0, 1], [0, 1]),
  }));

  const motion = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(menuProgress.get(), [0, 1], [distance, 0]) },
      { scale: interpolate(menuProgress.get(), [0, 1], [0.8, 1]) },
    ],
  }));

  return (
    <Animated.View
      pointerEvents={blocking ? "auto" : "none"}
      accessibilityElementsHidden={!blocking}
      importantForAccessibility={blocking ? "auto" : "no-hide-descendants"}
      style={[StyleSheet.absoluteFill, { zIndex: 30, backgroundColor: tokens.night }, fade]}
    >
      <Animated.View style={[{ flex: 1, overflow: "visible" }, motion]}>
        <AppMenu
          onDismiss={closeMenu}
          onNavigate={(href) => {
            closeMenu(false);
            router.navigate(href as Href);
          }}
        />
      </Animated.View>
    </Animated.View>
  );
}
