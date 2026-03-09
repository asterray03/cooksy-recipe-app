import { useEffect, useMemo, useState } from "react";

type ThemeMode = "system" | "light" | "dark";

type FeatureState = {
  recentlyViewed: Array<{ id: string; title: string; image?: string }>;
  favorites: Record<string, { liked: boolean; count: number }>;
  searchHistory: string[];
  ratings: Record<string, number>;
  themeMode: ThemeMode;
};

const state: FeatureState = {
  recentlyViewed: [],
  favorites: {},
  searchHistory: [],
  ratings: {},
  themeMode: "system",
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const subscribeFeatureState = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getFeatureState = () => state;

export const addRecentlyViewed = (item: { id: string; title: string; image?: string }) => {
  state.recentlyViewed = [item, ...state.recentlyViewed.filter((x) => x.id !== item.id)].slice(0, 12);
  emit();
};

export const getRecentlyViewed = () => state.recentlyViewed;

export const toggleFavoriteLocal = (id: string) => {
  const current = state.favorites[id] || { liked: false, count: 0 };
  const liked = !current.liked;
  const count = liked ? current.count + 1 : Math.max(0, current.count - 1);
  state.favorites[id] = { liked, count };
  emit();
  return state.favorites[id];
};

export const getFavoriteLocal = (id: string) => state.favorites[id] || { liked: false, count: 0 };

export const addSearchHistory = (q: string) => {
  const value = q.trim();
  if (!value) return;
  state.searchHistory = [value, ...state.searchHistory.filter((x) => x.toLowerCase() !== value.toLowerCase())].slice(0, 8);
  emit();
};

export const getSearchHistory = () => state.searchHistory;

export const removeSearchHistory = (q: string) => {
  state.searchHistory = state.searchHistory.filter((x) => x !== q);
  emit();
};

export const setRecipeRating = (id: string, rating: number) => {
  state.ratings[id] = rating;
  emit();
};

export const getRecipeRating = (id: string) => state.ratings[id] || 0;

export const setThemeMode = (themeMode: ThemeMode) => {
  state.themeMode = themeMode;
  emit();
};

export const getThemeMode = () => state.themeMode;

export const useFeatureState = () => {
  const [, setTick] = useState(0);
  useEffect(() => subscribeFeatureState(() => setTick((n) => n + 1)), []);
  const snapshot = getFeatureState();
  return useMemo(() => snapshot, [snapshot]);
};
