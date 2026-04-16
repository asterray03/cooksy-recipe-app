import { useMemo, useState, useEffect } from "react";
import { useSpeechRecognitionEvent } from "expo-speech-recognition";
import { Audio } from "expo-av";
import { parseRecipe } from "@/services/aiService";
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { TextInputProps } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { addRecipe } from "@/services/api";
import { AppTheme } from "@/constants/app-theme";
import { auth } from "@/config/firebase";
import { isGuestSession } from "@/state/session";
import {
  abortSpeechRecognitionSession,
  getSpeechTranscript,
  isSpeechRecognitionAvailable,
  startSpeechRecognitionSession,
  stopSpeechRecognitionSession,
} from "@/utils/speechRecognition";

const loadImagePicker = async () => {
  try {
    return await import("expo-image-picker");
  } catch {
    return null;
  }
};

const speechLanguages = [
  { label: "English", code: "en-US" },
  { label: "Hindi", code: "hi-IN" },
  { label: "Marathi", code: "mr-IN" },
  { label: "Telugu", code: "te-IN" },
  { label: "Tamil", code: "ta-IN" },
  { label: "Kannada", code: "kn-IN" },
  { label: "Gujarati", code: "gu-IN" },
  { label: "Punjabi", code: "pa-IN" },
  { label: "Bengali", code: "bn-IN" },
  { label: "Malayalam", code: "ml-IN" },
  { label: "Spanish", code: "es-ES" },
  { label: "French", code: "fr-FR" },
];

