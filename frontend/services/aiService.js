import axios from "axios";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "";

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

  return res.data.ingredients;
};

export const parseRecipe = async (text) => {
  const base = ensureApiUrl();
  const res = await axios.post(
    `${base}/api/ai/parse-recipe`,
    { text }
  );

  return res.data.data || {};
};

export const translateRecipe = async (text, language) => {
  const base = ensureApiUrl();
  const res = await axios.post(
    `${base}/api/ai/translate`,
    { text, language }
  );

  return res.data.text;
};
