import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        type?: string;
        slug?: string;
        triggered_at?: string;
      };
      if (data?.type === "esm") {
        router.push({
          pathname: "/esm",
          params: {
            slug: data.slug ?? "",
            triggered_at: data.triggered_at ?? new Date().toISOString(),
          },
        });
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#ffffff" },
          headerTitleStyle: { fontWeight: "600", fontSize: 16 },
          headerShadowVisible: false,
          headerTitleAlign: "center",
        }}
      >
        <Stack.Screen name="index" options={{ title: "Mercury" }} />
        <Stack.Screen name="chat" options={{ title: "Mercury" }} />
        <Stack.Screen name="esm" options={{ title: "Check-in", presentation: "modal" }} />
      </Stack>
    </SafeAreaProvider>
  );
}
