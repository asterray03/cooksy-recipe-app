import { Text, TouchableOpacity } from "react-native";

export default function CategoryChip({ label }: { label: string }) {
  return (
    <TouchableOpacity
      style={{
        backgroundColor: "#fff",
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
      }}
    >
      <Text style={{ fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
  );
}
