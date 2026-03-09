import { View, Text, Image } from "react-native";

type RecipeCardProps = {
  title?: string;
  image?: string;
  featured?: boolean;
};

export default function RecipeCard({
  title,
  image,
  featured,
}: RecipeCardProps) {
  const hasImage = !!image;
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 16,
        overflow: "hidden",
        marginTop: 12,
        flex: featured ? 1 : 0.48,
      }}
    >
      {hasImage ? (
        <Image
          source={{ uri: image }}
          style={{ height: featured ? 180 : 140 }}
        />
      ) : (
        <Image
          source={require("../assets/images/Cooksy.png")}
          style={{ height: featured ? 180 : 140, width: "100%" }}
          resizeMode="contain"
        />
      )}

      <View style={{ padding: 10 }}>
        <Text style={{ fontWeight: "700" }}>
          {title || "Untitled Recipe"}
        </Text>

        <Text style={{ color: "#777", fontSize: 12 }}>
          Delicious Recipe
        </Text>
      </View>
    </View>
  );
}
