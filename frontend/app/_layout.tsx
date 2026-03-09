import "react-native-reanimated";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, router, usePathname, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import type { User } from "firebase/auth";
import { auth } from "@/config/firebase";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { isGuestSession, setGuestSession, subscribeGuestSession } from "@/state/session";
import { getThemeMode, subscribeFeatureState } from "@/state/app-features";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  const deviceTheme = useColorScheme();
  const pathname = usePathname();
  const navigationState = useRootNavigationState();
  const [user, setUser] = useState<User | null>(null);
  const [guestMode, setGuestMode] = useState(isGuestSession());
  const [themeMode, setThemeModeState] = useState(getThemeMode());
  const [loading, setLoading] = useState(true);
  const didRouteAfterLogin = useRef(false);

  useEffect(() => {
    const unsubscribeGuest = subscribeGuestSession(() => {
      setGuestMode(isGuestSession());
    });
    const unsubscribeFeature = subscribeFeatureState(() => {
      setThemeModeState(getThemeMode());
    });

    return () => {
      unsubscribeGuest();
      unsubscribeFeature();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      // User requested auth-first flow on every app launch.
      try {
        await signOut(auth);
      } catch {
        // Ignore if already signed out.
      }

      const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
        if (!mounted) return;
        setUser(nextUser);
        if (nextUser) {
          setGuestSession(false);
        }
        setLoading(false);

        // Force app landing to tabs after successful auth, avoiding stale route restore.
        if (nextUser && !didRouteAfterLogin.current) {
          didRouteAfterLogin.current = true;
          router.replace("/(tabs)");
        }
      });

      return unsubscribe;
    };

    let unsubscribe = () => {};
    boot().then((fn) => {
      unsubscribe = fn;
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!navigationState?.key || loading) return;

    const inAuthFlow = pathname === "/auth" || pathname === "/welcome" || pathname === "/forgot-password";

    if (user || guestMode) {
      // Signed-in/guest users can navigate freely across app routes.
      // Only block auth screens for them.
      if (inAuthFlow) {
        router.replace("/(tabs)");
      }
      return;
    }

    if (!inAuthFlow) {
      router.replace("/auth");
    }
  }, [navigationState?.key, loading, pathname, user, guestMode]);

  if (loading) {
    return null;
  }

  const resolvedDark = (() => {
    if (themeMode === "dark") return true;
    if (themeMode === "light") return false;
    return deviceTheme === "dark";
  })();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={resolvedDark ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          {user || guestMode ? (
            <>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="recipe/[id]" />
              <Stack.Screen name="user/[uid]" />
              <Stack.Screen name="upload" />
              <Stack.Screen name="edit-profile" />
            </>
          ) : (
            <>
              <Stack.Screen name="welcome" />
              <Stack.Screen name="auth" />
              <Stack.Screen name="forgot-password" />
            </>
          )}
        </Stack>
        <StatusBar style={resolvedDark ? "light" : "dark"} />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
