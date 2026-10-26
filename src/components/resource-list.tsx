import type { ReactNode } from "react";
import { FlatList, Pressable, View } from "react-native";
import { AppText, EmptyState, ErrorNote, LoadingBlock, SearchField, StoreHeader, refreshControl } from "@/components/ui";
import { useAllowed, useStoreData, useStoreTitle } from "@/lib/store-data";
import { cardShadow, tokens } from "@/theme/tokens";

export function ResourceList<T>({
  permission,
  query,
  onQuery,
  placeholder,
  data,
  empty,
  keyExtractor,
  onPress,
  renderItem,
  header = true,
  extra,
}: {
  permission: string;
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  data: T[];
  empty: string;
  keyExtractor: (item: T) => string;
  onPress: (item: T) => void;
  renderItem: (item: T) => ReactNode;
  header?: boolean;
  extra?: ReactNode;
}) {
  const title = useStoreTitle();
  const allowed = useAllowed(permission);
  const { loading, refreshing, error, refresh } = useStoreData();
  const top = header ? <StoreHeader title={title} /> : null;
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.canvas }}>
        {top}
        <LoadingBlock />
      </View>
    );
  }
  if (!allowed) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.canvas }}>
        {top}
        <View style={{ padding: 16 }}>
          <AppText style={{ color: tokens.inkSecondary }}>אין הרשאה למסך הזה.</AppText>
        </View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: tokens.canvas }}>
      {top}
      {extra}
      {error ? <ErrorNote text={error} /> : null}
      <SearchField value={query} onChange={onQuery} placeholder={placeholder} />
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ flexGrow: 1, paddingTop: 12, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl(refreshing, () => void refresh())}
        ListEmptyComponent={error ? undefined : <EmptyState text={query.trim() ? "אין תוצאות לחיפוש" : empty} />}
        renderItem={({ item }) => (
          <Pressable onPress={() => onPress(item)} style={[cardShadow, { marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 12 }]}>
            {renderItem(item)}
          </Pressable>
        )}
      />
    </View>
  );
}
