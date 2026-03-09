import { View, Image, Text } from "react-native";

type MasonryItem = {
  id: string;
  image?: string;
};

export default function MasonryGrid({ items = [] }: { items?: MasonryItem[] }) {
  if (!items.length) {
    return (
      <View style={{ padding: 16, alignItems: "center" }}>
        <Text style={{ color: "#777" }}>No items to display</Text>
      </View>
    );
  }

  const left = items.filter((_, idx) => idx % 2 === 0);
  const right = items.filter((_, idx) => idx % 2 !== 0);

  return (
    <View style={{ flexDirection: "row", padding: 12, gap: 12 }}>
      <View style={{ flex: 1, gap: 12 }}>
        {left.map((item) => (
          <Image
            key={item.id}
            source={item.image ? { uri: item.image } : require("../assets/images/Cooksy.png")}
            style={{ height: 200, borderRadius: 16 }}
            resizeMode={item.image ? "cover" : "contain"}
          />
        ))}
      </View>
      <View style={{ flex: 1, gap: 12 }}>
        {right.map((item) => (
          <Image
            key={item.id}
            source={item.image ? { uri: item.image } : require("../assets/images/Cooksy.png")}
            style={{ height: 260, borderRadius: 16 }}
            resizeMode={item.image ? "cover" : "contain"}
          />
        ))}
      </View>
    </View>
  );
}
