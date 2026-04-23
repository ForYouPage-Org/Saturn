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
import { type Message } from "../lib/api";

const FONT_STACK = Platform.select({
  web: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  default: undefined,
});

// Negative client ids so they never collide with SQLite positive ids.
function clientId() {
  return -Date.now() - Math.floor(Math.random() * 1000);
}

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
      const hist = await loadHistory();
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
      id: clientId(),
      participant_id: 0,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);

    try {
      const assistant = await sendMessage(text);
      setMessages((m) => [...m, assistant]);
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        {
          id: clientId(),
          participant_id: 0,
          role: "assistant",
          content: `Something went wrong: ${err?.message ?? "please try again."}`,
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

  const empty = messages.length === 0;

  return (
    <SafeAreaView style={styles.page} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        {empty ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyHeadline}>What can I help you with?</Text>
            <Text style={styles.emptyHint}>
              Type a message below to start. Ask anything.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item }) =>
              item.role === "user" ? (
                <View style={styles.userRow}>
                  <View style={styles.userBubble}>
                    <Text style={styles.userText} selectable>
                      {item.content}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.assistantRow}>
                  <Text style={styles.assistantText} selectable>
                    {item.content}
                  </Text>
                </View>
              )
            }
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        <View style={styles.composerWrap}>
          <View style={styles.composer}>
            <TextInput
              style={styles.composerInput}
              value={input}
              onChangeText={setInput}
              placeholder="Message Mercury…"
              placeholderTextColor="#9a9aa8"
              multiline
              editable={!sending}
            />
            <Pressable
              style={[styles.sendBtn, (sending || !input.trim()) && styles.sendBtnDisabled]}
              onPress={onSend}
              disabled={sending || !input.trim()}
              accessibilityLabel="Send message"
            >
              <Text style={styles.sendArrow}>{sending ? "…" : "↑"}</Text>
            </Pressable>
          </View>
          <View style={styles.menuRow}>
            <Pressable onPress={() => router.push("/esm")} hitSlop={10}>
              <Text style={styles.menuText}>Take check-in</Text>
            </Pressable>
            <View style={styles.menuDot} />
            <Pressable
              hitSlop={10}
              onPress={async () => {
                await signOut();
                router.replace("/");
              }}
            >
              <Text style={styles.menuText}>Sign out</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#ffffff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyHeadline: {
    fontSize: 26,
    fontWeight: "600",
    color: "#1a1a1a",
    fontFamily: FONT_STACK,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  emptyHint: {
    fontSize: 15,
    color: "#8e8ea0",
    fontFamily: FONT_STACK,
    textAlign: "center",
  },

  list: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 18,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },

  userRow: { alignItems: "flex-end" },
  userBubble: {
    maxWidth: "85%",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "#f4f4f4",
  },
  userText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#1a1a1a",
    fontFamily: FONT_STACK,
  },

  assistantRow: {
    maxWidth: "100%",
  },
  assistantText: {
    fontSize: 15,
    lineHeight: 24,
    color: "#1a1a1a",
    fontFamily: FONT_STACK,
  },

  composerWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
    gap: 8,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 24,
    backgroundColor: "#ffffff",
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 6,
  },
  composerInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: "#1a1a1a",
    paddingVertical: 8,
    maxHeight: 160,
    fontFamily: FONT_STACK,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null),
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  sendBtnDisabled: { backgroundColor: "#d9d9e3" },
  sendArrow: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 20,
  },

  menuRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    paddingTop: 2,
  },
  menuText: {
    color: "#8e8ea0",
    fontSize: 12,
    fontFamily: FONT_STACK,
  },
  menuDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: "#c5c5d2",
  },
});
