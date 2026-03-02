import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Bildirim davranışını ayarla
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationPreference {
  id: string;
  user_id: string;
  group_id: string;
  expense_notifications_enabled: boolean;
  expense_threshold: number;
  member_join_notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export class NotificationService {
  private subscriptions: Map<string, any> = new Map();
  private userPreferences: Map<string, NotificationPreference> = new Map();
  private pushToken: string | null = null;

  // Kullanıcının bildirim tercihlerini getir
  async getUserPreferences(userId: string, householdId: string): Promise<NotificationPreference | null> {
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .eq('group_id', householdId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        logger.error('Error fetching notification preferences:', error);
        return null;
      }

      return data;
    } catch (err) {
      logger.error('Error in getUserPreferences:', err);
      return null;
    }
  }

  // Bildirim tercihlerini kaydet/güncelle
  async saveUserPreferences(preferences: Partial<NotificationPreference>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert(preferences, {
          onConflict: 'user_id,group_id'
        });

      if (error) {
        logger.error('Error saving notification preferences:', error);
        return false;
      }

      // Cache'i güncelle
      if (preferences.user_id && preferences.group_id) {
        const key = `${preferences.user_id}_${preferences.group_id}`;
        const existing = this.userPreferences.get(key);
        this.userPreferences.set(key, { ...existing, ...preferences } as NotificationPreference);
      }

      return true;
    } catch (err) {
      logger.error('Error in saveUserPreferences:', err);
      return false;
    }
  }

  // Varsayılan tercihleri oluştur (kullanıcı eve katıldığında)
  async createDefaultPreferences(userId: string, householdId: string): Promise<boolean> {
    const defaultPreferences = {
      user_id: userId,
      group_id: householdId,
      expense_notifications_enabled: true,
      expense_threshold: 0, // Tüm harcamalar için bildirim
      member_join_notifications_enabled: true
    };

    return await this.saveUserPreferences(defaultPreferences);
  }

  // Bir ev için harcama bildirimlerini dinlemeye başla
  async subscribeToHouseholdExpenses(householdId: string, currentUserId: string) {
    // Eğer zaten dinliyorsak, önce kapat
    this.unsubscribeFromHousehold(householdId);

    // Kullanıcının bildirim tercihlerini al
    const preferences = await this.getUserPreferences(currentUserId, householdId);
    
    // Harcama bildirimleri kapalıysa dinleme
    if (!preferences?.expense_notifications_enabled) {
      return;
    }

    const subscription = supabase
      .channel(`expenses_${householdId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'expenses',
          filter: `group_id=eq.${householdId}`
        },
        async (payload) => {
          // Kendi eklediği harcama için bildirim gösterme
          if (payload.new.created_by === currentUserId) return;

          // Alt sınır kontrolü
          const threshold = preferences?.expense_threshold || 0;
          if (payload.new.amount < threshold) return;

          // Harcamayı ekleyen kişinin bilgilerini al
          const { data: userData } = await supabase
            .from('users')
            .select('full_name, email')
            .eq('id', payload.new.created_by)
            .single();

          const userName = userData?.full_name || userData?.email || 'Bir ev arkadaşınız';
          
          Alert.alert(
            "💰 Yeni Harcama",
            `${userName} ${threshold > 0 ? `₺${threshold} üstü ` : ''}yeni bir harcama ekledi:\n\n"${payload.new.title}"\n₺${payload.new.amount}`,
            [
              { text: "Tamam", style: "default" },
              { text: "Detayları Gör", onPress: () => {
                router.push(`/(home)/group/${householdId}`);
              }}
            ]
          );
        }
      )
      .subscribe();

    this.subscriptions.set(`expenses_${householdId}`, subscription);
  }

  // Üye katılma bildirimlerini dinle
  async subscribeToHouseholdMembers(householdId: string, currentUserId: string) {
    // Kullanıcının bildirim tercihlerini al
    const preferences = await this.getUserPreferences(currentUserId, householdId);
    
    // Üye katılma bildirimleri kapalıysa dinleme
    if (!preferences?.member_join_notifications_enabled) {
      return;
    }

    const subscription = supabase
      .channel(`members_${householdId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_members',
          filter: `group_id=eq.${householdId}`
        },
        async (payload) => {
          // Kendi katılması için bildirim gösterme
          if (payload.new.user_id === currentUserId) return;

          // Katılan kişinin bilgilerini al
          const { data: userData } = await supabase
            .from('users')
            .select('full_name, email')
            .eq('id', payload.new.user_id)
            .single();

          // Ev bilgilerini al
          const { data: householdData } = await supabase
            .from('groups')
            .select('name')
            .eq('id', householdId)
            .single();

          const userName = userData?.full_name || userData?.email || 'Yeni bir kullanıcı';
          const householdName = householdData?.name || 'evinize';
          
          Alert.alert(
            "👋 Yeni Üye",
            `${userName} ${householdName} katıldı!`,
            [
              { text: "Tamam", style: "default" },
              { text: "Ev Detayını Gör", onPress: () => {
                router.push(`/(home)/group/${householdId}`);
              }}
            ]
          );
        }
      )
      .subscribe();

    this.subscriptions.set(`members_${householdId}`, subscription);
  }

  // Bir ev için tüm bildirimleri başlat
  async subscribeToHousehold(householdId: string, currentUserId: string) {
    await Promise.all([
      this.subscribeToHouseholdExpenses(householdId, currentUserId),
      this.subscribeToHouseholdMembers(householdId, currentUserId)
    ]);
  }

  // Bir evden dinlemeyi durdur
  unsubscribeFromHousehold(householdId: string) {
    const expenseSubscription = this.subscriptions.get(`expenses_${householdId}`);
    const memberSubscription = this.subscriptions.get(`members_${householdId}`);
    
    if (expenseSubscription) {
      expenseSubscription.unsubscribe();
      this.subscriptions.delete(`expenses_${householdId}`);
    }
    
    if (memberSubscription) {
      memberSubscription.unsubscribe();
      this.subscriptions.delete(`members_${householdId}`);
    }
  }

  // Tüm dinlemeleri durdur
  unsubscribeAll() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.subscriptions.clear();
    this.userPreferences.clear();
  }

  // Tercih cache'ini temizle
  clearPreferencesCache() {
    this.userPreferences.clear();
  }

  // Push notification izni al ve token'ı kaydet
  async requestPermissionsAndGetToken(userId: string): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        logger.log('📱 Emülatörde push notification çalışmaz');
        return null;
      }

      // İzin kontrolü
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        logger.log('❌ Push notification izni verilmedi');
        return null;
      }

      // Push token al (development için güvenli)
      let token;
      try {
        token = await Notifications.getExpoPushTokenAsync();
      } catch (tokenError) {
        logger.log('⚠️ Expo push token alınamadı, local notification kullanılacak:', tokenError);
        // Local notification için dummy token döndür
        this.pushToken = 'local-notification-only';
        return this.pushToken;
      }

      this.pushToken = token.data;
      logger.log('🔑 Push token alındı:', this.pushToken);

      // Token'ı kullanıcı tablosuna kaydet (opsiyonel)
      await this.savePushTokenToUser(userId, this.pushToken);

      return this.pushToken;
    } catch (error) {
      logger.error('❌ Push token alma hatası:', error);
      return null;
    }
  }

  // Push token'ı kullanıcı tablosuna kaydet
  private async savePushTokenToUser(userId: string, token: string): Promise<void> {
    try {
      // Önce users tablosuna push_token sütunu eklenmeli
      // Şimdilik sadece log
      logger.log('💾 Push token kaydedilecek:', { userId, token });
      
      // TODO: Supabase'de users tablosuna push_token sütunu ekle
      // const { error } = await supabase
      //   .from('users')
      //   .update({ push_token: token })
      //   .eq('id', userId);
    } catch (error) {
      logger.error('❌ Push token kaydetme hatası:', error);
    }
  }

  // Veritabanına bildirim kaydet
  async saveNotificationToDatabase(
    userId: string,
    groupId: string | null,
    type: 'expense_added' | 'member_joined' | 'group_created' | 'system',
    title: string,
    message: string,
    data?: any
  ): Promise<string | null> {
    try {
      const { data: notificationData, error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          group_id: groupId,
          type: type,
          title: title,
          message: message,
          data: data || {},
          is_read: false
        })
        .select('id')
        .single();

      if (error) {
        logger.error('❌ Bildirim veritabanına kaydedilemedi:', error);
        return null;
      }

      logger.log('💾 Bildirim veritabanına kaydedildi:', notificationData.id);
      return notificationData.id;
    } catch (error) {
      logger.error('❌ Bildirim kaydetme hatası:', error);
      return null;
    }
  }

  // Kullanıcının tüm bildirimlerini getir
  async getUserNotifications(userId: string, limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          groups(name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('❌ Kullanıcı bildirimleri alınamadı:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('❌ Bildirim getirme hatası:', error);
      return [];
    }
  }

  // Okunmamış bildirim sayısını getir
  async getUnreadNotificationCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        logger.error('❌ Okunmamış bildirim sayısı alınamadı:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      logger.error('❌ Okunmamış sayı getirme hatası:', error);
      return 0;
    }
  }

  // Bildirimi okundu olarak işaretle
  async markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', userId); // Güvenlik için

      if (error) {
        logger.error('❌ Bildirim okundu işaretlenemedi:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('❌ Okundu işaretleme hatası:', error);
      return false;
    }
  }

  // Tüm bildirimleri okundu işaretle
  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        logger.error('❌ Tüm bildirimler okundu işaretlenemedi:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('❌ Toplu okundu işaretleme hatası:', error);
      return false;
    }
  }

  // Gerçek push notification gönder
  async sendPushNotification(
    title: string,
    body: string,
    data?: any,
    targetUserId?: string
  ): Promise<void> {
    try {
      if (!Device.isDevice) {
        logger.log('📱 [SIMULATED PUSH]', { title, body, data });
        return;
      }

      // Şimdilik local notification gönder
      // Gerçek push için Expo Push API kullanılmalı
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: 'default',
        },
        trigger: null, // Hemen gönder
      });

      logger.log('📱 Push notification gönderildi:', { title, body });

    } catch (error) {
      logger.error('❌ Push notification gönderme hatası:', error);
    }
  }

  // Harcama bildirimi gönder
  async sendExpenseNotification(
    groupId: string, 
    expenseAmount: number, 
    expenseTitle: string, 
    createdByUserId: string
  ): Promise<void> {
    try {
      logger.log('🔔 Harcama bildirimi kontrol ediliyor...', {
        groupId,
        expenseAmount,
        expenseTitle,
        createdByUserId
      });

      // Gruptaki tüm üyeleri al (harcamayı ekleyen hariç)
      const { data: groupMembers, error: membersError } = await supabase
        .from('group_members')
        .select('user_id, users!inner(full_name, email)')
        .eq('group_id', groupId)
        .neq('user_id', createdByUserId); // Harcamayı ekleyen kişi hariç

      if (membersError) {
        logger.error('❌ Grup üyeleri alınamadı:', membersError);
        return;
      }

      if (!groupMembers || groupMembers.length === 0) {
        logger.log('📝 Bildirim gönderilecek üye bulunamadı');
        return;
      }

      // Her üye için bildirim tercihlerini kontrol et
      for (const member of groupMembers) {
        const preferences = await this.getUserPreferences(member.user_id, groupId);
        
        if (preferences && 
            preferences.expense_notifications_enabled && 
            expenseAmount > preferences.expense_threshold) {
          
          logger.log(`🔔 ${(member.users as any).full_name} için bildirim gönderiliyor...`);
          
          // Veritabanına bildirim kaydet
          await this.saveNotificationToDatabase(
            member.user_id,
            groupId,
            'expense_added',
            'Yeni Harcama Eklendi',
            `${expenseTitle} için ₺${expenseAmount} tutarında harcama eklendi`,
            { 
              expense_amount: expenseAmount,
              expense_title: expenseTitle,
              created_by: createdByUserId
            }
          );

          // Gerçek push notification gönder
          await this.sendPushNotification(
            `💰 Yeni Harcama: ${expenseTitle}`,
            `₺${expenseAmount} tutarında harcama eklendi`,
            { 
              type: 'expense',
              groupId, 
              expenseAmount,
              expenseTitle 
            },
            member.user_id
          );
        } else {
          logger.log(`🔕 ${(member.users as any).full_name} için bildirim gönderilmiyor (ayarlar: ${preferences?.expense_notifications_enabled}, limit: ${preferences?.expense_threshold})`);
        }
      }

    } catch (error) {
      logger.error('❌ Harcama bildirimi gönderme hatası:', error);
    }
  }

  // Üye katılım bildirimi gönder
  async sendMemberJoinNotification(
    groupId: string,
    newMemberName: string,
    newMemberUserId: string
  ): Promise<void> {
    try {
      logger.log('👥 Üye katılım bildirimi kontrol ediliyor...', {
        groupId,
        newMemberName,
        newMemberUserId
      });

      // Gruptaki mevcut üyeleri al (yeni katılan hariç)
      const { data: groupMembers, error: membersError } = await supabase
        .from('group_members')
        .select('user_id, users!inner(full_name, email)')
        .eq('group_id', groupId)
        .neq('user_id', newMemberUserId); // Yeni katılan kişi hariç

      if (membersError) {
        logger.error('❌ Grup üyeleri alınamadı:', membersError);
        return;
      }

      if (!groupMembers || groupMembers.length === 0) {
        logger.log('📝 Bildirim gönderilecek mevcut üye bulunamadı');
        return;
      }

      // Grup adını al
      const { data: groupData } = await supabase
        .from('groups')
        .select('name')
        .eq('id', groupId)
        .single();

      const groupName = groupData?.name || 'Grup';

      // Her üye için bildirim tercihlerini kontrol et
      for (const member of groupMembers) {
        const preferences = await this.getUserPreferences(member.user_id, groupId);
        
        if (preferences && preferences.member_join_notifications_enabled) {
          logger.log(`👥 ${(member.users as any).full_name} için üye katılım bildirimi gönderiliyor...`);
          
          // Veritabanına bildirim kaydet
          await this.saveNotificationToDatabase(
            member.user_id,
            groupId,
            'member_joined',
            'Yeni Üye Katıldı',
            `${newMemberName} "${groupName}" grubuna katıldı`,
            { 
              new_member_name: newMemberName,
              new_member_id: newMemberUserId,
              group_name: groupName
            }
          );

          // Gerçek push notification gönder
          await this.sendPushNotification(
            `👥 Yeni Üye: ${groupName}`,
            `${newMemberName} gruba katıldı`,
            { 
              type: 'member_join',
              groupId, 
              newMemberName,
              groupName
            },
            member.user_id
          );
        } else {
          logger.log(`🔕 ${(member.users as any).full_name} için üye katılım bildirimi gönderilmiyor (ayarlar: ${preferences?.member_join_notifications_enabled})`);
        }
      }

    } catch (error) {
      logger.error('❌ Üye katılım bildirimi gönderme hatası:', error);
    }
  }
}

export const notificationService = new NotificationService();
