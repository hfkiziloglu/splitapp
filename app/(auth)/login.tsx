import { useState, useEffect } from "react";
import { View, Alert, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Switch, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { supabase } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function Login() {
  const { email: emailParam } = useLocalSearchParams();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [savedPassword, setSavedPassword] = useState("");
  const [errors, setErrors] = useState<{email?: string; password?: string; general?: string}>({});

  // Kaydedilen e-postayı yükle ve parametreyi kontrol et
  useEffect(() => {
    const loadSavedEmail = async () => {
      try {
        // Önce parametre varsa onu kullan
        if (emailParam && typeof emailParam === 'string') {
          setEmail(decodeURIComponent(emailParam));
          // Kayıt sonrası geldiğini belirten mesaj
          setTimeout(() => {
            setErrors({ 
              general: "Lütfen e-posta adresinizi kontrol edin ve doğrulama linkine tıklayın. Ardından buradan giriş yapabilirsiniz." 
            });
          }, 500);
        } else {
          // Parametre yoksa kaydedilen bilgileri yükle
          const savedEmail = await AsyncStorage.getItem('remembered_email');
          const savedPw = await SecureStore.getItemAsync('remembered_password');

          if (savedEmail && savedPw) {
            setEmail(savedEmail);
            setSavedPassword(savedPw);
            setRememberMe(true);
            logger.log('📧 Kaydedilen bilgiler yüklendi');

            // Otomatik giriş yap
            await performAutoLogin(savedEmail, savedPw);
          } else if (savedEmail) {
            // Sadece e-posta kaydedilmişse
            setEmail(savedEmail);
            setRememberMe(true);
            logger.log('📧 Sadece e-posta yüklendi');
          }
        }
      } catch (err) {
        console.error('Kaydedilen e-posta yükleme hatası:', err);
      }
    };

    loadSavedEmail();
  }, [emailParam]);

  // Otomatik giriş fonksiyonu
  const performAutoLogin = async (savedEmail: string, savedPw: string) => {
    try {
      setBusy(true);
      logger.log('🔄 Otomatik giriş yapılıyor...');

      const { error } = await supabase.auth.signInWithPassword({
        email: savedEmail,
        password: savedPw
      });

      if (error) {
        logger.log('❌ Otomatik giriş başarısız:', error.message);
        // Kaydedilen şifreyi sil (geçersiz olabilir)
        await SecureStore.deleteItemAsync('remembered_password');
        setSavedPassword("");
        // Kullanıcı manuel giriş yapabilir
      } else {
        logger.log('✅ Otomatik giriş başarılı!');
        // Navigation otomatik olacak (auth state change)
      }
    } catch (err) {
      logger.error('Otomatik giriş hatası:', err);
      // Kaydedilen bilgileri temizle
      await SecureStore.deleteItemAsync('remembered_password');
      setSavedPassword("");
    } finally {
      setBusy(false);
    }
  };
  
  const validateInputs = () => {
    const newErrors: {email?: string; password?: string} = {};
    
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
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onSubmit = async () => {
    if (!validateInputs()) return;

    setBusy(true);
    setErrors({});
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password: pw 
      });
      
      if (error) {
        // Turkish error messages
        let message = error.message;
        if (error.message.includes("Invalid login credentials")) {
          message = "E-posta veya şifre hatalı.";
        } else if (error.message.includes("Email not confirmed")) {
          message = "E-posta adresinizi onaylamanız gerekiyor.";
        } else if (error.message.includes("Too many requests")) {
          message = "Çok fazla deneme yaptınız. Lütfen bir süre bekleyin.";
        }
        
        setErrors({ general: message });
      } else {
        // Login başarılı - "Beni hatırla" ayarını işle
        try {
          if (rememberMe) {
            // E-posta ve şifreyi kaydet
            await AsyncStorage.setItem('remembered_email', email.trim());
            await SecureStore.setItemAsync('remembered_password', pw);
            logger.log('📧 Giriş bilgileri kaydedildi');
          } else {
            // Kaydedilen bilgileri sil
            await AsyncStorage.removeItem('remembered_email');
            await SecureStore.deleteItemAsync('remembered_password');
            logger.log('🗑️ Kaydedilen giriş bilgileri silindi');
          }
        } catch (err) {
          logger.error('Giriş bilgileri kaydetme/silme hatası:', err);
        }
      }
      // Success - navigation will be handled by auth state change
    } catch (err) {
      setErrors({ general: "İnternet bağlantınızı kontrol edin ve tekrar deneyin." });
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
                <Text style={styles.logoIcon}>💸</Text>
              </View>
              <View style={styles.logoGlow} />
            </View>
            
            {/* App Name */}
            <Text style={styles.appTitle}>Bölüşelim</Text>
            <Text style={styles.appSubtitle}>Masrafları kolayca paylaş</Text>
          </View>

          {/* Main Login Form */}
          <View style={styles.formSection}>
            {/* Login Form Card */}
            <View style={styles.loginFormCard}>
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
                containerStyle={styles.lastInputInCard}
                style={styles.neonInput}
              />

              {/* Remember Me Switch */}
              <View style={styles.rememberMeContainer}>
                <View style={styles.rememberMeContent}>
                  <Text style={styles.rememberMeText}>Beni Hatırla</Text>
                  <Switch
                    value={rememberMe}
                    onValueChange={setRememberMe}
                    trackColor={{ false: '#2A2A3A', true: '#0EA5E9' }}
                    thumbColor={rememberMe ? '#FFFFFF' : '#9CA3AF'}
                    ios_backgroundColor="#2A2A3A"
                  />
                </View>
              </View>
            </View>

            <Button
              title={busy ? "Giriş Yapılıyor..." : "Giriş Yap"}
              onPress={onSubmit}
              loading={busy}
              disabled={busy}
              style={styles.loginButton}
              textStyle={styles.loginButtonText}
            />
            
            {/* General Error Message */}
            {errors.general && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errors.general}</Text>
              </View>
            )}
          </View>

          {/* Bottom Section */}
          <View style={styles.bottomSection}>
            <Text style={styles.noAccountText}>Hesabınız yok mu?</Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity style={styles.signupButton}>
                <Text style={styles.signupButtonText}>Kayıt Ol</Text>
              </TouchableOpacity>
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
    shadowColor: '#00FF94',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
    borderWidth: 3,
    borderColor: '#00FF94',
  },
  logoGlow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 48,
    backgroundColor: '#00FF94',
    opacity: 0.15,
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
    marginBottom: 0,
  },
  
  // Login Form Card
  loginFormCard: {
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
    marginBottom: 20,
  },
  lastInputInCard: {
    marginBottom: 8,
  },
  
  // Neon Input Style
  neonInput: {
    borderColor: '#F72585',
    borderWidth: 2,
    shadowColor: '#F72585',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 9,
  },
  
  // Remember Me Switch (inside card)
  rememberMeContainer: {
    marginBottom: -10,
    marginTop: 0,
  },
  rememberMeContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    gap: 16,
  },
  rememberMeText: {
    fontSize: 16,
    color: '#0EA5E9',
    fontWeight: '600',
    textShadowColor: 'rgba(14, 165, 233, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  
  // Login Button
  loginButton: {
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
  loginButtonText: {
    color: '#00FF94',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 255, 148, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  
  // Error Message
  errorContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: 'rgba(255, 51, 102, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 102, 0.2)',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3366',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Bottom Section - Simple Signup Link
  bottomSection: {
    alignItems: 'center',
    paddingTop: 20,
  },
  noAccountText: {
    fontSize: 15,
    color: '#FFFFFF',
    marginBottom: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  signupButton: {
    backgroundColor: '#151524',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: '#FF9500',
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  signupButtonText: {
    color: '#FF9500',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(255, 149, 0, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});
