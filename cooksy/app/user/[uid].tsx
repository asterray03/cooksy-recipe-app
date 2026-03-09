import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { auth } from "@/config/firebase";
import { getFollowStatus, getUserProfile, getUserRecipes, toggleFollow } from "@/src/services/api";
import { AppTheme } from "@/constants/app-theme";

type Profile = {
  uid: string;
  name: string;
  photoURL?: string;
  bio?: string;
  posts?: number;
  followers?: number;
  following?: number;
};

type Recipe = {
  id: string;
  title: string;
  image?: string;
  mediaType?: string;
};

export default function UserProfileScreen() {
  const params = useLocalSearchParams();
  const uid = String(params.uid ?? "");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [busyFollow, setBusyFollow] = useState(false);

  const isOwnProfile = useMemo(() => !!uid && uid === auth.currentUser?.uid, [uid]);

  const loadData = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [profileData, recipeData] = await Promise.all([getUserProfile(uid), getUserRecipes(uid)]);
      setProfile(profileData || null);
      setRecipes(Array.isArray(recipeData) ? recipeData : []);

      if (!isOwnProfile && auth.currentUser?.uid) {
        try {
          const state = await getFollowStatus(uid);
          setFollowing(!!state?.following);
        } catch {
          setFollowing(false);
        }
      }
    } catch (error) {
      console.log("Failed to load user profile", error);
      setProfile(null);
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }, [isOwnProfile, uid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const onToggleFollow = async () => {
    if (!uid || isOwnProfile || busyFollow) return;
    setBusyFollow(true);
    try {
      const result = await toggleFollow(uid);
      const nextFollowing = !!result?.following;
      setFollowing(nextFollowing);
      setProfile((prev) => {
        if (!prev) return prev;
        const currentFollowers = Number(prev.followers || 0);
        return { ...prev, followers: Math.max(0, currentFollowers + (nextFollowing ? 1 : -1)) };
      });
    } catch (error) {
      console.log("Follow toggle failed", error);
    } finally {
      setBusyFollow(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: AppTheme.colors.page }}>
      <View style={{ backgroundColor: AppTheme.colors.mustard, paddingTop: 10, paddingHorizontal: 12, paddingBottom: 12, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}><Ionicons name="chevron-back" size={22} /></Pressable>
          <Text style={{ fontWeight: "800", fontSize: 18 }}>Chef Profile</Text>
          <Pressable onPress={() => router.push("/(tabs)/profile")}><Ionicons name="person-circle" size={28} color={AppTheme.colors.primaryDeep} /></Pressable>
        </View>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={{ padding: 12, paddingBottom: 24 }}>
        {loading ? (
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <Ionicons name="hourglass-outline" size={24} color={AppTheme.colors.subtleInk} />
            <Text style={{ marginTop: 8, color: AppTheme.colors.subtleInk }}>Loading profile...</Text>
          </View>
        ) : !profile ? (
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <Ionicons name="alert-circle-outline" size={24} color={AppTheme.colors.subtleInk} />
            <Text style={{ marginTop: 8, color: AppTheme.colors.subtleInk }}>Profile not found.</Text>
          </View>
        ) : (
          <>
            {profile.photoURL ? (
              <Image source={{ uri: profile.photoURL }} style={{ width: 108, height: 108, borderRadius: 54, alignSelf: "center", borderWidth: 3, borderColor: AppTheme.colors.primary }} />
            ) : (
              <View style={{ width: 108, height: 108, borderRadius: 54, alignSelf: "center", borderWidth: 3, borderColor: AppTheme.colors.primary, backgroundColor: "white", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="person" size={44} color={AppTheme.colors.primaryDeep} />
              </View>
            )}

            <Text style={{ marginTop: 10, textAlign: "center", fontSize: 24, fontWeight: "800" }}>{profile.name || "Chef"}</Text>
            {profile.bio ? <Text style={{ marginTop: 8, textAlign: "center", color: AppTheme.colors.subtleInk }}>{profile.bio}</Text> : null}

            <View style={{ marginTop: 12, flexDirection: "row", justifyContent: "space-around", backgroundColor: "white", borderRadius: AppTheme.radius.md, borderWidth: 1, borderColor: AppTheme.colors.border, paddingVertical: 10 }}>
              <Stat value={Number(profile.posts || 0)} label="Posts" />
              <Stat value={Number(profile.followers || 0)} label="Followers" />
              <Stat value={Number(profile.following || 0)} label="Following" />
            </View>

            {!isOwnProfile ? (
              <Pressable
                onPress={onToggleFollow}
                disabled={busyFollow}
                style={{
                  marginTop: 12,
                  borderRadius: AppTheme.radius.pill,
                  paddingVertical: 10,
                  alignItems: "center",
                  backgroundColor: following ? "white" : AppTheme.colors.primary,
                  borderWidth: following ? 1 : 0,
                  borderColor: AppTheme.colors.border,
                }}
              >
                <Text style={{ fontWeight: "800", color: following ? AppTheme.colors.ink : "white" }}>
                  {busyFollow ? "Please wait..." : following ? "Following" : "Follow"}
                </Text>
              </Pressable>
            ) : null}

            <Text style={{ marginTop: 16, fontWeight: "800", fontSize: 16 }}>Recipes</Text>
            {recipes.length === 0 ? (
              <View style={{ marginTop: 10, backgroundColor: "white", borderRadius: AppTheme.radius.md, borderWidth: 1, borderColor: AppTheme.colors.border, padding: 16, alignItems: "center" }}>
                <Ionicons name="images-outline" size={22} color={AppTheme.colors.subtleInk} />
                <Text style={{ marginTop: 8, color: AppTheme.colors.subtleInk }}>No recipes posted yet.</Text>
              </View>
            ) : (
              <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {recipes.map((item) => (
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
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontWeight: "800", fontSize: 22 }}>{value}</Text>
      <Text style={{ color: AppTheme.colors.subtleInk }}>{label}</Text>
    </View>
  );
}
