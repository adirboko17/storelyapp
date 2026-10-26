import { createContext, useContext, type ReactNode } from "react";
import { useFonts } from "expo-font";
import { Assistant_400Regular } from "@expo-google-fonts/assistant/400Regular";
import { Assistant_500Medium } from "@expo-google-fonts/assistant/500Medium";
import { Assistant_600SemiBold } from "@expo-google-fonts/assistant/600SemiBold";
import { Assistant_700Bold } from "@expo-google-fonts/assistant/700Bold";
import { Assistant_800ExtraBold } from "@expo-google-fonts/assistant/800ExtraBold";
import { Heebo_400Regular } from "@expo-google-fonts/heebo/400Regular";
import { Heebo_500Medium } from "@expo-google-fonts/heebo/500Medium";
import { Heebo_600SemiBold } from "@expo-google-fonts/heebo/600SemiBold";
import { Heebo_700Bold } from "@expo-google-fonts/heebo/700Bold";
import { Heebo_800ExtraBold } from "@expo-google-fonts/heebo/800ExtraBold";

export type FontSet = {
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
  extrabold: string;
};

const assistant: FontSet = {
  regular: "Assistant_400Regular",
  medium: "Assistant_500Medium",
  semibold: "Assistant_600SemiBold",
  bold: "Assistant_700Bold",
  extrabold: "Assistant_800ExtraBold",
};

const heebo: FontSet = {
  regular: "Heebo_400Regular",
  medium: "Heebo_500Medium",
  semibold: "Heebo_600SemiBold",
  bold: "Heebo_700Bold",
  extrabold: "Heebo_800ExtraBold",
};

const system: FontSet = {
  regular: "System",
  medium: "System",
  semibold: "System",
  bold: "System",
  extrabold: "System",
};

const FontContext = createContext<FontSet>(assistant);

export function useFontSet() {
  return useContext(FontContext);
}

export function FontGate({ children }: { children: ReactNode }) {
  const [loaded, error] = useFonts({
    Assistant_400Regular,
    Assistant_500Medium,
    Assistant_600SemiBold,
    Assistant_700Bold,
    Assistant_800ExtraBold,
  });
  if (error) return <HeeboGate>{children}</HeeboGate>;
  if (!loaded) return null;
  return <FontContext.Provider value={assistant}>{children}</FontContext.Provider>;
}

function HeeboGate({ children }: { children: ReactNode }) {
  const [loaded, error] = useFonts({
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_600SemiBold,
    Heebo_700Bold,
    Heebo_800ExtraBold,
  });
  if (!loaded && !error) return null;
  return <FontContext.Provider value={error ? system : heebo}>{children}</FontContext.Provider>;
}
