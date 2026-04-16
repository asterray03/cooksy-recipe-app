import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AiKitchenStudio from "@/components/AiKitchenStudio";
import { AppTheme } from "@/constants/app-theme";

export default function AiStudioScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: AppTheme.colors.page }}>
      <View
        style={{
          backgroundColor: AppTheme.colors.mustard,
          paddingTop: insets.top + 8,
          paddingHorizontal: 12,
          paddingBottom: 12,
          borderBottomLeftRadius: 18,
          borderBottomRightRadius: 18,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/explore"))}>
            <Ionicons name="chevron-back" size={22} color={AppTheme.colors.ink} />
          </Pressable>
          <Text style={{ fontWeight: "800", fontSize: 18, color: AppTheme.colors.ink }}>AI Kitchen Studio</Text>
          <View style={{ width: 22 }} />
        </View>
        <Text style={{ marginTop: 8, color: AppTheme.colors.primaryDeep }}>
          Generate recipes, extract ingredients, and use voice or photo input.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 32 }}>
        <AiKitchenStudio />
      </ScrollView>
    </View>
  );
}
