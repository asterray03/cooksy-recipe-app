import axios from "axios";

import { getEnv } from "@/config/env";

const API_URL = getEnv("EXPO_PUBLIC_API_URL") || "";

const ensureApiUrl = () => {
  if (!API_URL) {
    throw new Error("AI API URL is not configured. Set EXPO_PUBLIC_API_URL.");
  }
  return API_URL;
};

export const extractIngredients = async (text) => {
  const base = ensureApiUrl();
  const res = await axios.post(
    `${base}/api/ai/ingredients-from-text`,
    { text }
  );

  return normalizeIngredients(res.data.ingredients);
};

export const extractIngredientsFromImage = async (imageBase64) => {
  const base = ensureApiUrl();
  const res = await axios.post(
    `${base}/api/ai/ingredients-from-image`,
    { imageBase64 }
  );

  return normalizeIngredients(res.data.ingredients);
};

export const parseRecipe = async (text) => {
  const base = ensureApiUrl();
  const res = await axios.post(
    `${base}/api/ai/parse-recipe`,
    { text }
  );

  return res.data.data || {};
};

const normalizeIngredients = (raw) => {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (typeof item === "string") {
        return { name: item.trim(), quantity: "" };
      }

      return {
        name: String(item?.name || "").trim(),
        quantity: String(item?.quantity || "").trim(),
      };
    })
    .filter((item) => item.name && !item.name.startsWith("{") && !item.name.includes('"ingredients"'));
};

export const translateRecipe = async (text, language) => {
  const base = ensureApiUrl();
  const res = await axios.post(
    `${base}/api/ai/translate`,
    { text, language }
  );

  return res.data.text;
};
