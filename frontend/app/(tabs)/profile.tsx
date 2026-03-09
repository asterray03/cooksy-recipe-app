import { useEffect, useState } from "react";
import { Alert, Image, Linking, Platform, Pressable, RefreshControl, ScrollView, Share, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import { auth } from "@/config/firebase";
import { checkinGamification, getGamification, getMyProfile, getMyRecipes, getSavedRecipes, toggleSaveRecipe } from "@/services/api";
import { AppTheme } from "@/constants/app-theme";
import { isGuestSession, setGuestSession } from "@/state/session";
import { getThemeMode, setThemeMode } from "@/state/app-features";

type Recipe = { id: string; title: string; image?: string; mediaType?: string };

type Profile = {
  name: string;
  photoURL: string;
  posts: number;
  followers: number;
  following: number;
  bio?: string;
  preferredCuisine?: string;
  dietaryPreference?: string;
  location?: string;
  socialLinks?: string;
  phone?: string;
};

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile>({
    name: auth.currentUser?.displayName || (auth.currentUser?.isAnonymous ? "Guest User" : ""),
    photoURL: auth.currentUser?.photoURL || "",
    posts: 0,
    followers: 0,
    following: 0,
    bio: "",
  });
  const [myRecipes, setMyRecipes] = useState<Recipe[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "saved">("posts");
  const [streak, setStreak] = useState(0);
  const [badges, setBadges] = useState<string[]>([]);
  const [darkMode, setDarkModeLocal] = useState(getThemeMode() === "dark");

  const loadData = async () => {
    const user = auth.currentUser;

    // Always seed profile with auth data so UI is never blank.
    setProfile((prev) => ({
      ...prev,
      name: prev.name || user?.displayName || (user?.isAnonymous ? "Guest User" : ""),
      photoURL: prev.photoURL || user?.photoURL || "",
    }));

    let postsCount = 0;
    let savedList: Recipe[] = [];

    try {
      const postData = await getMyRecipes();
      const posts = Array.isArray(postData) ? postData : [];
      postsCount = posts.length;
      setMyRecipes(posts);
    } catch (err) {
      console.log("Failed to load my recipes", err);
      setMyRecipes([]);
    }

    try {
      const savedData = await getSavedRecipes();
      savedList = Array.isArray(savedData) ? savedData : [];
      setSavedRecipes(savedList);
    } catch (err) {
      console.log("Failed to load saved recipes", err);
      setSavedRecipes([]);
    }

    try {
      const profileData = await getMyProfile();
      setProfile({
        name:
          profileData?.name ??
          user?.displayName ??
          (user?.isAnonymous ? "Guest User" : ""),
        photoURL: profileData?.photoURL ?? user?.photoURL ?? "",
        posts: Number(profileData?.posts ?? postsCount),
        followers: Number(profileData?.followers ?? 0),
        following: Number(profileData?.following ?? 0),
        bio: profileData?.bio ?? "",
        preferredCuisine: profileData?.preferredCuisine ?? "",
        dietaryPreference: profileData?.dietaryPreference ?? "",
        location: profileData?.location ?? "",
        socialLinks: profileData?.socialLinks ?? "",
        phone: profileData?.phone ?? "",
      });
    } catch (err) {
      console.log("Failed to load profile basics", err);
      setProfile((prev) => ({
        ...prev,
        name: prev.name || user?.displayName || (user?.isAnonymous ? "Guest User" : ""),
        photoURL: prev.photoURL || user?.photoURL || "",
        posts: prev.posts || postsCount,
      }));
    }

    try {
      const gameData = await getGamification();
      setStreak(Number(gameData?.streak ?? 0));
      setBadges(Array.isArray(gameData?.badges) ? gameData.badges : []);
    } catch (err) {
      console.log("Failed to load gamification", err);
      setStreak(0);
      setBadges([]);
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadData();
      try {
        const checked = await checkinGamification();
        setStreak(Number(checked?.streak ?? 0));
        setBadges(Array.isArray(checked?.badges) ? checked.badges : []);
      } catch {}
    };

    init();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const onLogout = async () => {
    try {
      setGuestSession(false);
      await signOut(auth);
    } catch (err) {
      console.log("Logout failed", err);
    } finally {
      router.replace("/auth");
    }
  };
  const confirmLogout = () => {
    if (Platform.OS === "web") {
      onLogout();
      return;
    }
    Alert.alert("Log out", "Do you want to log out from Cooksy?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: onLogout },
    ]);
  };

  const list = activeTab === "posts" ? myRecipes : savedRecipes;
  const isGuest = !!auth.currentUser?.isAnonymous || isGuestSession();

  const toggleTheme = (value: boolean) => {
    setDarkModeLocal(value);
    setThemeMode(value ? "dark" : "light");
  };

  const removeSaved = async (recipeId: string) => {
    try {
      await toggleSaveRecipe(recipeId);
      setSavedRecipes((prev) => prev.filter((x) => x.id !== recipeId));
    } catch (err) {
      console.log("Failed to remove saved", err);
    }
  };

  const refreshNow = async () => {
    setRefreshing(true);
    try {
      await loadData();
      if (!isGuest) {
        const checked = await checkinGamification();
        setStreak(Number(checked?.streak ?? 0));
        setBadges(Array.isArray(checked?.badges) ? checked.badges : []);
      }
      Alert.alert("Refreshed", "Profile data updated.");
    } catch (err) {
      console.log("Refresh failed", err);
      Alert.alert("Refresh failed", "Please try again.");
    } finally {
      setRefreshing(false);
    }
  };

  const openSupport = async () => {
    const url = "mailto:support@cooksy.app?subject=Cooksy%20Support";
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert("Unavailable", "Mail app is not available on this device.");
      return;
    }
    await Linking.openURL(url);
  };

  const openPrivacy = async () => {
    const url = "https://example.com/cooksy-privacy";
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert("Unavailable", "Cannot open privacy policy right now.");
      return;
    }
    await Linking.openURL(url);
  };

  const shareCooksy = async () => {
    try {
      await Share.share({
        message: "Cooksy - Discover and share recipes with the community.",
      });
    } catch (err) {
      console.log("Share failed", err);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: AppTheme.colors.page }}>
      <View style={{ backgroundColor: AppTheme.colors.mustard, paddingTop: 10, paddingHorizontal: 12, paddingBottom: 12, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={() => router.push("/(tabs)")}><Ionicons name="chevron-back" size={22} /></Pressable>
          <Text style={{ fontWeight: "800", fontSize: 18 }}>Profile</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable onPress={() => router.push("/edit-profile")}><Ionicons name="create-outline" size={22} /></Pressable>
            <Pressable onPress={confirmLogout}><Ionicons name="log-out-outline" size={22} color={AppTheme.colors.primaryDeep} /></Pressable>
          </View>
        </View>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
        {profile.photoURL ? (
          <Image source={{ uri: profile.photoURL }} style={{ width: 112, height: 112, borderRadius: 56, alignSelf: "center", borderWidth: 3, borderColor: AppTheme.colors.primary }} />
        ) : (
          <View style={{ width: 112, height: 112, borderRadius: 56, alignSelf: "center", borderWidth: 3, borderColor: AppTheme.colors.primary, backgroundColor: "white", alignItems: "center", justifyContent: "center" }}><Ionicons name="person" size={48} color={AppTheme.colors.primaryDeep} /></View>
        )}

        <Text style={{ fontSize: 24, textAlign: "center", marginTop: 8, fontWeight: "700" }}>{profile.name || "Your Profile"}</Text>

        <View style={{ alignSelf: "center", marginTop: 6, backgroundColor: "#fff4e5", borderRadius: AppTheme.radius.pill, borderWidth: 1, borderColor: "#ffd8a8", paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ color: "#b85c00", fontWeight: "700" }}>{isGuest ? "Guest Account" : `Daily Streak: ${streak} day${streak === 1 ? "" : "s"}`}</Text>
        </View>

        {badges.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 8, alignSelf: "center" }}>
            {badges.map((b) => (
              <View key={b} style={{ backgroundColor: "#eef7ff", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ color: "#175d9c", fontWeight: "700" }}>{b}</Text></View>
            ))}
          </ScrollView>
        ) : null}

        <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 14, backgroundColor: "white", borderRadius: 14, paddingVertical: 10 }}>
          <Stat value={profile.posts} label="Posts" />
          <Stat value={profile.followers} label="Followers" />
          <Stat value={profile.following} label="Following" />
        </View>

        {profile.bio ? <Text style={{ textAlign: "center", color: "#777", marginTop: 12 }}>{profile.bio}</Text> : null}

        <View style={{ marginTop: 14, backgroundColor: "white", borderRadius: AppTheme.radius.md, borderWidth: 1, borderColor: AppTheme.colors.border, padding: 12 }}>
          <Text style={{ fontWeight: "800", fontSize: 16 }}>Profile Settings</Text>
          <ProfileRow label="Name" value={profile.name || "Not set"} />
          <ProfileRow label="Bio" value={profile.bio || "Not set"} />
          <ProfileRow label="Preferred Cuisine" value={profile.preferredCuisine || "Not set"} />
          <ProfileRow label="Dietary Preference" value={profile.dietaryPreference || "Not set"} />
          <ProfileRow label="Location" value={profile.location || "Not set"} />
          <ProfileRow label="Phone" value={profile.phone || "Not set"} />

          <View style={{ marginTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: AppTheme.colors.border, borderRadius: AppTheme.radius.sm, paddingHorizontal: 10, paddingVertical: 8 }}>
            <Text style={{ color: AppTheme.colors.ink }}>Dark Mode</Text>
            <Switch value={darkMode} onValueChange={toggleTheme} />
          </View>

          <Pressable onPress={() => router.push("/edit-profile")} style={{ marginTop: 10, backgroundColor: AppTheme.colors.primary, borderRadius: AppTheme.radius.pill, paddingVertical: 10, alignItems: "center" }}>
            <Text style={{ color: "white", fontWeight: "700" }}>Edit Profile</Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 12, backgroundColor: "white", borderRadius: AppTheme.radius.md, borderWidth: 1, borderColor: AppTheme.colors.border, padding: 12 }}>
          <Text style={{ fontWeight: "800", fontSize: 16 }}>More Options</Text>
          <SettingsAction icon="refresh-outline" label="Refresh Data" onPress={refreshNow} />
          <SettingsAction icon="person-circle-outline" label="Edit Profile" onPress={() => router.push("/edit-profile")} />
          <SettingsAction icon="mail-outline" label="Help & Support" onPress={openSupport} />
          <SettingsAction icon="shield-checkmark-outline" label="Privacy Policy" onPress={openPrivacy} />
          <SettingsAction icon="share-social-outline" label="Share App" onPress={shareCooksy} />
          <SettingsAction icon="log-out-outline" label="Logout" danger onPress={confirmLogout} />
        </View>

        <View style={{ marginTop: 16, flexDirection: "row", gap: 8 }}>
          <Pressable onPress={() => setActiveTab("posts")} style={{ flex: 1, backgroundColor: activeTab === "posts" ? AppTheme.colors.primary : "white", borderWidth: 1, borderColor: activeTab === "posts" ? AppTheme.colors.primary : AppTheme.colors.border, borderRadius: AppTheme.radius.pill, paddingVertical: 8, alignItems: "center" }}><Text style={{ color: activeTab === "posts" ? "white" : AppTheme.colors.ink, fontWeight: "700" }}>Posts</Text></Pressable>
          <Pressable onPress={() => setActiveTab("saved")} style={{ flex: 1, backgroundColor: activeTab === "saved" ? AppTheme.colors.primary : "white", borderWidth: 1, borderColor: activeTab === "saved" ? AppTheme.colors.primary : AppTheme.colors.border, borderRadius: AppTheme.radius.pill, paddingVertical: 8, alignItems: "center" }}><Text style={{ color: activeTab === "saved" ? "white" : AppTheme.colors.ink, fontWeight: "700" }}>Saved</Text></Pressable>
        </View>

        <Text style={{ marginTop: 12, fontWeight: "800", fontSize: 16 }}>{activeTab === "posts" ? "Your Recent Dishes" : "Saved Collection"}</Text>

        {list.length === 0 ? (
          <View style={{ marginTop: 10, backgroundColor: "white", borderRadius: AppTheme.radius.md, borderWidth: 1, borderColor: AppTheme.colors.border, padding: 16, alignItems: "center" }}>
            <Ionicons name="images-outline" size={22} color={AppTheme.colors.subtleInk} />
            <Text style={{ marginTop: 8, color: AppTheme.colors.subtleInk, textAlign: "center" }}>{activeTab === "posts" ? "No posts yet. Upload your first recipe." : "No saved recipes yet. Save recipes from detail page."}</Text>
            <Pressable onPress={() => router.push(activeTab === "posts" ? "/upload" : "/(tabs)/explore")} style={{ marginTop: 10, backgroundColor: AppTheme.colors.primary, borderRadius: AppTheme.radius.pill, paddingHorizontal: 14, paddingVertical: 8 }}><Text style={{ color: "white", fontWeight: "700" }}>{activeTab === "posts" ? "Upload" : "Explore"}</Text></Pressable>
          </View>
        ) : activeTab === "saved" ? (
          <View style={{ marginTop: 10, gap: 8 }}>
            {savedRecipes.map((item) => (
              <Pressable key={item.id} onPress={() => router.push(`/recipe/${item.id}`)} style={{ backgroundColor: "white", borderRadius: 12, borderWidth: 1, borderColor: AppTheme.colors.border, padding: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
                {item.image && item.mediaType !== "video" ? (
                  <Image source={{ uri: item.image }} style={{ width: 88, height: 66, borderRadius: 10 }} />
                ) : (
                  <View style={{ width: 88, height: 66, borderRadius: 10, backgroundColor: "#f5f5f5", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={item.mediaType === "video" ? "videocam-outline" : "image-outline"} size={20} color="#888" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "700" }} numberOfLines={1}>{item.title}</Text>
                  <Text style={{ color: "#777", marginTop: 2 }}>Tap to open</Text>
                </View>
                <Pressable onPress={() => removeSaved(item.id)} style={{ backgroundColor: "#ff4b4b", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Text style={{ color: "white", fontWeight: "700" }}>Delete</Text>
                </Pressable>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {myRecipes.map((item) => (
              <Pressable key={item.id} onPress={() => router.push(`/recipe/${item.id}`)}>
                {item.image && item.mediaType !== "video" ? (
                  <Image source={{ uri: item.image }} style={{ width: 104, height: 78, borderRadius: 12 }} />
                ) : (
                  <View style={{ width: 104, height: 78, borderRadius: 12, backgroundColor: "#f5f5f5", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={item.mediaType === "video" ? "videocam-outline" : "image-outline"} size={20} color="#888" />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return <View style={{ alignItems: "center" }}><Text style={{ fontWeight: "800", fontSize: 24 }}>{value ?? 0}</Text><Text style={{ color: "#777" }}>{label}</Text></View>;
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return <View style={{ marginTop: 10, borderRadius: AppTheme.radius.sm, borderWidth: 1, borderColor: AppTheme.colors.border, paddingHorizontal: 10, paddingVertical: 8 }}><Text style={{ color: "#777", fontSize: 12 }}>{label}</Text><Text style={{ color: AppTheme.colors.ink, marginTop: 2 }}>{value}</Text></View>;
}

function SettingsAction({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        marginTop: 10,
        borderRadius: AppTheme.radius.sm,
        borderWidth: 1,
        borderColor: AppTheme.colors.border,
        paddingHorizontal: 10,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name={icon} size={18} color={danger ? "#d12d2d" : AppTheme.colors.ink} />
        <Text style={{ color: danger ? "#d12d2d" : AppTheme.colors.ink, fontWeight: "600" }}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color="#8e8e8e" />
    </Pressable>
  );
}
