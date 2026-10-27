import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FlatList, Image, Pressable, TextInput, View } from "react-native";
import { useIsFocused, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Icon } from "@/components/icon";
import { AppText } from "@/components/ui";
import { useFontSet } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

const TOP_PAD = 8;
const COMPACT_BODY = 48;
const SEARCH_BAR = 40;
const SEARCH_FILTERS = 56;
const SEARCH_BODY = SEARCH_BAR + SEARCH_FILTERS;
const TITLES: Record<string, string> = {
  orders: "הזמנות",
  products: "מוצרים",
  customers: "לקוחות",
};

export type HeaderSlot =
  | { kind: "home"; owner: "home"; title: string; initials: string; logoUrl: string }
  | { kind: "compact"; owner: string; title: string; switchable: boolean; add?: boolean }
  | { kind: "search"; owner: "search"; scopes: { id: string; label: string }[] };

type HeaderHandlers = {
  onAvatar?: () => void;
  onBell?: () => void;
  onSwitch?: () => void;
  onAdd?: () => void;
  onClose?: () => void;
  onSubmit?: (query: string) => void;
};

type HeaderContextValue = {
  slot: HeaderSlot | null;
  setSlot: (update: HeaderSlot | null | ((current: HeaderSlot | null) => HeaderSlot | null)) => void;
};

let headerHandlers: HeaderHandlers = {};
let searchReturn = "/";

export function rememberSearchFrom(path: string) {
  if (path && path !== "/search") searchReturn = path;
}

export function searchReturnPath() {
  return searchReturn || "/";
}

const SetSlotContext = createContext<HeaderContextValue["setSlot"] | null>(null);
const SlotContext = createContext<HeaderSlot | null>(null);

function headerKey(slot: HeaderSlot | null) {
  if (!slot) return "";
  if (slot.kind === "home") return `home:${slot.title}:${slot.initials}:${slot.logoUrl}`;
  if (slot.kind === "compact") return `compact:${slot.owner}:${slot.title}:${slot.switchable}:${Boolean(slot.add)}`;
  return `search:${slot.scopes.map((item) => `${item.id}:${item.label}`).join("|")}`;
}

type SearchDraft = {
  query: string;
  setQuery: (value: string) => void;
  scope: string;
  setScope: (value: string) => void;
};

const SearchContext = createContext<SearchDraft | null>(null);

function tabRoot(pathname: string) {
  if (pathname === "/" || pathname === "") return "home";
  if (pathname === "/orders") return "orders";
  if (pathname === "/products") return "products";
  if (pathname === "/customers") return "customers";
  if (pathname === "/search") return "search";
  return null;
}

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HeaderSlot | null>(null);
  return (
    <SetSlotContext.Provider value={setSlot}>
      <SlotContext.Provider value={slot}>
        <SearchDraftProvider>{children}</SearchDraftProvider>
      </SlotContext.Provider>
    </SetSlotContext.Provider>
  );
}

function SearchDraftProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  const value = useMemo(() => ({ query, setQuery, scope, setScope }), [query, scope]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearchDraft() {
  const value = useContext(SearchContext);
  if (!value) throw new Error("useSearchDraft must be used within HeaderProvider");
  return value;
}

export function useTabHeader(slot: HeaderSlot | null, handlers: HeaderHandlers) {
  const setSlot = useContext(SetSlotContext);
  const focused = useIsFocused();
  const key = headerKey(slot);

  useLayoutEffect(() => {
    if (!focused) return;
    headerHandlers = handlers;
    return () => {
      if (headerHandlers === handlers) headerHandlers = {};
    };
  });

  useLayoutEffect(() => {
    if (!setSlot || !focused || !slot) return;
    setSlot(slot);
    const owner = slot.owner;
    return () => setSlot((existing) => (existing?.owner === owner ? null : existing));
    // `key` already describes slot. Depending on the object itself republishes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, key, setSlot]);
}

export function SharedTabsHeader() {
  const slot = useContext(SlotContext);
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const root = tabRoot(pathname);
  const matched = slot && root && slot.owner === root ? slot : null;
  const mode = root === "search" ? "search" : root ? "compact" : null;
  const height = useSharedValue(insets.top + TOP_PAD + COMPACT_BODY);
  const ready = useRef(false);

  useEffect(() => {
    if (!mode) return;
    const next = insets.top + TOP_PAD + (mode === "search" ? SEARCH_BODY : COMPACT_BODY);
    if (!ready.current || Math.abs(height.get() - next) < 1) {
      ready.current = true;
      height.set(next);
      return;
    }
    height.set(withTiming(next, { duration: 180 }));
  }, [mode, insets.top, height]);

  const animated = useAnimatedStyle(() => ({ height: height.get() }));

  if (!root) return null;

  return (
    <Animated.View style={[{ paddingTop: insets.top + TOP_PAD, backgroundColor: tokens.night, overflow: "hidden" }, animated]}>
      {root === "home" ? <HomeChrome title={matched?.kind === "home" ? matched.title : ""} initialsText={matched?.kind === "home" ? matched.initials : ""} logoUrl={matched?.kind === "home" ? matched.logoUrl : ""} /> : null}
      {root === "orders" || root === "products" || root === "customers" ? (
        <CompactChrome title={matched?.kind === "compact" ? matched.title : TITLES[root]} switchable={matched?.kind === "compact" ? matched.switchable : true} add={matched?.kind === "compact" && Boolean(matched.add)} />
      ) : null}
      {root === "search" ? (
        <Animated.View entering={FadeIn.duration(120)}>
          <SearchChrome scopes={matched?.kind === "search" ? matched.scopes : []} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function HomeChrome({ title, initialsText, logoUrl }: { title: string; initialsText: string; logoUrl: string }) {
  const fonts = useFontSet();
  return (
    <View style={{ height: COMPACT_BODY, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }}>
      <Pressable onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => undefined); headerHandlers.onAvatar?.(); }} style={{ width: 32, height: 32, borderRadius: 16, overflow: "hidden", backgroundColor: logoUrl ? "#ffffff" : "#b03bd1", alignItems: "center", justifyContent: "center" }}>
        {logoUrl ? <Image source={{ uri: logoUrl }} style={{ width: 28, height: 28 }} resizeMode="contain" accessibilityIgnoresInvertColors /> : <AppText style={{ color: "#ffffff", fontFamily: fonts.bold, fontSize: 12 }}>{initialsText}</AppText>}
      </Pressable>
      <AppText style={{ flex: 1, textAlign: "center", color: "#ffffff", fontFamily: fonts.bold, fontSize: 17 }} numberOfLines={1}>{title}</AppText>
      <Pressable onPress={() => headerHandlers.onBell?.()} hitSlop={8} style={{ width: 32, alignItems: "center" }}>
        <Icon name="bell" size={22} color="#ffffff" strokeWidth={1.7} />
      </Pressable>
    </View>
  );
}

function CompactChrome({ title, switchable, add }: { title: string; switchable: boolean; add: boolean }) {
  const fonts = useFontSet();
  return (
    <View style={{ height: COMPACT_BODY, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Pressable disabled={!switchable} onPress={() => headerHandlers.onSwitch?.()} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4 }}>
        <AppText style={{ color: "#ffffff", fontFamily: fonts.bold, fontSize: 24, flexShrink: 1 }} numberOfLines={1}>{title}</AppText>
        {switchable ? <Icon name="down" size={18} color="#ffffff" strokeWidth={2} /> : null}
      </Pressable>
      {add ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="הוספה"
          hitSlop={6}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => undefined);
            headerHandlers.onAdd?.();
          }}
          style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: tokens.nightRaised, opacity: pressed ? 0.55 : 1 })}
        >
          <Icon name="plus" size={18} color="#ffffff" strokeWidth={2} />
        </Pressable>
      ) : null}
    </View>
  );
}

function SearchChrome({ scopes }: { scopes: { id: string; label: string }[] }) {
  const fonts = useFontSet();
  const draft = useSearchDraft();
  const listRef = useRef<FlatList<{ id: string; label: string }>>(null);

  return (
    <View>
      <View style={{ height: SEARCH_BAR, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable onPress={() => headerHandlers.onClose?.()} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: tokens.nightRaised, alignItems: "center", justifyContent: "center" }}>
          <Icon name="close" size={17} color="#ffffff" strokeWidth={2} />
        </Pressable>
        <View style={{ flex: 1, height: SEARCH_BAR, borderRadius: 12, backgroundColor: tokens.nightField, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10 }}>
          <Icon name="search" size={16} color={tokens.nightMuted} strokeWidth={1.8} />
          <TextInput
            autoFocus
            value={draft.query}
            onChangeText={draft.setQuery}
            onSubmitEditing={() => headerHandlers.onSubmit?.(draft.query)}
            placeholder="חיפוש"
            placeholderTextColor={tokens.nightMuted}
            returnKeyType="search"
            selectionColor={tokens.chart}
            style={{ flex: 1, height: SEARCH_BAR, color: "#ffffff", fontFamily: fonts.regular, fontSize: 16, textAlign: "right", writingDirection: "rtl" }}
          />
          {draft.query ? (
            <Pressable onPress={() => draft.setQuery("")} hitSlop={8}>
              <Icon name="close" size={14} color={tokens.nightMuted} strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <FlatList
        ref={listRef}
        data={scopes}
        horizontal
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ height: SEARCH_FILTERS }}
        contentContainerStyle={{ gap: 4, paddingHorizontal: 12, alignItems: "center" }}
        extraData={draft.scope}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
        }}
        renderItem={({ item, index }) => (
          <FilterChip
            label={item.label}
            active={item.id === draft.scope}
            onPress={() => {
              draft.setScope(item.id);
              listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
            }}
          />
        )}
      />
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const fonts = useFontSet();
  const pressed = useSharedValue(false);
  const wash = useAnimatedStyle(() => ({
    backgroundColor: pressed.get() ? "#525252" : "transparent",
  }));
  return (
    <Pressable
      onPressIn={() => {
        pressed.set(true);
      }}
      onPressOut={() => {
        pressed.set(false);
      }}
      onPress={onPress}
      style={{ borderRadius: 8, backgroundColor: active ? tokens.nightField : "transparent" }}
    >
      <Animated.View style={[{ height: 30, paddingHorizontal: 12, borderRadius: 8, alignItems: "center", justifyContent: "center" }, wash]}>
        <AppText style={{ color: "#ffffff", fontFamily: active ? fonts.semibold : fonts.medium }}>{label}</AppText>
      </Animated.View>
    </Pressable>
  );
}
