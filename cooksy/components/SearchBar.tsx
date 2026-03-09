import { View, TextInput } from "react-native";

export default function SearchBar() {
  return (
    <View
      style={{
        backgroundColor: "#fff",
        borderRadius: 12,
        paddingHorizontal: 16,
        marginTop: 12,
      }}
    >
      <TextInput
        placeholder="Search recipes, cuisines, chefs..."
        placeholderTextColor="#999"
        style={{ height: 44 }}
      />
    </View>
  );
}
