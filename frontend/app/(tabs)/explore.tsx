import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { categories } from "@/constants/mock-data";
import { getMyProfile, getRecipes } from "@/services/api";
import { AppTheme } from "@/constants/app-theme";
import { addSearchHistory, getFavoriteLocal, getSearchHistory, toggleFavoriteLocal, useFeatureState } from "@/state/app-features";
import { getDifficulty } from "@/utils/recipe";

type Recipe = {
  id: string;
  userId?: string;
  title: string;
  authorName?: string;
  image?: string;
  mediaType?: string;
  dietaryCategory?: string;
  ingredients?: string[];
  cookingTime?: string;
};

export default function ExploreScreen() {
  useFeatureState();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [sortMode, setSortMode] = useState<"az" | "za">("az");
  const [profilePhoto, setProfilePhoto] = useState("");

  const loadData = async () => {
    try {
      const recipesData = await getRecipes();
      setRecipes(Array.isArray(recipesData) ? recipesData : []);
    } catch (err) {
      console.log("Failed to load explore recipes", err);
      setRecipes([]);
    }

    try {
      const profile = await getMyProfile();
      setProfilePhoto(profile?.photoURL ?? "");
    } catch {
      // Guest/local sessions can fail profile lookup; keep explore feed available.
      setProfilePhoto("");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const list = recipes.filter((item) => {
      const byQuery = (item.title || "").toLowerCase().includes(query.toLowerCase());
      const byCategory =
        activeCategory === "All" ||
        item.dietaryCategory?.toLowerCase() === activeCategory.toLowerCase() ||
        (item.title || "").toLowerCase().includes(activeCategory.toLowerCase());
      return byQuery && byCategory;
    });

    return [...list].sort((a, b) =>
      sortMode === "az" ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title)
    );
  }, [recipes, query, activeCategory, sortMode]);

  const searchHistory = getSearchHistory();

  return (
    <View style={{ flex: 1, backgroundColor: AppTheme.colors.page }}>
      <View style={{ backgroundColor: AppTheme.colors.mustard, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Image source={require("../../assets/images/Cooksy_nobg.png")} style={{ width: 110, height: 36 }} resizeMode="contain" />
          <Pressable onPress={() => router.push("/(tabs)/profile")}>
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: AppTheme.colors.primary }} />
            ) : (
              <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: AppTheme.colors.primary, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="person" size={16} color={AppTheme.colors.primaryDeep} />
              </View>
            )}
          </Pressable>
        </View>

        <View style={{ marginTop: 8, flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 10, paddingHorizontal: 10, height: 40 }}>
          <Ionicons name="search" size={16} color="#999" />
          <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => addSearchHistory(query)} placeholder="Search recipes, cuisines, chefs..." placeholderTextColor="#999" style={{ marginLeft: 6, flex: 1 }} />
        </View>

        {searchHistory.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 8 }}>
            {searchHistory.map((q) => (
              <Pressable key={q} onPress={() => setQuery(q)} style={{ backgroundColor: "#fff", borderRadius: 999, borderWidth: 1, borderColor: "#ead9a0", paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: "#7a6630" }}>{q}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={{ padding: 10, paddingBottom: 84 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
          {["All", ...categories].map((c) => {
            const active = activeCategory === c;
            return (
              <Pressable key={c} onPress={() => setActiveCategory(c)} style={{ backgroundColor: active ? AppTheme.colors.primary : AppTheme.colors.surface, borderColor: active ? AppTheme.colors.primary : AppTheme.colors.border, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, borderRadius: AppTheme.radius.pill }}>
                <Text style={{ color: active ? "white" : AppTheme.colors.ink, fontWeight: "700" }}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={{ color: AppTheme.colors.subtleInk }}>{filtered.length} results</Text>
          <Pressable onPress={() => setSortMode((prev) => (prev === "az" ? "za" : "az"))} style={{ borderRadius: AppTheme.radius.pill, borderWidth: 1, borderColor: AppTheme.colors.border, backgroundColor: "white", paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ fontWeight: "700", color: AppTheme.colors.ink }}>Sort: {sortMode === "az" ? "A-Z" : "Z-A"}</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
          {filtered.map((item, idx) => (
            <Pressable key={item.id || idx} onPress={() => router.push(`/recipe/${item.id}`)} style={{ width: "48.5%", marginBottom: 10, borderRadius: 14, overflow: "hidden", backgroundColor: "#fff" }}>
              {item.image && item.mediaType !== "video" ? (
                <Image source={{ uri: item.image }} style={{ height: idx % 2 === 0 ? 140 : 200 }} />
              ) : (
                <View style={{ height: idx % 2 === 0 ? 140 : 200, width: "100%", backgroundColor: "#f5f5f5", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={item.mediaType === "video" ? "videocam-outline" : "image-outline"} size={24} color="#888" />
                </View>
              )}
              <View style={{ padding: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontWeight: "700", flex: 1 }} numberOfLines={1}>{item.title}</Text>
                  <Pressable onPress={() => toggleFavoriteLocal(item.id)} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Ionicons name={getFavoriteLocal(item.id).liked ? "heart" : "heart-outline"} size={16} color={getFavoriteLocal(item.id).liked ? "#ff4b4b" : "#777"} />
                    <Text style={{ fontSize: 12, color: "#777" }}>{getFavoriteLocal(item.id).count}</Text>
                  </Pressable>
                </View>
                {item.userId ? (
                  <Pressable onPress={() => router.push(`/user/${item.userId}`)}>
                    <Text style={{ marginTop: 3, color: AppTheme.colors.primaryDeep, fontWeight: "700", fontSize: 12 }} numberOfLines={1}>
                      @{item.authorName || "chef"}
                    </Text>
                  </Pressable>
                ) : null}
                <Text style={{ marginTop: 4, color: "#175d9c", fontWeight: "700", fontSize: 12 }}>
                  {getDifficulty(item.ingredients || [], item.cookingTime)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Pressable onPress={() => router.push("/upload")} style={{ position: "absolute", right: 16, bottom: 16, width: 56, height: 56, borderRadius: 28, backgroundColor: AppTheme.colors.primary, alignItems: "center", justifyContent: "center", elevation: 4 }}>
        <Ionicons name="add" color="white" size={30} />
      </Pressable>
    </View>
  );
}
