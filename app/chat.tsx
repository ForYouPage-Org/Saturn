import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCurrentParticipant, signOut } from "../lib/auth";
import { loadHistory, sendMessage } from "../lib/chat";
import { type Message } from "../lib/supabase";

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    (async () => {
      const p = await getCurrentParticipant();
      if (!p) {
        router.replace("/");
        return;
      }
      const hist = await loadHistory(p.id);
      setMessages(hist);
      setLoading(false);
    })();
  }, []);

  async function onSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);

    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      participant_id: "",
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);

    try {
      const assistant = await sendMessage(text);
      setMessages((m) => [...m.filter((x) => x.id !== optimistic.id), { ...optimistic, id: `local-${Date.now()}` }, assistant]);
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        {
          id: `err-${Date.now()}`,
          participant_id: "",
          role: "assistant",
          content: `⚠️ ${err?.message ?? "Failed to send"}`,
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.role === "user" ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              <Text style={item.role === "user" ? styles.userText : styles.assistantText}>
                {item.content}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>Say hi to start a conversation.</Text>
          }
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message..."
            multiline
            editable={!sending}
          />
          <Pressable
            style={[styles.send, (sending || !input.trim()) && { opacity: 0.4 }]}
            onPress={onSend}
            disabled={sending || !input.trim()}
          >
            <Text style={styles.sendText}>{sending ? "…" : "Send"}</Text>
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Pressable onPress={() => router.push("/esm")}>
            <Text style={styles.footerText}>Take check-in</Text>
          </Pressable>
          <Pressable onPress={async () => {
            await signOut();
            router.replace("/");
          }}>
            <Text style={styles.footerText}>Sign out</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 12, gap: 8 },
  bubble: { maxWidth: "85%", padding: 12, borderRadius: 14 },
  userBubble: { alignSelf: "flex-end", backgroundColor: "#111" },
  assistantBubble: { alignSelf: "flex-start", backgroundColor: "#f0f0f0" },
  userText: { color: "#fff", fontSize: 15, lineHeight: 21 },
  assistantText: { color: "#111", fontSize: 15, lineHeight: 21 },
  empty: { textAlign: "center", color: "#999", marginTop: 80 },
  inputRow: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ddd",
    gap: 8,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 140,
  },
  send: {
    backgroundColor: "#111",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
  },
  sendText: { color: "#fff", fontWeight: "600" },
  footer: {
    padding: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  footerText: { color: "#888", fontSize: 12 },
});
