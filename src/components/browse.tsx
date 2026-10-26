import type { ReactNode } from "react";
import { FlatList, Pressable, ScrollView, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { AppText, EmptyState, ErrorNote, LoadingBlock, SearchField, refreshControl } from "@/components/ui";
import { cardShadow, tokens } from "@/theme/tokens";

export function JumpRow({ items }: { items: Array<{ label: string; href: string }> }) {
  const router = useRouter();
  if (!items.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingTop: 12 }}>
      {items.map((item) => (
        <Pressable
          key={item.href}
          onPress={() => router.push(item.href as Href)}
          style={{ height: 32, borderRadius: 8, backgroundColor: tokens.card, borderWidth: 1, borderColor: tokens.line, paddingHorizontal: 12, justifyContent: "center" }}
        >
          <AppText style={{ fontSize: 13 }}>{item.label}</AppText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function FactList({ rows }: { rows: Array<{ label: string; value?: string | null }> }) {
  const visible = rows.filter((row) => row.value);
  if (!visible.length) return null;
  return (
    <View style={[cardShadow, { padding: 16, gap: 12 }]}>
      {visible.map((row) => (
        <View key={row.label} style={{ gap: 2 }}>
          <AppText style={{ color: tokens.inkSecondary, fontSize: 12 }}>{row.label}</AppText>
          <AppText>{row.value}</AppText>
        </View>
      ))}
    </View>
  );
}

export function BrowseList<T>({
  query,
  onQuery,
  placeholder,
  data,
  empty,
  error,
  loading,
  refreshing,
  onRefresh,
  keyExtractor,
  onPress,
  renderItem,
  header,
}: {
  query?: string;
  onQuery?: (value: string) => void;
  placeholder?: string;
  data: T[];
  empty: string;
  error?: string;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  keyExtractor: (item: T) => string;
  onPress?: (item: T) => void;
  renderItem: (item: T) => ReactNode;
  header?: ReactNode;
}) {
  if (loading) return <LoadingBlock />;
  return (
    <View style={{ flex: 1, backgroundColor: tokens.canvas }}>
      {error ? <ErrorNote text={error} /> : null}
      {onQuery ? <SearchField value={query ?? ""} onChange={onQuery} placeholder={placeholder ?? "חיפוש"} /> : null}
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ flexGrow: 1, paddingTop: 12, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? refreshControl(Boolean(refreshing), onRefresh) : undefined}
        ListHeaderComponent={header ? <View style={{ marginBottom: 8 }}>{header}</View> : undefined}
        ListEmptyComponent={error ? undefined : <EmptyState text={query?.trim() ? "אין תוצאות לחיפוש" : empty} />}
        renderItem={({ item }) => {
          const body = (
            <View style={[cardShadow, { marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 12 }]}>
              {renderItem(item)}
            </View>
          );
          if (!onPress) return body;
          return <Pressable onPress={() => onPress(item)}>{body}</Pressable>;
        }}
      />
    </View>
  );
}
