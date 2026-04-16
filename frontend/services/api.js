import { getAuth } from "firebase/auth";
import { auth, db, storage } from "@/config/firebase";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { getEnv } from "@/config/env";
import { isGuestSession } from "@/state/session";

const API_URL = getEnv("EXPO_PUBLIC_API_URL");

const getToken = async () => {
  const user = getAuth().currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }

  return user.getIdToken();
};

const getOptionalToken = async () => {
  const user = getAuth().currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
};

const authHeaders = async (json = false) => {
  const token = await getToken();
  const headers = {
    Authorization: `Bearer ${token}`,
  };

  if (json) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
};

const maybeAuthHeaders = async (json = false) => {
  const token = await getOptionalToken();
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (json) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
};

const withApiFallback = (message) => {
  if (!API_URL) {
    throw new Error("API_UNAVAILABLE");
  }

  return message;
};

const mapDocs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return 0;
};

const sortByCreatedAtDesc = (items) =>
  [...items].sort((a, b) => toMillis(b?.createdAt) - toMillis(a?.createdAt));

const getCurrentUid = () => {
  const uid = auth.currentUser?.uid || getAuth().currentUser?.uid;
  if (!uid) throw new Error("User not authenticated");
  return uid;
};

const uploadVoiceAudio = async (voiceAudioUri, uid) => {
  if (!voiceAudioUri) return "";
  if (voiceAudioUri.startsWith("http://") || voiceAudioUri.startsWith("https://")) {
    return voiceAudioUri;
  }

  const response = await fetch(voiceAudioUri);
  const blob = await response.blob();
  const fileRef = storageRef(storage, `recipe-voices/${uid || "anonymous"}/${Date.now()}.m4a`);
  await uploadBytes(fileRef, blob, { contentType: "audio/mp4" });
  return getDownloadURL(fileRef);
};

const uploadRecipeMedia = async (mediaUri, mediaType, uid) => {
  if (!mediaUri) return "";
  if (mediaUri.startsWith("http://") || mediaUri.startsWith("https://")) {
    return mediaUri;
  }

  const response = await fetch(mediaUri);
  const blob = await response.blob();

  const folder = mediaType === "video" ? "recipe-videos" : "recipe-images";
  const extension = mediaType === "video" ? "mp4" : "jpg";
  const contentType = mediaType === "video" ? "video/mp4" : "image/jpeg";
  const fileRef = storageRef(storage, `${folder}/${uid || "anonymous"}/${Date.now()}.${extension}`);

  await uploadBytes(fileRef, blob, { contentType });
  return getDownloadURL(fileRef);
};

