import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { enroll, getCurrentParticipant, signIn } from "../lib/auth";
import { registerForPushAsync } from "../lib/notifications";

const FONT_STACK = Platform.select({
  web: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  default: undefined,
});

const AGES = [13, 14, 15, 16, 17, 18, 19] as const;
type Age = (typeof AGES)[number];
type Mode = "signup" | "signin";

function generateCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function Enrollment() {
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<Mode>("signup");

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState<Age | null>(null);
  const [consent, setConsent] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentParticipant()
      .then((p) => {
        if (p) router.replace("/chat");
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function submit() {
    setError(null);
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return setError("Enter your participant code.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (mode === "signup") {
      if (age === null) return setError("Pick your age.");
      if (!consent) return setError("You need to agree to participate.");
    }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        await enroll({ participantCode: trimmed, age: age!, password });
      } else {
        await signIn({ participantCode: trimmed, password });
      }
      registerForPushAsync().catch(() => {});
      router.replace("/chat");
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const canSubmit = (() => {
    if (submitting) return false;
    if (!code.trim() || password.length < 6) return false;
    if (mode === "signup") return age !== null && consent;
    return true;
  })();

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.content}>
        <Text style={styles.h1}>
          {mode === "signup" ? "Welcome to Mercury" : "Welcome back"}
        </Text>
        <Text style={styles.lede}>
          {mode === "signup"
            ? "A research app where you can chat with an AI assistant. We'll occasionally ask short check-in questions about how you're feeling. Your data is stored securely and used only for research."
            : "Sign in with the participant code and password you used when you signed up."}
        </Text>

        <View style={styles.tabs}>
          <Pressable
            onPress={() => switchMode("signup")}
            style={[styles.tab, mode === "signup" && styles.tabActive]}
          >
            <Text style={[styles.tabText, mode === "signup" && styles.tabTextActive]}>
              Sign up
            </Text>
          </Pressable>
          <Pressable
            onPress={() => switchMode("signin")}
            style={[styles.tab, mode === "signin" && styles.tabActive]}
          >
            <Text style={[styles.tabText, mode === "signin" && styles.tabTextActive]}>
              Sign in
            </Text>
          </Pressable>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Participant code</Text>
          <View style={styles.codeRow}>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="e.g. ABC123"
              placeholderTextColor="#b4b4b4"
            />
            {mode === "signup" && (
              <Pressable
                style={styles.generateBtn}
                onPress={() => setCode(generateCode())}
                accessibilityLabel="Generate a random participant code"
              >
                <Text style={styles.generateText}>Generate</Text>
              </Pressable>
            )}
          </View>
          {mode === "signup" && (
            <Text style={styles.hint}>
              Don&apos;t have one? Tap Generate and we&apos;ll make one for you. Write it down —
              you&apos;ll need it to sign back in.
            </Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={mode === "signup" ? "Pick a password (6+ characters)" : "Your password"}
            placeholderTextColor="#b4b4b4"
          />
        </View>

        {mode === "signup" && (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Your age</Text>
              <View style={styles.ageRow}>
                {AGES.map((n) => {
                  const selected = age === n;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => setAge(n)}
                      style={[styles.agePill, selected && styles.agePillActive]}
                      accessibilityLabel={`Age ${n}`}
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.ageText, selected && styles.ageTextActive]}>{n}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.consentRow}>
              <Switch
                value={consent}
                onValueChange={setConsent}
                trackColor={{ false: "#d9d9e3", true: "#10a37f" }}
              />
              <Text style={styles.consentText}>
                I agree to participate in this research study.
              </Text>
            </View>
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.cta, !canSubmit && styles.ctaDisabled]}
          onPress={submit}
          disabled={!canSubmit}
        >
          <Text style={styles.ctaText}>
            {submitting
              ? mode === "signup"
                ? "Creating account…"
                : "Signing in…"
              : mode === "signup"
              ? "Continue"
              : "Sign in"}
          </Text>
        </Pressable>

        <Text
          style={styles.switchLink}
          onPress={() => switchMode(mode === "signup" ? "signin" : "signup")}
        >
          {mode === "signup"
            ? "Already have a code? Sign in."
            : "Don't have a code yet? Sign up."}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#ffffff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" },
  content: {
    flex: 1,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 18,
  },
  h1: {
    fontSize: 28,
    fontWeight: "600",
    color: "#1a1a1a",
    fontFamily: FONT_STACK,
    letterSpacing: -0.5,
  },
  lede: {
    fontSize: 15,
    lineHeight: 22,
    color: "#40414f",
    fontFamily: FONT_STACK,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#f4f4f5",
    padding: 4,
    borderRadius: 10,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  tabText: {
    fontSize: 14,
    color: "#8e8ea0",
    fontWeight: "500",
    fontFamily: FONT_STACK,
  },
  tabTextActive: { color: "#1a1a1a" },
  field: { gap: 8 },
  label: {
    fontSize: 14,
    color: "#1a1a1a",
    fontWeight: "500",
    fontFamily: FONT_STACK,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1a1a1a",
    fontFamily: FONT_STACK,
    backgroundColor: "#ffffff",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null),
  },
  codeRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "stretch",
  },
  codeInput: {
    flex: 1,
    letterSpacing: 2,
  },
  generateBtn: {
    paddingHorizontal: 14,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 12,
    backgroundColor: "#f7f7f8",
  },
  generateText: {
    fontSize: 14,
    color: "#1a1a1a",
    fontWeight: "500",
    fontFamily: FONT_STACK,
  },
  hint: {
    fontSize: 12,
    color: "#8e8ea0",
    fontFamily: FONT_STACK,
    lineHeight: 18,
  },
  ageRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  agePill: {
    minWidth: 48,
    height: 44,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e5e5e5",
    backgroundColor: "#ffffff",
  },
  agePillActive: {
    borderColor: "#1a1a1a",
    backgroundColor: "#1a1a1a",
  },
  ageText: {
    fontSize: 16,
    color: "#1a1a1a",
    fontWeight: "500",
    fontFamily: FONT_STACK,
  },
  ageTextActive: { color: "#ffffff" },
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  consentText: {
    flex: 1,
    fontSize: 14,
    color: "#40414f",
    fontFamily: FONT_STACK,
  },
  error: {
    color: "#d93025",
    fontSize: 14,
    fontFamily: FONT_STACK,
  },
  cta: {
    backgroundColor: "#1a1a1a",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 4,
  },
  ctaDisabled: { backgroundColor: "#c5c5d2" },
  ctaText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: FONT_STACK,
  },
  switchLink: {
    textAlign: "center",
    color: "#8e8ea0",
    fontSize: 13,
    fontFamily: FONT_STACK,
    paddingTop: 4,
  },
});
