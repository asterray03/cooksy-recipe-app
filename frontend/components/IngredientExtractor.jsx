import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from "react-native";
import { useSpeechRecognitionEvent } from "expo-speech-recognition";
import { extractIngredients, extractIngredientsFromImage } from "../services/aiService";
import {
  abortSpeechRecognitionSession,
  getSpeechTranscript,
  isSpeechRecognitionAvailable,
  startSpeechRecognitionSession,
} from "../utils/speechRecognition";

const loadImagePicker = async () => {
  try {
    return await import("expo-image-picker");
  } catch {
    return null;
  }
};

export default function IngredientExtractor({ enableVoice = true }) {
  const isVoiceSupported = isSpeechRecognitionAvailable();
  const canUseVoice = enableVoice && isVoiceSupported;
  const [text, setText] = useState("");
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [photoUri, setPhotoUri] = useState("");
  const [error, setError] = useState("");

  const runExtraction = async (inputText) => {
    if (!inputText?.trim()) return;

    try {
      setError("");
      setLoading(true);
      const result = await extractIngredients(inputText);
      setIngredients(result || []);
    } catch (err) {
      console.log("AI Error:", err);
      setError("Could not extract ingredients right now.");
    } finally {
      setLoading(false);
    }
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
    } catch (err) {
      console.log("Ingredient image parse error:", err);
      setError("Could not detect ingredients from the image.");
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    if (!canUseVoice) return;

    try {
      const result = await startSpeechRecognitionSession({
        lang: "en-US",
        interimResults: true,
      });

      if (!result.ok) {
        setListening(false);
        return;
      }

      setListening(true);
    } catch (e) {
      console.log("Voice start error:", e);
      setListening(false);
    }
  };

  useSpeechRecognitionEvent("result", (event) => {
    if (!canUseVoice || !listening) return;

    const spokenText = getSpeechTranscript(event);
    if (!spokenText) return;

    setText(spokenText);

    if (event.isFinal) {
      setListening(false);
      runExtraction(spokenText);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (!canUseVoice || !listening) return;
    console.log("Voice error:", event);
    setListening(false);
  });

  useSpeechRecognitionEvent("end", () => {
    if (!canUseVoice) return;
    setListening(false);
  });

  useEffect(() => {
    return () => {
      abortSpeechRecognitionSession();
    };
  }, []);

  return (
    <View
      style={{
        backgroundColor: "white",
        padding: 16,
        borderRadius: 14,
        marginVertical: 14,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>
        AI Ingredient Extractor
      </Text>

      <Text style={{ color: "#666", marginBottom: 10 }}>
        Tell me a dish and I will extract the ingredients for that.
      </Text>

      <TextInput
        placeholder="Type a dish name, for example butter chicken..."
        multiline
        value={text}
        onChangeText={setText}
        style={{
          borderWidth: 1,
          borderColor: "#ddd",
          borderRadius: 10,
          padding: 10,
          minHeight: 80,
        }}
      />

      <Pressable
        onPress={startRecording}
        disabled={!canUseVoice || listening}
        style={{
          backgroundColor: !canUseVoice ? "#b3b3b3" : listening ? "#999" : "#4CAF50",
          padding: 12,
          borderRadius: 10,
          marginTop: 10,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>
          {canUseVoice ? (listening ? "Listening..." : "Tell Me a Dish by Voice") : "Voice Unavailable"}
        </Text>
      </Pressable>

      <Pressable
        onPress={pickIngredientImage}
        style={{
          backgroundColor: "#2f7ddb",
          padding: 12,
          borderRadius: 10,
          marginTop: 10,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>
          Upload Ingredient Photo
        </Text>
      </Pressable>

      <Pressable
        onPress={() => runExtraction(text)}
        style={{
          backgroundColor: "#ff6b3d",
          padding: 12,
          borderRadius: 10,
          marginTop: 10,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>
          Extract Ingredients
        </Text>
      </Pressable>

      {loading && <ActivityIndicator style={{ marginTop: 10 }} />}

      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={{ width: "100%", height: 140, borderRadius: 10, marginTop: 10 }}
          resizeMode="cover"
        />
      ) : null}

      {error ? (
        <Text style={{ marginTop: 10, color: "#b22b2b", fontWeight: "600" }}>
          {error}
        </Text>
      ) : null}

      {ingredients.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: "700", marginBottom: 6 }}>
            Ingredients
          </Text>

          {ingredients.map((item, index) => (
            <Text key={index}>
              - {[item.quantity, item.name].filter(Boolean).join(" ")}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
