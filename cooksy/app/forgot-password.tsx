import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/config/firebase";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  const onReset = async () => {
    const value = email.trim();
    if (!value) {
      Alert.alert("Missing Email", "Please enter your email address.");
      return;
    }
    try {
      setSending(true);
      await sendPasswordResetEmail(auth, value);
      Alert.alert("Reset Link Sent", "Please check your inbox for password reset instructions.");
      router.replace("/auth");
    } catch (err: any) {
      Alert.alert("Reset Failed", err?.message || "Could not send reset email.");
    } finally {
      setSending(false);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#f3c640",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <View
        style={{
          borderRadius: 20,
          backgroundColor: "#f1f1f1",
          padding: 16,
          borderWidth: 1,
          borderColor: "#d0d0d0",
        }}
      >
        <Text style={{ color: "#ff4b4b", fontWeight: "700", marginBottom: 8 }}>
          Forgot your password?
        </Text>
        <Text style={{ color: "#666", marginBottom: 12 }}>
          Enter your email address and we will send you a reset link.
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="email@example.com"
          placeholderTextColor="#97a2a5"
          style={{
            borderWidth: 1,
            borderColor: "#5ea6a3",
            backgroundColor: "#f8f8f8",
            borderRadius: 6,
            paddingHorizontal: 10,
            paddingVertical: 10,
            marginBottom: 12,
          }}
        />

        <Pressable
          onPress={onReset}
          disabled={sending}
          style={{
            backgroundColor: sending ? "#f38f8f" : "#ff4b4b",
            borderRadius: 999,
            paddingVertical: 12,
            marginBottom: 10,
          }}
        >
          <Text style={{ color: "white", textAlign: "center", fontWeight: "700" }}>
            {sending ? "Sending..." : "Request Reset Link"}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.replace("/auth")}>
          <Text style={{ textAlign: "center", color: "#d84315", fontWeight: "600" }}>Back To Login</Text>
        </Pressable>
      </View>
    </View>
  );
}
