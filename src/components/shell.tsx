import { useCallback, useState, type ReactNode } from "react";
import { Image, Modal, Pressable, ScrollView, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/icon";
import { AppText } from "@/components/ui";
import { useFontSet } from "@/theme/fonts";
import { SHEET_RADIUS, tokens } from "@/theme/tokens";

export function useStatusBar(style: "light" | "dark") {
  useFocusEffect(useCallback(() => {
    setStatusBarStyle(style);
  }, [style]));
}

export function RoundButton({ icon, onPress, dark = false, size = 36 }: { icon: IconName; onPress: () => void; dark?: boolean; size?: number }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: dark ? tokens.nightRaised : tokens.field }}
    >
      <Icon name={icon} size={18} color={dark ? "#ffffff" : tokens.inkStrong} strokeWidth={1.8} />
    </Pressable>
  );
}

export type SwitchOption = { label: string; href?: string; active?: boolean };

export function NightScreen({
  title,
  options,
  actions,
  children,
}: {
  title: string;
  options?: SwitchOption[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  useStatusBar("light");
  const insets = useSafeAreaInsets();
  const fonts = useFontSet();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const switchable = Boolean(options && options.length > 1);
  return (
    <View style={{ flex: 1, backgroundColor: tokens.night }}>
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 16, paddingBottom: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable disabled={!switchable} onPress={() => setOpen(true)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4 }}>
          <AppText style={{ color: "#ffffff", fontFamily: fonts.bold, fontSize: 24 }} numberOfLines={1}>{title}</AppText>
          {switchable ? <Icon name="down" size={18} color="#ffffff" strokeWidth={2} /> : null}
        </Pressable>
        {actions}
      </View>
      <View style={{ flex: 1, backgroundColor: tokens.card, borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS, overflow: "hidden" }}>
        {children}
      </View>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", paddingTop: insets.top + 52, paddingHorizontal: 12 }}>
          <View style={{ alignSelf: "flex-start", minWidth: 220, backgroundColor: tokens.card, borderRadius: 14, paddingVertical: 6, direction: "rtl" }}>
            {(options ?? []).map((option) => (
              <Pressable
                key={option.label}
                onPress={() => {
                  setOpen(false);
                  if (option.href && !option.active) router.push(option.href as never);
                }}
                style={{ height: 44, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <AppText style={{ flex: 1, fontFamily: option.active ? fonts.bold : fonts.regular, fontSize: 15 }}>{option.label}</AppText>
                {option.active ? <AppText style={{ color: tokens.inkStrong }}>✓</AppText> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function SearchBar({
  value,
  onChange,
  placeholder,
  onSort,
  sortActive = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onSort?: () => void;
  sortActive?: boolean;
}) {
  const fonts = useFontSet();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingTop: 12 }}>
      <View style={{ flex: 1, height: 38, borderRadius: 10, backgroundColor: tokens.field, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10 }}>
        <Icon name="search" size={16} color={tokens.inkSecondary} strokeWidth={1.8} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#8a8a8a"
          returnKeyType="search"
          style={{ flex: 1, height: 38, fontFamily: fonts.regular, fontSize: 15, color: tokens.inkStrong, textAlign: "right", writingDirection: "rtl" }}
        />
      </View>
      {onSort ? (
        <Pressable onPress={onSort} style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: sortActive ? tokens.inkStrong : tokens.field }}>
          <Icon name="sort" size={17} color={sortActive ? "#ffffff" : tokens.inkStrong} strokeWidth={1.8} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Chips<T extends string>({ items, value, onChange }: { items: { id: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  const fonts = useFontSet();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 4, paddingHorizontal: 12, paddingVertical: 10 }}>
      {items.map((item) => {
        const on = item.id === value;
        return (
          <Pressable key={item.id} onPress={() => onChange(item.id)} style={{ height: 30, borderRadius: 8, paddingHorizontal: 11, justifyContent: "center", backgroundColor: on ? "#e3e3e3" : "transparent" }}>
            <AppText style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 14, color: tokens.inkStrong }}>{item.label}</AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function SectionLabel({ text }: { text: string }) {
  return (
    <View style={{ backgroundColor: tokens.section, paddingHorizontal: 16, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: tokens.line }}>
      <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }}>{text}</AppText>
    </View>
  );
}

export function FlatRow({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const body = <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tokens.line, backgroundColor: tokens.card }}>{children}</View>;
  if (!onPress) return body;
  return <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>{body}</Pressable>;
}

export function Thumb({ uri, size = 40 }: { uri?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: 8, borderWidth: 1, borderColor: tokens.line, backgroundColor: tokens.card, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {uri ? <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" /> : <Icon name="image" size={size * 0.45} color="#b5b5b5" />}
    </View>
  );
}

export function DetailHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  useStatusBar("dark");
  const insets = useSafeAreaInsets();
  const fonts = useFontSet();
  const router = useRouter();
  return (
    <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 12, paddingBottom: 8, backgroundColor: tokens.card, flexDirection: "row", alignItems: "center", gap: 8 }}>
      <RoundButton icon="back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      <AppText style={{ flex: 1, textAlign: "center", fontFamily: fonts.bold, fontSize: 17, color: tokens.inkStrong }} numberOfLines={1}>{title}</AppText>
      <View style={{ minWidth: 36, flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>{actions}</View>
    </View>
  );
}

export function SheetEmpty({ icon = "search", text }: { icon?: IconName; text: string }) {
  return (
    <View style={{ alignItems: "center", paddingTop: 80, paddingHorizontal: 24, gap: 10 }}>
      <Icon name={icon} size={30} color="#b5b5b5" strokeWidth={1.6} />
      <AppText style={{ color: tokens.inkSecondary, textAlign: "center" }}>{text}</AppText>
    </View>
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "S";
}
