import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { getMyProfile, updateMyProfile } from "@/services/api";

type ProfileForm = {
  name: string;
  photoURL: string;
  bio: string;
  preferredCuisine: string;
  dietaryPreference: string;
  location: string;
  socialLinks: string;
  phone: string;
};

const fields: { key: keyof ProfileForm; label: string }[] = [
  { key: "name", label: "Edit Name" },
  { key: "photoURL", label: "Profile Photo URL" },
  { key: "bio", label: "Bio" },
  { key: "preferredCuisine", label: "Preferred Cuisine" },
  { key: "dietaryPreference", label: "Dietary Preference" },
  { key: "location", label: "Location" },
  { key: "socialLinks", label: "Social Links" },
  { key: "phone", label: "Phone" },
];

export default function EditProfileScreen() {
  const [form, setForm] = useState<ProfileForm>({
    name: "",
    photoURL: "",
    bio: "",
    preferredCuisine: "",
    dietaryPreference: "",
    location: "",
    socialLinks: "",
    phone: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        const profile = await getMyProfile();
        setForm((prev) => ({ ...prev, ...profile }));
      } catch (err) {
        console.log("Failed to load profile", err);
      }
    };

    load();
  }, []);

  const onSave = async () => {
    try {
      await updateMyProfile(form);
      Alert.alert("Saved", "Profile updated");
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)/profile");
      }
    } catch {
      Alert.alert("Error", "Failed to update profile");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#efefef" }}>
      <View style={{ backgroundColor: "#f3c640", paddingTop: 10, paddingHorizontal: 12, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))}>
            <Text style={{ fontSize: 20 }}>{"<"}</Text>
          </Pressable>
          <Text style={{ fontWeight: "700", fontSize: 18 }}>Edit Profile</Text>
          <Pressable onPress={onSave}>
            <Text style={{ color: "#ff4b4b", fontWeight: "700" }}>Save</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 12, gap: 10 }}>
        {fields.map(({ key, label }) => (
          <View key={key} style={{ backgroundColor: "white", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 }}>
            <Text style={{ color: "#6f6f6f", marginBottom: 2 }}>{label}</Text>
            <TextInput value={String(form[key] ?? "")} onChangeText={(v) => setForm((prev) => ({ ...prev, [key]: v }))} />
          </View>
        ))}
      </ScrollView>

      <Pressable
        onPress={onSave}
        style={{
          position: "absolute",
          right: 16,
          bottom: 16,
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: "#ff4b4b",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "white", fontSize: 28 }}>+</Text>
      </Pressable>
    </View>
  );
}
