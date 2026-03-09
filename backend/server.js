import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import aiRoutes from "./routes/aiRoutes.js";

const requiredEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

const firebaseProjectId = requiredEnv("FIREBASE_PROJECT_ID");
const firebaseClientEmail = requiredEnv("FIREBASE_CLIENT_EMAIL");
const firebasePrivateKey = requiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: firebaseProjectId,
      clientEmail: firebaseClientEmail,
      privateKey: firebasePrivateKey,
    }),
  });
}

const db = admin.firestore();
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/ai", aiRoutes);

const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split("Bearer ")[1];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const ensureUserDoc = async (decoded) => {
  const ref = db.collection("users").doc(decoded.uid);
  const snap = await ref.get();
  const isAnonymous = decoded?.firebase?.sign_in_provider === "anonymous";

  const base = {
    uid: decoded.uid,
    name: decoded.name ?? (isAnonymous ? "Guest User" : ""),
    email: decoded.email ?? "",
    photoURL: decoded.picture ?? "",
    bio: "",
    preferredCuisine: "",
    dietaryPreference: "",
    location: "",
    socialLinks: "",
    phone: "",
    posts: 0,
    followers: 0,
    following: 0,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!snap.exists) {
    await ref.set({
      ...base,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    await ref.set(base, { merge: true });
  }

  return ref;
};

app.get("/", (req, res) => {
  res.send("Cooksy Backend Running");
});

app.get("/api/test", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/oauth/google", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Token missing" });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    await ensureUserDoc(decoded);

    return res.json({
      message: "Login success",
      uid: decoded.uid,
      email: decoded.email ?? "",
    });
  } catch (error) {
    return res.status(401).json({ error: "OAuth failed" });
  }
});

