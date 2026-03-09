import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { router, useLocalSearchParams } from "expo-router";
import { getRecipeById, getSavedRecipes, toggleSaveRecipe } from "@/services/api";
import { translateRecipe } from "@/services/aiService";
import { AppTheme } from "@/constants/app-theme";
import { addRecentlyViewed, getRecipeRating, setRecipeRating } from "@/state/app-features";
import { getDifficulty, extractMinutes } from "@/utils/recipe";

type Recipe = {
  id: string;
  userId?: string;
  title: string;
  image?: string;
  mediaType?: string;
  authorName?: string;
  ingredients?: string[];
  steps?: string[];
  cookingTime?: string;
  servings?: string;
  description?: string;
  voiceAudioUrl?: string;
  voiceTranscript?: string;
  voiceLanguage?: string;
};

const languageOptions = [
  { label: "English", code: "en-US", aiName: "English" },
  { label: "Hindi", code: "hi-IN", aiName: "Hindi" },
  { label: "Marathi", code: "mr-IN", aiName: "Marathi" },
  { label: "Telugu", code: "te-IN", aiName: "Telugu" },
  { label: "Tamil", code: "ta-IN", aiName: "Tamil" },
  { label: "Kannada", code: "kn-IN", aiName: "Kannada" },
  { label: "Gujarati", code: "gu-IN", aiName: "Gujarati" },
  { label: "Punjabi", code: "pa-IN", aiName: "Punjabi" },
  { label: "Bengali", code: "bn-IN", aiName: "Bengali" },
  { label: "Malayalam", code: "ml-IN", aiName: "Malayalam" },
  { label: "Spanish", code: "es-ES", aiName: "Spanish" },
  { label: "French", code: "fr-FR", aiName: "French" },
];

