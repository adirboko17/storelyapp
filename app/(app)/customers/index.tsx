import { useMemo, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { JumpRow } from "@/components/browse";
import { ResourceList } from "@/components/resource-list";
import { AppText } from "@/components/ui";
import { formatCount } from "@/lib/format";
import type { CustomerRecord } from "@/lib/snapshot";
import { useStoreData } from "@/lib/store-data";
import { useFontSet } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

export default function CustomersScreen() {
  const fonts = useFontSet();
  const router = useRouter();
  const { snapshot } = useStoreData();
  const [query, setQuery] = useState("");
  const customers = snapshot?.customers;
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = customers ?? [];
    if (!needle) return list;
    return list.filter((person) => `${person.name ?? ""} ${person.email ?? ""} ${person.phone ?? ""} ${person.city ?? ""}`.toLowerCase().includes(needle));
  }, [customers, query]);

  return (
    <ResourceList
      permission="customers.read"
      query={query}
      onQuery={setQuery}
      placeholder="חיפוש לקוחות"
      data={customers ? rows : []}
      empty={customers ? "אין לקוחות עדיין" : "הסנאפשוט לא כולל לקוחות."}
      keyExtractor={(person) => person.id}
      onPress={(person) => router.push(`/customers/${person.id}`)}
      extra={<JumpRow items={[{ label: "פלחים", href: "/more/area/segments" }]} />}
      renderItem={(person) => <CustomerRow person={person} bold={fonts.semibold} />}
    />
  );
}

function CustomerRow({ person, bold }: { person: CustomerRecord; bold: string }) {
  const detail = [person.email, person.phone, person.city].filter(Boolean).join(" · ");
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <AppText style={{ flex: 1, fontFamily: bold }} numberOfLines={1}>{person.name || ""}</AppText>
        {person.orders != null ? <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }}>{formatCount(person.orders)} הזמנות</AppText> : null}
      </View>
      {detail ? <AppText style={{ color: tokens.inkSecondary, fontSize: 13 }} numberOfLines={1}>{detail}</AppText> : null}
    </View>
  );
}
