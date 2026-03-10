import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useSpeechRecognitionEvent } from "expo-speech-recognition";
import { extractIngredients } from "../services/aiService";
import {
  abortSpeechRecognitionSession,
  getSpeechTranscript,
  isSpeechRecognitionAvailable,
  startSpeechRecognitionSession,
} from "../utils/speechRecognition";

export default function IngredientExtractor({ enableVoice = true }) {
  const isVoiceSupported = isSpeechRecognitionAvailable();
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