export const getRecipes = async () => {
  try {
    withApiFallback();
    const res = await fetch(`${API_URL}/api/recipes`, {
      headers: await maybeAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error("Failed to fetch recipes");
    }
    return res.json();
  } catch {
    const snap = await getDocs(query(collection(db, "recipes"), orderBy("createdAt", "desc"), limit(50)));
    return mapDocs(snap);
  }
};

export const getRecipeById = async (id) => {
  try {
    withApiFallback();
    const res = await fetch(`${API_URL}/api/recipes/${id}`, {
      headers: await maybeAuthHeaders(),
    });
    if (!res.ok) {
      throw new Error("Failed to fetch recipe");
    }
    return res.json();
  } catch {
    const snap = await getDoc(doc(db, "recipes", id));
    if (!snap.exists()) throw new Error("Failed to fetch recipe");
    return { id: snap.id, ...snap.data() };
  }
};

export const toggleSaveRecipe = async (id) => {
  try {
    withApiFallback();
    const res = await fetch(`${API_URL}/api/recipes/${id}/save`, {
      method: "POST",
      headers: await authHeaders(),
    });
    if (!res.ok) {
      throw new Error("Failed to toggle save");
    }
    return res.json();
  } catch {
    const uid = getCurrentUid();
    const ref = doc(db, "users", uid, "savedRecipes", id);
    const saved = await getDoc(ref);
    if (saved.exists()) {
      await deleteDoc(ref);
      return { saved: false };
    }
    await setDoc(ref, { recipeId: id, createdAt: serverTimestamp() });
    return { saved: true };
  }
};

export const getSavedRecipes = async () => {
  try {
    withApiFallback();
    const res = await fetch(`${API_URL}/api/recipes/saved`, {
      headers: await authHeaders(),
    });
    if (!res.ok) {
      throw new Error("Failed to fetch saved recipes");
    }
    return res.json();
  } catch {
    let uid = "";
    try {
      uid = getCurrentUid();
    } catch {
      return [];
    }

    let savedDocs = [];
    try {
      const savedSnap = await getDocs(
        query(collection(db, "users", uid, "savedRecipes"), orderBy("createdAt", "desc"), limit(100))
      );
      savedDocs = savedSnap.docs;
    } catch {
      const savedSnap = await getDocs(collection(db, "users", uid, "savedRecipes"));
      savedDocs = sortByCreatedAtDesc(savedSnap.docs.map((d) => ({ id: d.id, ...d.data() }))).map((x) => ({
        id: x.id,
      }));
    }

    const out = [];
    for (const d of savedDocs) {
      const recipe = await getDoc(doc(db, "recipes", d.id));
      if (recipe.exists()) out.push({ id: recipe.id, ...recipe.data() });
    }
    return sortByCreatedAtDesc(out).slice(0, 100);
  }
};

export const getMyRecipes = async () => {
  try {
    withApiFallback();
    const res = await fetch(`${API_URL}/api/profile/me/recipes`, {
      headers: await authHeaders(),
    });
    if (!res.ok) {
      throw new Error("Failed to fetch my recipes");
    }
    return res.json();
  } catch {
    let uid = "";
    try {
      uid = getCurrentUid();
    } catch {
      return [];
    }

    try {
      const snap = await getDocs(
        query(collection(db, "recipes"), where("userId", "==", uid), orderBy("createdAt", "desc"), limit(50))
      );
      return mapDocs(snap);
    } catch {
      const snap = await getDocs(query(collection(db, "recipes"), where("userId", "==", uid), limit(100)));
      return sortByCreatedAtDesc(mapDocs(snap)).slice(0, 50);
    }
  }
};

export const generateAiRecipe = async (payload) => {
  if (!auth.currentUser && isGuestSession()) {
    const ingredients = Array.isArray(payload?.ingredients)
      ? payload.ingredients.map((x) => String(x).trim()).filter(Boolean)
      : [];

    if (!ingredients.length) {
      throw new Error("At least one ingredient is required");
    }

    return {
      title: payload?.title || "Cooksy Voice Chef Suggestion",
      ingredients,
      steps: [
        "Prep the available ingredients and heat a pan on medium heat.",
        `Cook ${ingredients.slice(0, 3).join(", ")} with seasoning until aromatic.`,
        "Add remaining ingredients, simmer briefly, and adjust salt.",
        "Serve hot and garnish before plating.",
      ],
      cookingTime: payload?.time || "30 min",
      servings: payload?.servings || "2",
      dietaryCategory: payload?.diet || "Any",
      description: `A quick recipe suggestion using ${ingredients.slice(0, 4).join(", ")}.`,
      tags: ["guest-mode", "quick"],
    };
  }

  withApiFallback();

  const res = await fetch(`${API_URL}/api/ai/generate`, {
    method: "POST",
    headers: await authHeaders(true),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Failed to generate AI recipe");
  }

  return res.json();
};

export const chatHelper = async (payload) => {
  withApiFallback();

  const res = await fetch(`${API_URL}/api/chat-helper`, {
    method: "POST",
    headers: await authHeaders(true),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Failed to get assistant response");
  }

  return res.json();
};

export const getReels = async () => {
  withApiFallback();

  const res = await fetch(`${API_URL}/api/reels`, {
    headers: await maybeAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch reels");
  }

  return res.json();
};

export const getSocialFeed = async () => {
  withApiFallback();

  const res = await fetch(`${API_URL}/api/social/feed`, {
    headers: await maybeAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch social feed");
  }

  return res.json();
};

export const toggleRecipeLike = async (id) => {
  withApiFallback();

  const res = await fetch(`${API_URL}/api/social/recipes/${id}/like`, {
    method: "POST",
    headers: await authHeaders(),
  });

  if (!res.ok) {
    throw new Error("Failed to toggle like");
  }

  return res.json();
};

export const getRecipeComments = async (id) => {
  withApiFallback();

  const res = await fetch(`${API_URL}/api/social/recipes/${id}/comments`, {
    headers: await maybeAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch comments");
  }

  return res.json();
};

export const addRecipeComment = async (id, text) => {
  withApiFallback();

  const res = await fetch(`${API_URL}/api/social/recipes/${id}/comments`, {
    method: "POST",
    headers: await authHeaders(true),
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error("Failed to add comment");
  }

  return res.json();
};

export const toggleFollow = async (targetUid) => {
  try {
    withApiFallback();

    const res = await fetch(`${API_URL}/api/social/follow/${targetUid}`, {
      method: "POST",
      headers: await authHeaders(),
    });

    if (!res.ok) {
      throw new Error("Failed to toggle follow");
    }

    return res.json();
  } catch {
    const uid = getCurrentUid();
    if (uid === targetUid) throw new Error("Cannot follow yourself");

    const meFollowingRef = doc(db, "users", uid, "following", targetUid);
    const targetFollowerRef = doc(db, "users", targetUid, "followers", uid);
    const existing = await getDoc(meFollowingRef);

    if (existing.exists()) {
      await deleteDoc(meFollowingRef);
      await deleteDoc(targetFollowerRef);
      return { following: false };
    }

    await setDoc(meFollowingRef, { uid: targetUid, createdAt: serverTimestamp() });
    await setDoc(targetFollowerRef, { uid, createdAt: serverTimestamp() });
    return { following: true };
  }
};

export const getFollowStatus = async (targetUid) => {
  try {
    withApiFallback();
    const res = await fetch(`${API_URL}/api/social/follow/${targetUid}/status`, {
      headers: await authHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch follow status");
    return res.json();
  } catch {
    const uid = getCurrentUid();
    const snap = await getDoc(doc(db, "users", uid, "following", targetUid));
    return { following: snap.exists() };
  }
};

export const getUserProfile = async (uid) => {
  try {
    withApiFallback();
    const res = await fetch(`${API_URL}/api/profile/${uid}`, {
      headers: await maybeAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch user profile");
    return res.json();
  } catch {
    const userSnap = await getDoc(doc(db, "users", uid));
    const userData = userSnap.exists() ? userSnap.data() : {};

    const [postsSnap, followersSnap, followingSnap] = await Promise.all([
      getDocs(query(collection(db, "recipes"), where("userId", "==", uid), limit(100))),
      getDocs(query(collection(db, "users", uid, "followers"), limit(1000))),
      getDocs(query(collection(db, "users", uid, "following"), limit(1000))),
    ]);

    return {
      uid,
      name: userData?.name || "Chef",
      photoURL: userData?.photoURL || "",
      bio: userData?.bio || "",
      preferredCuisine: userData?.preferredCuisine || "",
      dietaryPreference: userData?.dietaryPreference || "",
      location: userData?.location || "",
      socialLinks: userData?.socialLinks || "",
      phone: userData?.phone || "",
      posts: postsSnap.size,
      followers: followersSnap.size,
      following: followingSnap.size,
    };
  }
};

export const getUserRecipes = async (uid) => {
  try {
    withApiFallback();
    const res = await fetch(`${API_URL}/api/profile/${uid}/recipes`, {
      headers: await maybeAuthHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch user recipes");
    return res.json();
  } catch {
    try {
      const snap = await getDocs(
        query(collection(db, "recipes"), where("userId", "==", uid), orderBy("createdAt", "desc"), limit(50))
      );
      return mapDocs(snap);
    } catch {
      const snap = await getDocs(query(collection(db, "recipes"), where("userId", "==", uid), limit(100)));
      return sortByCreatedAtDesc(mapDocs(snap)).slice(0, 50);
    }
  }
};

export const getMealPlan = async () => {
  if (!auth.currentUser && isGuestSession()) {
    return [];
  }

  withApiFallback();

  const res = await fetch(`${API_URL}/api/meal-plan`, {
    headers: await authHeaders(),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch meal plan");
  }

  return res.json();
};

export const upsertMealPlan = async (payload) => {
  if (!auth.currentUser && isGuestSession()) {
    return { ok: false, guest: true, ...payload };
  }

  withApiFallback();

  const res = await fetch(`${API_URL}/api/meal-plan`, {
    method: "POST",
    headers: await authHeaders(true),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Failed to save meal plan");
  }

  return res.json();
};

export const generateGroceryList = async () => {
  if (!auth.currentUser && isGuestSession()) {
    return [];
  }

  withApiFallback();

  const res = await fetch(`${API_URL}/api/grocery-list/generate`, {
    method: "POST",
    headers: await authHeaders(),
  });

  if (!res.ok) {
    throw new Error("Failed to generate grocery list");
  }

  return res.json();
};

export const getGroceryList = async () => {
  if (!auth.currentUser && isGuestSession()) {
    return [];
  }

  withApiFallback();

  const res = await fetch(`${API_URL}/api/grocery-list`, {
    headers: await authHeaders(),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch grocery list");
  }

  return res.json();
};

export const checkinGamification = async () => {
  if (!auth.currentUser && isGuestSession()) {
    return { streak: 0, points: 0, badges: [] };
  }

  withApiFallback();

  const res = await fetch(`${API_URL}/api/gamification/checkin`, {
    method: "POST",
    headers: await authHeaders(),
  });

  if (!res.ok) {
    throw new Error("Failed to check in");
  }

  return res.json();
};

export const getGamification = async () => {
  if (!auth.currentUser && isGuestSession()) {
    return { streak: 0, points: 0, badges: [] };
  }

  withApiFallback();

  const res = await fetch(`${API_URL}/api/gamification/me`, {
    headers: await authHeaders(),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch gamification");
  }

  return res.json();
};

export const addRecipe = async (recipe) => {
  const user = auth.currentUser || getAuth().currentUser;
  let image = recipe.image || "";
  if (image) {
    try {
      image = await uploadRecipeMedia(image, recipe.mediaType || "image", user?.uid || "anonymous");
    } catch (error) {
      console.log("Recipe media upload failed", error);
    }
  }

  let voiceAudioUrl = recipe.voiceAudioUrl || "";

  if (!voiceAudioUrl && recipe.voiceAudioUri) {
    try {
      voiceAudioUrl = await uploadVoiceAudio(recipe.voiceAudioUri, user?.uid || "anonymous");
    } catch (error) {
      console.log("Voice upload failed, continuing without audio", error);
      voiceAudioUrl = "";
    }
  }

  const requestPayload = {
    ...recipe,
    image,
    mediaType: recipe.mediaType || "image",
    voiceAudioUrl,
    voiceTranscript: recipe.voiceTranscript || "",
    voiceLanguage: recipe.voiceLanguage || "",
  };

  try {
    withApiFallback();
    const res = await fetch(`${API_URL}/api/recipes`, {
      method: "POST",
      headers: await authHeaders(true),
      body: JSON.stringify(requestPayload),
    });
    if (!res.ok) {
      throw new Error("Failed to add recipe");
    }
    return res.json();
  } catch {
    if (!user) throw new Error("Please login to upload");
    const payload = {
      title: recipe.title || "",
      image,
      ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
      steps: Array.isArray(recipe.steps) ? recipe.steps : [],
      description: recipe.description || "",
      cookingTime: recipe.cookingTime || "",
      servings: recipe.servings || "",
      cuisineType: recipe.cuisineType || "",
      dietaryCategory: recipe.dietaryCategory || "",
      tags: Array.isArray(recipe.tags) ? recipe.tags : [],
      mediaType: recipe.mediaType || "image",
      voiceAudioUrl,
      voiceTranscript: recipe.voiceTranscript || "",
      voiceLanguage: recipe.voiceLanguage || "",
      userId: user.uid,
      authorName: user.displayName || "Chef",
      createdAt: serverTimestamp(),
    };
    const ref = await addDoc(collection(db, "recipes"), payload);
    await setDoc(
      doc(db, "users", user.uid),
      { posts: increment(1), updatedAt: serverTimestamp() },
      { merge: true }
    );
    return { id: ref.id, ...payload };
  }
};

export const getMyProfile = async () => {
  if (!auth.currentUser && isGuestSession()) {
    return {
      uid: "guest",
      name: "Guest User",
      email: "",
      photoURL: "",
      posts: 0,
      followers: 0,
      following: 0,
      bio: "",
      preferredCuisine: "",
      dietaryPreference: "",
      location: "",
      socialLinks: "",
      phone: "",
    };
  }

  try {
    withApiFallback();
    const res = await fetch(`${API_URL}/api/profile/me`, {
      headers: await authHeaders(),
    });
    if (!res.ok) {
      throw new Error("Failed to fetch profile");
    }
    return res.json();
  } catch {
    const uid = getCurrentUid();
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const user = auth.currentUser || getAuth().currentUser;
      const base = {
        uid,
        name: user?.displayName || (user?.isAnonymous ? "Guest User" : ""),
        email: user?.email || "",
        photoURL: user?.photoURL || "",
        posts: 0,
        followers: 0,
        following: 0,
        bio: "",
        preferredCuisine: "",
        dietaryPreference: "",
        location: "",
        socialLinks: "",
        phone: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, base, { merge: true });
      return base;
    }
    return snap.data();
  }
};

export const updateMyProfile = async (payload) => {
  if (!auth.currentUser && isGuestSession()) {
    return {
      uid: "guest",
      name: payload?.name || "Guest User",
      email: "",
      photoURL: payload?.photoURL || "",
      posts: 0,
      followers: 0,
      following: 0,
      bio: payload?.bio || "",
      preferredCuisine: payload?.preferredCuisine || "",
      dietaryPreference: payload?.dietaryPreference || "",
      location: payload?.location || "",
      socialLinks: payload?.socialLinks || "",
      phone: payload?.phone || "",
    };
  }

  try {
    withApiFallback();
    const res = await fetch(`${API_URL}/api/profile/me`, {
      method: "PUT",
      headers: await authHeaders(true),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error("Failed to update profile");
    }
    return res.json();
  } catch {
    const uid = getCurrentUid();
    await setDoc(
      doc(db, "users", uid),
      {
        ...payload,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    const snap = await getDoc(doc(db, "users", uid));
    return snap.data();
  }
};