export default function UploadRecipeScreen() {
  const insets = useSafeAreaInsets();
  const isVoiceSupported = isSpeechRecognitionAvailable();
  const isGuest = !auth.currentUser || isGuestSession();
  const [listening, setListening] = useState(false);
  const [speechLang, setSpeechLang] = useState("en-US");
  const [form, setForm] = useState({
    title: "",
    image: "",
    mediaType: "image" as "image" | "video",
    ingredients: "",
    description: "",
    cookingTime: "",
    servings: "",
    cuisineType: "",
    dietaryCategory: "",
    tags: "",
    voiceTranscript: "",
    voiceLanguage: "en-US",
  });
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [voiceAudioUri, setVoiceAudioUri] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const descriptionCount = form.description.length;

  const hasMedia = useMemo(() => !!form.image, [form.image]);

  useEffect(() => {
    if (!isGuest) return;

    Alert.alert("Sign in required", "Upload is available only for signed-in users.");
    router.replace("/auth");
  }, [isGuest]);

  const goBackSafe = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)");
  };

  const startVoiceRecipe = async () => {
    if (!isVoiceSupported) {
      setFeedback({ type: "error", text: "Voice input is not available in this runtime." });
      return;
    }
    try {
      const result = await startSpeechRecognitionSession({
        lang: speechLang,
        interimResults: true,
      });

      if (!result.ok) {
        if (result.reason === "permissions") {
          setFeedback({ type: "error", text: "Microphone permission was denied." });
        } else if (result.reason === "busy") {
          setFeedback({ type: "error", text: "Voice recognition is already in use." });
        } else {
          setFeedback({ type: "error", text: "Voice input is not available in this runtime." });
        }
        setListening(false);
        return;
      }

      setListening(true);
      setFeedback(null);
    } catch (err) {
      console.log(err);
      setListening(false);
    }
  };

  const pickMediaFromDevice = async () => {
    try {
      const ImagePicker = await loadImagePicker();
      if (!ImagePicker) {
        setFeedback({ type: "error", text: "Photo picker is not available in this build." });
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setFeedback({ type: "error", text: "Media library permission is required." });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.9,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];

      setForm((prev) => ({
        ...prev,
        image: asset.uri || "",
        mediaType: asset.type === "video" ? "video" : "image",
      }));
      setFeedback({ type: "success", text: "Media selected from device." });
    } catch (error) {
      console.log("Media picker failed", error);
      setFeedback({ type: "error", text: "Could not pick media from device." });
    }
  };

  const stopVoiceRecipe = async () => {
    if (!isVoiceSupported) return;
    stopSpeechRecognitionSession();
    setListening(false);
  };

  const startVoiceRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setFeedback({ type: "error", text: "Microphone permission is required to record audio." });
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const nextRecording = new Audio.Recording();
      await nextRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await nextRecording.startAsync();
      setRecording(nextRecording);
      setRecordingVoice(true);
      setFeedback(null);
    } catch (error) {
      console.log("Voice recording start failed", error);
      setFeedback({ type: "error", text: "Could not start voice recording." });
    }
  };

  const stopVoiceRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI() || "";
      setVoiceAudioUri(uri);
      setFeedback(uri ? { type: "success", text: "Voice note recorded and ready to upload." } : null);
    } catch (error) {
      console.log("Voice recording stop failed", error);
      setFeedback({ type: "error", text: "Could not save voice recording." });
    } finally {
      setRecording(null);
      setRecordingVoice(false);
    }
  };

  const onUpload = async () => {
    setFeedback(null);
    if (!auth.currentUser) {
      setFeedback({ type: "error", text: "Please sign in first. Redirecting to login..." });
      router.replace("/auth");
      return;
    }
    if (!form.title.trim()) {
      setFeedback({ type: "error", text: "Recipe title is required." });
      return;
    }
    if (!form.ingredients.trim()) {
      setFeedback({ type: "error", text: "Add at least one ingredient." });
      return;
    }

    setSubmitting(true);
    try {
      await addRecipe({
        title: form.title.trim(),
        image: form.image.trim(),
        mediaType: form.mediaType,
        ingredients: form.ingredients
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
        steps: form.description
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean),
        description: form.description,
        cookingTime: form.cookingTime,
        servings: form.servings,
        cuisineType: form.cuisineType,
        dietaryCategory: form.dietaryCategory,
        tags: form.tags
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        voiceAudioUri,
        voiceTranscript: form.voiceTranscript.trim(),
        voiceLanguage: form.voiceLanguage,
      });

      Alert.alert("Uploaded", "Recipe uploaded successfully");
      setFeedback({ type: "success", text: "Recipe uploaded successfully." });
      router.replace("/(tabs)");
    } catch (error: any) {
      const message = error?.message || "Failed to upload recipe";
      setFeedback({ type: "error", text: message });
      Alert.alert("Upload Failed", message);
    } finally {
      setSubmitting(false);
    }
  };

  useSpeechRecognitionEvent("result", async (event) => {
    if (!isVoiceSupported || !listening) return;

    const spokenText = getSpeechTranscript(event);
    if (!spokenText) return;

    setForm((prev) => ({
      ...prev,
      voiceTranscript: spokenText,
      voiceLanguage: speechLang,
    }));

    if (!event.isFinal) return;

    try {
      const result = await parseRecipe(spokenText);
      setForm((prev) => ({
        ...prev,
        ingredients: result?.ingredients?.join("\n") || prev.ingredients,
        description: result?.steps?.join("\n") || prev.description,
        voiceTranscript: spokenText,
        voiceLanguage: speechLang,
      }));
    } catch (err) {
      console.log(err);
    } finally {
      setListening(false);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (!isVoiceSupported) return;
    setListening(false);
    setFeedback({ type: "error", text: event?.message || "Voice recognition failed." });
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
    <View style={{ flex: 1, backgroundColor: AppTheme.colors.page }}>
      <View
        style={{
          backgroundColor: AppTheme.colors.mustard,
          paddingTop: insets.top + 8,
          paddingHorizontal: 12,
          paddingBottom: 12,
          borderBottomLeftRadius: 18,
          borderBottomRightRadius: 18,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable onPress={goBackSafe}>
            <Ionicons name="chevron-back" size={22} />
          </Pressable>
          <Text style={{ fontWeight: "800", fontSize: 22 }}>Upload Recipe</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: Math.max(insets.bottom, 12) + 12 }}>
        <Field label="Recipe Title" value={form.title} onChangeText={(v) => setForm((p) => ({ ...p, title: v }))} />

        <Text style={{ color: "#333", marginBottom: 4, fontWeight: "600" }}>Upload Photo/Video</Text>
        <Pressable
          onPress={pickMediaFromDevice}
          style={{
            backgroundColor: "#fff",
            borderRadius: 8,
            borderWidth: 1,
            borderColor: "#ddd",
            paddingHorizontal: 12,
            paddingVertical: 12,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ color: form.image ? AppTheme.colors.ink : "#888", flex: 1 }} numberOfLines={1}>
            {form.image ? "Media selected from device" : "Tap to select photo/video from gallery"}
          </Text>
          <Ionicons name="images-outline" size={20} color="#666" />
        </Pressable>

        {hasMedia && form.mediaType === "image" ? (
          <Image source={{ uri: form.image }} style={{ width: "100%", height: 180, borderRadius: 10 }} />
        ) : hasMedia && form.mediaType === "video" ? (
          <View
            style={{
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#d4d4d4",
              backgroundColor: "#fafafa",
              paddingVertical: 18,
              alignItems: "center",
            }}
          >
            <Ionicons name="videocam-outline" size={24} color="#666" />
            <Text style={{ marginTop: 6, color: "#666" }}>Video selected and will be uploaded</Text>
          </View>
        ) : (
          <View
            style={{
              borderStyle: "dashed",
              borderColor: "#cfcfcf",
              borderWidth: 1,
              borderRadius: 10,
              paddingVertical: 18,
              alignItems: "center",
              backgroundColor: "#fafafa",
            }}
          >
            <Ionicons name="image-outline" size={22} color="#999" />
            <Text style={{ marginTop: 6, color: "#888" }}>Image preview appears here</Text>
          </View>
        )}

        <View style={{ marginBottom: 6 }}>
          <Text style={{ fontWeight: "600", marginBottom: 4 }}>Select Speech Language</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {speechLanguages.map((lang) => (
              <Pressable
                key={lang.code}
                onPress={() => setSpeechLang(lang.code)}
                style={{
                  backgroundColor: speechLang === lang.code ? "#ffd54f" : "#eee",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  marginRight: 6,
                }}
              >
                <Text>{lang.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <Pressable
          onPress={listening ? stopVoiceRecipe : startVoiceRecipe}
          style={{
            backgroundColor: listening ? "#6e6e6e" : "#4CAF50",
            padding: 12,
            borderRadius: 8,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>
            {listening ? "Stop Listening" : "Speak Full Recipe"}
          </Text>
        </Pressable>

        <Pressable
          onPress={recordingVoice ? stopVoiceRecording : startVoiceRecording}
          style={{
            backgroundColor: recordingVoice ? "#d36b6b" : "#2f7ddb",
            padding: 12,
            borderRadius: 8,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>
            {recordingVoice ? "Stop Voice Note" : "Record Voice Note"}
          </Text>
        </Pressable>

        <Text style={{ color: AppTheme.colors.subtleInk }}>
          {voiceAudioUri ? "Voice note attached for viewers." : "No voice note attached yet."}
        </Text>

        <Field
          label="Voice Transcript"
          value={form.voiceTranscript}
          onChangeText={(v) => setForm((p) => ({ ...p, voiceTranscript: v }))}
          multiline
        />

        <Field
          label="Ingredients (one per line)"
          value={form.ingredients}
          onChangeText={(v) => setForm((p) => ({ ...p, ingredients: v }))}
          multiline
        />

        <Field
          label="Description/Instruction"
          value={form.description}
          onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
          multiline
        />
        <Text style={{ color: AppTheme.colors.subtleInk, marginTop: -6, marginBottom: 2 }}>{descriptionCount} chars</Text>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field label="Cooking Time" value={form.cookingTime} onChangeText={(v) => setForm((p) => ({ ...p, cookingTime: v }))} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Servings" value={form.servings} onChangeText={(v) => setForm((p) => ({ ...p, servings: v }))} />
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field label="Cuisine Type" value={form.cuisineType} onChangeText={(v) => setForm((p) => ({ ...p, cuisineType: v }))} />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Dietary Category"
              value={form.dietaryCategory}
              onChangeText={(v) => setForm((p) => ({ ...p, dietaryCategory: v }))}
            />
          </View>
        </View>

        <Field label="Tags/Keywords" value={form.tags} onChangeText={(v) => setForm((p) => ({ ...p, tags: v }))} placeholder="keto, easy" />

        {feedback ? (
          <View
            style={{
              borderRadius: AppTheme.radius.sm,
              borderWidth: 1,
              borderColor: feedback.type === "error" ? "#ffb5b5" : "#9dd2a8",
              backgroundColor: feedback.type === "error" ? "#fff1f1" : "#eefaf0",
              paddingHorizontal: 10,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: feedback.type === "error" ? "#b22b2b" : "#1f7a35", fontWeight: "600" }}>{feedback.text}</Text>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => {
              setForm({
                title: "",
                image: "",
                mediaType: "image",
                ingredients: "",
                description: "",
                cookingTime: "",
                servings: "",
                cuisineType: "",
                dietaryCategory: "",
                tags: "",
                voiceTranscript: "",
                voiceLanguage: "en-US",
              });
              setVoiceAudioUri("");
            }}
            style={{
              flex: 1,
              backgroundColor: "#fff",
              borderRadius: AppTheme.radius.sm,
              borderWidth: 1,
              borderColor: AppTheme.colors.border,
              paddingVertical: 12,
            }}
          >
            <Text style={{ textAlign: "center", fontWeight: "700", color: AppTheme.colors.ink }}>Clear</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (isGuest) {
                setFeedback({ type: "error", text: "Please sign in first. Redirecting to login..." });
                router.replace("/auth");
                return;
              }
              onUpload();
            }}
            disabled={submitting}
            style={{
              flex: 2,
              backgroundColor: submitting ? "#e9cb70" : AppTheme.colors.mustardDeep,
              borderRadius: AppTheme.radius.sm,
              paddingVertical: 12,
            }}
          >
            <Text style={{ textAlign: "center", fontWeight: "800" }}>
              {submitting ? "Uploading..." : isGuest ? "Login to Upload" : "Upload"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

type FieldProps = TextInputProps & {
  label: string;
};

function Field({ label, multiline, ...props }: FieldProps) {
  return (
    <View>
      <Text style={{ color: "#333", marginBottom: 4, fontWeight: "600" }}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor="#9a9a9a"
        style={{
          backgroundColor: "#fff",
          borderRadius: 8,
          borderWidth: 1,
          borderColor: "#ddd",
          paddingHorizontal: 10,
          paddingVertical: 10,
          minHeight: multiline ? 92 : undefined,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}