export default function RecipeDetailsScreen() {
  const params = useLocalSearchParams();
  const id = String(params.id ?? "");

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [quickNote, setQuickNote] = useState("");
  const [rating, setRating] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState("en-US");
  const [translatedVoiceText, setTranslatedVoiceText] = useState("");
  const [translatingVoice, setTranslatingVoice] = useState(false);

  const timerRef = useRef<any>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const goBackSafe = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)");
  };

  const stopVoicePlayback = async () => {
    Speech.stop();
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        const recipeData = await getRecipeById(id);
        setRecipe(recipeData);
        setSaved(false);
        setTranslatedVoiceText("");

        try {
          const savedRecipes = await getSavedRecipes();
          setSaved((savedRecipes || []).some((r: Recipe) => r.id === id));
        } catch {
          setSaved(false);
        }

        setRating(getRecipeRating(id));
        addRecentlyViewed({ id: recipeData.id, title: recipeData.title, image: recipeData.image });

        const mins = extractMinutes(recipeData.cookingTime) || 20;
        setSeconds(mins * 60);
      } catch (err) {
        console.log("Failed to load recipe", err);
        setRecipe(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  useEffect(() => {
    if (!running) return;

    timerRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setRunning(false);
          Alert.alert("Timer done", "Your cooking timer has finished.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [running]);

  useEffect(() => {
    return () => {
      stopVoicePlayback();
    };
  }, []);

  const ingredients = useMemo(() => recipe?.ingredients ?? [], [recipe]);

  const completion = useMemo(() => {
    if (ingredients.length === 0) return 0;
    const done = ingredients.filter((_, idx) => checked[idx]).length;
    return Math.round((done / ingredients.length) * 100);
  }, [ingredients, checked]);

  const toggleIngredient = (idx: number) => setChecked((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const onToggleSave = async () => {
    if (!id) return;
    try {
      const result = await toggleSaveRecipe(id);
      setSaved(!!result?.saved);
    } catch (err) {
      console.log("Save toggle failed", err);
      Alert.alert("Save Failed", "Please sign in to save recipes.");
    }
  };

  const onCopyIngredients = async () => {
    const text = ingredients.join("\n");
    await Share.share({ message: `Ingredients for ${recipe?.title}:\n${text}` });
  };

  const setRate = (v: number) => {
    setRating(v);
    if (id) setRecipeRating(id, v);
  };

  const onPlayCreatorVoice = async () => {
    if (!recipe) return;

    try {
      await stopVoicePlayback();

      if (recipe.voiceAudioUrl) {
        const { sound } = await Audio.Sound.createAsync({ uri: recipe.voiceAudioUrl }, { shouldPlay: true });
        soundRef.current = sound;
        return;
      }

      if (recipe.voiceTranscript) {
        Speech.speak(recipe.voiceTranscript, {
          language: recipe.voiceLanguage || "en-US",
          rate: 1,
        });
        return;
      }

      Alert.alert("No voice found", "This recipe does not include creator voice content.");
    } catch (error) {
      console.log("Voice playback failed", error);
      Alert.alert("Playback failed", "Could not play creator voice.");
    }
  };

  const onTranslateVoice = async () => {
    if (!recipe?.voiceTranscript?.trim()) {
      Alert.alert("No transcript", "This recipe has no transcript to translate.");
      return;
    }

    const selected = languageOptions.find((item) => item.code === targetLanguage) || languageOptions[0];

    try {
      setTranslatingVoice(true);
      const translated = await translateRecipe(recipe.voiceTranscript, selected.aiName);
      setTranslatedVoiceText(translated || "");
    } catch (error) {
      console.log("Voice translate failed", error);
      Alert.alert("Translate failed", "Could not translate creator voice right now.");
    } finally {
      setTranslatingVoice(false);
    }
  };

  const onPlayTranslatedVoice = async () => {
    if (!translatedVoiceText.trim()) {
      Alert.alert("Translate first", "Generate translated voice text first.");
      return;
    }

    const selected = languageOptions.find((item) => item.code === targetLanguage) || languageOptions[0];

    await stopVoicePlayback();
    Speech.speak(translatedVoiceText, { language: selected.code, rate: 1 });
  };

  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");

  return (
    <View style={{ flex: 1, backgroundColor: AppTheme.colors.page }}>
      <View style={{ backgroundColor: AppTheme.colors.mustard, paddingTop: 10, paddingHorizontal: 12, paddingBottom: 12, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={goBackSafe}><Ionicons name="chevron-back" size={22} /></Pressable>
          <Image source={require("../../assets/images/Cooksy_nobg.png")} style={{ width: 95, height: 30 }} resizeMode="contain" />
          <Pressable onPress={() => router.push("/(tabs)/profile")}><Ionicons name="person-circle" size={30} color={AppTheme.colors.primaryDeep} /></Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
        {loading ? (
          <View style={{ alignItems: "center", marginTop: 30 }}><Ionicons name="hourglass-outline" size={22} color={AppTheme.colors.subtleInk} /><Text style={{ marginTop: 8, color: AppTheme.colors.subtleInk }}>Loading recipe...</Text></View>
        ) : !recipe ? (
          <View style={{ alignItems: "center", marginTop: 30 }}><Ionicons name="alert-circle-outline" size={22} color={AppTheme.colors.subtleInk} /><Text style={{ marginTop: 8, color: AppTheme.colors.subtleInk, textAlign: "center" }}>Recipe not found or unavailable.</Text></View>
        ) : (
          <>
            <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 8 }}>Recipe Detail</Text>
            <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 10 }}>
              {recipe.image && recipe.mediaType !== "video" ? (
                <Image source={{ uri: recipe.image }} style={{ width: "100%", height: 220, borderRadius: 12 }} />
              ) : (
                <View style={{ width: "100%", height: 220, borderRadius: 12, backgroundColor: "#f5f5f5", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={recipe.mediaType === "video" ? "videocam-outline" : "image-outline"} size={30} color="#888" />
                </View>
              )}
              <Text style={{ fontSize: 20, fontWeight: "800", marginTop: 10 }}>{recipe.title}</Text>

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} onPress={() => setRate(n)}><Ionicons name={n <= rating ? "star" : "star-outline"} color="#f8b400" size={16} style={{ marginRight: 2 }} /></Pressable>
                  ))}
                  <Pressable
                    onPress={() => {
                      if (!recipe.userId) return;
                      router.push(`/user/${recipe.userId}`);
                    }}
                  >
                    <Text style={{ marginLeft: 6, color: AppTheme.colors.primaryDeep, fontWeight: "700" }}>
                      {recipe.authorName || "Chef"}
                    </Text>
                  </Pressable>
                </View>
                <View style={{ backgroundColor: "#eef7ff", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: "#175d9c", fontWeight: "700" }}>{getDifficulty(recipe.ingredients || [], recipe.cookingTime)}</Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <InfoChip text={recipe.cookingTime ? `${recipe.cookingTime}` : "N/A"} icon="time-outline" />
                <InfoChip text={recipe.servings ? `${recipe.servings} servings` : "N/A"} icon="people-outline" />
              </View>

              <View style={{ marginTop: 10, backgroundColor: "#f4f4f4", borderRadius: 10, padding: 10 }}>
                <Text style={{ fontWeight: "700" }}>Prep + Cook Timer</Text>
                <Text style={{ fontSize: 24, fontWeight: "800", marginTop: 2 }}>{`${minutes}:${secs}`}</Text>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <ActionChip text={running ? "Pause" : "Start"} icon={running ? "pause-outline" : "play-outline"} onPress={() => setRunning((r) => !r)} />
                  <ActionChip text="Reset" icon="refresh-outline" onPress={() => { setRunning(false); setSeconds((extractMinutes(recipe.cookingTime) || 20) * 60); }} />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <ActionChip text={saved ? "Saved" : "Save"} icon={saved ? "bookmark" : "bookmark-outline"} onPress={onToggleSave} />
                <ActionChip text="Copy Ingredients" icon="copy-outline" onPress={onCopyIngredients} />
              </View>

              {(recipe.voiceTranscript || recipe.voiceAudioUrl) ? (
                <View style={{ marginTop: 12, borderWidth: 1, borderColor: "#e7e7e7", borderRadius: 12, padding: 10, backgroundColor: "#fcfcfc" }}>
                  <Text style={{ fontWeight: "800", fontSize: 16 }}>Creator Voice</Text>
                  <Text style={{ marginTop: 4, color: AppTheme.colors.subtleInk }}>
                    Play the creator voice note or translate it into your language.
                  </Text>

                  <View style={{ marginTop: 8, flexDirection: "row", gap: 8 }}>
                    <ActionChip text="Play Original" icon="volume-high-outline" onPress={onPlayCreatorVoice} />
                    <ActionChip text="Stop" icon="stop-outline" onPress={stopVoicePlayback} />
                  </View>

                  <Text style={{ marginTop: 10, fontWeight: "700" }}>Translate Voice To</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 8 }}>
                    {languageOptions.map((lang) => {
                      const active = targetLanguage === lang.code;
                      return (
                        <Pressable
                          key={lang.code}
                          onPress={() => setTargetLanguage(lang.code)}
                          style={{
                            backgroundColor: active ? AppTheme.colors.primary : "#fff",
                            borderColor: active ? AppTheme.colors.primary : AppTheme.colors.border,
                            borderWidth: 1,
                            borderRadius: AppTheme.radius.pill,
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                          }}
                        >
                          <Text style={{ color: active ? "white" : AppTheme.colors.ink, fontWeight: "700" }}>{lang.label}</Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <View style={{ marginTop: 8, flexDirection: "row", gap: 8 }}>
                    <ActionChip text={translatingVoice ? "Translating..." : "AI Translate"} icon="language-outline" onPress={onTranslateVoice} />
                    <ActionChip text="Play Translated" icon="play-circle-outline" onPress={onPlayTranslatedVoice} />
                  </View>

                  {translatedVoiceText ? (
                    <Text style={{ marginTop: 10, color: AppTheme.colors.ink }}>{translatedVoiceText}</Text>
                  ) : null}
                </View>
              ) : null}

              <Text style={{ marginTop: 12, fontWeight: "800", fontSize: 16 }}>Ingredients</Text>
              <View style={{ marginTop: 8, backgroundColor: "#f2f2f2", borderRadius: AppTheme.radius.pill, height: 8, overflow: "hidden" }}>
                <View style={{ width: `${completion}%`, height: "100%", backgroundColor: AppTheme.colors.success }} />
              </View>
              <Text style={{ marginTop: 6, color: AppTheme.colors.subtleInk }}>{completion}% ingredients prepared</Text>

              {ingredients.map((item, idx) => {
                const done = !!checked[idx];
                return (
                  <Pressable key={`${item}-${idx}`} onPress={() => toggleIngredient(idx)} style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
                    <Ionicons name={done ? "checkbox" : "square-outline"} size={18} color={done ? AppTheme.colors.success : "#777"} />
                    <Text style={{ marginLeft: 8, color: done ? AppTheme.colors.subtleInk : AppTheme.colors.ink }}>{item}</Text>
                  </Pressable>
                );
              })}

              <Text style={{ marginTop: 12, fontWeight: "800", fontSize: 16 }}>Instructions</Text>
              {(recipe.steps ?? []).map((step, idx) => (
                <View key={`${step}-${idx}`} style={{ flexDirection: "row", marginTop: 8 }}>
                  <Text style={{ width: 22, color: AppTheme.colors.primary, fontWeight: "800" }}>{idx + 1}.</Text>
                  <Text style={{ flex: 1, color: AppTheme.colors.ink }}>{step}</Text>
                </View>
              ))}

              <Text style={{ marginTop: 12, fontWeight: "800", fontSize: 16 }}>Quick Notes</Text>
              <TextInput value={quickNote} onChangeText={setQuickNote} placeholder="Add your cooking note..." placeholderTextColor="#9a9a9a" style={{ marginTop: 8, borderWidth: 1, borderColor: AppTheme.colors.border, borderRadius: AppTheme.radius.sm, backgroundColor: "#fafafa", paddingHorizontal: 10, paddingVertical: 10, minHeight: 70, textAlignVertical: "top" }} multiline />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function InfoChip({ text, icon }: { text: string; icon: keyof typeof Ionicons.glyphMap }) {
  return <View style={{ backgroundColor: "#f4f4f4", borderRadius: AppTheme.radius.pill, paddingHorizontal: 12, paddingVertical: 7, flexDirection: "row", alignItems: "center" }}><Ionicons name={icon} size={14} color="#666" /><Text style={{ marginLeft: 6 }}>{text}</Text></View>;
}

function ActionChip({ text, icon, onPress }: { text: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; }) {
  return <Pressable onPress={onPress} style={{ backgroundColor: "#fff5f5", borderRadius: AppTheme.radius.pill, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#ffd7d7", flexDirection: "row", alignItems: "center" }}><Ionicons name={icon} size={14} color={AppTheme.colors.primaryDeep} /><Text style={{ marginLeft: 6, color: AppTheme.colors.primaryDeep, fontWeight: "700" }}>{text}</Text></Pressable>;
}
