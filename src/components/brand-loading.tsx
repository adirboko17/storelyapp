import { useEffect, useState } from "react";
import { Animated, Easing, Image, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { tokens } from "@/theme/tokens";

export function BrandMark({ size }: { size: number }) {
  const [breath] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);

  const opacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  const translateY = breath.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { scale }] }}>
      <Image
        source={require("../../assets/brand/storely-mark.png")}
        style={{ width: size * 0.78, height: size }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </Animated.View>
  );
}

export function BootScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: tokens.login, alignItems: "center", justifyContent: "center" }}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["rgba(150,205,255,0.72)", "rgba(28,72,140,0.28)", tokens.login]}
        locations={[0, 0.46, 0.78]}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        start={{ x: 0.5, y: 0.15 }}
        end={{ x: 0.5, y: 1 }}
      />
      <BrandMark size={128} />
    </View>
  );
}
