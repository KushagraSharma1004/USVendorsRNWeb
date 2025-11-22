import { Stack } from "expo-router";
import { StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AuthProvider } from "./context/AuthContext";
import "./global.css"

export default function RootLayout() {

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar
        animated={true}
        backgroundColor="#2874F0"
        barStyle="light-content"
      />
      <AuthProvider>
        <Stack>
          <Stack.Screen name="Login" options={{ headerShown: false }} />
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="ForgotPassword" options={{ headerShown: false }} />
          <Stack.Screen name="[...not-found]" options={{ headerShown: false }} />
        </Stack>
      </AuthProvider>
    </SafeAreaView>
  )
}
