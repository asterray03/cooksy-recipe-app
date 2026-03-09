import { useEffect } from "react";
import { Image, Text, View } from "react-native";
import { router } from "expo-router";

export default function Welcome() {
  useEffect(() => {
    const t = setTimeout(() => {
      router.replace("/auth");
    }, 1400);

    return () => clearTimeout(t);
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#f3c640",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Image
        source={require("../assets/images/Cooksy_nobg.png")}
        style={{ width: 220, height: 100 }}
        resizeMode="contain"
      />
      <Text style={{ marginTop: 20, color: "#d84315", fontWeight: "700" }}>
        AI Powered Recipe Sharing App
      </Text>
    </View>
  );
}
