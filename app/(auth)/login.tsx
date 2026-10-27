import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText, PrimaryButton } from "@/components/ui";
import { publicConfigProblem } from "@/lib/config";
import { useSession } from "@/lib/session";
import { useFontSet } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";

const field = {
  height: 44,
  marginTop: 6,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: tokens.fieldBorder,
  backgroundColor: "#ffffff",
  paddingHorizontal: 12,
  fontSize: 15,
  color: tokens.inkStrong,
} as const;

export default function LoginScreen() {
  const problem = publicConfigProblem();
  if (problem) return <MissingConfig message={problem} />;
  return <LoginForm />;
}

function MissingConfig({ message }: { message: string }) {
  const fonts = useFontSet();
  const { signIn } = useSession();
  const [error, setError] = useState("");
  return (
    <LoginFrame>
      <AppText style={{ fontSize: 24, lineHeight: 32, fontFamily: fonts.extrabold, color: tokens.inkStrong }}>ההגדרות חסרות</AppText>
      <AppText style={{ marginTop: 8, fontSize: 15, lineHeight: 22, color: tokens.inkStrong }}>{message}</AppText>
      <View style={{ marginTop: 16 }}>
        <PrimaryButton
          label="התחברות"
          onPress={() => {
            void signIn("", "").then((next) => setError(next ?? message));
          }}
        />
      </View>
      {error ? <AppText style={{ marginTop: 8, color: tokens.negative, fontSize: 13, lineHeight: 20 }}>{error}</AppText> : null}
    </LoginFrame>
  );
}

function LoginForm() {
  const fonts = useFontSet();
  const { signIn } = useSession();
  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function continueWithEmail() {
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("הזינו כתובת אימייל תקינה");
      return;
    }
    setEmail(value);
    setError("");
    setStep("password");
  }

  async function submit() {
    if (pending) return;
    if (step === "email") {
      continueWithEmail();
      return;
    }
    if (password.length === 0) {
      setError("הזינו סיסמה");
      return;
    }
    setPending(true);
    setError("");
    const next = await signIn(email, password);
    if (next) {
      setError(next);
      setPending(false);
    }
  }

  return (
    <LoginFrame>
      <AppText style={{ fontFamily: fonts.extrabold, fontSize: 24, lineHeight: 32, color: tokens.inkStrong }}>התחברות</AppText>
      <AppText style={{ marginTop: 4, fontFamily: fonts.semibold, fontSize: 15, color: tokens.inkStrong }}>
        המשך אל Storely
      </AppText>
      {step === "email" ? (
        <View style={{ marginTop: 24 }}>
          <AppText style={{ fontFamily: fonts.medium, fontSize: 13 }}>אימייל</AppText>
          <Input
            value={email}
            onChange={(value) => {
              setEmail(value);
              setError("");
            }}
            keyboardType="email-address"
            autoComplete="username"
            textContentType="username"
          />
        </View>
      ) : (
        <View style={{ marginTop: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <AppText style={{ flex: 1, color: tokens.inkSecondary, fontSize: 13, writingDirection: "ltr", textAlign: "left" }} numberOfLines={1}>
              {email}
            </AppText>
            <Pressable
              onPress={() => {
                setStep("email");
                setPassword("");
                setError("");
              }}
            >
              <AppText style={{ color: tokens.link, fontFamily: fonts.medium, fontSize: 13 }}>שינוי</AppText>
            </Pressable>
          </View>
          <View style={{ marginTop: 16 }}>
            <AppText style={{ fontFamily: fonts.medium, fontSize: 13 }}>סיסמה</AppText>
            <Input
              value={password}
              onChange={(value) => {
                setPassword(value);
                setError("");
              }}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
            />
          </View>
        </View>
      )}
      {error ? <AppText style={{ marginTop: 8, color: tokens.negative, fontSize: 13, lineHeight: 20 }}>{error}</AppText> : null}
      <View style={{ marginTop: 16 }}>
        <PrimaryButton
          label={step === "email" ? "המשך באמצעות אימייל" : pending ? "מתחברים…" : "התחברות"}
          onPress={() => void submit()}
          disabled={pending}
        />
      </View>
    </LoginFrame>
  );
}

function Input({
  value,
  onChange,
  secureTextEntry = false,
  keyboardType = "default",
  autoComplete,
  textContentType,
}: {
  value: string;
  onChange: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address";
  autoComplete?: "username" | "current-password";
  textContentType?: "username" | "password";
}) {
  const fonts = useFontSet();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      autoCapitalize="none"
      autoCorrect={false}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      autoComplete={autoComplete}
      textContentType={textContentType}
      style={[field, { fontFamily: fonts.regular, textAlign: "left", writingDirection: "ltr" }]}
    />
  );
}

function LoginFrame({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const fonts = useFontSet();
  return (
    <View style={{ flex: 1, backgroundColor: tokens.login }}>
      <LinearGradient
        colors={["rgba(150,205,255,0.72)", "rgba(28,72,140,0.28)", tokens.login]}
        locations={[0, 0.46, 0.78]}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        start={{ x: 0.5, y: 0.2 }}
        end={{ x: 0.5, y: 1 }}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ paddingTop: insets.top + 18, paddingHorizontal: 28, flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Image source={require("../../assets/brand/storely-mark.png")} style={{ width: 26, height: 34 }} resizeMode="contain" accessibilityIgnoresInvertColors />
            <AppText style={{ color: "#ffffff", fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.8 }}>storely</AppText>
          </View>
          <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 32 }}>
            <View style={{ width: "100%", maxWidth: 400, alignSelf: "center", borderRadius: 16, backgroundColor: "#ffffff", paddingHorizontal: 28, paddingTop: 32, paddingBottom: 24 }}>
              {children}
            </View>
          </View>
          <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
            <AppText style={{ color: "rgba(255,255,255,0.9)", fontSize: 13, textAlign: "center" }}>צריך עזרה?</AppText>
            <AppText style={{ marginTop: 8, color: "rgba(255,255,255,0.45)", fontSize: 11, lineHeight: 16, textAlign: "center" }}>
              המשך מהווה הסכמה לתנאי השימוש ולמדיניות הפרטיות של Storely.
            </AppText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
