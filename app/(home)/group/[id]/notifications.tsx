import React, { useState, useEffect } from "react";
import { View, Text, Alert, StyleSheet, ScrollView, Switch, TouchableOpacity, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "@/state/auth-context";
import { notificationService, NotificationPreference } from "@/services/NotificationService";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import SkeletonNotificationSettings from "@/components/ui/SkeletonNotificationSettings";

export default function NotificationSettings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreference | null>(null);
  
  const [expenseNotificationsEnabled, setExpenseNotificationsEnabled] = useState(true);
  const [expenseThreshold, setExpenseThreshold] = useState("0");
  const [memberJoinNotificationsEnabled, setMemberJoinNotificationsEnabled] = useState(true);
  
  const [errors, setErrors] = useState<{expenseThreshold?: string}>({});
  
  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    if (user?.id && id) {
      loadPreferences();
    }
  }, [user?.id, id]);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const userPrefs = await notificationService.getUserPreferences(user!.id, id!);
      
      if (userPrefs) {
        setPreferences(userPrefs);
        setExpenseNotificationsEnabled(userPrefs.expense_notifications_enabled);
        setExpenseThreshold(userPrefs.expense_threshold.toString());
        setMemberJoinNotificationsEnabled(userPrefs.member_join_notifications_enabled);
      }
    } catch (err) {
      console.error("Error loading preferences:", err);
      Alert.alert("Hata", "Bildirim ayarları yüklenirken hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const validateInputs = (): boolean => {
    const newErrors: {expenseThreshold?: string} = {};
    
    const threshold = parseFloat(expenseThreshold.replace(',', '.'));
    if (isNaN(threshold) || threshold < 0) {
      newErrors.expenseThreshold = "Geçerli bir alt sınır girin (0 veya üstü)";
    } else if (threshold > 999999) {
      newErrors.expenseThreshold = "Alt sınır çok yüksek";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateInputs()) return;
    
    setSaving(true);
    setErrors({});
    
    try {
      const threshold = parseFloat(expenseThreshold.replace(',', '.'));
      
      const preferencesData = {
        user_id: user!.id,
        group_id: id!,
        expense_notifications_enabled: expenseNotificationsEnabled,
        expense_threshold: threshold,
        member_join_notifications_enabled: memberJoinNotificationsEnabled,
      };

      const success = await notificationService.saveUserPreferences(preferencesData);
      
      if (success) {
        setShowSuccessModal(true);
      } else {
        Alert.alert("Hata", "Ayarlar kaydedilirken hata oluştu.");
      }
    } catch (err) {
      console.error("Save preferences error:", err);
      Alert.alert("Bağlantı Hatası", "İnternet bağlantınızı kontrol edin.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <SkeletonNotificationSettings />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.futuristicHeaderContainer}>
          <View style={styles.fadeBackground} />
          <View style={styles.fadeOverlay} />
          
          <View style={styles.futuristicHeader}>
            <View style={styles.heroSection}>
              <View style={styles.iconContainer}>
                <View style={styles.iconGlowRing} />
                <View style={styles.iconCircle}>
                  <Text style={styles.iconText}>🔔</Text>
                </View>
              </View>
              
              <View style={styles.heroTextSection}>
                <Text style={styles.heroTitle}>Bildirim Ayarları</Text>
                <Text style={styles.heroSubtitle}>
                  Hangi durumlarda bildirim almak istediğinizi belirleyin
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.modernSection}>
          <View style={styles.modernSectionHeader}>
            <View style={styles.sectionIconContainer}>
              <Text style={styles.sectionIcon}>💰</Text>
            </View>
            <Text style={styles.modernSectionTitle}>Harcama Bildirimleri</Text>
          </View>
          
          <View style={styles.modernSettingRow}>
            <View style={styles.modernSettingInfo}>
              <Text style={styles.modernSettingLabel}>Harcama Bildirimleri</Text>
              <Text style={styles.modernSettingDescription}>
                Ev arkadaşlarınız harcama eklediğinde bildirim al
              </Text>
            </View>
            <Switch
              value={expenseNotificationsEnabled}
              onValueChange={setExpenseNotificationsEnabled}
              trackColor={{ false: '#16213E', true: 'rgba(0, 212, 255, 0.3)' }}
              thumbColor={expenseNotificationsEnabled ? '#00D4FF' : '#6B7280'}
            />
          </View>

          {expenseNotificationsEnabled && (
            <View style={styles.modernThresholdSection}>
              <View style={styles.thresholdHeaderContainer}>
                <Text style={styles.modernThresholdLabel}>Alt Sınır (₺)</Text>
                <View style={styles.thresholdBadge}>
                  <Text style={styles.thresholdBadgeText}>Opsiyonel</Text>
                </View>
              </View>
              <Text style={styles.modernThresholdDescription}>
                Sadece bu tutarın üstündeki harcamalar için bildirim al. 
                0 yazarsanız tüm harcamalar için bildirim alırsınız.
              </Text>
              <Input
                placeholder="Örn: 100"
                value={expenseThreshold}
                onChangeText={setExpenseThreshold}
                keyboardType="numeric"
                error={errors.expenseThreshold}
                style={styles.modernThresholdInput}
              />
            </View>
          )}
        </View>

        <View style={styles.modernSection}>
          <View style={styles.modernSectionHeader}>
            <View style={styles.sectionIconContainer}>
              <Text style={styles.sectionIcon}>👥</Text>
            </View>
            <Text style={styles.modernSectionTitle}>Üyelik Bildirimleri</Text>
          </View>
          
          <View style={styles.modernSettingRow}>
            <View style={styles.modernSettingInfo}>
              <Text style={styles.modernSettingLabel}>Yeni Üye Bildirimleri</Text>
              <Text style={styles.modernSettingDescription}>
                Eve yeni biri katıldığında bildirim al
              </Text>
            </View>
            <Switch
              value={memberJoinNotificationsEnabled}
              onValueChange={setMemberJoinNotificationsEnabled}
              trackColor={{ false: '#16213E', true: 'rgba(0, 212, 255, 0.3)' }}
              thumbColor={memberJoinNotificationsEnabled ? '#00D4FF' : '#6B7280'}
            />
          </View>
        </View>

        <View style={styles.modernButtonSection}>
          <TouchableOpacity
            style={[
              styles.modernSaveButton,
              saving && styles.modernSaveButtonDisabled
            ]}
            onPress={handleSave}
            disabled={saving}
          >
            <View style={styles.modernButtonContent}>
              {saving ? (
                <>
                  <Text style={styles.modernButtonIcon}>⏳</Text>
                  <Text style={styles.modernSaveButtonText}>Kaydediliyor...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.modernButtonIcon}>💾</Text>
                  <Text style={styles.modernSaveButtonText}>Ayarları Kaydet</Text>
                </>
              )}
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.modernCancelButton}
            onPress={() => router.back()}
          >
            <View style={styles.modernButtonContent}>
              <Text style={styles.modernCancelButtonIcon}>↩️</Text>
              <Text style={styles.modernCancelButtonText}>İptal</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Success Modal */}
      {showSuccessModal && (
        <View style={styles.successModalOverlay}>
          <View style={styles.successModal}>
            {/* Header Icon */}
            <View style={styles.successIconContainer}>
              <View style={styles.successIconCircle}>
                <Text style={styles.successIcon}>✅</Text>
              </View>
            </View>
            
            {/* Title */}
            <Text style={styles.successTitle}>Başarılı!</Text>
            
            {/* Message */}
            <Text style={styles.successMessage}>
              Bildirim ayarlarınız başarıyla kaydedildi.
            </Text>
            
            {/* OK Button */}
            <TouchableOpacity
              style={styles.successButton}
              onPress={() => {
                setShowSuccessModal(false);
                router.back();
              }}
            >
              <Text style={styles.successButtonText}>Tamam</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#9CA3AF', fontWeight: '500' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  
  futuristicHeaderContainer: { position: 'relative', overflow: 'hidden', minHeight: 140, marginBottom: 32 },
  fadeBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00D4FF', opacity: 0.15 },
  fadeOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  futuristicHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 32 },
  heroSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1 },
  iconContainer: { position: 'relative', marginRight: 20 },
  iconGlowRing: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: 'rgba(0, 212, 255, 0.4)', top: -6, left: -6, shadowColor: '#00D4FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 16, elevation: 12 },
  iconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#00D4FF', justifyContent: 'center', alignItems: 'center', shadowColor: '#00D4FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 24, elevation: 20, borderWidth: 3, borderColor: 'rgba(255, 255, 255, 0.3)' },
  iconText: { fontSize: 24, textShadowColor: 'rgba(0, 0, 0, 0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  heroTextSection: { flex: 1 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', marginBottom: 4, textShadowColor: 'rgba(255, 255, 255, 0.6)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20, letterSpacing: 0.5 },
  heroSubtitle: { fontSize: 14, color: '#B0B7C3', fontWeight: '500', lineHeight: 20, letterSpacing: 0.2 },
  
  modernSection: { backgroundColor: '#151524', borderRadius: 20, padding: 24, marginBottom: 20, marginHorizontal: 20, borderWidth: 2, borderColor: 'rgba(0, 212, 255, 0.2)', shadowColor: '#00D4FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  modernSectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  sectionIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0, 212, 255, 0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1, borderColor: 'rgba(0, 212, 255, 0.3)' },
  sectionIcon: { fontSize: 20 },
  modernSectionTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', textShadowColor: 'rgba(255, 255, 255, 0.3)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  modernSettingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modernSettingInfo: { flex: 1, marginRight: 16 },
  modernSettingLabel: { fontSize: 17, fontWeight: '600', color: '#FFFFFF', marginBottom: 6, textShadowColor: 'rgba(255, 255, 255, 0.2)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
  modernSettingDescription: { fontSize: 14, color: '#B0B7C3', lineHeight: 20, letterSpacing: 0.1 },
  
  modernThresholdSection: { marginTop: 16, paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(0, 212, 255, 0.3)' },
  thresholdHeaderContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  modernThresholdLabel: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', textShadowColor: 'rgba(255, 255, 255, 0.2)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
  thresholdBadge: { backgroundColor: 'rgba(255, 149, 0, 0.15)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255, 149, 0, 0.3)' },
  thresholdBadgeText: { fontSize: 10, color: '#FF9500', fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  modernThresholdDescription: { fontSize: 14, color: '#B0B7C3', lineHeight: 20, marginBottom: 16, letterSpacing: 0.1 },
  modernThresholdInput: { marginBottom: 0 },
  
  modernButtonSection: { marginTop: 32, marginBottom: 20, marginHorizontal: 20, gap: 16 },
  modernSaveButton: { 
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#00FF94',
    shadowColor: '#00FF94',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 15,
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
  modernCancelButton: { 
    backgroundColor: '#1A1A2F',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: '#FF6B6B',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modernButtonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
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
  modernCancelButtonIcon: { 
    fontSize: 16, 
    color: '#FF6B6B' 
  },
  modernCancelButtonText: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#FF6B6B', 
    textAlign: 'center', 
    textShadowColor: 'rgba(255, 255, 255, 0.3)', 
    textShadowOffset: { width: 0, height: 0 }, 
    textShadowRadius: 10 
  },
  
  // Success Modal Styles
  successModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
    elevation: 99999,
  },
  successModal: {
    backgroundColor: '#151524',
    borderRadius: 20,
    padding: 24,
    width: 300,
    borderWidth: 2,
    borderColor: '#00FF94',
    margin: 20,
    shadowColor: '#00FF94',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  successIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 255, 148, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 148, 0.3)',
  },
  successIcon: {
    fontSize: 28,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  successMessage: {
    fontSize: 16,
    color: '#B0B7C3',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  successButton: {
    backgroundColor: 'rgba(0, 255, 148, 0.3)',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#00FF94',
    alignItems: 'center',
    justifyContent: 'center'
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 255, 148, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8
  },
});
