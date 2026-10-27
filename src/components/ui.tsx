import { Pressable, RefreshControl, Text, TextInput, View, type TextProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandMark } from "@/components/brand-loading";
import { Icon } from "@/components/icon";
import { Logo } from "@/components/logo";
import { useFontSet } from "@/theme/fonts";
import { cardShadow, tokens } from "@/theme/tokens";

export function AppText({ style, ...props }: TextProps) {
  const fonts = useFontSet();
  return (
    <Text
      {...props}
      style={[{ fontFamily: fonts.regular, color: tokens.ink, fontSize: 14, writingDirection: "rtl" }, style]}
    />
  );
}

export function StoreHeader({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  const fonts = useFontSet();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: tokens.card, borderBottomWidth: 1, borderBottomColor: tokens.line }}>
      <View style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 10 }}>
        <AppText style={{ fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }} numberOfLines={1}>
          {title}
        </AppText>
      </View>
    </View>
  );
}

export function MenuBar() {
  const insets = useSafeAreaInsets();
  const fonts = useFontSet();
  return (
    <View style={{ paddingTop: insets.top, backgroundColor: tokens.shell }}>
      <View style={{ height: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 }}>
        <Logo height={26} />
        <AppText style={{ color: "#ffffff", fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.4 }}>storely</AppText>
      </View>
    </View>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const fonts = useFontSet();
  return (
    <View style={[cardShadow, { marginHorizontal: 12, marginTop: 12, minHeight: 42, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 }]}>
      <Icon name="search" size={16} color={tokens.inkSecondary} strokeWidth={1.8} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#8a8a8a"
        style={{ flex: 1, height: 42, fontFamily: fonts.regular, fontSize: 14, color: tokens.ink, textAlign: "right", writingDirection: "rtl" }}
      />
    </View>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 28 }}>
      <AppText style={{ color: tokens.inkSecondary, textAlign: "center" }}>{text}</AppText>
    </View>
  );
}

export function ErrorNote({ text }: { text: string }) {
  if (!text) return null;
  return (
    <View style={{ marginHorizontal: 12, marginTop: 12, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "rgba(142,31,11,0.25)", paddingHorizontal: 14, paddingVertical: 12 }}>
      <AppText style={{ color: tokens.negative, fontSize: 13, lineHeight: 20 }}>{text}</AppText>
    </View>
  );
}

export function LoadingBlock(_props?: { label?: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: tokens.canvas }}>
      <BrandMark size={72} />
    </View>
  );
}

export function Badge({ label, background, color }: { label: string; background: string; color: string }) {
  const fonts = useFontSet();
  return (
    <View style={{ height: 20, borderRadius: 6, backgroundColor: background, alignItems: "center", justifyContent: "center", paddingHorizontal: 7, alignSelf: "flex-start" }}>
      <AppText style={{ color, fontFamily: fonts.medium, fontSize: 12 }}>{label}</AppText>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const fonts = useFontSet();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{ height: 44, borderRadius: 8, backgroundColor: tokens.inkStrong, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.7 : 1 }}
    >
      <AppText style={{ color: "#ffffff", fontFamily: fonts.semibold, fontSize: 14 }}>{label}</AppText>
    </Pressable>
  );
}

export function QuietButton({ label, onPress }: { label: string; onPress: () => void }) {
  const fonts = useFontSet();
  return (
    <Pressable onPress={onPress} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
      <AppText style={{ color: tokens.link, fontFamily: fonts.medium, fontSize: 14 }}>{label}</AppText>
    </Pressable>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={[cardShadow, { backgroundColor: tokens.card }]}>{children}</View>;
}

export function refreshControl(refreshing: boolean, onRefresh: () => void) {
  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.inkStrong} colors={[tokens.inkStrong]} />;
}
