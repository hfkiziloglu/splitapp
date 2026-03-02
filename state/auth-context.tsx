import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";
import { Alert } from "react-native";

type Ctx = { 
  user: User | null; 
  loading: boolean;
  error: string | null;
};

const AuthCtx = createContext<Ctx>({ 
  user: null, 
  loading: true,
  error: null 
});

export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) {
          console.error("Auth session error:", error);
          setError(error.message);
          Alert.alert("Bağlantı Hatası", "Kimlik doğrulama hizmeti ile bağlantı kurulamadı.");
        } else {
          setSession(data.session ?? null);
          setError(null);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Auth session catch:", err);
        setError("Beklenmeyen bir hata oluştu");
        setLoading(false);
        Alert.alert("Hata", "Beklenmeyen bir hata oluştu. Lütfen uygulamayı yeniden başlatın.");
      });

    // Listen for auth changes
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state changed:", event);
      setSession(session);
      setError(null);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthCtx.Provider value={{ 
      user: session?.user ?? null, 
      loading,
      error 
    }}>
      {children}
    </AuthCtx.Provider>
  );
}
