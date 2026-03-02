import { Stack, Redirect } from "expo-router";
import { useAuth } from "@/state/auth-context";

export default function HomeLayout() {
  const { user, loading } = useAuth();
  
  if (loading) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="group/[id]" />
    </Stack>
  );
}
