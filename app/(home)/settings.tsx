import { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";

import { useAuth } from "@/state/auth-context";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import SkeletonSettings from "@/components/ui/SkeletonSettings";

export default function Settings() {
  const { user } = useAuth();
  const [monthStartDay, setMonthStartDay] = useState("1");
  const [userProfile, setUserProfile] = useState<{full_name?: string; phone?: string; email?: string; month_start_day?: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savingMonthDay, setSavingMonthDay] = useState(false);
  const [errors, setErrors] = useState<{monthStartDay?: string; fullName?: string; phone?: string; email?: string; currentPassword?: string; newPassword?: string; confirmPassword?: string; profile?: string}>({});
  
  // Profile editing states
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  
  // Warning modal state
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");

  // Notification settings states
  const [expenseNotificationsEnabled, setExpenseNotificationsEnabled] = useState(true);
  const [expenseThreshold, setExpenseThreshold] = useState("0");
  const [memberJoinNotificationsEnabled, setMemberJoinNotificationsEnabled] = useState(true);
  const [notificationSettings, setNotificationSettings] = useState<{[groupId: string]: {expense_notifications_enabled: boolean; expense_threshold: number; member_join_notifications_enabled: boolean}} | null>(null);

  // Ayarları yükle (sadece Users tablosundan)
  const loadSettings = async () => {
    try {
      const { data: profileResult, error } = await supabase
        .from('users')
        .select('full_name, phone, email, month_start_day')
        .eq('id', user?.id)
        .single();

      if (!error && profileResult) {
        setUserProfile(profileResult);
        const startDay = profileResult.month_start_day || 1;
        setMonthStartDay(startDay.toString());
        
        // Profil bilgilerini state'lere yükle (Users tablosundan)
        setFullName(profileResult.full_name || "");
        setPhone(profileResult.phone || "");
        setEmail(profileResult.email || user?.email || "");
      }
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  // Bildirim ayarlarını yükle
  const loadNotificationSettings = async () => {
    try {
      if (!user?.id) return;

      const { data: notificationData, error } = await supabase
        .from('notification_preferences')
        .select('group_id, expense_notifications_enabled, expense_threshold, member_join_notifications_enabled')
        .eq('user_id', user.id);

      if (!error && notificationData) {
        const settingsMap: {[groupId: string]: {expense_notifications_enabled: boolean; expense_threshold: number; member_join_notifications_enabled: boolean}} = {};
        
        notificationData.forEach(setting => {
          settingsMap[setting.group_id] = {
            expense_notifications_enabled: setting.expense_notifications_enabled,
            expense_threshold: setting.expense_threshold || 0,
            member_join_notifications_enabled: setting.member_join_notifications_enabled
          };
        });

        setNotificationSettings(settingsMap);

        // Varsayılan değerleri ayarla (ilk grubun ayarlarını kullan)
        const firstSetting = notificationData[0];
        if (firstSetting) {
          setExpenseNotificationsEnabled(firstSetting.expense_notifications_enabled);
          setExpenseThreshold((firstSetting.expense_threshold || 0).toString());
          setMemberJoinNotificationsEnabled(firstSetting.member_join_notifications_enabled);
        }
      }
    } catch (err) {
      console.error('Bildirim ayarları yükleme hatası:', err);
    }
  };

  // Real-time gün validasyonu
  const validateDay = (day: string) => {
    if (day === "") {
      setErrors({});
      return true;
    }
    
    const num = parseInt(day);
    if (isNaN(num)) {
      setErrors({ monthStartDay: "Sadece sayı girin" });
      return false;
    }
    
    if (num < 1) {
      setErrors({ monthStartDay: "En az 1 olmalı" });
      return false;
    }
    
    if (num > 31) {
      setErrors({ monthStartDay: "En fazla 31 olabilir" });
      return false;
    }
    
    setErrors({});
    return true;
  };

  // Input değiştiğinde validasyon
  const handleDayChange = (day: string) => {
    setMonthStartDay(day);
    validateDay(day);
  };

  // Profil validasyonu
  const validateProfile = () => {
    const newErrors: any = {};
    
    if (!fullName.trim()) {
      newErrors.fullName = "Ad Soyad zorunludur";
    } else if (fullName.trim().length < 2) {
      newErrors.fullName = "Ad Soyad en az 2 karakter olmalı";
    }
    
    if (phone && !/^[0-9+\s\-()]{10,}$/.test(phone.replace(/\s/g, ''))) {
      newErrors.phone = "Geçerli bir telefon numarası girin";
    }
    
    if (!email.trim()) {
      newErrors.email = "E-posta zorunludur";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Geçerli bir e-posta adresi girin";
    }
    
    // Şifre validasyonu ayrı fonksiyonda yapılacak
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Şifre validasyonu
  const validatePassword = () => {
    const newErrors: any = {};
    
    if (!currentPassword.trim()) {
      newErrors.currentPassword = "Mevcut şifrenizi girin";
      setErrors(newErrors);
      return false;
    }
    
    if (!newPassword.trim()) {
      newErrors.newPassword = "Yeni şifrenizi girin";
      setErrors(newErrors);
      return false;
    }
    
    if (newPassword.length < 6) {
      newErrors.newPassword = "Yeni şifre en az 6 karakter olmalı";
      setErrors(newErrors);
      return false;
    }
    
    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "Şifreler eşleşmiyor";
      setErrors(newErrors);
      return false;
    }
    
    if (currentPassword === newPassword) {
      newErrors.newPassword = "Yeni şifre mevcut şifreden farklı olmalı";
      setErrors(newErrors);
      return false;
    }
    
    setErrors({});
    return true;
  };

  // Profil değişiklik kontrolü (sadece Users tablosu)
  const hasProfileChanges = () => {
    const currentFullName = userProfile?.full_name || "";
    const currentPhone = userProfile?.phone || "";
    const currentEmail = userProfile?.email || user?.email || "";
    
    return (
      fullName.trim() !== currentFullName ||
      phone.trim() !== currentPhone ||
      email.trim() !== currentEmail
    );
  };

  // Bildirim ayarları değişiklik kontrolü
  const hasNotificationChanges = () => {
    if (!notificationSettings) return true; // İlk kez ayarlanıyorsa değişiklik var sayılır
    
    // İlk grubun mevcut ayarlarını al (varsayılan olarak gösterilen)
    const firstGroupId = Object.keys(notificationSettings)[0];
    if (!firstGroupId) return true;
    
    const currentSettings = notificationSettings[firstGroupId];
    const currentThreshold = (currentSettings?.expense_threshold || 0).toString();
    
    return (
      expenseNotificationsEnabled !== currentSettings?.expense_notifications_enabled ||
      expenseThreshold !== currentThreshold ||
      memberJoinNotificationsEnabled !== currentSettings?.member_join_notifications_enabled
    );
  };

  // Dönem ayarları değişiklik kontrolü
  const hasMonthStartDayChanges = () => {
    const currentMonthStartDay = (userProfile?.month_start_day || 1).toString();
    return monthStartDay !== currentMonthStartDay;
  };

  // Profil bilgilerini kaydet
  const saveProfile = async () => {
    if (!validateProfile()) return;
    
    // Değişiklik kontrolü
    if (!hasProfileChanges()) {
      setWarningMessage("Profil bilgilerinizde herhangi bir değişiklik yapmadınız. Kaydetmek için önce bilgilerinizi düzenleyin.");
      setShowWarningModal(true);
      return;
    }
    
    // Önceki hataları temizle
    setErrors(prev => ({ ...prev, profile: undefined }));
    
    setSaving(true);
    try {
      // Sadece Users tablosunu güncelle
      const { error: profileError } = await supabase
        .from('users')
        .update({ 
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          email: email.trim()
        })
        .eq('id', user?.id);

      if (profileError) {
        
        // Profil kaydetme hatası için özel mesajlar
        let errorMessage = "Profil kaydedilemedi";
        
        if (profileError.message?.includes('duplicate key')) {
          errorMessage = "Bu e-posta adresi zaten kullanılıyor.";
        } else if (profileError.message?.includes('invalid input')) {
          errorMessage = "Girilen bilgiler geçersiz.";
        } else if (profileError.message?.includes('permission denied')) {
          errorMessage = "Bu işlem için yetkiniz bulunmuyor.";
        } else {
          errorMessage = "Profil kaydedilemedi. Lütfen tekrar deneyin.";
        }
        
        setErrors({ profile: errorMessage });
        return;
      }



      // Profil state'ini güncelle
      setUserProfile(prev => prev ? { 
        ...prev, 
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim()
      } : null);
      
      // Başarı mesajı (Auth tablosu güncellemesi olmadığı için basit)
      let message = "Profil bilgileriniz başarıyla güncellendi!";
      
      // Email değişikliği varsa bilgilendirme
      if (email.trim() !== user?.email) {
        message += "\n\nNot: E-posta değişikliği sadece profil bilgilerinizde kaydedildi. Giriş yaparken hala eski e-posta adresinizi kullanmanız gerekecek.";
      }
      
      setSuccessMessage(message);
      setShowSuccessModal(true);
    } catch (err) {
      setErrors({ profile: "Bağlantı hatası. İnternet bağlantınızı kontrol edin." });
    } finally {
      setSaving(false);
    }
  };

  // Şifre değiştirme
  const changePassword = async () => {
    if (!validatePassword()) return;
    
    // Önceki hataları temizle
    setErrors(prev => ({ ...prev, currentPassword: undefined, newPassword: undefined, confirmPassword: undefined }));
    
    setSaving(true);
    try {
      // Önce mevcut şifreyi doğrula
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || email,
        password: currentPassword
      });

      if (signInError) {
        
        // Hata tipine göre mesaj belirle
        let errorMessage = "Mevcut şifreniz yanlış";
        
        if (signInError.message?.includes('Invalid login credentials')) {
          errorMessage = "Mevcut şifreniz hatalı. Lütfen doğru şifrenizi girin.";
        } else if (signInError.message?.includes('Email not confirmed')) {
          errorMessage = "E-posta adresiniz doğrulanmamış.";
        } else if (signInError.message?.includes('Too many requests')) {
          errorMessage = "Çok fazla deneme yapıldı. Lütfen bir süre bekleyin.";
        }
        
        setErrors({ currentPassword: errorMessage });
        return;
      }

      // Şifre doğruysa yeni şifreyi güncelle
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (passwordError) {
        
        // Şifre güncelleme hatası için özel mesajlar
        let errorMessage = "Şifre güncellenemedi";
        
        if (passwordError.message?.includes('Password should be at least')) {
          errorMessage = "Şifre en az 6 karakter olmalıdır.";
        } else if (passwordError.message?.includes('Password is too weak')) {
          errorMessage = "Şifre çok zayıf. Daha güçlü bir şifre seçin.";
        } else if (passwordError.message?.includes('Same password')) {
          errorMessage = "Yeni şifre mevcut şifreden farklı olmalıdır.";
        } else {
          errorMessage = "Şifre güncellenemedi: " + passwordError.message;
        }
        
        setErrors({ newPassword: errorMessage });
        return;
      }
      
      // Şifre alanlarını temizle
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setErrors({});
      
      setSuccessMessage("Şifreniz başarıyla güncellendi!");
      setShowSuccessModal(true);
    } catch (err) {
      setErrors({ newPassword: "Bağlantı hatası. İnternet bağlantınızı kontrol edin." });
    } finally {
      setSaving(false);
    }
  };

  // Gün ayarını veritabanına kaydet
  const saveMonthStartDay = async () => {
    if (!validateDay(monthStartDay)) return;
    
    // Değişiklik kontrolü
    if (!hasMonthStartDayChanges()) {
      setWarningMessage("Dönem ayarlarınızda herhangi bir değişiklik yapmadınız. Kaydetmek için önce ayarlarınızı düzenleyin.");
      setShowWarningModal(true);
      return;
    }
    
    setSavingMonthDay(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ month_start_day: parseInt(monthStartDay) })
        .eq('id', user?.id);

      if (error) {
        console.error("Month start day save error:", error);
        Alert.alert("Hata", "Ayar kaydedilemedi: " + error.message);
        return;
      }

      setUserProfile(prev => prev ? { ...prev, month_start_day: parseInt(monthStartDay) } : null);
      setSuccessMessage(`Aylık dönem artık ${monthStartDay}. günde başlayacak.`);
      setShowSuccessModal(true);
    } catch (err) {
      console.error("Save month start day catch:", err);
      Alert.alert("Bağlantı Hatası", "İnternet bağlantınızı kontrol edin.");
    } finally {
      setSavingMonthDay(false);
    }
  };

  // Bildirim ayarlarını kaydet
  const saveNotificationSettings = async () => {
    // Değişiklik kontrolü
    if (!hasNotificationChanges()) {
      setWarningMessage("Bildirim ayarlarınızda herhangi bir değişiklik yapmadınız. Kaydetmek için önce ayarlarınızı düzenleyin.");
      setShowWarningModal(true);
      return;
    }

    setSavingNotifications(true);
    try {
      if (!user?.id) return;

      // Tüm gruplar için ayarları güncelle
      const { data: userGroups, error: groupsError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      if (groupsError) {
        console.error('Grup listesi alınamadı:', groupsError);
        Alert.alert("Hata", "Ayarlar kaydedilemedi: " + groupsError.message);
        return;
      }

      if (userGroups && userGroups.length > 0) {
        const threshold = parseFloat(expenseThreshold) || 0;

        // Her grup için bildirim ayarlarını güncelle
        const updatePromises = userGroups.map(group => 
          supabase
            .from('notification_preferences')
            .upsert({
              user_id: user.id,
              group_id: group.group_id,
              expense_notifications_enabled: expenseNotificationsEnabled,
              expense_threshold: threshold,
              member_join_notifications_enabled: memberJoinNotificationsEnabled,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'user_id, group_id'
            })
        );

        const results = await Promise.all(updatePromises);
        const hasError = results.some(result => result.error);

        if (hasError) {
          const firstError = results.find(result => result.error)?.error;
          console.error("Notification settings save error:", firstError);
          Alert.alert("Hata", "Bildirim ayarları kaydedilemedi: " + firstError?.message);
          return;
        }

        setSuccessMessage("Bildirim ayarları başarıyla güncellendi! 🔔");
        setShowSuccessModal(true);
        
        // Ayarları yeniden yükle
        await loadNotificationSettings();
      }
    } catch (err) {
      console.error("Notification settings save catch:", err);
      Alert.alert("Bağlantı Hatası", "İnternet bağlantınızı kontrol edin.");
    } finally {
      setSavingNotifications(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadNotificationSettings();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <SkeletonSettings />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Floating Geri Butonu */}
      <TouchableOpacity 
        style={styles.floatingBackButton}
        onPress={() => router.back()}
      >
        <Text style={styles.floatingBackButtonText}>◀</Text>
      </TouchableOpacity>
      
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
                  <Text style={styles.iconText}>⚙️</Text>
                </View>
                </View>
                
                <View style={styles.heroTextSection}>
                <Text style={styles.heroTitle}>Ayarlar</Text>
                <Text style={styles.heroSubtitle}>
                  Kişisel tercihlerinizi ve hesap ayarlarınızı yönetin
                  </Text>
              </View>
            </View>
          </View>
        </View>

                {/* Bildirim Ayarları */}
        <View style={styles.modernSection}>
          <View style={styles.modernSectionHeader}>
            <View style={styles.sectionIconContainer}>
              <Text style={styles.sectionIcon}>🔔</Text>
            </View>
            <Text style={styles.modernSectionTitle}>Bildirim Ayarları</Text>
          </View>

          {/* Harcama Bildirimleri */}
          <View style={styles.modernSettingRow}>
            <View style={styles.modernSettingInfo}>
              <Text style={styles.modernSettingLabel}>Harcama Bildirimleri</Text>
              <Text style={styles.modernSettingDescription}>
                Belirli tutarın üzerindeki harcamalar için bildirim al
              </Text>
            </View>
            <Switch
              value={expenseNotificationsEnabled}
              onValueChange={setExpenseNotificationsEnabled}
              trackColor={{ false: '#374151', true: '#00FF94' }}
              thumbColor={expenseNotificationsEnabled ? '#FFFFFF' : '#9CA3AF'}
              ios_backgroundColor="#374151"
            />
          </View>

          {/* Harcama Limiti */}
          {expenseNotificationsEnabled && (
            <View>
              <View style={styles.thresholdHeaderContainer}>
                <Text style={styles.modernSettingLabel}>Bildirim Limiti (₺)</Text>
              </View>
              <Text style={styles.passwordDescription}>
                Bu tutarın üzerindeki harcamalar için bildirim alacaksınız
              </Text>
              <Input
                placeholder="Örn: 100"
                value={expenseThreshold}
                onChangeText={setExpenseThreshold}
                keyboardType="numeric"
                containerStyle={styles.lastInputContainer}
              />
            </View>
          )}
              
          {/* Çizgi - Üye bildirimlerini ayırmak için */}
          <View style={[styles.passwordSection, styles.notificationSeparator]}>
            {/* Üye Katılım Bildirimleri */}
            <View style={styles.modernSettingRow}>
              <View style={styles.modernSettingInfo}>
                <Text style={styles.modernSettingLabel}>Yeni Üye Bildirimleri</Text>
                <Text style={styles.modernSettingDescription}>
                  Gruplarınıza yeni üye katıldığında bildirim al
                </Text>
              </View>
              <Switch
                value={memberJoinNotificationsEnabled}
                onValueChange={setMemberJoinNotificationsEnabled}
                trackColor={{ false: '#374151', true: '#00FF94' }}
                thumbColor={memberJoinNotificationsEnabled ? '#FFFFFF' : '#9CA3AF'}
                ios_backgroundColor="#374151"
              />
            </View>
          </View>

          {/* Bildirim Ayarlarını Kaydet Butonu */}
          <TouchableOpacity
            style={[
              styles.modernSaveButton,
              styles.saveButton,
              savingNotifications && styles.modernSaveButtonDisabled
            ]}
            onPress={saveNotificationSettings}
            disabled={savingNotifications}
          >
            <View style={styles.modernButtonContent}>
              {savingNotifications ? (
                <>
                  <Text style={styles.modernButtonIcon}>⏳</Text>
                  <Text style={styles.modernSaveButtonText}>Kaydediliyor...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.modernButtonIcon}>🔔</Text>
                  <Text style={styles.modernSaveButtonText}>Bildirimleri Kaydet</Text>
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Dönem Ayarları */}
        <View style={styles.modernSection}>
          <View style={styles.modernSectionHeader}>
            <View style={styles.sectionIconContainer}>
              <Text style={styles.sectionIcon}>📅</Text>
            </View>
            <Text style={styles.modernSectionTitle}>Dönem Ayarları</Text>
          </View>

          <View style={styles.modernSettingRow}>
            <View style={styles.modernSettingInfo}>
              <Text style={styles.modernSettingLabel}>Aylık Dönem Başlangıcı</Text>
              <Text style={styles.passwordDescription}>
                Ayın hangi gününde başlasın? (1-31 arası)
              </Text>
            </View>
          </View>
              
          <View style={styles.passwordSection}>
            <View style={styles.thresholdHeaderContainer}>
              <Text style={styles.modernSettingLabel}>Başlangıç Günü</Text>
            </View>
            <Text style={styles.passwordDescription}>
              {monthStartDay === "1" ? 
                "Normal takvim ayı kullanılacak (1-30/31)" : 
                `${monthStartDay}. günden sonraki ayın ${parseInt(monthStartDay) - 1}. gününe kadar`}
            </Text>
            <Input
              placeholder="Örn: 15"
              value={monthStartDay}
              onChangeText={handleDayChange}
              keyboardType="numeric"
              error={errors.monthStartDay}
              maxLength={2}
              containerStyle={styles.lastInputContainer}
            />
                  
            <TouchableOpacity
              style={[
                styles.modernSaveButton,
                styles.saveButton,
                (savingMonthDay || !!errors.monthStartDay || !monthStartDay.trim()) && styles.modernSaveButtonDisabled
              ]}
              onPress={saveMonthStartDay}
              disabled={savingMonthDay || !!errors.monthStartDay || !monthStartDay.trim()}
            >
              <View style={styles.modernButtonContent}>
                {savingMonthDay ? (
                  <>
                    <Text style={styles.modernButtonIcon}>⏳</Text>
                    <Text style={styles.modernSaveButtonText}>Kaydediliyor...</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.modernButtonIcon}>💾</Text>
                    <Text style={styles.modernSaveButtonText}>Kaydet</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Profil Bilgileri */}
        <View style={styles.modernSection}>
          <View style={styles.modernSectionHeader}>
            <View style={styles.sectionIconContainer}>
              <Text style={styles.sectionIcon}>👤</Text>
            </View>
            <Text style={styles.modernSectionTitle}>Profil Bilgileri</Text>
          </View>
          
          <View style={styles.profileFormContainer}>
            <Input
              label="Ad Soyad"
              placeholder="Adınızı ve soyadınızı girin"
              value={fullName}
              onChangeText={setFullName}
              error={errors.fullName}
              editable={!saving}
              containerStyle={styles.standardInputContainer}
            />
            
            <Input
              label="E-posta"
              placeholder="E-posta adresinizi girin"
              value={email}
              onChangeText={setEmail}
              error={errors.email}
              keyboardType="email-address"
              editable={!saving}
              containerStyle={styles.standardInputContainer}
            />
            
            <View style={styles.phoneContainer}>
              <View style={styles.phoneHeaderContainer}>
                <Text style={styles.phoneLabel}>Telefon</Text>
                <View style={styles.phoneBadge}>
                  <Text style={styles.phoneBadgeText}>Opsiyonel</Text>
                </View>
              </View>
              <Input
                placeholder="Telefon numaranızı girin"
                value={phone}
                onChangeText={setPhone}
                error={errors.phone}
                keyboardType="phone-pad"
                editable={!saving}
                style={styles.phoneInput}
                containerStyle={styles.lastInputContainer}
              />
            </View>
            
            <TouchableOpacity
              style={[
                styles.modernSaveButton,
                styles.saveButton,
                saving && styles.modernSaveButtonDisabled
              ]}
              onPress={saveProfile}
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
                    <Text style={styles.modernButtonIcon}>👤</Text>
                    <Text style={styles.modernSaveButtonText}>Profili Kaydet</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
            
            {/* Profil Hata Mesajı */}
            {errors.profile && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errors.profile}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Şifre Değiştirme */}
        <View style={styles.modernSection}>
          <View style={styles.modernSectionHeader}>
            <View style={styles.sectionIconContainer}>
              <Text style={styles.sectionIcon}>🔐</Text>
            </View>
            <Text style={styles.modernSectionTitle}>Şifre Değiştirme</Text>
          </View>
          
          <View style={styles.modernSettingRow}>
            <View style={styles.modernSettingInfo}>
              <Text style={styles.modernSettingLabel}>Yeni Şifre Belirle</Text>
              <Text style={styles.passwordDescription}>
                Güvenliğiniz için güçlü bir şifre seçin (en az 6 karakter)
              </Text>
            </View>
          </View>

          <View style={styles.passwordSection}>
            <Input
              label="Mevcut Şifre"
              placeholder="Mevcut şifrenizi girin"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              error={errors.currentPassword}
              secureTextEntry
              editable={!saving}
              containerStyle={styles.firstInputAfterLine}
            />
            
            <Input
              label="Yeni Şifre"
              placeholder="Yeni şifrenizi girin"
              value={newPassword}
              onChangeText={setNewPassword}
              error={errors.newPassword}
              secureTextEntry
              editable={!saving}
              containerStyle={styles.standardInputContainer}
            />
            
            <Input
              label="Şifre Tekrar"
              placeholder="Şifrenizi tekrar girin"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              error={errors.confirmPassword}
              secureTextEntry
              editable={!saving}
              containerStyle={styles.lastInputContainer}
            />
            
            <TouchableOpacity
              style={[
                styles.modernSaveButton,
                styles.saveButton,
                saving && styles.modernSaveButtonDisabled
              ]}
              onPress={changePassword}
              disabled={saving}
            >
              <View style={styles.modernButtonContent}>
                {saving ? (
                  <>
                    <Text style={styles.modernButtonIcon}>⏳</Text>
                    <Text style={styles.modernSaveButtonText}>Değiştiriliyor...</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.modernButtonIcon}>🔐</Text>
                    <Text style={styles.modernSaveButtonText}>Şifreyi Değiştir</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          </View>
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
              {successMessage}
            </Text>
            
            {/* OK Button */}
              <TouchableOpacity 
              style={styles.successButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.successButtonText}>Tamam</Text>
              </TouchableOpacity>
            </View>
          </View>
      )}

      {/* Warning Modal */}
      {showWarningModal && (
        <View style={styles.warningModalOverlay}>
          <View style={styles.warningModal}>
            {/* Header Icon */}
            <View style={styles.warningIconContainer}>
              <View style={styles.warningIconCircle}>
                <Text style={styles.warningIcon}>⚠️</Text>
              </View>
            </View>
            
            {/* Title */}
            <Text style={styles.warningTitle}>Değişiklik Yok</Text>
            
            {/* Message */}
            <Text style={styles.warningMessage}>
              {warningMessage}
            </Text>
            
            {/* OK Button */}
            <TouchableOpacity 
              style={styles.warningButton}
              onPress={() => setShowWarningModal(false)}
            >
              <Text style={styles.warningButtonText}>Anladım</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  
  // Floating Back Button
  floatingBackButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 0, 128, 0.4)',
    shadowColor: '#FF0080',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 15,
    zIndex: 1000,
  },
  floatingBackButtonText: {
    color: '#FF0080',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
    includeFontPadding: false,
    textAlignVertical: 'center',
    textShadowColor: 'rgba(255, 0, 128, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  
  futuristicHeaderContainer: { position: 'relative', overflow: 'hidden', minHeight: 140, marginBottom: 32 },
  fadeBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FF0080', opacity: 0.15 },
  fadeOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  futuristicHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 32, paddingLeft: 50, flex: 1},
  heroSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1 },
  iconContainer: { position: 'relative', marginRight: 20 },
  iconGlowRing: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: 'rgba(255, 0, 128, 0.4)', top: -6, left: -6, shadowColor: '#FF0080', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 16, elevation: 12 },
  iconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FF0080', justifyContent: 'center', alignItems: 'center', shadowColor: '#FF0080', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 24, elevation: 20, borderWidth: 3, borderColor: 'rgba(255, 255, 255, 0.3)' },
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
  
  // Tutarlı Boşluk Sistemi
  // Küçük boşluk: 8px - Input'lar arası, label'lar arası
  // Orta boşluk: 16px - Form grupları arası, buton öncesi
  // Büyük boşluk: 24px - Bölümler arası
  
  // Profil Form Container
  profileFormContainer: { gap: 0 }, // Gap'i kaldırıp manuel spacing kullanacağız
  
  // Input Containers - Tutarlı boşluklar
  standardInputContainer: { marginBottom: 16 }, // Standart input'lar arası
  lastInputContainer: { marginBottom: 8 },      // Son input ile buton arası küçük
  firstInputAfterLine: { marginTop: 8, marginBottom: 16 }, // Çizgiden sonraki ilk input
  
  // Phone Input with Badge
  phoneHeaderContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  phoneLabel: { fontSize: 14, fontWeight: '700', color: '#00D4FF', textShadowColor: 'rgba(0, 212, 255, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  phoneBadge: { backgroundColor: 'rgba(255, 149, 0, 0.15)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(255, 149, 0, 0.3)' },
  phoneBadgeText: { fontSize: 10, color: '#FF9500', fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  phoneInput: { marginTop: 0 },
  phoneContainer: { marginBottom: 8 }, // Telefon container'ı için özel spacing
  
  // Şifre Bölümü
  passwordSection: { marginTop: 0, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0, 212, 255, 0.3)' },
  passwordDescription: { fontSize: 14, color: '#B0B7C3', lineHeight: 20, marginBottom: 8, letterSpacing: 0.1 },
  
  // Bildirim ayarları çizgi boşlukları (çizgi altı için paddingTop kullan)
  notificationSeparator: { marginTop: 16, marginBottom: 0, paddingTop: 16 },
  
  // Butonlar
  saveButton: { marginTop: 16 },
  
  // Dönem Ayarları
  thresholdHeaderContainer: { marginTop: 8, marginBottom: 12 },
  
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
  
  // Warning Modal Styles
  warningModalOverlay: {
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
  warningModal: {
    backgroundColor: '#151524',
    borderRadius: 20,
    padding: 24,
    width: 300,
    borderWidth: 2,
    borderColor: '#FF9500',
    margin: 20,
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  warningIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  warningIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  warningIcon: {
    fontSize: 28,
  },
  warningTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  warningMessage: {
    fontSize: 16,
    color: '#B0B7C3',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  warningButton: {
    backgroundColor: 'rgba(255, 149, 0, 0.3)',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#FF9500',
    alignItems: 'center',
    justifyContent: 'center'
  },
  warningButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(255, 149, 0, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8
  },
  
  // Error Message Styles
  errorContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(255, 51, 102, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 51, 102, 0.3)',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3366',
    textAlign: 'center',
    fontWeight: '600',
    textShadowColor: 'rgba(255, 51, 102, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
});