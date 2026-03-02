import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/state/auth-context";
import { notificationService } from "@/services/NotificationService";

type NotificationType = 'expense_added' | 'group_joined' | 'group_created' | 'system';

type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
  data?: any;
  groups?: {
    name: string;
  };
};

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Bildirim türlerine göre emoji ve renk
  const getNotificationStyle = (type: NotificationType) => {
    switch (type) {
      case 'expense_added':
        return { emoji: '💸', color: '#FF6B6B', bgColor: 'rgba(255, 107, 107, 0.1)' };
      case 'group_joined':
        return { emoji: '👋', color: '#00D4FF', bgColor: 'rgba(0, 212, 255, 0.1)' };
      case 'group_created':
        return { emoji: '🏠', color: '#00FF94', bgColor: 'rgba(0, 255, 148, 0.1)' };
      case 'system':
        return { emoji: '⚙️', color: '#FFD700', bgColor: 'rgba(255, 215, 0, 0.1)' };
      default:
        return { emoji: '📢', color: '#9CA3AF', bgColor: 'rgba(156, 163, 175, 0.1)' };
    }
  };

  // Zaman farkı hesaplama
  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins} dakika önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays < 7) return `${diffDays} gün önce`;
    return date.toLocaleDateString('tr-TR');
  };


  // Bildirimleri yükle
  const fetchNotifications = async (isRefresh = false) => {
    if (!user?.id) return;
    
    if (isRefresh) setRefreshing(true);
    
    try {
      const notificationsData = await notificationService.getUserNotifications(user.id, 50);
      setNotifications(notificationsData);
      console.log('📱 Bildirimler yüklendi:', notificationsData.length);
    } catch (err) {
      console.error("Notification fetch error:", err);
      Alert.alert("Hata", "Bildirimler yüklenirken hata oluştu.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Bildirimi okundu olarak işaretle
  const markAsRead = async (notificationId: string) => {
    if (!user?.id) return;
    
    try {
      const success = await notificationService.markNotificationAsRead(notificationId, user.id);
      
      if (success) {
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === notificationId 
              ? { ...notification, is_read: true }
              : notification
          )
        );
      }
    } catch (err) {
      console.error("Mark as read error:", err);
    }
  };

  // Tüm bildirimleri okundu olarak işaretle
  const markAllAsRead = async () => {
    if (!user?.id) return;
    
    try {
      const success = await notificationService.markAllNotificationsAsRead(user.id);
      
      if (success) {
        setNotifications(prev => 
          prev.map(notification => ({ ...notification, is_read: true }))
        );
      }
    } catch (err) {
      console.error("Mark all as read error:", err);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
    }
  }, [user?.id]);

  // Bildirim kartını render et
  const renderNotification = (notification: NotificationItem) => {
    const style = getNotificationStyle(notification.type);
    
    return (
      <TouchableOpacity
        key={notification.id}
        style={[
          styles.notificationCard,
          { 
            backgroundColor: notification.is_read ? styles.notificationCard.backgroundColor : style.bgColor,
            borderLeftColor: style.color
          }
        ]}
        onPress={() => markAsRead(notification.id)}
      >
        <View style={styles.notificationHeader}>
          <View style={styles.notificationIcon}>
            <Text style={styles.notificationEmoji}>{style.emoji}</Text>
          </View>
          <View style={styles.notificationContent}>
            <Text style={[
              styles.notificationTitle,
              !notification.is_read && styles.notificationTitleUnread
            ]}>
              {notification.title}
            </Text>
            <Text style={styles.notificationMessage}>
              {notification.message}
            </Text>
            <Text style={styles.notificationTime}>
              {getTimeAgo(notification.created_at)}
            </Text>
          </View>
          {!notification.is_read && (
            <View style={[styles.unreadDot, { backgroundColor: style.color }]} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.container}>
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchNotifications(true)}
              tintColor="#00D4FF"
              colors={['#00D4FF']}
            />
          }
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
                <Text style={styles.heroTitle}>Bildirimler</Text>
                <Text style={styles.heroSubtitle}>
                  {unreadCount > 0 
                    ? `${unreadCount} okunmamış bildirim`
                    : 'Tüm bildirimler okundu'
                  }
                  </Text>
              </View>
            </View>
          </View>
        </View>

          {/* Tümünü Okundu İşaretle Butonu */}
          {unreadCount > 0 && (
            <View style={styles.actionButtonContainer}>
              <TouchableOpacity 
                style={styles.markAllButton}
                onPress={markAllAsRead}
              >
                <Text style={styles.markAllButtonText}>✓ Tümünü Okundu İşaretle</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Bildirimler */}
          <View style={styles.notificationsSection}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Bildirimler yükleniyor...</Text>
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>📪 Bildirim Yok</Text>
                <Text style={styles.emptyText}>
                  Henüz hiç bildirimin yok. Grup etkinlikleri ve harcamalar hakkında bildirimler burada görünecek.
                </Text>
              </View>
            ) : (
              notifications.map(renderNotification)
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
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
  
  // Action Button
  actionButtonContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  markAllButton: {
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
    borderWidth: 2,
    borderColor: '#00D4FF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  markAllButtonText: {
    color: '#00D4FF',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 212, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  
  // Notifications Section
  notificationsSection: {
    paddingHorizontal: 20,
  },
  notificationCard: {
    backgroundColor: '#151524',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#16213E',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationEmoji: {
    fontSize: 20,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  notificationTitleUnread: {
    fontWeight: '700',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 6,
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
    marginTop: 6,
  },
  
  // Loading & Empty States
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
  },
});