app.get("/api/profile/me", verifyToken, async (req, res) => {
  try {
    const ref = await ensureUserDoc(req.user);
    const snap = await ref.get();
    return res.json(snap.data());
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

app.get("/api/profile/me/recipes", verifyToken, async (req, res) => {
  try {
    const snap = await db
      .collection("recipes")
      .where("userId", "==", req.user.uid)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const recipes = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json(recipes);
  } catch (error) {
    const fallback = await db
      .collection("recipes")
      .where("userId", "==", req.user.uid)
      .limit(50)
      .get();
    const recipes = fallback.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json(recipes);
  }
});

app.get("/api/profile/:uid", async (req, res) => {
  try {
    const uid = String(req.params.uid || "");
    if (!uid) return res.status(400).json({ error: "User id is required" });

    const userRef = db.collection("users").doc(uid);
    const [userSnap, postsSnap, followersSnap, followingSnap] = await Promise.all([
      userRef.get(),
      db.collection("recipes").where("userId", "==", uid).limit(1000).get(),
      userRef.collection("followers").limit(1000).get(),
      userRef.collection("following").limit(1000).get(),
    ]);

    if (!userSnap.exists) return res.status(404).json({ error: "User not found" });

    const userData = userSnap.data() ?? {};
    return res.json({
      uid,
      name: userData.name ?? "Chef",
      photoURL: userData.photoURL ?? "",
      bio: userData.bio ?? "",
      preferredCuisine: userData.preferredCuisine ?? "",
      dietaryPreference: userData.dietaryPreference ?? "",
      location: userData.location ?? "",
      socialLinks: userData.socialLinks ?? "",
      phone: userData.phone ?? "",
      posts: postsSnap.size,
      followers: followersSnap.size,
      following: followingSnap.size,
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

app.get("/api/profile/:uid/recipes", async (req, res) => {
  try {
    const uid = String(req.params.uid || "");
    if (!uid) return res.status(400).json({ error: "User id is required" });

    try {
      const snap = await db
        .collection("recipes")
        .where("userId", "==", uid)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();
      return res.json(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    } catch {
      const snap = await db.collection("recipes").where("userId", "==", uid).limit(100).get();
      return res.json(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    }
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch user recipes" });
  }
});

app.put("/api/profile/me", verifyToken, async (req, res) => {
  try {
    const allowed = [
      "name",
      "bio",
      "preferredCuisine",
      "dietaryPreference",
      "location",
      "socialLinks",
      "phone",
      "photoURL",
    ];

    const payload = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        payload[key] = req.body[key];
      }
    }

    payload.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection("users").doc(req.user.uid).set(payload, { merge: true });
    const snap = await db.collection("users").doc(req.user.uid).get();

    return res.json(snap.data());
  } catch (error) {
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

app.get("/api/recipes", async (req, res) => {
  try {
    const snap = await db.collection("recipes").orderBy("createdAt", "desc").limit(50).get();
    const recipes = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json(recipes);
  } catch (error) {
    const fallback = await db.collection("recipes").limit(50).get();
    const recipes = fallback.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json(recipes);
  }
});

app.get("/api/recipes/saved", verifyToken, async (req, res) => {
  try {
    const savedSnap = await db
      .collection("users")
      .doc(req.user.uid)
      .collection("savedRecipes")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const ids = savedSnap.docs.map((doc) => doc.id);
    if (!ids.length) {
      return res.json([]);
    }

    const chunks = [];
    for (let i = 0; i < ids.length; i += 10) {
      chunks.push(ids.slice(i, i + 10));
    }

    const recipes = [];
    for (const chunk of chunks) {
      const recipeSnap = await db.collection("recipes").where(admin.firestore.FieldPath.documentId(), "in", chunk).get();
      recipeSnap.forEach((doc) => recipes.push({ id: doc.id, ...doc.data() }));
    }

    return res.json(recipes);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch saved recipes" });
  }
});

app.post("/api/recipes", verifyToken, async (req, res) => {
  try {
    const {
      title,
      image,
      mediaType,
      ingredients,
      steps,
      description,
      cookingTime,
      servings,
      cuisineType,
      dietaryCategory,
      tags,
      voiceAudioUrl,
      voiceTranscript,
      voiceLanguage,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const userDoc = await db.collection("users").doc(req.user.uid).get();
    const userData = userDoc.data() ?? {};

    const payload = {
      title,
      image: image ?? "",
      mediaType: mediaType ?? "image",
      ingredients: Array.isArray(ingredients) ? ingredients : [],
      steps: Array.isArray(steps) ? steps : [],
      description: description ?? "",
      cookingTime: cookingTime ?? "",
      servings: servings ?? "",
      cuisineType: cuisineType ?? "",
      dietaryCategory: dietaryCategory ?? "",
      tags: Array.isArray(tags) ? tags : [],
      voiceAudioUrl: voiceAudioUrl ?? "",
      voiceTranscript: voiceTranscript ?? "",
      voiceLanguage: voiceLanguage ?? "en-US",
      userId: req.user.uid,
      authorName: userData.name ?? req.user.name ?? "Guest User",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("recipes").add(payload);

    await db
      .collection("users")
      .doc(req.user.uid)
      .set(
        {
          posts: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return res.status(201).json({ id: docRef.id, ...payload });
  } catch (error) {
    return res.status(500).json({ error: "Failed to add recipe" });
  }
});

app.get("/api/recipes/:id", async (req, res) => {
  try {
    const doc = await db.collection("recipes").doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    return res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch recipe" });
  }
});

app.post("/api/recipes/:id/save", verifyToken, async (req, res) => {
  try {
    const recipeRef = db.collection("recipes").doc(req.params.id);
    const recipeDoc = await recipeRef.get();
    if (!recipeDoc.exists) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    const savedRef = db
      .collection("users")
      .doc(req.user.uid)
      .collection("savedRecipes")
      .doc(req.params.id);

    const savedDoc = await savedRef.get();
    if (savedDoc.exists) {
      await savedRef.delete();
      return res.json({ saved: false });
    }

    await savedRef.set({
      recipeId: req.params.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ saved: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to update save state" });
  }
});

const nutritionTable = {
  chicken: { calories: 220, protein: 30, carbs: 0, fat: 8 },
  paneer: { calories: 260, protein: 18, carbs: 6, fat: 20 },
  egg: { calories: 70, protein: 6, carbs: 1, fat: 5 },
  rice: { calories: 205, protein: 4, carbs: 45, fat: 0.4 },
  pasta: { calories: 210, protein: 7, carbs: 42, fat: 1.3 },
  potato: { calories: 160, protein: 4, carbs: 37, fat: 0.2 },
  tomato: { calories: 22, protein: 1, carbs: 5, fat: 0.2 },
  onion: { calories: 44, protein: 1, carbs: 10, fat: 0.1 },
  avocado: { calories: 160, protein: 2, carbs: 9, fat: 15 },
};

const estimateNutrition = (ingredients = []) => {
  const total = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  for (const raw of ingredients) {
    const ing = String(raw || "").toLowerCase();
    const match = Object.keys(nutritionTable).find((k) => ing.includes(k));
    if (!match) continue;
    const n = nutritionTable[match];
    total.calories += n.calories;
    total.protein += n.protein;
    total.carbs += n.carbs;
    total.fat += n.fat;
  }
  return {
    calories: Math.round(total.calories),
    protein: Math.round(total.protein),
    carbs: Math.round(total.carbs),
    fat: Math.round(total.fat),
  };
};

app.post("/api/ai/generate", verifyToken, async (req, res) => {
  try {
    const {
      ingredients = [],
      time = "30 min",
      diet = "Any",
      title = "AI Generated Recipe",
      servings = "2",
    } = req.body;

    const cleanIngredients = Array.isArray(ingredients)
      ? ingredients.map((x) => String(x).trim()).filter(Boolean)
      : [];

    if (!cleanIngredients.length) {
      return res.status(400).json({ error: "At least one ingredient is required" });
    }

    const steps = [
      "Prep all ingredients and heat a pan on medium flame.",
      `Cook the base using ${cleanIngredients.slice(0, 3).join(", ")} for 5-7 minutes.`,
      "Add seasoning and simmer until flavors combine.",
      "Plate and garnish before serving.",
    ];

    const nutrition = estimateNutrition(cleanIngredients);

    return res.json({
      title,
      ingredients: cleanIngredients,
      steps,
      cookingTime: time,
      servings,
      dietaryCategory: diet,
      description: `Smart recipe generated for ${diet} in about ${time}.`,
      nutrition,
      tags: ["ai-generated", "quick"],
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to generate recipe" });
  }
});

app.post("/api/chat-helper", verifyToken, async (req, res) => {
  try {
    const { message = "", pantry = [] } = req.body;
    const q = String(message).toLowerCase();
    const items = Array.isArray(pantry) ? pantry.map((x) => String(x).toLowerCase()) : [];

    let reply = "Try a simple stir-fry with your available ingredients.";
    if (q.includes("20 min") || q.includes("quick")) {
      reply = "Go for a quick one-pan recipe: saute veggies + protein, add spices, serve hot in 20 minutes.";
    } else if (q.includes("healthy")) {
      reply = "Use grilled protein, fresh veggies, and minimal oil. Add lemon for flavor.";
    } else if (items.length) {
      reply = `Using ${items.slice(0, 4).join(", ")}, I suggest a bowl recipe with protein + veggies + sauce.`;
    }

    return res.json({ reply });
  } catch (error) {
    return res.status(500).json({ error: "Chat helper unavailable" });
  }
});

app.get("/api/reels", async (req, res) => {
  try {
    const snap = await db.collection("recipes").orderBy("createdAt", "desc").limit(30).get();
    const reels = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        recipeId: doc.id,
        title: data.title ?? "",
        caption: data.description ?? "",
        mediaUrl: data.videoUrl || data.image || "",
        authorName: data.authorName || "",
      };
    });
    return res.json(reels);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch reels" });
  }
});

app.get("/api/social/feed", async (req, res) => {
  try {
    const snap = await db.collection("recipes").orderBy("createdAt", "desc").limit(40).get();
    const feed = [];
    for (const doc of snap.docs) {
      const data = doc.data();
      const likesSnap = await db.collection("recipes").doc(doc.id).collection("likes").get();
      feed.push({
        id: doc.id,
        ...data,
        likes: likesSnap.size,
      });
    }
    return res.json(feed);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch social feed" });
  }
});

app.post("/api/social/recipes/:id/like", verifyToken, async (req, res) => {
  try {
    const likeRef = db
      .collection("recipes")
      .doc(req.params.id)
      .collection("likes")
      .doc(req.user.uid);
    const snap = await likeRef.get();
    if (snap.exists) {
      await likeRef.delete();
      return res.json({ liked: false });
    }
    await likeRef.set({
      uid: req.user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return res.json({ liked: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to toggle like" });
  }
});

app.get("/api/social/recipes/:id/comments", async (req, res) => {
  try {
    const snap = await db
      .collection("recipes")
      .doc(req.params.id)
      .collection("comments")
      .orderBy("createdAt", "asc")
      .limit(100)
      .get();
    return res.json(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch comments" });
  }
});

app.post("/api/social/recipes/:id/comments", verifyToken, async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim();
    if (!text) return res.status(400).json({ error: "Comment text is required" });

    const userDoc = await db.collection("users").doc(req.user.uid).get();
    const userName = userDoc.data()?.name || "User";

    const docRef = await db.collection("recipes").doc(req.params.id).collection("comments").add({
      uid: req.user.uid,
      name: userName,
      text,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({ id: docRef.id, uid: req.user.uid, name: userName, text });
  } catch (error) {
    return res.status(500).json({ error: "Failed to add comment" });
  }
});

app.post("/api/social/follow/:targetUid", verifyToken, async (req, res) => {
  try {
    if (req.user.uid === req.params.targetUid) {
      return res.status(400).json({ error: "Cannot follow yourself" });
    }

    const meFollowingRef = db
      .collection("users")
      .doc(req.user.uid)
      .collection("following")
      .doc(req.params.targetUid);
    const targetFollowerRef = db
      .collection("users")
      .doc(req.params.targetUid)
      .collection("followers")
      .doc(req.user.uid);

    const snap = await meFollowingRef.get();
    if (snap.exists) {
      await meFollowingRef.delete();
      await targetFollowerRef.delete();
      return res.json({ following: false });
    }

    await meFollowingRef.set({
      uid: req.params.targetUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await targetFollowerRef.set({
      uid: req.user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return res.json({ following: true });
  } catch (error) {
    return res.status(500).json({ error: "Failed to toggle follow" });
  }
});

app.get("/api/social/follow/:targetUid/status", verifyToken, async (req, res) => {
  try {
    const snap = await db
      .collection("users")
      .doc(req.user.uid)
      .collection("following")
      .doc(req.params.targetUid)
      .get();

    return res.json({ following: snap.exists });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch follow status" });
  }
});

app.get("/api/meal-plan", verifyToken, async (req, res) => {
  try {
    const snap = await db
      .collection("users")
      .doc(req.user.uid)
      .collection("mealPlan")
      .orderBy("day", "asc")
      .get();
    return res.json(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch meal plan" });
  }
});

app.post("/api/meal-plan", verifyToken, async (req, res) => {
  try {
    const { day, mealType, recipeId, recipeTitle, servings = 1 } = req.body;
    if (!day || !mealType || !recipeId) {
      return res.status(400).json({ error: "day, mealType and recipeId are required" });
    }

    const key = `${day}-${mealType}`;
    await db
      .collection("users")
      .doc(req.user.uid)
      .collection("mealPlan")
      .doc(key)
      .set({
        day,
        mealType,
        recipeId,
        recipeTitle: recipeTitle ?? "",
        servings,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return res.json({ ok: true, id: key });
  } catch (error) {
    return res.status(500).json({ error: "Failed to save meal plan" });
  }
});

app.post("/api/grocery-list/generate", verifyToken, async (req, res) => {
  try {
    const planSnap = await db
      .collection("users")
      .doc(req.user.uid)
      .collection("mealPlan")
      .get();
    const plan = planSnap.docs.map((doc) => doc.data());

    const recipeIds = [...new Set(plan.map((p) => p.recipeId).filter(Boolean))];
    if (!recipeIds.length) return res.json([]);

    const chunks = [];
    for (let i = 0; i < recipeIds.length; i += 10) chunks.push(recipeIds.slice(i, i + 10));

    const ingredientCounter = {};
    for (const chunk of chunks) {
      const recipeSnap = await db.collection("recipes").where(admin.firestore.FieldPath.documentId(), "in", chunk).get();
      recipeSnap.forEach((doc) => {
        const ingredients = doc.data()?.ingredients ?? [];
        for (const ing of ingredients) {
          const key = String(ing).trim();
          if (!key) continue;
          ingredientCounter[key] = (ingredientCounter[key] || 0) + 1;
        }
      });
    }

    const list = Object.keys(ingredientCounter).map((name) => ({
      name,
      quantity: ingredientCounter[name],
      checked: false,
    }));

    const batch = db.batch();
    const listCollection = db.collection("users").doc(req.user.uid).collection("groceryList");
    const oldSnap = await listCollection.get();
    oldSnap.forEach((doc) => batch.delete(doc.ref));
    list.forEach((item) => {
      const ref = listCollection.doc();
      batch.set(ref, {
        ...item,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();

    return res.json(list);
  } catch (error) {
    return res.status(500).json({ error: "Failed to generate grocery list" });
  }
});

app.get("/api/grocery-list", verifyToken, async (req, res) => {
  try {
    const snap = await db
      .collection("users")
      .doc(req.user.uid)
      .collection("groceryList")
      .orderBy("createdAt", "asc")
      .get();
    return res.json(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch grocery list" });
  }
});

app.post("/api/gamification/checkin", verifyToken, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const ref = db.collection("users").doc(req.user.uid).collection("gamification").doc("stats");
    const snap = await ref.get();
    const data = snap.data() || {};
    const last = data.lastCheckin || "";
    let streak = Number(data.streak || 0);

    if (last !== today) {
      const lastDate = last ? new Date(last) : null;
      const nowDate = new Date(today);
      const diff = lastDate ? Math.floor((nowDate - lastDate) / (1000 * 60 * 60 * 24)) : 0;
      streak = diff === 1 ? streak + 1 : 1;
    }

    const points = Number(data.points || 0) + (last === today ? 0 : 5);
    const badges = [
      ...(streak >= 3 ? ["3-Day Streak"] : []),
      ...(streak >= 7 ? ["7-Day Chef"] : []),
      ...(points >= 100 ? ["Top Creator"] : []),
    ];

    await ref.set(
      {
        streak,
        points,
        badges: [...new Set(badges)],
        lastCheckin: today,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const next = await ref.get();
    return res.json(next.data());
  } catch (error) {
    return res.status(500).json({ error: "Failed to update checkin" });
  }
});

app.get("/api/gamification/me", verifyToken, async (req, res) => {
  try {
    const ref = db.collection("users").doc(req.user.uid).collection("gamification").doc("stats");
    const snap = await ref.get();
    return res.json(
      snap.data() || {
        streak: 0,
        points: 0,
        badges: [],
      }
    );
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch gamification" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
