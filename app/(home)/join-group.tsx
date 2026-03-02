import { useState } from "react";
import { View, Text, Alert, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/state/auth-context";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { notificationService } from "@/services/NotificationService";
import { UserHouseholdPreferencesService } from "@/services/UserHouseholdPreferencesService";

export default function JoinHousehold() {
  const { user } = useAuth();
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{inviteCode?: string}>({});

  const validateInputs = () => {
    const newErrors: {inviteCode?: string} = {};
    
    if (!inviteCode.trim()) {
      newErrors.inviteCode = "Davet kodu gerekli";
    } else if (inviteCode.trim().length !== 8) {
      newErrors.inviteCode = "Davet kodu 8 karakter olmalı";
    } else if (!/^[A-Z0-9]+$/.test(inviteCode.trim().toUpperCase())) {
      newErrors.inviteCode = "Geçersiz davet kodu formatı";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleJoin = async () => {
    if (!validateInputs()) return;
    
    setBusy(true);
    setErrors({});
    
    try {
      const code = inviteCode.trim().toUpperCase();
      
      // 1. Davet koduna göre evi bul
      const { data: household, error: householdError } = await supabase
        .from('groups')
        .select('id, name, description')
        .eq('invite_code', code)
        .single();
        
      if (householdError || !household) {
        Alert.alert("Hata", "Geçersiz davet kodu. Lütfen kodu kontrol edin.");
        return;
      }

      // 2. Zaten üye mi kontrol et
      const { data: existingMember, error: memberCheckError } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', household.id)
        .eq('user_id', user?.id)
        .single();

      if (existingMember) {
        Alert.alert("Bilgi", "Bu gruba zaten üyesiniz!");
        router.back();
        return;
      }

      // 3. Eve katıl
      const { error: joinError } = await supabase
        .from('group_members')
        .insert({
          group_id: household.id,
          user_id: user?.id,
          role: 'member'
        });

      if (joinError) {
        console.error("Join household error:", joinError);
        Alert.alert("Hata", "Gruba katılırken hata oluştu: " + joinError.message);
        return;
      }

      // 4. Varsayılan bildirim tercihlerini oluştur
      await notificationService.createDefaultPreferences(user?.id!, household.id);

      // 5. Akıllı renk seçimi ile kullanıcı tercihlerini oluştur
      await UserHouseholdPreferencesService.createDefaultPreference(user?.id!, household.id);

      // 6. Mevcut üyelere yeni katılım bildirimi gönder
      const userFullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Yeni Üye';
      await notificationService.sendMemberJoinNotification(
        household.id,
        userFullName,
        user?.id!
      );

      Alert.alert(
        "🎉 Harika!", 
        `"${household.name}" grubuna başarıyla katıldınız!\n\n${household.description || 'Hoş geldiniz!'}`,
        [{ text: "Ana Sayfaya Dön", onPress: () => router.replace("/(home)/") }]
      );
    } catch (err) {
      console.error("Join household catch:", err);
      Alert.alert("Bağlantı Hatası", "İnternet bağlantınızı kontrol edin.");
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
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Modern Header - Ayarlar sayfası gibi */}
            <View style={styles.futuristicHeaderContainer}>
              <View style={styles.fadeBackground} />
              <View style={styles.fadeOverlay} />
              
              <View style={styles.futuristicHeader}>
                <View style={styles.heroSection}>
                  <View style={styles.iconContainer}>
                    <View style={styles.iconGlowRing} />
                    <View style={styles.iconCircle}>
                      <Text style={styles.iconText}>🔗</Text>
                    </View>
                  </View>
                  
                  <View style={styles.heroTextSection}>
                    <Text style={styles.heroTitle}>Gruba Katıl</Text>
                    <Text style={styles.heroSubtitle}>
                      Davet kodunu girerek bir gruba katılabilirsin
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Davet Kodu Section */}
            <View style={[styles.modernSection, styles.primarySection]}>
              <View style={styles.modernSectionHeader}>
                <View style={[styles.sectionIconContainer, styles.primaryIconContainer]}>
                  <Text style={styles.sectionIcon}>🔑</Text>
                </View>
                <Text style={styles.modernSectionTitle}>Davet Kodu</Text>
              </View>
              
              <View style={styles.formContainer}>
                <Input
                  label="8 Haneli Davet Kodu"
                  placeholder="Örn: A7B3C9D1"
                  value={inviteCode}
                  onChangeText={(text) => setInviteCode(text.toUpperCase())}
                  error={errors.inviteCode}
                  editable={!busy}
                  autoFocus
                  autoCapitalize="characters"
                  maxLength={8}
                  focusColor="#00FF94"
                  containerStyle={styles.standardInputContainer}
                />
                
                <Button
                  title="Gruba Katıl"
                  onPress={handleJoin}
                  loading={busy}
                  disabled={busy || !inviteCode.trim()}
                  style={styles.joinButton}
                  textStyle={styles.joinButtonText}
                />
              </View>
            </View>

            {/* Nasıl Çalışır Section */}
            <View style={[styles.modernSection, styles.infoSection]}>
              <View style={styles.modernSectionHeader}>
                <View style={[styles.sectionIconContainer, styles.infoIconContainer]}>
                  <Text style={styles.sectionIcon}>💡</Text>
                </View>
                <Text style={styles.modernSectionTitle}>Nasıl Çalışır?</Text>
              </View>
              
              <View style={styles.modernSettingRow}>
                <View style={styles.modernSettingInfo}>
                  <Text style={styles.infoText}>
                    • Grup arkadaşınızdan 8 haneli davet kodunu alın{'\n'}
                    • Kodu yukarıdaki alana girin{'\n'}
                    • "Gruba Katıl" butonuna tıklayın{'\n'}
                    • Otomatik olarak gruba üye olursunuz
                  </Text>
                </View>
              </View>
            </View>

            {/* Örnek Kod Section */}
            <View style={[styles.modernSection, styles.exampleSection]}>
              <View style={styles.modernSectionHeader}>
                <View style={[styles.sectionIconContainer, styles.exampleIconContainer]}>
                  <Text style={styles.sectionIcon}>📋</Text>
                </View>
                <Text style={styles.modernSectionTitle}>Örnek Davet Kodu</Text>
              </View>
              
              <View style={styles.exampleContainer}>
                <Text style={styles.exampleCode}>A7B3C9D1</Text>
                <Text style={styles.exampleDescription}>
                  Davet kodları büyük harf ve rakamlardan oluşur
                </Text>
              </View>
            </View>

            {/* İptal Butonu */}
            <View style={styles.cancelSection}>
              <TouchableOpacity
                style={[
                  styles.modernCancelButton,
                  busy && styles.modernCancelButtonDisabled
                ]}
                onPress={() => router.back()}
                disabled={busy}
              >
                <View style={styles.modernButtonContent}>
                  <Text style={styles.modernCancelButtonText}>İptal</Text>
                </View>
              </TouchableOpacity>
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
    backgroundColor: '#0A0A0F' 
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: { 
    flex: 1 
  },
  scrollContent: { 
    paddingBottom: 20 
  },
  
  // Header Styles (Ayarlar sayfasından)
  futuristicHeaderContainer: { 
    position: 'relative', 
    overflow: 'hidden', 
    minHeight: 140, 
    marginBottom: 32 
  },
  fadeBackground: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    backgroundColor: '#FF0080', 
    opacity: 0.2 
  },
  fadeOverlay: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0 
  },
  futuristicHeader: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 32, 
    paddingVertical: 32 
  },
  heroSection: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    flex: 1 
  },
  iconContainer: { 
    position: 'relative', 
    marginRight: 20 
  },
  iconGlowRing: { 
    position: 'absolute', 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    borderWidth: 3, 
    borderColor: 'rgba(255, 0, 128, 0.6)', 
    top: -10, 
    left: -10, 
    shadowColor: '#FF0080', 
    shadowOffset: { width: 0, height: 0 }, 
    shadowOpacity: 0.9, 
    shadowRadius: 25, 
    elevation: 20 
  },
  iconCircle: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    backgroundColor: '#FF0080', 
    justifyContent: 'center', 
    alignItems: 'center', 
    shadowColor: '#FF0080', 
    shadowOffset: { width: 0, height: 0 }, 
    shadowOpacity: 1.0, 
    shadowRadius: 30, 
    elevation: 25, 
    borderWidth: 4, 
    borderColor: 'rgba(255, 255, 255, 0.5)' 
  },
  iconText: { 
    fontSize: 24, 
    textShadowColor: 'rgba(0, 0, 0, 0.4)', 
    textShadowOffset: { width: 0, height: 2 }, 
    textShadowRadius: 6 
  },
  heroTextSection: { 
    flex: 1 
  },
  heroTitle: { 
    fontSize: 28, 
    fontWeight: '900', 
    color: '#FFFFFF', 
    marginBottom: 4, 
    textShadowColor: 'rgba(255, 0, 128, 0.8)', 
    textShadowOffset: { width: 0, height: 0 }, 
    textShadowRadius: 25, 
    letterSpacing: 1 
  },
  heroSubtitle: { 
    fontSize: 14, 
    color: '#B0B7C3', 
    fontWeight: '500', 
    lineHeight: 20, 
    letterSpacing: 0.2 
  },
  
  // Modern Section Styles (Ayarlar sayfasından)
  modernSection: { 
    backgroundColor: '#151524', 
    borderRadius: 20, 
    padding: 24, 
    marginBottom: 20, 
    marginHorizontal: 20, 
    borderWidth: 2, 
    borderColor: 'rgba(0, 255, 148, 0.4)', 
    shadowColor: '#00FF94', 
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 20, 
    elevation: 15 
  },
  primarySection: {
    // Ana bölüm - yeşil kalır
  },
  infoSection: {
    borderColor: 'rgba(0, 212, 255, 0.4)',
    shadowColor: '#00D4FF',
  },
  exampleSection: {
    borderColor: 'rgba(0, 212, 255, 0.4)',
    shadowColor: '#00D4FF',
  },
  modernSectionHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 20 
  },
  sectionIconContainer: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: 'rgba(0, 255, 148, 0.2)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12, 
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)', // Beyaz neon border
    elevation: 8,
  },
  primaryIconContainer: {
    // Ana bölüm - yeşil kalır
  },
  infoIconContainer: {
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.6)', // Beyaz neon border
  },
  exampleIconContainer: {
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.6)', // Beyaz neon border
  },
  sectionIcon: { 
    fontSize: 20 
  },
  modernSectionTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#FFFFFF', 
    textShadowColor: 'rgba(255, 255, 255, 0.3)', 
    textShadowOffset: { width: 0, height: 0 }, 
    textShadowRadius: 8 
  },
  modernSettingRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: 16 
  },
  modernSettingInfo: { 
    flex: 1, 
    marginRight: 16 
  },
  
  // Form Container
  formContainer: { 
    gap: 0 
  },
  standardInputContainer: { 
    marginBottom: 16 
  },
  
  // Modern Button Styles (Ayarlar sayfasından)
  modernSaveButton: { 
    backgroundColor: '#00FF94',
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 32,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    shadowColor: '#00FF94',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1.0,
    shadowRadius: 30,
    elevation: 25,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modernSaveButtonDisabled: { 
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(156, 163, 175, 0.5)',
    opacity: 0.6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modernButtonContent: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8 
  },
  modernButtonIcon: { 
    fontSize: 18, 
    color: '#00FF94', 
    textShadowColor: 'rgba(255, 255, 255, 0.3)', 
    textShadowOffset: { width: 0, height: 0 }, 
    textShadowRadius: 10 
  },
  modernSaveButtonText: { 
    fontSize: 16, 
    fontWeight: '700',
    color: '#00FF94', 
    textAlign: 'center', 
    textShadowColor: 'rgba(255, 255, 255, 0.3)', 
    textShadowOffset: { width: 0, height: 0 }, 
    textShadowRadius: 10 
  },
  
  // Info Text
  infoText: {
    fontSize: 14,
    color: '#B0B7C3',
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  
  // Example Container
  exampleContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  exampleCode: {
    fontSize: 32,
    fontWeight: '900',
    color: '#00FF94',
    letterSpacing: 6,
    marginBottom: 12,
    textShadowColor: 'rgba(0, 255, 148, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 148, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 255, 148, 0.1)',
  },
  exampleDescription: {
    fontSize: 13,
    color: '#B0B7C3',
    textAlign: 'center',
    lineHeight: 18,
  },
  
  // Cancel Section
  cancelSection: {
    marginHorizontal: 20,
    marginTop: 20, // Daha fazla boşluk
  },
  modernCancelButton: {
    backgroundColor: '#151524',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: '#FF6B6B',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modernCancelButtonDisabled: {
    backgroundColor: '#151524',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(156, 163, 175, 0.3)',
    opacity: 0.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernCancelButtonIcon: {
    fontSize: 16,
    color: '#FF6B6B',
    textShadowColor: 'rgba(255, 107, 107, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  modernCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF6B6B',
    textAlign: 'center',
    textShadowColor: 'rgba(255, 107, 107, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  joinButton: {
    marginTop: 16,
    backgroundColor: '#1A1A2E',
    borderColor: '#00FF94',
    shadowColor: '#00FF94',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 8,
  },
  joinButtonText: {
    color: '#00FF94',
    textShadowColor: 'rgba(0, 255, 148, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: 8,
  },
});
