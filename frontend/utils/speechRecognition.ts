import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";
import type { ExpoSpeechRecognitionResultEvent } from "expo-speech-recognition";

export function isSpeechRecognitionAvailable() {
  try {
    return !!(
      ExpoSpeechRecognitionModule &&
      typeof ExpoSpeechRecognitionModule.start === "function" &&
      typeof ExpoSpeechRecognitionModule.stop === "function" &&
      typeof ExpoSpeechRecognitionModule.requestPermissionsAsync === "function"
    );
  } catch {
    return false;
  }
}

export function getSpeechTranscript(event: ExpoSpeechRecognitionResultEvent | null | undefined) {
  return (
    event?.results
      ?.map((result) => result?.transcript || "")
      .filter(Boolean)
      .join(" ")
      .trim() || ""
  );
}

type StartSpeechRecognitionOptions = {
  lang?: string;
  interimResults?: boolean;
  continuous?: boolean;
};

export async function startSpeechRecognitionSession({
  lang = "en-US",
  interimResults = true,
  continuous = false,
}: StartSpeechRecognitionOptions = {}) {
  try {
    if (!isSpeechRecognitionAvailable()) {
      return { ok: false as const, reason: "unavailable" as const };
    }

    const state = await ExpoSpeechRecognitionModule.getStateAsync();
    if (state !== "inactive") {
      return { ok: false as const, reason: "busy" as const, state };
    }
  } catch {
    // If the recognizer state cannot be read, continue and rely on start/error events.
  }

  try {
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      return { ok: false as const, reason: "permissions" as const };
    }

    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults,
      continuous,
      maxAlternatives: 1,
    });

    return { ok: true as const };
  } catch {
    return { ok: false as const, reason: "unavailable" as const };
  }
}

export function stopSpeechRecognitionSession() {
  try {
    ExpoSpeechRecognitionModule.stop();
    return true;
  } catch {
    return false;
  }
}

export function abortSpeechRecognitionSession() {
  try {
    ExpoSpeechRecognitionModule.abort();
    return true;
  } catch {
    return false;
  }
}
