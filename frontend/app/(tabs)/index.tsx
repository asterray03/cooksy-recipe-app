import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSpeechRecognitionEvent } from "expo-speech-recognition";
import { router } from "expo-router";
import { categories } from "@/constants/mock-data";
import { generateAiRecipe, getMyProfile, getRecipes } from "@/services/api";
import { AppTheme } from "@/constants/app-theme";
import IngredientExtractor  from "../../components/IngredientExtractor";
import {
  addSearchHistory,
  getFavoriteLocal,
  getSearchHistory,
  toggleFavoriteLocal,
  useFeatureState,
} from "@/state/app-features";
import { getDifficulty } from "@/utils/recipe";
import {
  abortSpeechRecognitionSession,
  getSpeechTranscript,
  isSpeechRecognitionAvailable,
  startSpeechRecognitionSession,
  stopSpeechRecognitionSession,
} from "@/utils/speechRecognition";

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
  useFeatureState();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [profilePhoto, setProfilePhoto] = useState<string>("");

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
      // Guest/local sessions can fail profile lookup; keep recipe feed available.
      setProfilePhoto("");
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
    Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }).start();
  }, [fade]);

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

  return (
    <View style={{ flex: 1, backgroundColor: AppTheme.colors.page }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 90 }}
      >
        <TopHeader
          query={query}
          onQueryChange={setQuery}
          onSubmitSearch={submitSearch}
          profilePhoto={profilePhoto}
          searchHistory={searchHistory}
        />

        <IngredientExtractor enableVoice={false} />
        <VoiceChefCard />

        <Animated.View style={{ padding: 14, opacity: fade }}>
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
            <EmptyCard loading={loading} />
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
        onPress={() => router.push("/upload")}
        style={{
          position: "absolute",
          right: 16,
          bottom: 16,
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
  query,
  onQueryChange,
  onSubmitSearch,
  profilePhoto,
  searchHistory,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  onSubmitSearch: () => void;
  profilePhoto: string;
  searchHistory: string[];
}) {
  return (
    <View style={{ backgroundColor: AppTheme.colors.mustard, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }}>
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

function EmptyCard({ loading }: { loading: boolean }) {
  return (
    <View style={{ marginTop: 10, borderRadius: AppTheme.radius.lg, borderWidth: 1, borderColor: AppTheme.colors.border, backgroundColor: "white", padding: 16, alignItems: "center" }}>
      <Ionicons name={loading ? "hourglass-outline" : "restaurant-outline"} size={22} color={AppTheme.colors.subtleInk} />
      <Text style={{ marginTop: 8, color: AppTheme.colors.subtleInk, textAlign: "center" }}>
        {loading ? "Loading recipes..." : "No recipes yet. Add your first recipe to get started."}
      </Text>
      {!loading ? (
        <Pressable onPress={() => router.push("/upload")} style={{ marginTop: 10, backgroundColor: AppTheme.colors.primary, borderRadius: AppTheme.radius.pill, paddingHorizontal: 14, paddingVertical: 8 }}>
          <Text style={{ color: "white", fontWeight: "700" }}>Upload Recipe</Text>
        </Pressable>
      ) : null}
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

function VoiceChefCard() {
  const isVoiceSupported = isSpeechRecognitionAvailable();
  const [listening, setListening] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recipe, setRecipe] = useState<any>(null);

  const extractIngredientsFromPrompt = useCallback((prompt: string) => {
    const cleaned = prompt.toLowerCase().replace(/\?/g, " ").trim();
    const withMatch = cleaned.match(/with\s+(.+)/i);
    const source = withMatch ? withMatch[1] : cleaned;

    const tokens = source
      .split(/,| and |&|\+/gi)
      .map((x) => x.replace(/[^a-z\s]/gi, " ").trim())
      .map((x) => x.split(/\s+/).filter(Boolean).slice(-2).join(" "))
      .filter(Boolean)
      .filter((x, idx, arr) => arr.indexOf(x) === idx);

    return tokens.slice(0, 8);
  }, []);

  const generateFromPrompt = useCallback(async (prompt: string) => {
    const trimmed = String(prompt || "").trim();
    if (!trimmed) return;

    const ingredients = extractIngredientsFromPrompt(trimmed);
    if (!ingredients.length) {
      setError("Tell me ingredients like: tomatoes and eggs.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const generated = await generateAiRecipe({
        ingredients,
        time: "30 min",
        diet: "Any",
        title: "Cooksy Voice Chef Suggestion",
        servings: "2",
      });
      setRecipe(generated || null);
    } catch (err: any) {
      setError(err?.message || "Could not generate recipe right now.");
      setRecipe(null);
    } finally {
      setLoading(false);
    }
  }, [extractIngredientsFromPrompt]);

  const startListening = async () => {
    if (!isVoiceSupported) {
      setError("Voice input is not available in this runtime.");
      return;
    }
    try {
      setError("");
      const result = await startSpeechRecognitionSession({
        lang: "en-US",
        interimResults: true,
      });

      if (!result.ok) {
        if (result.reason === "permissions") {
          setError("Microphone permission was denied.");
        } else if (result.reason === "busy") {
          setError("Voice recognition is already in use.");
        } else {
          setError("Voice input is not available in this runtime.");
        }
        setListening(false);
        return;
      }

      setListening(true);
    } catch (err: any) {
      setListening(false);
      setError(err?.message || "Could not start voice input.");
    }
  };

  const stopListening = async () => {
    if (!isVoiceSupported) return;
    stopSpeechRecognitionSession();
    setListening(false);
  };

  useSpeechRecognitionEvent("result", async (event) => {
    if (!isVoiceSupported || !listening) return;

    const spoken = getSpeechTranscript(event);
    if (!spoken) return;

    setQueryText(spoken);

    if (event.isFinal) {
      setListening(false);
      await generateFromPrompt(spoken);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (!isVoiceSupported) return;
    setListening(false);
    setError(event?.message || "Voice recognition failed.");
  });

  useSpeechRecognitionEvent("end", () => {
    if (!isVoiceSupported) return;
    setListening(false);
  });

  useEffect(() => {
    return () => {
      abortSpeechRecognitionSession();
    };
  }, []);

  return (
    <View style={{ marginHorizontal: 14, marginTop: 10, backgroundColor: "white", borderRadius: 14, borderWidth: 1, borderColor: AppTheme.colors.border, padding: 12 }}>
      <Text style={{ fontSize: 17, fontWeight: "800" }}>Cooksy Voice Chef</Text>
      <Text style={{ marginTop: 4, color: AppTheme.colors.subtleInk }}>
        Ask by voice: What can I cook with tomatoes and eggs?
      </Text>

      <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: AppTheme.colors.border, borderRadius: 10, paddingHorizontal: 10, minHeight: 40 }}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color="#888" />
          <TextInput
            value={queryText}
            onChangeText={setQueryText}
            placeholder="What can I cook with tomatoes and eggs?"
            placeholderTextColor="#999"
            style={{ marginLeft: 8, flex: 1 }}
          />
        </View>
        <Pressable
          onPress={listening ? stopListening : startListening}
          disabled={loading}
          style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: listening ? "#d14d4d" : AppTheme.colors.primary, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name={listening ? "stop" : "mic"} color="white" size={18} />
        </Pressable>
      </View>

      <Pressable
        onPress={() => generateFromPrompt(queryText)}
        disabled={loading}
        style={{ marginTop: 10, backgroundColor: loading ? "#dec27a" : AppTheme.colors.mustardDeep, borderRadius: 10, paddingVertical: 10, alignItems: "center" }}
      >
        <Text style={{ fontWeight: "800" }}>{loading ? "Thinking..." : "Get Recipe Suggestion"}</Text>
      </Pressable>

      {loading ? (
        <View style={{ marginTop: 10, alignItems: "center" }}>
          <ActivityIndicator />
        </View>
      ) : null}

      {error ? <Text style={{ marginTop: 8, color: "#b22b2b", fontWeight: "600" }}>{error}</Text> : null}

      {recipe ? (
        <View style={{ marginTop: 10, backgroundColor: "#fcfcfc", borderWidth: 1, borderColor: "#ececec", borderRadius: 10, padding: 10 }}>
          <Text style={{ fontWeight: "800", fontSize: 16 }}>{recipe.title || "Recipe Suggestion"}</Text>
          <Text style={{ marginTop: 4, color: AppTheme.colors.subtleInk }}>
            {recipe.cookingTime || "30 min"} • {recipe.servings || "2 servings"}
          </Text>
          {recipe.description ? <Text style={{ marginTop: 6, color: AppTheme.colors.ink }}>{recipe.description}</Text> : null}

          {Array.isArray(recipe.ingredients) && recipe.ingredients.length ? (
            <Text style={{ marginTop: 8, color: AppTheme.colors.ink }}>
              Ingredients: {recipe.ingredients.join(", ")}
            </Text>
          ) : null}

          {Array.isArray(recipe.steps) && recipe.steps.length ? (
            <View style={{ marginTop: 8 }}>
              {recipe.steps.slice(0, 4).map((step: string, idx: number) => (
                <Text key={`${step}-${idx}`} style={{ color: AppTheme.colors.ink, marginTop: idx === 0 ? 0 : 4 }}>
                  {idx + 1}. {step}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
