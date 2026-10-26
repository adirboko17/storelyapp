import { Image, type ImageStyle, type StyleProp } from "react-native";

export function Logo({ height = 26, style }: { height?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={require("../../assets/brand/storely-logo.png")}
      style={[{ height, width: height }, style]}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
