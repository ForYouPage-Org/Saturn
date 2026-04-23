import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getActiveSurvey, submitEsm } from "../lib/esm";
import { type EsmQuestion, type EsmSurvey } from "../lib/supabase";

export default function EsmScreen() {
  const { slug, triggered_at } = useLocalSearchParams<{ slug?: string; triggered_at?: string }>();
  const [survey, setSurvey] = useState<EsmSurvey | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getActiveSurvey(slug)
      .then((s) => setSurvey(s))
      .catch((err) => Alert.alert("Error", err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  function setAnswer(qid: string, value: unknown) {
    setAnswers((a) => ({ ...a, [qid]: value }));
  }

  async function onSubmit() {
    if (!survey) return;
    const missing = survey.questions.find((q) => {
      if (q.optional) return false;
      const v = answers[q.id];
      if (v === undefined || v === "") return true;
      if (Array.isArray(v) && v.length === 0) return true;
      return false;
    });
    if (missing) {
      return Alert.alert("Almost there", "Please answer all questions.");
    }
    setSubmitting(true);
    try {
      await submitEsm({
        surveyId: survey.id,
        answers,
        triggeredAt: triggered_at,
      });
      router.back();
    } catch (err: any) {
      Alert.alert("Submit failed", err?.message ?? String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!survey) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>No check-in available</Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Close</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }}>
        <Text style={styles.title}>{survey.title}</Text>
        {survey.questions.map((q) => (
          <QuestionView
            key={q.id}
            question={q}
            value={answers[q.id]}
            onChange={(v) => setAnswer(q.id, v)}
          />
        ))}
        <Pressable
          style={[styles.button, submitting && { opacity: 0.5 }]}
          onPress={onSubmit}
          disabled={submitting}
        >
          <Text style={styles.buttonText}>{submitting ? "Submitting…" : "Submit"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuestionView({
  question,
  value,
  onChange,
}: {
  question: EsmQuestion;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (question.type === "likert") {
    const { min, max, min_label, max_label } = question;
    const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return (
      <View style={{ gap: 10 }}>
        <Text style={styles.prompt}>{question.prompt}</Text>
        <View style={styles.scaleRow}>
          {options.map((n) => (
            <Pressable
              key={n}
              style={[styles.scaleBtn, value === n && styles.scaleBtnActive]}
              onPress={() => onChange(n)}
            >
              <Text style={[styles.scaleBtnText, value === n && { color: "#fff" }]}>{n}</Text>
            </Pressable>
          ))}
        </View>
        {(min_label || max_label) && (
          <View style={styles.scaleLabels}>
            <Text style={styles.scaleLabel}>{min_label ?? ""}</Text>
            <Text style={styles.scaleLabel}>{max_label ?? ""}</Text>
          </View>
        )}
      </View>
    );
  }

  if (question.type === "text") {
    return (
      <View style={{ gap: 8 }}>
        <Text style={styles.prompt}>{question.prompt}</Text>
        <TextInput
          style={styles.textArea}
          multiline
          value={(value as string) ?? ""}
          onChangeText={onChange}
          placeholder={question.placeholder}
        />
      </View>
    );
  }

  if (question.type === "choice") {
    const selected = (value as string | string[] | undefined) ?? (question.multiple ? [] : "");
    const isSelected = (opt: string) =>
      question.multiple ? (selected as string[]).includes(opt) : selected === opt;

    function toggle(opt: string) {
      if (question.multiple) {
        const arr = new Set(selected as string[]);
        arr.has(opt) ? arr.delete(opt) : arr.add(opt);
        onChange(Array.from(arr));
      } else {
        onChange(opt);
      }
    }

    return (
      <View style={{ gap: 8 }}>
        <Text style={styles.prompt}>{question.prompt}</Text>
        {question.options.map((opt) => (
          <Pressable
            key={opt}
            style={[styles.choice, isSelected(opt) && styles.choiceActive]}
            onPress={() => toggle(opt)}
          >
            <Text style={isSelected(opt) ? { color: "#fff" } : { color: "#111" }}>{opt}</Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700" },
  prompt: { fontSize: 16, fontWeight: "500", color: "#111" },
  scaleRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  scaleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
  },
  scaleBtnActive: { backgroundColor: "#111", borderColor: "#111" },
  scaleBtnText: { color: "#111", fontWeight: "600" },
  scaleLabels: { flexDirection: "row", justifyContent: "space-between" },
  scaleLabel: { color: "#999", fontSize: 12 },
  textArea: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    minHeight: 90,
    textAlignVertical: "top",
  },
  choice: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
  },
  choiceActive: { backgroundColor: "#111", borderColor: "#111" },
  button: {
    backgroundColor: "#111",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
