import { Redirect } from "expo-router";
import { auth } from "@/config/firebase";

export default function Index() {
  return <Redirect href={auth.currentUser ? "/(tabs)" : "/welcome"} />;
}
