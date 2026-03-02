import React, { useEffect, useState } from "react";
import { View, Text, Alert, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/state/auth-context";
import Button from "@/components/ui/Button";
import { notificationService } from "@/services/NotificationService";
import { UserHouseholdPreferencesService } from "@/services/UserHouseholdPreferencesService";

type GroupData = {
  id: string;
  name: string;
  description?: string;
};

export default function JoinGroup() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<GroupData | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!token) {
      Alert.alert("Hata", "Geçersiz davet linki.");
      router.replace("/(home)/");
      return;
    }

    if (!user) {
      // Kullanıcı giriş yapmamış, login sayfasına yönlendir
      Alert.alert(
        "Giriş Gerekli", 
        "Gruba katılmak için önce giriş yapmalısınız.",
        [
          { text: "İptal", onPress: () => router.replace("/(home)/") },
          { text: "Giriş Yap", onPress: () => router.replace("/(auth)/login") }
        ]
      );
      return;
    }

    checkGroupAndJoin();
  }, [token, user]);

  const checkGroupAndJoin = async () => {
    if (!token || !user) return;

    try {
      // 1. Davet koduna göre grubu bul
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('id, name, description')
        .eq('invite_code', token.toUpperCase())
        .single();

      if (groupError || !groupData) {
        Alert.alert("Hata", "Geçersiz davet kodu. Grup bulunamadı.", [
          { text: "Ana Sayfaya Dön", onPress: () => router.replace("/(home)/") }
        ]);
        return;
      }

      setGroup(groupData);

      // 2. Zaten üye mi kontrol et
      const { data: existingMember } = await supabase
        .from('group_members')
        .select('id')
        .eq('group_id', groupData.id)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        Alert.alert(
          "Bilgi", 
          `"${groupData.name}" grubuna zaten üyesiniz!`,
          [{ text: "Ana Sayfaya Dön", onPress: () => router.replace("/(home)/") }]
        );
        return;
      }

      setLoading(false);

    } catch (err) {
      console.error("Check group error:", err);
      Alert.alert("Bağlantı Hatası", "İnternet bağlantınızı kontrol edin.", [
        { text: "Ana Sayfaya Dön", onPress: () => router.replace("/(home)/") }
      ]);
    }
  };

  const joinGroup = async () => {
    if (!group || !user) return;

    setJoining(true);

    try {
      // Gruba katıl
      const { error: joinError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user.id,
          role: 'member'
        });

      if (joinError) {
        console.error("Join group error:", joinError);
        Alert.alert("Hata", "Gruba katılırken hata oluştu: " + joinError.message);
        return;
      }

      // Varsayılan bildirim tercihlerini oluştur
      await notificationService.createDefaultPreferences(user.id, group.id);

      // Akıllı renk seçimi ile kullanıcı tercihlerini oluştur
      await UserHouseholdPreferencesService.createDefaultPreference(user.id, group.id);

      // Mevcut üyelere yeni katılım bildirimi gönder
      const userFullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Yeni Üye';
      await notificationService.sendMemberJoinNotification(
        group.id,
        userFullName,
        user.id
      );

      Alert.alert(
        "🎉 Harika!", 
        `"${group.name}" grubuna başarıyla katıldınız!\n\n${group.description || 'Hoş geldiniz!'}`,
        [{ text: "Ana Sayfaya Dön", onPress: () => router.replace("/(home)/") }]
      );

    } catch (err) {
      console.error("Join group catch:", err);
      Alert.alert("Bağlantı Hatası", "İnternet bağlantınızı kontrol edin.");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <>
        <StatusBar style="light" />
        <SafeAreaView style={styles.container}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00D4FF" />
            <Text style={styles.loadingText}>Davet kontrol ediliyor...</Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  if (!group) {
    return (
      <>
        <StatusBar style="light" />
        <SafeAreaView style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Grup Bulunamadı</Text>
            <Text style={styles.errorText}>Bu davet linki geçersiz veya süresi dolmuş.</Text>
            <Button
              title="Ana Sayfaya Dön"
              onPress={() => router.replace("/(home)/")}
              variant="outline"
              style={styles.button}
            />
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>🎉 Gruba Davetlisin!</Text>
            <Text style={styles.subtitle}>SplitApp ile harcamalarını paylaş</Text>
            <Text style={styles.codeInfo}>Davet Kodu: {token}</Text>
          </View>

          {/* Grup Bilgileri */}
          <View style={styles.groupCard}>
            <View style={styles.groupIconContainer}>
              <Text style={styles.groupIcon}>👥</Text>
            </View>
            <Text style={styles.groupName}>{group.name}</Text>
            {group.description && (
              <Text style={styles.groupDescription}>{group.description}</Text>
            )}
          </View>

          {/* Açıklama */}
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Bu gruba katılarak harcamalarını arkadaşlarınla paylaşabilir, 
              hesapları kolayca bölebilir ve kimse kimseyi unutmaz!
            </Text>
          </View>

          {/* Butonlar */}
          <View style={styles.buttonsContainer}>
            <Button
              title="Gruba Katıl"
              onPress={joinGroup}
              loading={joining}
              disabled={joining}
              style={styles.joinButton}
              textStyle={styles.joinButtonText}
            />
            
            <Button
              title="İptal"
              onPress={() => router.replace("/(home)/")}
              variant="outline"
              style={styles.cancelButton}
              disabled={joining}
            />
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: '#00FF94',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#00D4FF',
    textAlign: 'center',
  },
  codeInfo: {
    fontSize: 18,
    color: '#00FF94',
    textAlign: 'center',
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: 2,
  },
  groupCard: {
    backgroundColor: '#151524',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#00FF94',
    shadowColor: '#00FF94',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  groupIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#00FF94',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupIcon: {
    fontSize: 24,
  },
  groupName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  groupDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  infoCard: {
    backgroundColor: '#151524',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#16213E',
  },
  infoText: {
    fontSize: 14,
    color: '#B0B7C3',
    lineHeight: 22,
    textAlign: 'center',
  },
  buttonsContainer: {
    gap: 12,
  },
  joinButton: {
    backgroundColor: '#00FF94',
    borderColor: '#00FF94',
  },
  joinButtonText: {
    color: '#000000',
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: '#151524',
  },
  button: {
    marginTop: 20,
  },
});
