import { useEffect, useState, useSyncExternalStore } from "react";
import { ScrollView, Switch, View } from "react-native";
import { Icon, type IconName } from "@/components/icon";
import { AppText, ErrorNote } from "@/components/ui";
import { alertPrefsHydrated, getAlertPrefs, hydrateAlertPrefs, setAlertPref, subscribeAlertPrefs, type AlertPrefs } from "@/lib/alert-prefs";
import { ensureAlertPermission } from "@/lib/sale-alerts";
import { useFontSet } from "@/theme/fonts";
import { TAB_SPACE, tokens } from "@/theme/tokens";

const ROWS: { key: keyof AlertPrefs; title: string; detail: string; icon: IconName }[] = [
  { key: "sale", title: "מכירה חדשה", detail: "צליל בכל מכירה שנכנסת לחנות", icon: "bell" },
  { key: "abandoned", title: "עגלה נטושה", detail: "צליל המערכת כשלקוח עוזב עגלה", icon: "orders" },
];

export function NotificationSettings() {
  const fonts = useFontSet();
  const prefs = useSyncExternalStore(subscribeAlertPrefs, getAlertPrefs, getAlertPrefs);
  const [ready, setReady] = useState(alertPrefsHydrated);
  const [note, setNote] = useState("");
  const active = ROWS.filter((row) => prefs[row.key]).length;

  useEffect(() => {
    void hydrateAlertPrefs().finally(() => setReady(true));
  }, []);

  async function toggle(key: keyof AlertPrefs, value: boolean) {
    setNote("");
    if (value) {
      const allowed = await ensureAlertPermission();
      if (!allowed) {
        setNote("כדי להדליק התראות צריך לאשר אותן בהגדרות הטלפון.");
        return;
      }
    }
    await setAlertPref(key, value);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f6f6f6" }} contentContainerStyle={{ padding: 16, paddingBottom: TAB_SPACE + 24, gap: 12 }}>
      <View style={{ paddingHorizontal: 4, paddingBottom: 4, gap: 8 }}>
        <AppText style={{ fontSize: 15, color: tokens.inkSecondary, lineHeight: 22 }}>בחר אילו אירועים בחנות ישמיעו התראה בטלפון.</AppText>
        <View style={{ alignSelf: "flex-start", height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: active ? tokens.activeBg : tokens.card, borderWidth: active ? 0 : 1, borderColor: tokens.line, justifyContent: "center" }}>
          <AppText style={{ fontFamily: fonts.semibold, fontSize: 12, color: active ? tokens.activeText : tokens.inkSecondary }}>
            {active === 0 ? "ההתראות כבויות" : active === 1 ? "התראה אחת פעילה" : `${active} התראות פעילות`}
          </AppText>
        </View>
      </View>
      {note ? <ErrorNote text={note} /> : null}
      {ROWS.map((row) => {
        const on = prefs[row.key];
        return (
          <View key={row.key} style={{ backgroundColor: tokens.card, borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderColor: on ? "#d7f5e3" : "rgba(26,26,26,0.06)" }}>
            <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: on ? tokens.inkStrong : tokens.field, alignItems: "center", justifyContent: "center" }}>
              <Icon name={row.icon} size={22} color={on ? "#ffffff" : tokens.inkStrong} strokeWidth={1.7} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <AppText style={{ fontFamily: fonts.bold, fontSize: 16, color: tokens.inkStrong }}>{row.title}</AppText>
              <AppText style={{ color: tokens.inkSecondary, fontSize: 13, lineHeight: 18 }}>{row.detail}</AppText>
            </View>
            <Switch
              value={on}
              disabled={!ready}
              onValueChange={(value) => void toggle(row.key, value)}
              trackColor={{ false: "#d9d9d9", true: "#1f7a4d" }}
              thumbColor="#ffffff"
              ios_backgroundColor="#d9d9d9"
            />
          </View>
        );
      })}
    </ScrollView>
  );
}
