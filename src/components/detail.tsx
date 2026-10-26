import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { DetailHeader } from "@/components/shell";
import { AppText } from "@/components/ui";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, tokens } from "@/theme/tokens";

export function DetailScreen({ title, actions, children, scroll = true }: { title: string; actions?: ReactNode; children: ReactNode; scroll?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: tokens.card }}>
      <DetailHeader title={title} actions={actions} />
      {scroll ? <ScrollView contentContainerStyle={{ paddingBottom: TAB_SPACE + 20 }}>{children}</ScrollView> : children}
    </View>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  const fonts = useFontSet();
  return (
    <View style={{ marginHorizontal: 12, marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: tokens.line, padding: 14, gap: 10, backgroundColor: tokens.card }}>
      {title ? <AppText style={{ fontFamily: fonts.bold, fontSize: 15, color: tokens.inkStrong }}>{title}</AppText> : null}
      {children}
    </View>
  );
}

export function InfoRow({ label, value, strong = false, ltr = false }: { label: string; value?: string | null; strong?: boolean; ltr?: boolean }) {
  const fonts = useFontSet();
  if (!value) return null;
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <AppText style={{ flex: 1, color: strong ? tokens.inkStrong : tokens.inkSecondary, fontFamily: strong ? fonts.bold : fonts.regular }}>{label}</AppText>
      <AppText style={{ flexShrink: 1, color: tokens.inkStrong, fontFamily: strong ? fonts.bold : fonts.regular, writingDirection: ltr ? "ltr" : "rtl", textAlign: "left" }}>{value}</AppText>
    </View>
  );
}
