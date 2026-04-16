import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  InteractionManager,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { categories } from "@/constants/mock-data";
import { auth } from "@/config/firebase";
import { getMyProfile, getRecipes } from "@/services/api";
import { AppTheme } from "@/constants/app-theme";
import AiKitchenStudio from "@/components/AiKitchenStudio";
import {
  addSearchHistory,
  getFavoriteLocal,
  getSearchHistory,
  toggleFavoriteLocal,
  useFeatureState,
} from "@/state/app-features";
import { isGuestSession } from "@/state/session";
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

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  useFeatureState();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [showAiStudio, setShowAiStudio] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;

  const loadData = async () => {
    setLoading(true);
    try {
      const recipesData = await getRecipes();
      setRecipes(Array.isArray(recipesData) ? recipesData : []);
    } catch (err) {
      console.log("Failed to load home recipes", err);
      setRecipes([]);
    }

    try {
      const profile = await getMyProfile();
      setProfilePhoto(profile?.photoURL ?? "");
    } catch {
      setProfilePhoto("");
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
    Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, [fade]);

  useEffect(() => {
    let mounted = true;
    const task = InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        if (mounted) {
          setShowAiStudio(true);
        }
      }, 450);
    });

    return () => {
      mounted = false;
      task.cancel?.();
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    return recipes.filter((item) => {
      const title = (item.title || "").toLowerCase();
      const byQuery = title.includes(query.toLowerCase());
      const byCategory =
        activeCategory === "All" ||
        item.dietaryCategory?.toLowerCase() === activeCategory.toLowerCase() ||
        title.includes(activeCategory.toLowerCase());
      return byQuery && byCategory;
    });
  }, [recipes, query, activeCategory]);

  const featured = filtered[0];
  const recent = useFeatureState().recentlyViewed.slice(0, 8);
  const searchHistory = getSearchHistory();

  const submitSearch = () => addSearchHistory(query);

  const openUpload = () => {
    if (!auth.currentUser || isGuestSession()) {
      Alert.alert("Sign in required", "Upload is available only for signed-in users.");
      router.push("/auth");
      return;
    }
    router.push("/upload");
  };

  return (
    <View style={{ flex: 1, backgroundColor: AppTheme.colors.page }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 90 }}
      >
        <TopHeader
          topInset={insets.top}
          query={query}
          onQueryChange={setQuery}
          onSubmitSearch={submitSearch}
          profilePhoto={profilePhoto}
          searchHistory={searchHistory}
        />

        <Animated.View style={{ padding: 14, opacity: fade }}>
          {showAiStudio ? (
            <AiKitchenStudio />
          ) : (
            <AiStudioPlaceholder />
          )}

          <SectionTitle title="Trending Now" subtitle={loading ? "Loading..." : `${filtered.length} recipes`} />

          {featured ? (
            <Pressable
              onPress={() => router.push(`/recipe/${featured.id}`)}
              style={{ marginTop: 10, borderRadius: 18, overflow: "hidden", backgroundColor: AppTheme.colors.surface }}
            >
              {featured.image && featured.mediaType !== "video" ? (
                <Image source={{ uri: featured.image }} style={{ height: 190, width: "100%" }} />
              ) : (
                <View style={{ height: 190, width: "100%", backgroundColor: "#f5f5f5", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={featured.mediaType === "video" ? "videocam-outline" : "image-outline"} size={28} color="#888" />
                </View>
              )}
              <View style={{ padding: 12 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontWeight: "800", fontSize: 18, color: AppTheme.colors.ink, flex: 1 }}>{featured.title}</Text>
                  <FavoriteButton recipeId={featured.id} />
                </View>
                {featured.userId ? (
                  <Pressable onPress={() => router.push(`/user/${featured.userId}`)}>
                    <Text style={{ marginTop: 3, color: AppTheme.colors.primaryDeep, fontWeight: "700" }}>
                      @{featured.authorName || "chef"}
                    </Text>
                  </Pressable>
                ) : null}
                <View style={{ marginTop: 6, alignSelf: "flex-start", backgroundColor: "#eef7ff", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: "#175d9c", fontWeight: "700" }}>
                    {getDifficulty(featured.ingredients || [], featured.cookingTime)}
                  </Text>
                </View>
              </View>
            </Pressable>
          ) : (
            <EmptyCard loading={loading} onUploadPress={openUpload} />
          )}

          {recent.length ? (
            <>
              <SectionTitle title="Recently Viewed" subtitle={`${recent.length} items`} style={{ marginTop: 14 }} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
                {recent.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => router.push(`/recipe/${item.id}`)}
                    style={{ width: 130, backgroundColor: "white", borderRadius: 12, overflow: "hidden" }}
                  >
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={{ height: 86 }} />
                    ) : (
                      <Image source={require("../../assets/images/Cooksy.png")} style={{ height: 86, width: "100%" }} resizeMode="contain" />
                    )}
                    <Text style={{ padding: 8, fontWeight: "700" }} numberOfLines={1}>{item.title}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          <SectionTitle title="Categories" subtitle="Tap to filter" style={{ marginTop: 14 }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
            {["All", ...categories].map((c) => {
              const active = activeCategory === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setActiveCategory(c)}
                  style={{
                    backgroundColor: active ? AppTheme.colors.primary : AppTheme.colors.surface,
                    borderRadius: AppTheme.radius.pill,
                    borderWidth: 1,
                    borderColor: active ? AppTheme.colors.primary : AppTheme.colors.border,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: active ? "white" : AppTheme.colors.ink, fontWeight: "700" }}>{c}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
            {filtered.slice(1, 7).map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/recipe/${item.id}`)}
                style={{
                  width: "48.5%",
                  marginBottom: 10,
                  backgroundColor: AppTheme.colors.surface,
                  borderRadius: 14,
                  overflow: "hidden",
                }}
              >
                {item.image && item.mediaType !== "video" ? (
                  <Image source={{ uri: item.image }} style={{ height: 120 }} />
                ) : (
                  <View style={{ height: 120, width: "100%", backgroundColor: "#f5f5f5", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={item.mediaType === "video" ? "videocam-outline" : "image-outline"} size={24} color="#888" />
                  </View>
                )}
                <View style={{ padding: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontWeight: "700", flex: 1 }} numberOfLines={1}>{item.title}</Text>
                    <FavoriteButton recipeId={item.id} />
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
        </Animated.View>
      </ScrollView>

      <Pressable
        onPress={openUpload}
        style={{
          position: "absolute",
          right: 16,
          bottom: Math.max(insets.bottom, 10) + 6,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: AppTheme.colors.primary,
          alignItems: "center",
          justifyContent: "center",
          elevation: 4,
        }}
      >
        <Ionicons name="add" color="white" size={30} />
      </Pressable>
    </View>
  );
}

function FavoriteButton({ recipeId }: { recipeId: string }) {
  const fav = getFavoriteLocal(recipeId);
  return (
    <Pressable onPress={() => toggleFavoriteLocal(recipeId)} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <Ionicons name={fav.liked ? "heart" : "heart-outline"} size={18} color={fav.liked ? "#ff4b4b" : "#777"} />
      <Text style={{ fontSize: 12, color: "#777" }}>{fav.count}</Text>
    </Pressable>
  );
}

function TopHeader({
  topInset,
  query,
  onQueryChange,
  onSubmitSearch,
  profilePhoto,
  searchHistory,
}: {
  topInset: number;
  query: string;
  onQueryChange: (v: string) => void;
  onSubmitSearch: () => void;
  profilePhoto: string;
  searchHistory: string[];
}) {
  return (
    <View style={{ backgroundColor: AppTheme.colors.mustard, paddingHorizontal: 14, paddingTop: topInset + 8, paddingBottom: 12, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }}>
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
        <TextInput
          value={query}
          onChangeText={onQueryChange}
          onSubmitEditing={onSubmitSearch}
          placeholder="Search recipes, cuisines, chefs..."
          placeholderTextColor="#999"
          style={{ marginLeft: 6, flex: 1 }}
        />
      </View>

      {searchHistory.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 8 }}>
          {searchHistory.map((q) => (
            <Pressable key={q} onPress={() => onQueryChange(q)} style={{ backgroundColor: "#fff", borderRadius: 999, borderWidth: 1, borderColor: "#ead9a0", paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: "#7a6630" }}>{q}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function EmptyCard({ loading, onUploadPress }: { loading: boolean; onUploadPress: () => void }) {
  return (
    <View style={{ marginTop: 10, borderRadius: AppTheme.radius.lg, borderWidth: 1, borderColor: AppTheme.colors.border, backgroundColor: "white", padding: 16, alignItems: "center" }}>
      <Ionicons name={loading ? "hourglass-outline" : "restaurant-outline"} size={22} color={AppTheme.colors.subtleInk} />
      <Text style={{ marginTop: 8, color: AppTheme.colors.subtleInk, textAlign: "center" }}>
        {loading ? "Loading recipes..." : "No recipes yet. Add your first recipe to get started."}
      </Text>
      {!loading ? (
        <Pressable onPress={onUploadPress} style={{ marginTop: 10, backgroundColor: AppTheme.colors.primary, borderRadius: AppTheme.radius.pill, paddingHorizontal: 14, paddingVertical: 8 }}>
          <Text style={{ color: "white", fontWeight: "700" }}>Upload Recipe</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function AiStudioPlaceholder() {
  return (
    <View
      style={{
        marginTop: 12,
        borderRadius: 16,
        backgroundColor: "#fff8e8",
        borderWidth: 1,
        borderColor: "#ead9a0",
        paddingHorizontal: 14,
        paddingVertical: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: AppTheme.colors.mustard,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="sparkles-outline" size={20} color={AppTheme.colors.primaryDeep} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: "800", color: AppTheme.colors.ink }}>
            AI Kitchen Studio
          </Text>
          <Text style={{ color: AppTheme.colors.subtleInk, marginTop: 2 }}>
            Loading recipe generator, extractor, voice, and photo tools...
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 12, alignItems: "center" }}>
        <ActivityIndicator color={AppTheme.colors.primaryDeep} />
      </View>
    </View>
  );
}

function SectionTitle({ title, subtitle, style }: { title: string; subtitle: string; style?: object }) {
  return (
    <View style={[{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, style]}>
      <Text style={{ fontSize: 17, fontWeight: "800" }}>{title}</Text>
      <Text style={{ color: AppTheme.colors.subtleInk }}>{subtitle}</Text>
    </View>
  );
}
