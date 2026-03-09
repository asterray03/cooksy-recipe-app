import React, { useEffect, useMemo, useState } from "react";
import { Alert, Image, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { router } from "expo-router";
import { auth, db } from "@/config/firebase";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { setGuestSession } from "@/state/session";

WebBrowser.maybeCompleteAuthSession();

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const formatAuthError = (error: any) => {
    const code = String(error?.code || "");
    if (code === "auth/email-already-in-use") return "This email is already registered. Please login.";
    if (code === "auth/invalid-email") return "Please enter a valid email address.";
    if (code === "auth/weak-password") return "Password is too weak. Use at least 6 characters.";
    if (code === "auth/unauthorized-domain") {
      return "Signup blocked: add this domain in Firebase Auth -> Settings -> Authorized domains (localhost, 127.0.0.1).";
    }
    if (code === "auth/operation-not-allowed") {
      return "Email/Password sign-in is disabled in Firebase Authentication. Enable it in Firebase Console.";
    }
    if (code === "auth/network-request-failed") return "Network error. Check internet connection and try again.";
    return error?.message || "Authentication failed";
  };

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId:
      "409144630675-f3np7u4oh1565gbo64eou3m2q0tv5p73.apps.googleusercontent.com",
    scopes: ["profile", "email"],
    responseType: "id_token",
    extraParams: { nonce: "cooksyNonce" },
  });

  const syncUser = async (user: any, provider: string) => {
    await setDoc(
      doc(db, "users", user.uid),
      {
        uid: user.uid,
        name: user.displayName ?? (provider === "anonymous" ? "Guest User" : ""),
        email: user.email ?? "",
        photoURL: user.photoURL ?? "",
        provider,
        lastLoginAt: serverTimestamp(),
      },
      { merge: true }
    );

    try {
      if (API_URL && provider !== "anonymous") {
        const token = await user.getIdToken();
        await fetch(`${API_URL}/api/oauth/google`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
      }
    } catch (err) {
      console.log("Backend oauth sync skipped", err);
    }
  };

  useEffect(() => {
    const loginWithGoogle = async () => {
      if (response?.type !== "success") return;
      setAuthLoading(true);

      const idToken = response.params?.id_token;
      if (!idToken) {
        setAuthLoading(false);
        return;
      }

      const credential = GoogleAuthProvider.credential(idToken);
      const userCred = await signInWithCredential(auth, credential);
      setGuestSession(false);
      router.replace("/(tabs)");

      try {
        await syncUser(userCred.user, "google");
      } catch (err) {
        console.log("Google sync failed", err);
      } finally {
        setAuthLoading(false);
      }
    };

    loginWithGoogle().catch((error) => {
      console.log("Google auth error", error);
      setAuthLoading(false);
      Alert.alert("Login failed", "Google sign-in could not be completed.");
    });
  }, [response]);

  const handleEmailAuth = async () => {
    try {
      setAuthError("");
      if (!email.trim() || !password.trim()) {
        const msg = "Enter email and password.";
        setAuthError(msg);
        Alert.alert("Missing fields", msg);
        return;
      }

      setAuthLoading(true);
      if (mode === "signup") {
        if (!name.trim()) {
          const msg = "Enter your name.";
          setAuthError(msg);
          Alert.alert("Missing name", msg);
          setAuthLoading(false);
          return;
        }
        if (password.length < 6) {
          const msg = "Password must be at least 6 characters.";
          setAuthError(msg);
          Alert.alert("Weak password", msg);
          setAuthLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          const msg = "Confirm password must match.";
          setAuthError(msg);
          Alert.alert("Password mismatch", msg);
          setAuthLoading(false);
          return;
        }

        const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(userCred.user, { displayName: name.trim() });
        setGuestSession(false);
        router.replace("/(tabs)");
        syncUser(userCred.user, "email").catch((err) => {
          console.log("Signup sync failed", err);
        });
      } else {
        const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
        setGuestSession(false);
        router.replace("/(tabs)");
        syncUser(userCred.user, "email").catch((err) => {
          console.log("Login sync failed", err);
        });
      }
    } catch (error: any) {
      console.log("Email auth error", error);
      const msg = formatAuthError(error);
      setAuthError(msg);
      Alert.alert("Auth error", msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const continueAsGuest = async () => {
    try {
      setAuthLoading(true);
      try {
        const userCred = await signInAnonymously(auth);
        setGuestSession(true);
        await syncUser(userCred.user, "anonymous");
        router.replace("/(tabs)");
        return;
      } catch (err: any) {
        console.log("Anonymous auth unavailable, using local guest mode", err);
        // Fallback: allow guest browsing even when anonymous auth is disabled in Firebase.
        setGuestSession(true);
        router.replace("/(tabs)");
        Alert.alert(
          "Guest Mode",
          "You are in guest mode. Upload/save features need sign-in."
        );
      }
    } catch (err: any) {
      console.log("Guest login failed", err);
      setGuestSession(false);
      Alert.alert(
        "Guest Sign-in Failed",
        err?.message || "Guest mode is unavailable right now. Please login with email or Google."
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const title = useMemo(() => (mode === "login" ? "LOGIN" : "SIGNUP"), [mode]);

  const handleGoogleAuth = async () => {
    try {
      setAuthLoading(true);
      if (Platform.OS === "web") {
        const provider = new GoogleAuthProvider();
        const userCred = await signInWithPopup(auth, provider);
        setGuestSession(false);
        router.replace("/(tabs)");
        await syncUser(userCred.user, "google");
        return;
      }
      await promptAsync();
    } catch (error: any) {
      console.log("Google auth error", error);
      Alert.alert("Login failed", error?.message || "Google sign-in could not be completed.");
      setAuthLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} style={{ backgroundColor: "#f3c640" }}>
      <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
        <Image
          source={require("../assets/images/Cooksy_nobg.png")}
          style={{ width: 200, height: 84, alignSelf: "center", marginBottom: 24 }}
          resizeMode="contain"
        />

        <View
          style={{
            borderRadius: 22,
            backgroundColor: "#f1f1f1",
            padding: 14,
            borderWidth: 1,
            borderColor: "#d0d0d0",
          }}
        >
          <View style={{ flexDirection: "row", borderRadius: 999, backgroundColor: "#f7f7f7", padding: 4, marginBottom: 16 }}>
            <Pressable onPress={() => setMode("login")} style={{ flex: 1, borderRadius: 999, backgroundColor: mode === "login" ? "#ff4b4b" : "transparent", paddingVertical: 10 }}>
              <Text style={{ textAlign: "center", color: mode === "login" ? "white" : "#ff4b4b", fontWeight: "700" }}>LOGIN</Text>
            </Pressable>
            <Pressable onPress={() => setMode("signup")} style={{ flex: 1, borderRadius: 999, backgroundColor: mode === "signup" ? "#ff4b4b" : "transparent", paddingVertical: 10 }}>
              <Text style={{ textAlign: "center", color: mode === "signup" ? "white" : "#ff4b4b", fontWeight: "700" }}>SIGNUP</Text>
            </Pressable>
          </View>

          {mode === "signup" ? <AuthInput placeholder="User Name" value={name} onChangeText={setName} /> : null}
          <AuthInput placeholder="E-mail address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <AuthInput placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />

          {mode === "signup" ? <AuthInput placeholder="Confirm Password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} /> : null}

          {mode === "login" ? (
            <Pressable onPress={() => router.push("/forgot-password")}> 
              <Text style={{ alignSelf: "flex-end", color: "#8a8a8a", marginTop: 2 }}>Forgot Password?</Text>
            </Pressable>
          ) : null}

          <Pressable onPress={handleEmailAuth} disabled={authLoading} style={{ marginTop: 14, backgroundColor: authLoading ? "#f38f8f" : "#ff4b4b", borderRadius: 999, paddingVertical: 12 }}>
            <Text style={{ color: "white", textAlign: "center", fontWeight: "700" }}>{authLoading ? "PLEASE WAIT..." : title}</Text>
          </Pressable>

          <Pressable
            onPress={handleGoogleAuth}
            disabled={(Platform.OS !== "web" && !request) || authLoading}
            style={{ marginTop: 10, backgroundColor: "white", borderRadius: 999, paddingVertical: 12, borderWidth: 1, borderColor: "#e3e3e3" }}
          >
            <Text style={{ color: "#353535", textAlign: "center", fontWeight: "700" }}>CONTINUE WITH GOOGLE</Text>
          </Pressable>

          <Pressable onPress={continueAsGuest} disabled={authLoading} style={{ marginTop: 10, backgroundColor: "white", borderRadius: 999, paddingVertical: 12, borderWidth: 1, borderColor: "#e3e3e3" }}>
            <Text style={{ color: "#353535", textAlign: "center", fontWeight: "700" }}>CONTINUE AS GUEST</Text>
          </Pressable>

          {authError ? (
            <View style={{ marginTop: 10, borderWidth: 1, borderColor: "#ffb5b5", borderRadius: 10, backgroundColor: "#fff1f1", paddingHorizontal: 10, paddingVertical: 8 }}>
              <Text style={{ color: "#a23232", fontWeight: "600" }}>{authError}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={() => setMode((prev) => (prev === "login" ? "signup" : "login"))}
            style={{ marginTop: 14 }}
          >
            <Text style={{ textAlign: "center", color: "#888" }}>
              {mode === "login" ? "Don't have an account? SIGNUP" : "Already have an account? LOGIN"}
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function AuthInput(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor="#97a2a5"
      {...props}
      style={{
        borderWidth: 1,
        borderColor: "#5ea6a3",
        backgroundColor: "#f8f8f8",
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 10,
        marginBottom: 10,
      }}
    />
  );
}
