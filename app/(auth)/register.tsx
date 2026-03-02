import { useState } from "react";
import { View, Alert, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{fullName?: string; email?: string; password?: string; confirmPassword?: string}>({});
  
  const validateInputs = () => {
    const newErrors: {fullName?: string; email?: string; password?: string; confirmPassword?: string} = {};
    
    if (!fullName.trim()) {
      newErrors.fullName = "Ad soyad gerekli";
    } else if (fullName.trim().length < 2) {
      newErrors.fullName = "Ad soyad en az 2 karakter olmalı";
    }
    
    if (!email.trim()) {
      newErrors.email = "E-posta adresi gerekli";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Geçerli bir e-posta adresi girin";
    }
    
    if (!pw.trim()) {
      newErrors.password = "Şifre gerekli";
    } else if (pw.length < 6) {
      newErrors.password = "Şifre en az 6 karakter olmalı";
    }
    
    if (!confirmPw.trim()) {
      newErrors.confirmPassword = "Şifre tekrarı gerekli";
    } else if (pw !== confirmPw) {
      newErrors.confirmPassword = "Şifreler eşleşmiyor";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onSubmit = async () => {
    if (!validateInputs()) return;

    setBusy(true);
    setErrors({});
    
    try {
      const { error } = await supabase.auth.signUp({ 
        email: email.trim(), 
        password: pw,
        options: {
          emailRedirectTo: 'evarkadasi://auth/confirm',
          data: {
            full_name: fullName.trim()
          }
        }
      });
      
      if (error) {
        // Turkish error messages
        let message = error.message;
        if (error.message.includes("User already registered")) {
          message = "Bu e-posta adresi zaten kayıtlı.";
        } else if (error.message.includes("Password should be")) {
          message = "Şifre en az 6 karakter olmalıdır.";
        } else if (error.message.includes("Invalid email")) {
          message = "Geçersiz e-posta adresi.";
        }
        
        Alert.alert("Kayıt Hatası", message);
      } else {
        Alert.alert(
          "Kayıt Başarılı", 
          "Hesabınız oluşturuldu. E-posta adresinize gönderilen doğrulama linkine tıklayın.",
          [{ text: "Tamam", onPress: () => router.replace(`/(auth)/login?email=${encodeURIComponent(email.trim())}`) }]
        );
      }
    } catch (err) {
      console.error("Register catch:", err);
      Alert.alert("Bağlantı Hatası", "İnternet bağlantınızı kontrol edin ve tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          style={styles.keyboardView} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Merkezi Ana Bileşen */}
            <View style={styles.mainContainer}>
              {/* Modern App Header */}
              <View style={styles.headerSection}>
                {/* App Logo */}
                <View style={styles.logoContainer}>
                  <View style={styles.logoCircle}>
                    <Text style={styles.logoIcon}>🍕</Text>
                  </View>
                  <View style={styles.logoGlow} />
                </View>
                
                {/* App Name */}
                <Text style={styles.appTitle}>Bölüşelim</Text>
                <Text style={styles.appSubtitle}>Hesap oluştur ve paylaşmaya başla</Text>
              </View>

              {/* Main Register Form */}
              <View style={styles.formSection}>
                {/* Register Form Card */}
                <View style={styles.registerFormCard}>
                  <Input
                    label="Ad Soyad"
                    placeholder="Örn: Ahmet Yılmaz"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    error={errors.fullName}
                    editable={!busy}
                    containerStyle={styles.inputSpacing}
                    style={styles.neonInput}
                  />

                  <Input
                    label="E-posta"
                    placeholder="ornek@email.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={errors.email}
                    editable={!busy}
                    containerStyle={styles.inputSpacing}
                    style={styles.neonInput}
                  />
                  
                  <Input
                    label="Şifre"
                    placeholder="En az 6 karakter"
                    value={pw}
                    onChangeText={setPw}
                    showPasswordToggle
                    error={errors.password}
                    editable={!busy}
                    containerStyle={styles.inputSpacing}
                    style={styles.neonInput}
                  />

                  <Input
                    label="Şifre Tekrar"
                    placeholder="Şifrenizi tekrar girin"
                    value={confirmPw}
                    onChangeText={setConfirmPw}
                    showPasswordToggle
                    error={errors.confirmPassword}
                    editable={!busy}
                    containerStyle={styles.lastInputInCard}
                    style={styles.neonInput}
                  />
                </View>

                {/* Register Button */}
                <Button
                  title="Hesap Oluştur"
                  onPress={onSubmit}
                  loading={busy}
                  disabled={busy}
                  style={styles.registerButton}
                  textStyle={styles.registerButtonText}
                />
              </View>

              {/* Bottom Section */}
              <View style={styles.bottomSection}>
                <Text style={styles.alreadyAccountText}>Zaten hesabınız var mı?</Text>
                <Link href="/(auth)/login" style={styles.loginLink}>
                  <View style={styles.loginLinkButton}>
                    <Text style={styles.loginLinkText}>Giriş Yap</Text>
                  </View>
                </Link>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  mainContainer: {
    maxWidth: 400,
    width: '100%',
    alignItems: 'center',
  },
  
  // Modern Header Section - Bölüşelim Theme
  headerSection: {
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 6,
  },
  logoContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 3,
    borderColor: '#FF9500',
  },
  logoGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    opacity: 0.6,
    zIndex: -1,
  },
  logoIcon: {
    fontSize: 32,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  appTitle: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 255, 148, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 25,
    letterSpacing: 1,
  },
  appSubtitle: {
    fontSize: 15,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 0,
    lineHeight: 24,
    paddingHorizontal: 20,
    letterSpacing: 0.5,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 255, 148, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 25,
  },
  
  // Form Section - Clean and Focused
  formSection: {
    width: '100%',
    paddingTop: 20,
    marginBottom: 8,
  },
  
  // Register Form Card
  registerFormCard: {
    backgroundColor: '#151524',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#0EA5E9',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  
  inputSpacing: {
    marginBottom: 28,
  },
  lastInputInCard: {
    marginBottom: 8,
  },
  
  // Neon Input Style
  neonInput: {
    borderColor: '#F72585',
    borderWidth: 2,
    borderRadius: 12,
    backgroundColor: '#1A1A2E',
    color: '#FFFFFF',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#F72585',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  
  // Register Button
  registerButton: {
    backgroundColor: '#151524',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: '#00FF94',
    shadowColor: '#00FF94',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    marginBottom: 0,
  },
  registerButtonText: {
    color: '#00FF94',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 255, 148, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  
  // Bottom Section - Simple Login Link
  bottomSection: {
    alignItems: 'center',
    paddingTop: 20,
  },
  alreadyAccountText: {
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  loginLinkButton: {
    backgroundColor: '#151524',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: '#0EA5E9',
    shadowColor: '#0EA5E9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  loginLink: {
    textDecorationLine: 'none',
  },
  loginLinkText: {
    color: '#0EA5E9',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(14, 165, 233, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});