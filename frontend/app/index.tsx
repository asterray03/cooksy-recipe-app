import { Redirect } from "expo-router";
import { auth } from "@/config/firebase";
import { isGuestSession } from "@/state/session";

export default function Index() {
  return <Redirect href={auth.currentUser || isGuestSession() ? "/(tabs)" : "/welcome"} />;
}
