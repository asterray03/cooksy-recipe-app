import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSpeechRecognitionEvent } from "expo-speech-recognition";
import { AppTheme } from "@/constants/app-theme";
import { generateAiRecipe } from "@/services/api";
import { extractIngredients, extractIngredientsFromImage } from "@/services/aiService";
import {
  abortSpeechRecognitionSession,
  getSpeechTranscript,
  isSpeechRecognitionAvailable,
  startSpeechRecognitionSession,
  stopSpeechRecognitionSession,
} from "@/utils/speechRecognition";

type StudioMode = "generator" | "extractor";

const loadImagePicker = async () => {
  try {
    return await import("expo-image-picker");
  } catch {
    return null;
  }
};

export default function AiKitchenStudio() {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<StudioMode>("generator");

  return (
    <View
      style={{
        marginTop: 12,
        borderRadius: 16,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: AppTheme.colors.border,
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        style={{
          paddingHorizontal: 14,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#fff8e8",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
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
              Recipe generator, ingredient extractor, voice and photo input
            </Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={AppTheme.colors.primaryDeep}
        />
      </Pressable>

      {expanded ? (
        <View style={{ padding: 14 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <StudioTab
              label="Recipe Generator"
              active={mode === "generator"}
              onPress={() => setMode("generator")}
            />
            <StudioTab
              label="Ingredient Extractor"
              active={mode === "extractor"}
              onPress={() => setMode("extractor")}
            />
          </View>

          {mode === "generator" ? <RecipeGeneratorPanel /> : <IngredientExtractorPanel />}
        </View>
      ) : null}
    </View>
  );
}

function StudioTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        borderRadius: AppTheme.radius.pill,
        paddingVertical: 10,
        paddingHorizontal: 10,
        backgroundColor: active ? AppTheme.colors.primary : "#fff",
        borderWidth: 1,
        borderColor: active ? AppTheme.colors.primary : AppTheme.colors.border,
        alignItems: "center",
      }}
    >
      <Text style={{ color: active ? "#fff" : AppTheme.colors.ink, fontWeight: "700", fontSize: 12 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function RecipeGeneratorPanel() {
  const isVoiceSupported = isSpeechRecognitionAvailable();
  const [input, setInput] = useState("");
  const [photoUri, setPhotoUri] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [recipe, setRecipe] = useState<any>(null);

  const ingredients = useMemo(
    () =>
      String(input || "")
        .split(/,| and |&|\+/gi)
        .map((x) => x.replace(/[^a-zA-Z\s]/g, " ").trim())
        .filter(Boolean)
        .filter((x, idx, arr) => arr.indexOf(x) === idx)
        .slice(0, 8),
    [input]
  );

  const generateRecipe = useCallback(async (items: string[]) => {
    if (!items.length) {
      setError("Add ingredients like tomato, onion, paneer.");
      setRecipe(null);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const generated = await generateAiRecipe({
        ingredients: items,
        time: "30 min",
        diet: "Any",
        title: "Cooksy AI Recipe Suggestion",
        servings: "2",
      });
      setRecipe(generated || null);
    } catch (err: any) {
      setRecipe(null);
      setError(err?.message || "Could not generate a recipe right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  const startListening = async () => {
    if (!isVoiceSupported) {
      setError("Voice input is not available on this build.");
      return;
    }

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
        setError("Voice input is not available on this build.");
      }
      setListening(false);
      return;
    }

    setListening(true);
  };

  const stopListening = () => {
    stopSpeechRecognitionSession();
    setListening(false);
  };

  const generateFromPhoto = async () => {
    try {
      setError("");
      const ImagePicker = await loadImagePicker();
      if (!ImagePicker) {
        setError("Photo input is not available in this build.");
        return;
      }
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Photo library permission is required.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setPhotoUri(asset.uri || "");
      setLoading(true);

      const detected = await extractIngredientsFromImage(asset.base64 || "");
      const items = (detected || []).map((item) => item.name).filter(Boolean).slice(0, 8);
      setInput(items.join(", "));

      if (!items.length) {
        setRecipe(null);
        setError("Could not detect ingredients from that image.");
        return;
      }

      await generateRecipe(items);
    } catch (err: any) {
      setRecipe(null);
      setError(err?.message || "Could not generate a recipe from that image.");
      setLoading(false);
    }
  };

  useSpeechRecognitionEvent("result", async (event) => {
    if (!listening) return;

    const spoken = getSpeechTranscript(event);
    if (!spoken) return;

    setInput(spoken);
    if (event.isFinal) {
      setListening(false);
      const spokenIngredients = spoken
        .split(/,| and |&|\+/gi)
        .map((x) => x.replace(/[^a-zA-Z\s]/g, " ").trim())
        .filter(Boolean)
        .filter((x, idx, arr) => arr.indexOf(x) === idx)
        .slice(0, 8);
      await generateRecipe(spokenIngredients);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (!listening) return;
    setListening(false);
    setError(event?.message || "Voice recognition failed.");
  });

  useSpeechRecognitionEvent("end", () => {
    setListening(false);
  });

  useEffect(() => {
    return () => {
      abortSpeechRecognitionSession();
    };
  }, []);

  return (
    <View style={{ marginTop: 12 }}>
      <Text style={{ color: AppTheme.colors.subtleInk }}>
        Enter ingredients, speak them, or upload a photo to get a quick AI recipe.
      </Text>

      <TextInput
        value={input}
        onChangeText={setInput}
        placeholder="Example: tomato, onion, paneer"
        placeholderTextColor="#999"
        style={{
          marginTop: 10,
          borderWidth: 1,
          borderColor: AppTheme.colors.border,
          borderRadius: 12,
          backgroundColor: "#fff",
          paddingHorizontal: 12,
          paddingVertical: 12,
        }}
      />

      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <ActionButton
          label={listening ? "Stop Voice" : "Use Voice"}
          bg={listening ? "#d14d4d" : "#3c8f53"}
          onPress={listening ? stopListening : startListening}
        />
        <ActionButton label="Use Photo" bg="#2f7ddb" onPress={generateFromPhoto} />
      </View>

      <Pressable
        onPress={() => generateRecipe(ingredients)}
        disabled={loading}
        style={{
          marginTop: 10,
          backgroundColor: loading ? "#e0c889" : AppTheme.colors.mustardDeep,
          borderRadius: 12,
          paddingVertical: 12,
          alignItems: "center",
        }}
      >
        <Text style={{ fontWeight: "800", color: AppTheme.colors.ink }}>
          {loading ? "Generating..." : "Generate Recipe"}
        </Text>
      </Pressable>

      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={{ marginTop: 10, width: "100%", height: 140, borderRadius: 12 }}
          resizeMode="cover"
        />
      ) : null}

      {loading ? (
        <View style={{ marginTop: 10, alignItems: "center" }}>
          <ActivityIndicator />
        </View>
      ) : null}

      {error ? <ErrorText message={error} /> : null}

      {recipe ? (
        <View
          style={{
            marginTop: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#ececec",
            backgroundColor: "#fcfcfc",
            padding: 12,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "800", color: AppTheme.colors.ink }}>
            {recipe.title || "Recipe Suggestion"}
          </Text>
          <Text style={{ marginTop: 4, color: AppTheme.colors.subtleInk }}>
            {recipe.cookingTime || "30 min"} | {recipe.servings || "2 servings"}
          </Text>
          {recipe.description ? (
            <Text style={{ marginTop: 6, color: AppTheme.colors.ink }}>{recipe.description}</Text>
          ) : null}
          {Array.isArray(recipe.ingredients) && recipe.ingredients.length ? (
            <Text style={{ marginTop: 8, color: AppTheme.colors.ink }}>
              Ingredients: {recipe.ingredients.join(", ")}
            </Text>
          ) : null}
          {Array.isArray(recipe.steps) && recipe.steps.length ? (
            <View style={{ marginTop: 8 }}>
              {recipe.steps.slice(0, 4).map((step: string, idx: number) => (
                <Text key={`${step}-${idx}`} style={{ marginTop: idx === 0 ? 0 : 4, color: AppTheme.colors.ink }}>
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

function IngredientExtractorPanel() {
  const isVoiceSupported = isSpeechRecognitionAvailable();
  const [text, setText] = useState("");
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [photoUri, setPhotoUri] = useState("");
  const [error, setError] = useState("");

  const runExtraction = async (inputText: string) => {
    if (!inputText.trim()) {
      setError("Enter a dish name or recipe text first.");
      return;
    }

    try {
      setError("");
      setLoading(true);
      const result = await extractIngredients(inputText);
      setIngredients(result || []);
    } catch (err: any) {
      setError(err?.message || "Could not extract ingredients right now.");
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    if (!isVoiceSupported) {
      setError("Voice input is not available on this build.");
      return;
    }

    setError("");
    const result = await startSpeechRecognitionSession({
      lang: "en-US",
      interimResults: true,
    });

    if (!result.ok) {
      setListening(false);
      setError(
        result.reason === "permissions"
          ? "Microphone permission was denied."
          : "Voice input is not available right now."
      );
      return;
    }

    setListening(true);
  };

  const pickIngredientImage = async () => {
    try {
      setError("");
      const ImagePicker = await loadImagePicker();
      if (!ImagePicker) {
        setError("Photo input is not available in this build.");
        return;
      }
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Photo library permission is required.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setPhotoUri(asset.uri || "");
      setLoading(true);
      const detected = await extractIngredientsFromImage(asset.base64 || "");
      setIngredients(detected || []);
    } catch (err: any) {
      setError(err?.message || "Could not detect ingredients from the image.");
    } finally {
      setLoading(false);
    }
  };

  useSpeechRecognitionEvent("result", async (event) => {
    if (!listening) return;

    const spokenText = getSpeechTranscript(event);
    if (!spokenText) return;

    setText(spokenText);
    if (event.isFinal) {
      setListening(false);
      await runExtraction(spokenText);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (!listening) return;
    setListening(false);
    setError(event?.message || "Voice recognition failed.");
  });

  useSpeechRecognitionEvent("end", () => {
    setListening(false);
  });

  useEffect(() => {
    return () => {
      abortSpeechRecognitionSession();
    };
  }, []);

  return (
    <View style={{ marginTop: 12 }}>
      <Text style={{ color: AppTheme.colors.subtleInk }}>
        Extract ingredients from dish text, voice, or a photo of ingredients.
      </Text>

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Type a dish name or short recipe"
        placeholderTextColor="#999"
        multiline
        style={{
          marginTop: 10,
          minHeight: 88,
          borderWidth: 1,
          borderColor: AppTheme.colors.border,
          borderRadius: 12,
          backgroundColor: "#fff",
          paddingHorizontal: 12,
          paddingVertical: 12,
          textAlignVertical: "top",
        }}
      />

      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <ActionButton
          label={listening ? "Listening..." : "Voice Input"}
          bg={!isVoiceSupported ? "#b6b6b6" : listening ? "#d14d4d" : "#3c8f53"}
          onPress={() => {
            if (listening) {
              stopSpeechRecognitionSession();
              setListening(false);
              return;
            }
            startRecording();
          }}
        />
        <ActionButton label="Photo Input" bg="#2f7ddb" onPress={pickIngredientImage} />
      </View>

      <Pressable
        onPress={() => runExtraction(text)}
        disabled={loading}
        style={{
          marginTop: 10,
          backgroundColor: loading ? "#ffb49b" : "#ff6b3d",
          borderRadius: 12,
          paddingVertical: 12,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "800" }}>
          {loading ? "Extracting..." : "Extract Ingredients"}
        </Text>
      </Pressable>

      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={{ marginTop: 10, width: "100%", height: 140, borderRadius: 12 }}
          resizeMode="cover"
        />
      ) : null}

      {loading ? (
        <View style={{ marginTop: 10, alignItems: "center" }}>
          <ActivityIndicator />
        </View>
      ) : null}

      {error ? <ErrorText message={error} /> : null}

      {ingredients.length ? (
        <View
          style={{
            marginTop: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: AppTheme.colors.border,
            backgroundColor: "#fcfcfc",
            padding: 12,
          }}
        >
          <Text style={{ fontWeight: "800", color: AppTheme.colors.ink }}>Detected Ingredients</Text>
          {ingredients.map((item, index) => (
            <Text key={`${item?.name || "ingredient"}-${index}`} style={{ marginTop: 6, color: AppTheme.colors.ink }}>
              {index + 1}. {[item?.quantity, item?.name].filter(Boolean).join(" ")}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ActionButton({
  label,
  bg,
  onPress,
}: {
  label: string;
  bg: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: bg,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: "center",
      }}
    >
      <Text style={{ color: "#fff", fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

function ErrorText({ message }: { message: string }) {
  return <Text style={{ marginTop: 10, color: "#b22b2b", fontWeight: "600" }}>{message}</Text>;
}
