import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import Voice from "@react-native-voice/voice";
import { extractIngredients } from "../services/aiService";

export default function IngredientExtractor({ enableVoice = true }) {
  const isVoiceSupported = !!Voice && typeof Voice.start === "function";
  const canUseVoice = enableVoice && isVoiceSupported;
  const [text, setText] = useState("");
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);

  const runExtraction = async (inputText) => {
    if (!inputText?.trim()) return;

    try {
      setLoading(true);
      const result = await extractIngredients(inputText);
      setIngredients(result || []);
    } catch (err) {
      console.log("AI Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    if (!canUseVoice) return;

    try {
      setListening(true);
      await Voice.start("en-US");
    } catch (e) {
      console.log("Voice start error:", e);
      setListening(false);
    }
  };

  useEffect(() => {
    if (!canUseVoice) return;

    Voice.onSpeechResults = (event) => {
      const spokenText = event.value?.[0];
      if (!spokenText) return;

      setText(spokenText);
      runExtraction(spokenText);
      setListening(false);
    };

    Voice.onSpeechError = (e) => {
      console.log("Voice error:", e);
      setListening(false);
    };

    return () => {
      try {
        Voice.onSpeechResults = undefined;
        Voice.onSpeechError = undefined;
      } catch {}
      Voice.destroy().catch(() => {});
    };
  }, [canUseVoice]);

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

      <TextInput
        placeholder="Paste recipe or speak ingredients..."
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
        disabled={!canUseVoice}
        style={{
          backgroundColor: !canUseVoice ? "#b3b3b3" : listening ? "#999" : "#4CAF50",
          padding: 12,
          borderRadius: 10,
          marginTop: 10,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>
          {canUseVoice ? (listening ? "Listening..." : "Speak Ingredients") : "Voice Unavailable"}
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

      {ingredients.length > 0 && (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: "700", marginBottom: 6 }}>
            Ingredients
          </Text>

          {ingredients.map((item, index) => (
            <Text key={index}>
              - {item.quantity} {item.name}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}
