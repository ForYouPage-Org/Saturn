import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { enroll, getCurrentParticipant } from "../lib/auth";
import { registerForPushAsync } from "../lib/notifications";

export default function Enrollment() {
  const [checking, setChecking] = useState(true);
  const [code, setCode] = useState("");
  const [age, setAge] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCurrentParticipant()
      .then((p) => {
        if (p) router.replace("/chat");
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  async function submit() {
    const ageNum = Number.parseInt(age, 10);
    if (!code.trim()) return Alert.alert("Missing code", "Enter your participant code.");
    if (!Number.isFinite(ageNum) || ageNum < 13 || ageNum > 19) {
      return Alert.alert("Age", "Enter an age between 13 and 19.");
    }
    if (!consent) return Alert.alert("Consent", "You must agree to participate.");

    setSubmitting(true);
    try {
      await enroll({ participantCode: code, age: ageNum });
      registerForPushAsync().catch(() => {});
      router.replace("/chat");
    } catch (err: any) {
      Alert.alert("Enrollment failed", err?.message ?? String(err));
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

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Welcome to Mercury</Text>
      <Text style={styles.body}>
        This is a research app. You can chat with an AI assistant, and we&apos;ll occasionally ask you
        short check-in questions about how you&apos;re feeling. Your data is stored securely and used
        only for research.
      </Text>

      <Text style={styles.label}>Participant code</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        placeholder="e.g. ABC123"
      />

      <Text style={styles.label}>Age</Text>
      <TextInput
        style={styles.input}
        value={age}
        onChangeText={setAge}
        keyboardType="number-pad"
        placeholder="13–19"
      />

      <View style={styles.consentRow}>
        <Switch value={consent} onValueChange={setConsent} />
        <Text style={styles.consentText}>
          I agree to participate in this research study.
        </Text>
      </View>

      <Pressable
        style={[styles.button, submitting && { opacity: 0.5 }]}
        onPress={submit}
        disabled={submitting}
      >
        <Text style={styles.buttonText}>{submitting ? "Enrolling…" : "Start"}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "700", marginBottom: 4 },
  body: { fontSize: 15, color: "#444", marginBottom: 16, lineHeight: 21 },
  label: { fontSize: 13, color: "#666", marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  consentRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16 },
  consentText: { flex: 1, fontSize: 14, color: "#333" },
  button: {
    backgroundColor: "#111",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 24,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
