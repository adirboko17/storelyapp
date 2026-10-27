import type { ReactNode } from "react";
import { FlatList, View } from "react-native";
import { FlatRow, SearchBar, SheetEmpty } from "@/components/shell";
import { AppText, ErrorNote, LoadingBlock, refreshControl } from "@/components/ui";
import { TAB_SPACE, tokens } from "@/theme/tokens";

export function FactList({ rows }: { rows: { label: string; value?: string | null }[] }) {
  const visible = rows.filter((row) => row.value);
  if (!visible.length) return null;
  return (
    <View style={{ borderRadius: 14, borderWidth: 1, borderColor: tokens.line, padding: 14, gap: 12, backgroundColor: tokens.card }}>
      {visible.map((row) => (
        <View key={row.label} style={{ gap: 2 }}>
          <AppText style={{ color: tokens.inkSecondary, fontSize: 12 }}>{row.label}</AppText>
          <AppText style={{ color: tokens.inkStrong }}>{row.value}</AppText>
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
  onLongPress,
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
  onLongPress?: (item: T) => void;
  renderItem: (item: T) => ReactNode;
  header?: ReactNode;
}) {
  if (loading) return <LoadingBlock />;
  return (
    <View style={{ flex: 1, backgroundColor: tokens.card }}>
      {onQuery ? <SearchBar value={query ?? ""} onChange={onQuery} placeholder={placeholder ?? "חיפוש"} /> : null}
      {error ? <ErrorNote text={error} /> : null}
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ flexGrow: 1, paddingTop: 8, paddingBottom: TAB_SPACE + 12 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? refreshControl(Boolean(refreshing), onRefresh) : undefined}
        ListHeaderComponent={header ? <View style={{ paddingVertical: 8 }}>{header}</View> : undefined}
        ListEmptyComponent={error ? undefined : <SheetEmpty text={query?.trim() ? "אין תוצאות לחיפוש" : empty} />}
        renderItem={({ item }) => <FlatRow onPress={onPress ? () => onPress(item) : undefined} onLongPress={onLongPress ? () => onLongPress(item) : undefined}>{renderItem(item)}</FlatRow>}
      />
    </View>
  );
}
