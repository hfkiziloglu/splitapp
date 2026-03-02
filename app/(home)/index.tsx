import { useState, useEffect, useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, Alert, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, FlatList, Modal, BackHandler } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/state/auth-context";
import GroupCard from "@/components/ui/GroupCard";
import SkeletonGroupCard from "@/components/ui/SkeletonGroupCard";
import FloatingActionButton from "@/components/ui/FloatingActionButton";

import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { UserHouseholdPreferencesService, GroupWithPreferences } from '@/services/UserHouseholdPreferencesService';
import { notificationService } from '@/services/NotificationService';


type Group = {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  member_count?: number;
  total_expenses?: number;
};

export default function Home() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupWithPreferences[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expenseLoading, setExpenseLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{full_name?: string; month_start_day?: number} | null>(null);
  const [monthStartDay, setMonthStartDay] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  
  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editGroups, setEditGroups] = useState<GroupWithPreferences[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Color picker modal states - Grup detay sayfasındaki gibi
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  
  // Logout modal state
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [fabShouldClose, setFabShouldClose] = useState(false);
  
  // Notification badge state
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  
  // FlatList ref'leri
  const flatListRef = useRef<FlatList>(null);
  const draggableListRef = useRef<any>(null);
  
  // Grup renkleri paleti - 8 canlı renk (grup detay sayfası ile senkron)
  const memberColors = [
    { bg: '#FF0080', shadow: '#FF0080', lightBg: 'rgba(255, 0, 128, 0.12)' },   // Neon Pink
    { bg: '#00D4FF', shadow: '#00D4FF', lightBg: 'rgba(0, 212, 255, 0.12)' },   // Electric Blue
    { bg: '#00FF94', shadow: '#00FF94', lightBg: 'rgba(0, 255, 148, 0.12)' },   // Neon Green
    { bg: '#FFD700', shadow: '#FFD700', lightBg: 'rgba(255, 215, 0, 0.12)' },   // Gold
    { bg: '#FF6B6B', shadow: '#FF6B6B', lightBg: 'rgba(255, 107, 107, 0.12)' }, // Coral Red
    { bg: '#9B59B6', shadow: '#9B59B6', lightBg: 'rgba(155, 89, 182, 0.12)' },  // Purple
    { bg: '#FF9500', shadow: '#FF9500', lightBg: 'rgba(255, 149, 0, 0.12)' },   // Bright Orange
    { bg: '#1ABC9C', shadow: '#1ABC9C', lightBg: 'rgba(26, 188, 156, 0.12)' }   // Turquoise
  ];
  


  // Veritabanı bağlantısını test et (gerektiğinde kullanmak için)
  const testDatabaseConnection = async () => {
    try {
      console.log('🔍 Testing database connection...');
      
      // Basit bağlantı testi
      const { data, error } = await supabase
        .from('groups')
        .select('id')
        .limit(1);
      
      if (error) {
        console.error('❌ Database connection failed:', error);
        return false;
      }
      
      console.log('✅ Database connection successful');
      return true;
    } catch (err) {
      console.error('❌ Database test error:', err);
      return false;
    }
  };

  // Mevcut AsyncStorage verilerini migrate et
  const migrateAsyncStorageData = async () => {
    try {
      if (user?.id) {
        await UserHouseholdPreferencesService.migrateFromAsyncStorage(user.id);
      }
    } catch (err) {
      console.error("Migration error:", err);
    }
  };

  // Okunmamış bildirim sayısını yükle
  const loadUnreadNotificationCount = async () => {
    try {
      if (!user?.id) return;
      
      const count = await notificationService.getUnreadNotificationCount(user.id);
      setUnreadNotificationCount(count);
    } catch (err) {
      console.error("Load unread count error:", err);
    }
  };

  // Push notification izni al ve eksik tercihleri oluştur
  const setupPushNotifications = async () => {
    try {
      if (!user?.id) {
        console.log('⚠️ Kullanıcı giriş yapmamış, push notification setup atlanıyor');
        return;
      }

      const { notificationService } = await import("@/services/NotificationService");
      await notificationService.requestPermissionsAndGetToken(user.id);
      
      // Mevcut kullanıcının tüm grupları için bildirim tercihleri var mı kontrol et
      await ensureNotificationPreferencesExist();
      
      // Okunmamış bildirim sayısını yükle
      await loadUnreadNotificationCount();
    } catch (err) {
      console.error("Push notification setup error:", err);
    }
  };

  // Mevcut kullanıcının tüm grupları için bildirim tercihleri oluştur (sadece ilk giriş için)
  const ensureNotificationPreferencesExist = async () => {
    try {
      if (!user?.id) {
        console.log('⚠️ Kullanıcı ID yok, bildirim tercihleri oluşturulamıyor');
        return;
      }

      // Çıkış işlemi sırasında çalışmaması için auth durumunu kontrol et
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('⚠️ Kullanıcı session yok, bildirim tercihleri oluşturulmayacak');
        return;
      }
      
      const { notificationService } = await import("@/services/NotificationService");
      
      // Kullanıcının üye olduğu grupları al
      const { data: userGroups, error: groupsError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);
      
      if (groupsError) {
        console.log('⚠️ Grup listesi alınamadı (çıkış işlemi olabilir):', groupsError);
        return;
      }
      
      if (userGroups && userGroups.length > 0) {
        console.log(`📋 ${userGroups.length} grup için bildirim tercihleri kontrol ediliyor...`);
        
        // Her grup için varsayılan tercih oluştur (eğer yoksa)
        for (const group of userGroups) {
          try {
            await notificationService.createDefaultPreferences(user.id, group.group_id);
          } catch (prefError: any) {
            // RLS hatası normal olabilir (çıkış işlemi sırasında)
            if (prefError.code === '42501') {
              console.log('⚠️ RLS policy hatası - çıkış işlemi sırasında normal');
            } else if (prefError.code === '23505') {
              console.log('📝 Bildirim tercihi zaten mevcut');
            } else {
              console.error('Bildirim tercihi oluşturma hatası:', prefError);
            }
          }
        }
      }
    } catch (err) {
      console.log('⚠️ Notification preferences ensure error (çıkış işlemi olabilir):', err);
    }
  };

  // Edit mode toggle
  const toggleEditMode = async () => {
    if (isEditMode) {
      // Edit modundan normal moda geçiş
      saveEditChanges();
    } else {
      // Normal moddan edit moduna geçiş
      setEditGroups([...groups]);
      setIsEditMode(true);
      setHasChanges(false);
    }
  };

  // Edit mode değişikliklerini kaydet
  const saveEditChanges = async () => {
    if (!hasChanges || !user?.id) {
      setIsEditMode(false);
      return;
    }

    try {
      setIsSaving(true);
      
      // Sıralama değişikliklerini kaydet
      const newOrder = editGroups.map(g => g.id);
      await UserHouseholdPreferencesService.updateHouseholdOrder(user.id, newOrder);
      
      // Renk değişikliklerini kaydet
      for (const group of editGroups) {
        const originalGroup = groups.find(g => g.id === group.id);
        if (originalGroup && group.custom_color !== originalGroup.custom_color) {
          await UserHouseholdPreferencesService.updateHouseholdColor(
            user.id, 
            group.id, 
            group.custom_color || null
          );
        }
      }
      
      // Ana listeyi güncelle
      setGroups(editGroups);
      setIsEditMode(false);
      setHasChanges(false);
      
    } catch (err) {
      console.error("❌ Save edit changes error:", err);
      Alert.alert("Hata", "Değişiklikler kaydedilemedi. Lütfen tekrar deneyin.");
    } finally {
      setIsSaving(false);
    }
  };

    // Renk seçici aç
  const openColorPicker = (groupId: string) => {
    if (!isEditMode) return;
    
    setSelectedGroup(groupId);
    setShowColorPicker(true);
  };

  const handleColorChange = async (groupId: string, colorIndex: number) => {
    const selectedColor = memberColors[colorIndex].bg;
    
    setEditGroups(prev => 
      prev.map(group => 
        group.id === groupId 
          ? { 
              ...group, 
              custom_color: selectedColor,
              display_color: selectedColor
            } 
          : group
      )
    );
    
    setHasChanges(true);
    setShowColorPicker(false);
    setSelectedGroup(null);
  };

  // Grup sıralamasını kaydet (normal mod için)
  const saveGroupOrder = useCallback(
    async (newOrder: string[]) => {
      if (isSaving) return;
      
      try {
        if (user?.id) {
          setIsSaving(true);
          await UserHouseholdPreferencesService.updateHouseholdOrder(user.id, newOrder);
        }
      } catch (err) {
        console.error("❌ Save group order error:", err);
        Alert.alert("Hata", "Sıralama kaydedilemedi. Lütfen tekrar deneyin.");
      } finally {
        setIsSaving(false);
      }
    },
    [user?.id, isSaving]
  );

  // Tarih formatını string'e çevir (timezone-safe)
  const formatDateToString = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // Bu ayın periyodunu hesapla (basit ve güvenli)
  const getCurrentPeriodRange = (startDay?: number) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const currentDay = now.getDate();
    const effectiveStartDay = startDay ?? monthStartDay;

    let periodStart: Date, periodEnd: Date;
    
    if (currentDay >= effectiveStartDay) {
      // Bu ayın dönemindeyiz
      periodStart = new Date(year, month, effectiveStartDay);
      periodEnd = new Date(year, month + 1, effectiveStartDay - 1);
    } else {
      // Geçen ayın dönemindeyiz
      periodStart = new Date(year, month - 1, effectiveStartDay);
      periodEnd = new Date(year, month, effectiveStartDay - 1);
    }
    
    return {
      start: formatDateToString(periodStart),
      end: formatDateToString(periodEnd)
    };
  };

  // User profile'ı çek
  const fetchUserProfile = async (shouldFetchHouseholds = true) => {
    if (!user?.id) return;
    
    if (shouldFetchHouseholds) {
      setExpenseLoading(true); // Harcama verileri yüklenirken
    }
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('full_name, month_start_day')
        .eq('id', user.id)
        .single();
        
      if (!error && data) {
        setUserProfile(data);
        // Veritabanından gelen month_start_day değerini kullan, null ise 1 default
        const startDay = data.month_start_day ?? 1;
        setMonthStartDay(startDay);
        
        // Eğer groups da çekilmesi gerekiyorsa, fresh startDay ile çek
        if (shouldFetchHouseholds) {
          await fetchGroups(false, startDay);
          setExpenseLoading(false); // Harcama verileri yüklendi
        }
      } else if (error) {
        console.error("User profile fetch error:", error);
        // Hata durumunda default değerle devam et
        setMonthStartDay(1);
        if (shouldFetchHouseholds) {
          await fetchGroups(false, 1);
          setExpenseLoading(false);
        }
      }
    } catch (err) {
      console.error("User profile fetch error:", err);
      if (shouldFetchHouseholds) {
        await fetchGroups(false, 1);
        setExpenseLoading(false);
      }
    }
  };

  const fetchGroups = async (isRefresh = false, overrideStartDay?: number) => {
    if (isRefresh) setRefreshing(true);
    
    try {
      if (!user?.id) {
        console.log('❌ No user ID available for fetching groups');
        setGroups([]);
        return;
      }
      
      // Kullanıcının üye olduğu grupları getir
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          groups(
            id,
            name, 
            description,
            created_at,
            invite_code
          )
        `)
        .eq('user_id', user?.id);

      if (error) {
        console.error("Fetch groups error:", error);
        Alert.alert("Hata", `Gruplar yüklenirken hata oluştu: ${error.message}`);
        return;
      }

      if (!data || data.length === 0) {
        console.log('⚠️ No groups found for user');
        setGroups([]);
        return;
      }

      // Her grup için istatistikleri paralel olarak çek
      const validGroups = (data || [])
        .map(member => {
          const group = Array.isArray(member.groups) 
            ? member.groups[0] 
            : member.groups;
          return group;
        })
        .filter((group): group is NonNullable<typeof group> => {
          return group !== null && group !== undefined && group.id;
        });

      if (validGroups.length === 0) {
        console.log('⚠️ No valid groups found after filtering');
        setGroups([]);
        return;
      }

      console.log(`✅ Found ${validGroups.length} valid groups`);

      const groupsWithRealStats = await Promise.all(
        validGroups
          .map(async (group) => {
            // Paralel olarak grup üye sayısı ve toplam harcama çek
            const [memberCountResult, totalExpensesResult] = await Promise.all([
              // Gerçek üye sayısı
              supabase
                .from('group_members')
                .select('*', { count: 'exact', head: true })
                .eq('group_id', group.id),
              
              // Bu periyottaki harcamalar
              (() => {
                const effectiveStartDay = overrideStartDay ?? monthStartDay;
                const periodRange = getCurrentPeriodRange(effectiveStartDay);
                console.log(`🏠 Ana Sayfa Periyot Debug - ${group.name}:`, {
                  currentTime: new Date().toISOString(),
                  currentDay: new Date().getDate(),
                  monthStartDay: effectiveStartDay,
                  periodRange: periodRange,
                  groupId: group.id
                });
                const expenseQuery = supabase
                  .from('expenses')
                  .select('amount, expense_date')
                  .eq('group_id', group.id)
                  .gte('expense_date', periodRange.start)
                  .lte('expense_date', periodRange.end);
                
                console.log(`🔍 Harcama sorgusu - ${group.name}:`, {
                  groupId: group.id,
                  startDate: periodRange.start,
                  endDate: periodRange.end,
                  query: expenseQuery
                });
                
                return expenseQuery;
              })()
            ]);

            const memberCount = memberCountResult.count || 0;
            const monthlyExpenses = totalExpensesResult.data?.reduce((sum, exp) => sum + exp.amount, 0) || 0;
            
            // Basit harcama kontrolü - tüm harcamaları getir
            const { data: allExpenses } = await supabase
              .from('expenses')
              .select('amount, expense_date')
              .eq('group_id', group.id)
              .limit(10);
            
            console.log(`💰 Ana Sayfa Harcama Debug - ${group.name}:`, {
              expenseCount: totalExpensesResult.data?.length || 0,
              monthlyExpenses: monthlyExpenses,
              rawExpenses: totalExpensesResult.data?.map(e => ({
                amount: e.amount,
                date: e.expense_date
              })),
              allExpensesCount: allExpenses?.length || 0,
              allExpensesSample: allExpenses?.slice(0, 3).map(e => ({
                amount: e.amount,
                date: e.expense_date
              }))
            });

            return {
              id: group.id,
              name: group.name,
              description: group.description,
              created_at: group.created_at,
              member_count: memberCount,
              total_expenses: monthlyExpenses,
            };
          })
      );

      // Yeni gruplar için tercih oluştur
      if (user?.id) {
        const groupIds = groupsWithRealStats.map(g => g.id);
        await UserHouseholdPreferencesService.ensurePreferencesExist(user.id, groupIds);
        
        // Grupları tercihlerle birleştir ve sırala
        const groupsWithPrefs = await UserHouseholdPreferencesService
          .getHouseholdsWithPreferences(user.id, groupsWithRealStats);
        
        setGroups(groupsWithPrefs);
      } else {
        setGroups(groupsWithRealStats.map((group, index) => ({
          ...group,
          sort_order: index + 1,
          custom_color: null,
          display_color: UserHouseholdPreferencesService.getDefaultColor(group.id)
        })));
      }
      
    } catch (err) {
      console.error("Fetch groups catch:", err);
      
      // Hata türüne göre farklı mesajlar
      if (err instanceof Error) {
        if (err.message.includes('relation') || err.message.includes('column')) {
          Alert.alert("Veritabanı Hatası", "Veritabanı yapısında sorun var. Lütfen geliştiriciye bildirin.");
        } else if (err.message.includes('network') || err.message.includes('connection')) {
          Alert.alert("Bağlantı Hatası", "İnternet bağlantınızı kontrol edin.");
        } else {
          Alert.alert("Hata", `Gruplar yüklenirken hata oluştu: ${err.message}`);
        }
      } else {
        Alert.alert("Bilinmeyen Hata", "Beklenmedik bir hata oluştu.");
      }
      
      // Hata durumunda boş liste göster
      setGroups([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setExpenseLoading(false);
    }
  };



  useEffect(() => {
    const initializeApp = async () => {
      // Sadece kullanıcı giriş yapmışsa initialize et
      if (user?.id) {
        await migrateAsyncStorageData();
        await setupPushNotifications(); // Push notification izni al
        await fetchUserProfile(true); // Profile + gruplar + harcamalar
      }
    };

    initializeApp();
  }, [user?.id]); // user?.id dependency ekle

  // Bildirim servisi için ayrı useEffect
  useEffect(() => {
    if (user?.id && groups.length > 0) {
      // Tüm gruplar için bildirim dinlemeye başla
      groups.forEach(group => {
        notificationService.subscribeToHousehold(group.id, user.id);
      });
    }

    // Cleanup: Sayfa kapanırken dinlemeleri durdur
    return () => {
      notificationService.unsubscribeAll();
    };
  }, [user?.id, groups]);







  // Sayfa focus olduğunda yenile (ev oluşturma ve settings sonrası için)
  useFocusEffect(
    useCallback(() => {
      // User profile'ı yenile (settings'den month_start_day değişmiş olabilir)
      fetchUserProfile();
      
      // Bildirim sayısını yenile (bildirim sayfasından dönüldüğünde)
      if (user?.id) {
        loadUnreadNotificationCount();
      }
      
      // Android geri tuşu işleyicisi
      const backAction = () => {
        if (showLogoutModal) {
          // Çıkış modalı açıkken geri tuşuna basılırsa modalı kapat
          setShowLogoutModal(false);
          return true; // Geri tuşu işlemini engelle
        } else if (isEditMode) {
          // Edit modundayken geri tuşuna basılırsa değişiklikleri kaydet
          saveEditChanges();
          return true; // Geri tuşu işlemini engelle (uygulamadan çıkmasın)
        } else {
          // Normal modda geri tuşuna basılırsa çıkış onay modalını aç
          setShowLogoutModal(true);
          return true; // Geri tuşu işlemini engelle (direkt çıkmasın)
        }
      };

      // Geri tuşu dinleyicisini ekle
      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

      // Cleanup function - sayfa odaktan çıktığında dinleyiciyi kaldır
      return () => backHandler.remove();
    }, [isEditMode, hasChanges, showLogoutModal]) // State değiştiğinde yeniden tanımla
  );

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    
    // "Beni hatırla" bilgilerini temizle
    try {
      await AsyncStorage.removeItem('remembered_email');
      await AsyncStorage.removeItem('remembered_password');
      console.log('🗑️ Çıkış yapıldı - "Beni hatırla" bilgileri temizlendi');
    } catch (err) {
      console.error('Çıkış bilgileri temizleme hatası:', err);
    }
    
    // Notification service'i temizle
    try {
      const { notificationService } = await import("@/services/NotificationService");
      notificationService.unsubscribeAll();
      notificationService.clearPreferencesCache();
      console.log('🔔 Bildirim servisi temizlendi');
    } catch (err) {
      console.error('Notification service temizleme hatası:', err);
    }
    
    await supabase.auth.signOut();
  };

  const fabActions = [
    {
      label: "Yeni Grup",
      onPress: () => router.push("/(home)/group/NEW"),
      icon: "👥",
      color: "#1A1A2E", // Standart koyu renk
      shadowColor: "#00D4FF"
    },
    {
      label: "Gruba Katıl",
      onPress: () => router.push("/(home)/join-group"),
      icon: "🔗",
      color: "#1A1A2E", // Standart koyu renk
      shadowColor: "#00FF94"
    }
  ];

  // Renk sistemi artık UserHouseholdPreferencesService'te

  // Normal mod için render
  const renderGroupNormal = ({ item }: { item: GroupWithPreferences }) => {
    return (
      <View style={styles.groupItem}>
        <View style={styles.cardWrapper}>
          <GroupCard
            id={item.id}
            name={item.name}
            description={item.description}
            memberCount={item.member_count}
            totalExpenses={item.total_expenses}
            createdAt={item.created_at}
            onPress={() => router.push(`/(home)/group/${item.id}`)}
            color={item.display_color}
            isExpenseLoading={expenseLoading}
          />
        </View>
      </View>
    );
  };

  // Edit mod için render (draggable + color picker button)
  const renderGroupEdit = ({ item, getIndex, drag, isActive }: RenderItemParams<GroupWithPreferences>) => {
    const index = getIndex?.() ?? 0;
    
    return (
      <ScaleDecorator>
        <View style={styles.groupItemEdit}>
          <View style={styles.cardWrapperEdit}>
            <GroupCard
              id={item.id}
              name={item.name}
              description={item.description}
              memberCount={item.member_count}
              totalExpenses={item.total_expenses}
              createdAt={item.created_at}
              onPress={() => {}} // Edit modunda tıklama devre dışı
              color={item.display_color}
              isExpenseLoading={expenseLoading}
              showColorPicker={true}
              onColorPickerPress={() => openColorPicker(item.id)}
            />
          </View>
          
          {/* Drag Handle - Sağda */}
          <TouchableOpacity 
            style={[styles.dragHandle, isActive && styles.dragHandleActive]}
            onLongPress={drag}
            delayLongPress={200}
          >
            <View style={styles.dragIcon}>
              <View style={styles.dragLine} />
              <View style={styles.dragLine} />
              <View style={styles.dragLine} />
            </View>
          </TouchableOpacity>
        </View>
      </ScaleDecorator>
    );
  };

  const renderHeader = () => {
    const currentHour = new Date().getHours();
    let timeGreeting;
    
    if (currentHour >= 5 && currentHour < 10) {
      timeGreeting = 'Günaydın';
    } else if (currentHour >= 10 && currentHour < 17) {
      timeGreeting = 'İyi günler';
    } else if (currentHour >= 17 && currentHour < 22) {
      timeGreeting = 'İyi akşamlar';
    } else {
      timeGreeting = 'İyi geceler';
    }
    
    const name = userProfile?.full_name?.split(' ')[0] || 'Kullanıcı';
    
    return (
      <View style={styles.futuristicHeaderContainer}>
        {/* Dramatic Fade Background */}
        <View style={styles.fadeBackground} />
        <View style={styles.fadeOverlay} />
        
        <View style={styles.futuristicHeader}>
          {/* Hero User Section */}
          <View style={styles.heroUserSection}>
            <View style={styles.megaAvatarContainer}>
              <View style={styles.avatarGlowRing} />
              <View style={styles.megaAvatar}>
                <Text style={styles.megaAvatarText}>
                  {userProfile?.full_name?.charAt(0).toUpperCase() || 
                   user?.email?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
              <View style={styles.pulsingIndicator} />
            </View>
            
            <View style={styles.heroTextSection}>
              <Text style={styles.heroGreeting}>{timeGreeting}</Text>
              <Text style={styles.heroName}>{name}</Text>
              <Text style={styles.heroEmail}>{user?.email}</Text>
              <View style={styles.statusChip}>
                <View style={styles.statusDotSmall} />
                <Text style={styles.statusText}>Online</Text>
              </View>
            </View>
          </View>
          

        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>Henüz grup yok! 👥</Text>
      <Text style={styles.emptyStateText}>
        İlk grubunuzu oluşturmak veya bir gruba katılmak için aşağıdaki butonu kullanın
      </Text>
    </View>
  );

  const renderListHeader = () => (
    <View>
      {renderHeader()}
      
      {/* Modern Action Buttons - Header altında */}
      <View style={styles.actionButtonsContainer}>
        <View style={styles.modernActionButtons}>
          <View style={styles.btnShadowContainer}>
            <TouchableOpacity 
              style={styles.modernBtn} 
              onPress={handleLogout}
            >
              <Text style={styles.logoutButtonText}>🔒</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.btnShadowContainer}>
            <TouchableOpacity 
              style={[
                styles.modernBtn, 
                isEditMode && styles.modernBtnActive,
                isSaving && styles.modernBtnSaving
              ]} 
              onPress={toggleEditMode}
              disabled={isSaving}
            >
              {isSaving ? (
                <Text style={styles.buttonText}>⏳</Text>
              ) : isEditMode ? (
                <Text style={styles.buttonText}>💾</Text>
              ) : (
                <Text style={styles.editButtonText}>✏️</Text>
              )}
            </TouchableOpacity>
          </View>
          
          <View style={styles.btnShadowContainer}>
            <TouchableOpacity 
              style={styles.modernBtn} 
              onPress={() => router.push("/(home)/notifications")}
            >
              <Text style={styles.notificationButtonText}>🔔</Text>
              {unreadNotificationCount > 0 && (
                <View style={styles.modernNotificationBadge}>
                  <Text style={styles.modernBadgeText}>
                    {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          
          <View style={styles.btnShadowContainer}>
            <TouchableOpacity 
              style={styles.modernBtn} 
              onPress={() => router.push("/(home)/settings")}
            >
              <Text style={styles.settingsButtonText}>⋮</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      <View style={styles.groupSection}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>Gruplarım</Text>
            <View style={styles.groupCount}>
              <Text style={styles.countText}>{groups.length}</Text>
            </View>
          </View>
          <Text style={styles.sectionSubtitle}>
            {groups.length === 0 
              ? 'Henüz hiç grubunuz yok' 
              : `${groups.length} grup${groups.length > 1 ? '' : ''}`
            }
          </Text>
        </View>
      </View>
    </View>
  );

  const renderListFooter = () => null; // Boşluk paddingBottom ile halloldu

  // Skeleton kartları için dummy data
  const skeletonData = [...Array(3)].map((_, index) => ({ id: `skeleton-${index}` }));

  // Skeleton kartları render et
  const renderSkeletonCard = ({ item }: { item: { id: string } }) => (
    <View style={styles.groupItem}>
      <View style={styles.cardWrapper}>
            <SkeletonGroupCard />
      </View>
    </View>
  );

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.container}>
        {loading ? (
          // Loading State - Skeleton kartları FlatList ile göster
          <>
            <FlatList
              data={skeletonData}
              renderItem={renderSkeletonCard}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={renderListHeader}
              ListFooterComponent={renderListFooter}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={false}
                  onRefresh={() => {}} // Boş fonksiyon
                  tintColor="#00D4FF"
                  colors={['#00D4FF']}
                />
              }
              style={styles.flatListContent}
            />
          </>
        ) : groups.length === 0 ? (
          // Empty State - Header her zaman görünsün (edit butonu için)
          <>
            <View style={{ flex: 1 }}>
              {renderHeader()}
              <View style={styles.groupSection}>
                {renderEmptyState()}
              </View>
            </View>
          </>
        ) : isEditMode ? (
          // Edit Mode: DraggableFlatList with color pickers
          <DraggableFlatList
            ref={draggableListRef}
            key={`draggable-${editGroups.map(g => g.id).join('-')}`}
            data={editGroups}
            renderItem={renderGroupEdit}
            keyExtractor={(item) => `${item.id}-${item.sort_order || 0}-${(item as any)._updateTime || 0}`}
            extraData={editGroups.map(g => g.id).join(',')}
            ListHeaderComponent={renderListHeader}
            ListFooterComponent={renderListFooter}
            showsVerticalScrollIndicator={false}
            onDragEnd={({ data }) => {
              // Basit ve hızlı güncelleme
              const newData = data.map((item, index) => ({
                ...item,
                sort_order: index + 1,
                // Unique identifier ekle ki React tamamen yeniden render etsin
                _updateTime: Date.now()
              }));
              
              setEditGroups(newData);
              setHasChanges(true);
            }}
            activationDistance={0}
            dragItemOverflow={false}
            autoscrollThreshold={100}
            dragHitSlop={{ top: 0, bottom: 0, left: 0, right: 0 }}
            containerStyle={styles.flatListContent}
          />
        ) : (
          // Normal Mode: Regular FlatList
          <FlatList
            ref={flatListRef}
            data={groups}
            renderItem={renderGroupNormal}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderListHeader}
            ListFooterComponent={renderListFooter}
            showsVerticalScrollIndicator={false}

            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setFabShouldClose(true); // FAB'ı kapat
                  setTimeout(() => setFabShouldClose(false), 100); // Reset flag
                  fetchUserProfile(true);
                }}
                tintColor="#00D4FF"
                colors={['#00D4FF']}
              />
            }
            style={styles.flatListContent}
          />
        )}
      </SafeAreaView>
      
      <FloatingActionButton 
        actions={fabActions} 
        forceClose={fabShouldClose}
      />
      
      {/* Basit overlay - Modal değil */}
      {showColorPicker && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999,
          elevation: 99999,
        }}>
          <View style={{
            backgroundColor: '#1A1A2E',
            borderRadius: 20,
            padding: 24,
            width: 300,
            borderWidth: 2,
            borderColor: '#00D4FF',
            margin: 20,
          }}>
            <Text style={{
              fontSize: 24,
              fontWeight: '700',
              color: '#FFFFFF',
              textAlign: 'center',
              marginBottom: 8,
            }}>Renk Seç 🎨</Text>
            
            <Text style={{
              fontSize: 14,
              color: '#9CA3AF',
              textAlign: 'center',
              marginBottom: 24,
            }}>Ev kartının rengini seç</Text>
            
            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 12,
              marginBottom: 24,
            }}>
              {memberColors.map((color, index) => {
                const currentGroup = editGroups.find(g => g.id === selectedGroup);
                let currentColorIndex = -1;
                
                if (currentGroup?.custom_color) {
                  currentColorIndex = memberColors.findIndex(c => c.bg === currentGroup.custom_color);
                }
                
                const isSelected = currentColorIndex === index;
                
                return (
                  <TouchableOpacity
                    key={index}
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 25,
                      backgroundColor: color.bg,
                      borderWidth: isSelected ? 3 : 0,
                      borderColor: '#FFFFFF',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    onPress={() => handleColorChange(selectedGroup!, index)}
                  >
                    {isSelected && (
                      <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>✓</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            
            <TouchableOpacity
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 24,
              }}
              onPress={() => setShowColorPicker(false)}
            >
              <Text style={{
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: '600',
                textAlign: 'center',
              }}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {/* Custom Logout Modal */}
      {showLogoutModal && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999,
          elevation: 99999,
        }}>
          <View style={{
            backgroundColor: '#1A1A2E',
            borderRadius: 20,
            padding: 24,
            width: 300,
            borderWidth: 2,
            borderColor: '#FF6B6B',
            margin: 20,
            shadowColor: '#FF6B6B',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.4,
            shadowRadius: 20,
            elevation: 20,
          }}>
            {/* Header Icon */}
            <View style={{
              alignItems: 'center',
              marginBottom: 16,
            }}>
              <View style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                backgroundColor: 'rgba(255, 107, 107, 0.15)',
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 2,
                borderColor: 'rgba(255, 107, 107, 0.3)',
              }}>
                <Text style={{ fontSize: 28 }}>🔒</Text>
              </View>
            </View>
            
            {/* Title */}
            <Text style={{
              fontSize: 24,
              fontWeight: '700',
              color: '#FFFFFF',
              textAlign: 'center',
              marginBottom: 8,
              textShadowColor: 'rgba(255, 255, 255, 0.3)',
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 8,
            }}>Çıkış Yap</Text>
            
            {/* Message */}
            <Text style={{
              fontSize: 16,
              color: '#9CA3AF',
              textAlign: 'center',
              marginBottom: 24,
              lineHeight: 22,
            }}>Çıkış yapmak istediğinizden emin misiniz?</Text>
            
            {/* Buttons */}
            <View style={{
              flexDirection: 'row',
              gap: 12,
            }}>
              {/* Cancel Button */}
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                }}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: 16,
                  fontWeight: '600',
                  textAlign: 'center',
                }}>İptal</Text>
              </TouchableOpacity>
              
              {/* Logout Button */}
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#FF6B6B',
                  borderRadius: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  shadowColor: '#FF6B6B',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                }}
                onPress={confirmLogout}
              >
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: 16,
                  fontWeight: '700',
                  textAlign: 'center',
                }}>Çıkış Yap</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
    flexGrow: 1,
    paddingBottom: 100, // FAB için boşluk
  },
  headerContainer: {
    position: 'relative',
    overflow: 'hidden',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    backgroundColor: 'rgba(255, 0, 128, 0.05)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(22, 33, 62, 0.3)',
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF0080',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 0, 128, 0.3)',
    shadowColor: '#FF0080',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#00FF94',
    borderWidth: 2,
    borderColor: '#0A0A0F',
    shadowColor: '#00FF94',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  userEmail: {
    fontSize: 8,
    color: '#00D4FF',
    marginTop: 2,
    textShadowColor: 'rgba(0, 212, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6, // Eşit aralıklar
  },

  groupSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
    marginRight: 12,
  },
  groupCount: {
    backgroundColor: '#FF0080',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: '#FF0080',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
  },
  flatListContent: {
    flexGrow: 1,
    paddingBottom: 8, // FAB için minimal boşluk (20'den düşürüldü)
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 8, //grup kartları arasındaki boşluk
    paddingHorizontal: 20,
  },
  cardWrapper: {
    flex: 1,
  },
  dragHandle: {
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    backgroundColor: 'transparent',
    paddingVertical: 20,
    alignSelf: 'center', // Kartın ortasında hizala
  },
  dragHandleActive: {
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderRadius: 8,
  },
  dragIcon: {
    width: 12,
    height: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dragLine: {
    width: 12,
    height: 2,
    backgroundColor: '#6B7280',
    borderRadius: 1,
    marginVertical: 1,
  },
  // Edit Mode Styles
  editButton: {
    width: 44,
    height: 44,
    backgroundColor: '#1A1A2E',
    borderRadius: 22,
    marginRight: 0,
    marginLeft: 2,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  editButtonActive: {
    backgroundColor: 'rgba(0, 212, 255, 0.8)',
    borderColor: 'rgba(0, 212, 255, 0.8)',
  },
  editButtonSaving: {
    backgroundColor: 'rgba(156, 163, 175, 0.5)',
    borderColor: 'rgba(156, 163, 175, 0.8)',
  },
  editIconText: {
    fontSize: 18,
    color: '#00D4FF',
  },
  saveIconText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  savingIconText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  groupItemEdit: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  cardWrapperEdit: {
    position: 'relative',
    flex: 1,
  },

  
  // Futuristic Header Styles
  futuristicHeaderContainer: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 120,
  },
  fadeBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FF0080',
    opacity: 0.15,
  },
  fadeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'linear-gradient(135deg, rgba(255,0,128,0.2) 0%, rgba(0,212,255,0.1) 50%, rgba(0,255,148,0.05) 100%)',
  },
  futuristicHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 64,
    paddingVertical: 32,
  },
  heroUserSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  megaAvatarContainer: {
    position: 'relative',
    marginRight: 22,
  },
  avatarGlowRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(255, 0, 128, 0.4)',
    top: -8,
    left: -8,
    shadowColor: '#FF0080',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  megaAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF0080',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF0080',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 20,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  megaAvatarText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  pulsingIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00FF94',
    borderWidth: 3,
    borderColor: '#0A0A0F',
    shadowColor: '#00FF94',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 16,
  },
  heroTextSection: {
    flex: 1,
  },
  heroGreeting: {
    fontSize: 18,
    color: '#B0B7C3',
    fontWeight: '600',
    marginBottom: 1,
    letterSpacing: 0.3,
  },
  heroName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 1,
    textShadowColor: 'rgba(255, 255, 255, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    letterSpacing: 0.8,
  },
  heroEmail: {
    fontSize: 10,
    color: '#00D4FF',
    fontWeight: '500',
    marginBottom: 8,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 212, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 148, 0.15)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 148, 0.3)',
  },
  statusDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00FF94',
    marginRight: 6,
    shadowColor: '#00FF94',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  statusText: {
    fontSize: 10,
    color: '#00FF94',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  actionButtonsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 0, 128, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 0, 128, 0.25)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 0, 128, 0.12)',
  },
  modernActionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  btnShadowContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1A1A2E',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
  },
  modernBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#00D4FF',
  },
  modernBtnActive: {
    backgroundColor: 'rgba(0, 212, 255, 0.5)',
    borderColor: 'rgba(0, 212, 255, 0.8)',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  modernBtnSaving: {
    backgroundColor: 'rgba(156, 163, 175, 0.5)',
    borderColor: 'rgba(156, 163, 175, 0.8)',
    shadowColor: '#9CA3AF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  modernIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  buttonText: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 18,
    fontWeight: '600',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3,
    includeFontPadding: false,
    textShadowColor: '#FFFFFF',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  editButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 28,
    fontWeight: '600',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3,
    includeFontPadding: false,
    textShadowColor: '#FFFFFF',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  notificationButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 24,
    fontWeight: '600',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3,
    includeFontPadding: false,
    textShadowColor: '#FFFFFF',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  settingsButtonText: {
    fontSize: 22,
    color: '#33E5EE',
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 0,
    shadowColor: '#33E5EE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 5,
    elevation: 5,
    includeFontPadding: false,
    textShadowColor: '#33E5EE',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 1,
  },

  modernNotificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF0080',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0A0A0F',
    shadowColor: '#FF0080',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
  },
  modernBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  logoutButtonText: {
    fontSize: 18,
    color: '#FF6B6B',
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 20,
    fontWeight: '700',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 5,
    elevation: 5,
    includeFontPadding: false,
    textShadowColor: '#FF6B6B',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 1,
  },
});
