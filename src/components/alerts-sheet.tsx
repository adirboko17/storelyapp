import { useEffect, useState } from "react";
import { BackHandler, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import * as Haptics from "expo-haptics";
import Animated, { Easing, FadeInDown, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/icon";
import { AppText } from "@/components/ui";
import { systemAlerts, type SystemAlert } from "@/lib/system-alerts";
import { useFontSet } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

const SHEET = "#f6f6f6";
const RADIUS = 28;
const OPEN_SPRING = { damping: 20, stiffness: 210, mass: 0.86 };
const CLOSE_MS = 340;

const alertDate = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jerusalem",
});

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return alertDate.format(date);
}

export function AlertsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const fonts = useFontSet();
  const progress = useSharedValue(0);
  const [shown, setShown] = useState(visible);
  const [items, setItems] = useState<SystemAlert[]>(() => systemAlerts());
  const [seen, setSeen] = useState(visible);
  if (visible !== seen) {
    setSeen(visible);
    if (visible) {
      setShown(true);
      setItems(systemAlerts());
    }
  }
  const unread = items.some((item) => item.unread);

  useEffect(() => {
    if (visible) {
      progress.set(withSpring(1, OPEN_SPRING));
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => undefined);
      return;
    }
    progress.set(withTiming(0, { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) }));
    const timer = setTimeout(() => setShown(false), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [progress, visible]);

  useEffect(() => {
    if (!shown) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose, shown]);

  const backdrop = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 1], [0, 1]),
  }));

  const sheet = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.get(), [0, 1], [height, 0]) }],
  }));

  function markAllRead() {
    if (!unread) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => undefined);
    setItems((current) => current.map((item) => ({ ...item, unread: false })));
  }

  function openItem(id: string) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, unread: false } : item)));
  }

  return (
    <Modal visible={shown} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.4)" }, backdrop]}>
        <Pressable accessibilityRole="button" accessibilityLabel="סגירה" onPress={onClose} style={{ flex: 1 }} />
      </Animated.View>
      <Animated.View style={[{ position: "absolute", left: 0, right: 0, bottom: 0, top: insets.top + 36, borderTopLeftRadius: RADIUS, borderTopRightRadius: RADIUS, backgroundColor: SHEET, shadowColor: "#000", shadowOpacity: 0.22, shadowRadius: 24, shadowOffset: { width: 0, height: -8 }, elevation: 18 }, sheet]}>
        <View style={{ flex: 1, borderTopLeftRadius: RADIUS, borderTopRightRadius: RADIUS, overflow: "hidden", backgroundColor: SHEET }}>
        <View style={{ paddingTop: 14, paddingBottom: 10, paddingHorizontal: 12, backgroundColor: "#ffffff", borderBottomWidth: 1, borderBottomColor: tokens.line, flexDirection: "row", alignItems: "center", direction: "rtl" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="סגירה" onPress={onClose} hitSlop={8} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
            <Icon name="close" size={18} color={tokens.inkStrong} strokeWidth={2} />
          </Pressable>
          <AppText style={{ flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 17, color: tokens.inkStrong }}>התראות</AppText>
          {items.length ? (
            <Pressable accessibilityRole="button" accessibilityLabel="סימון הכל כנקרא" disabled={!unread} onPress={markAllRead} hitSlop={8} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center", opacity: unread ? 1 : 0.35 }}>
              <Icon name="check" size={18} color={tokens.inkStrong} strokeWidth={2} />
            </Pressable>
          ) : <View style={{ width: 36 }} />}
        </View>

        {items.length ? (
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
            <View style={{ backgroundColor: "#ffffff" }}>
              {items.map((item, index) => (
                <Animated.View key={item.id} entering={FadeInDown.delay(70 + index * 36).duration(320)}>
                  <Pressable onPress={() => openItem(item.id)} style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: tokens.line, backgroundColor: pressed ? tokens.hover : "#ffffff", direction: "rtl" })}>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ width: 8, paddingTop: 6 }}>
                        {item.unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.chart }} /> : null}
                      </View>
                      <View style={{ flex: 1, gap: 3, alignItems: "flex-start" }}>
                        <AppText style={{ fontSize: 13, color: tokens.inkSecondary }}>{[item.source, when(item.createdAt)].filter(Boolean).join(" • ")}</AppText>
                        <AppText style={{ fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }}>{item.title}</AppText>
                        {item.body ? <AppText style={{ fontSize: 14, lineHeight: 20, color: tokens.ink }}>{item.body}</AppText> : null}
                      </View>
                    </View>
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          </ScrollView>
        ) : (
          <Animated.View entering={FadeInDown.delay(90).duration(420).springify()} style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36, paddingBottom: insets.bottom + 24 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Icon name="bell" size={30} color={tokens.inkStrong} strokeWidth={1.6} />
            </View>
            <AppText style={{ fontFamily: fonts.bold, fontSize: 18, color: tokens.inkStrong, textAlign: "center" }}>כרגע אין התראות מערכת</AppText>
            <AppText style={{ marginTop: 6, fontSize: 15, lineHeight: 22, color: tokens.inkSecondary, textAlign: "center" }}>עדכונים חשובים מהמערכת יופיעו כאן.</AppText>
          </Animated.View>
        )}
        </View>
      </Animated.View>
      </View>
    </Modal>
  );
}
