import { Stack, Redirect } from "expo-router";
import { useAuth } from "@/state/auth-context";

export default function AuthLayout() {
  const { user, loading } = useAuth();
  
  if (loading) return null;
  if (user) return <Redirect href="/(home)/" />;
  
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
