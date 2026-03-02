/* eslint-disable react-native/no-unused-styles */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, Alert, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Animated, RefreshControl, Share } from "react-native";
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/state/auth-context";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import CustomDonut from "@/components/ui/NeonDonutChart";
import { SkeletonGroupHeader, SkeletonChart, SkeletonStats, SkeletonMembers } from "@/components/ui/SkeletonGroupDetail";
import * as Clipboard from 'expo-clipboard';
import { notificationService } from "@/services/NotificationService";
import { UserHouseholdPreferencesService } from "@/services/UserHouseholdPreferencesService";


type GroupData = {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  invite_code: string;
  created_at: string;
  member_count?: number;
  total_expenses?: number;
  members?: Array<{
    id: string;
    user_id: string;
    role: string;
    joined_at: string;
    users: {
      email: string;
      full_name?: string;
    };
  }>;
};

type Expense = {
  id: string;
  title: string;
  amount: number;
  created_by: string;
  expense_date: string;
  users: {
    email: string;
    full_name?: string;
  };
};

export default function Group() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{name?: string; description?: string}>({});
  
  // Grup detayları için state'ler
  const [group, setGroup] = useState<GroupData | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expenseLoading, setExpenseLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Filtre state'i
  const [selectedFilter, setSelectedFilter] = useState('thisMonth');
  const [monthStartDay, setMonthStartDay] = useState(1);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  
  // Özel tarih aralığı state'leri
  const [customStartDate, setCustomStartDate] = useState(new Date());
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  // Renk seçici state'leri
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [memberCustomColors, setMemberCustomColors] = useState<{[key: string]: number}>({});
  const [copySuccess, setCopySuccess] = useState(false);
  const [linkCopySuccess, setLinkCopySuccess] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  
  // Timeout referansları
  const copyTimeoutRef = useRef<number | null>(null);
  const linkTimeoutRef = useRef<number | null>(null);
  
  // Başarı state'lerini temizleme fonksiyonu
  const clearAllSuccessStates = () => {
    // Mevcut timeout'ları temizle
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = null;
    }
    if (linkTimeoutRef.current) {
      clearTimeout(linkTimeoutRef.current);
      linkTimeoutRef.current = null;
    }
    
    setCopySuccess(false);
    setLinkCopySuccess(false);
  };
  
  // ScrollView ref'i scroll pozisyonunu korumak için
  const scrollViewRef = useRef<ScrollView>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  
  // Basit tracking - sadece filtrenin üstündeki content container
  const aboveFilterContentRef = useRef<View>(null);
  const filterSectionRef = useRef<View>(null);
  const [aboveFilterHeight, setAboveFilterHeight] = useState(0);
  const [filterSectionY, setFilterSectionY] = useState(0);
  
  // İlk yükleme tamamlandı mı? (scroll compensation sadece filtre değişikliklerinde)
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  // Filtre aktif mi takibi (scroll restoration sadece filtre varsa)
  const [isFilterActive, setIsFilterActive] = useState(false);
  // Veri yenilenirken scroll compensation'ı devre dışı bırak
  const [isDataRefreshing, setIsDataRefreshing] = useState(false);
  
  // Chart tipi state'i
  const [chartType, setChartType] = useState<'bar' | 'donut'>('donut');
  const [isChartTypeChanging, setIsChartTypeChanging] = useState(false);
  
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Invite code warning modal state
  const [showInviteCodeWarningModal, setShowInviteCodeWarningModal] = useState(false);
  
  // Regenerate invite code modals state
  const [showRegenerateConfirmModal, setShowRegenerateConfirmModal] = useState(false);
  const [showRegenerateSuccessModal, setShowRegenerateSuccessModal] = useState(false);
  const [newGeneratedCode, setNewGeneratedCode] = useState<string>('');
  
  // Disable invite code modal state
  const [showDisableConfirmModal, setShowDisableConfirmModal] = useState(false);
  
  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdGroup, setCreatedGroup] = useState<{name: string, invite_code: string} | null>(null);
  const [successCopySuccess, setSuccessCopySuccess] = useState(false);
  
  const isNewGroup = id === "NEW";
  
  // Kullanıcının admin olup olmadığını kontrol et
  const isCurrentUserAdmin = () => {
    if (!group?.members || !user?.id) return false;
    const currentUserMember = group.members.find(member => member.user_id === user.id);
    return currentUserMember?.role === 'admin';
  };
  
  // Stats loading animasyonu için animated values
  const statDot1Opacity = useRef(new Animated.Value(0.3)).current;
  const statDot2Opacity = useRef(new Animated.Value(0.3)).current;
  const statDot3Opacity = useRef(new Animated.Value(0.3)).current;
  
  // Header animation values
  const headerFadeAnim = useRef(new Animated.Value(0)).current;
  const headerSlideAnim = useRef(new Animated.Value(-50)).current;
  const notificationBadgeScale = useRef(new Animated.Value(0)).current;

  // Stats loading animasyonu
  useEffect(() => {
    if (statsLoading) {
      const createStatsAnimation = () => {
        return Animated.loop(
          Animated.sequence([
            // İlk nokta parlar
            Animated.timing(statDot1Opacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            // İkinci nokta parlar, birinci söner
            Animated.parallel([
              Animated.timing(statDot1Opacity, {
                toValue: 0.3,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(statDot2Opacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }),
            ]),
            // Üçüncü nokta parlar, ikinci söner
            Animated.parallel([
              Animated.timing(statDot2Opacity, {
                toValue: 0.3,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(statDot3Opacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }),
            ]),
            // Üçüncü söner
            Animated.timing(statDot3Opacity, {
              toValue: 0.3,
              duration: 200,
              useNativeDriver: true,
            }),
            // Kısa bekleme
            Animated.delay(100),
          ]),
          { iterations: -1 }
        );
      };
      
      const animation = createStatsAnimation();
      animation.start();
      
      return () => {
        animation.stop();
      };
    } else {
      // Loading bitince tüm noktaları resetle
      statDot1Opacity.setValue(0.3);
      statDot2Opacity.setValue(0.3);
      statDot3Opacity.setValue(0.3);
    }
  }, [statsLoading]);
  
  // Header entrance animation when loading completes
  useEffect(() => {
    if (!loading && group) {
      Animated.parallel([
        Animated.timing(headerFadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(headerSlideAnim, {
          toValue: 0,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Notification badge pop animation after a slight delay
      setTimeout(() => {
        Animated.spring(notificationBadgeScale, {
          toValue: 1,
          tension: 100,
          friction: 6,
          useNativeDriver: true,
        }).start();
      }, 300);
    }
  }, [loading, group]);
  
  // Kişi renkleri paleti - 8 canlı renk
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
  
  // Deep link oluşturma fonksiyonu
  const generateInviteLink = (inviteCode: string) => {
    return `splitapp://join/${inviteCode}`;
  };

  // Paylaşım için mesaj oluşturma
  const generateInviteText = (inviteCode: string) => {
    const deepLink = generateInviteLink(inviteCode);
    return `🎉 SplitApp grubuma katıl!\n\n"${group?.name}" grubuna davetlisin.\n\nDirekt katıl: ${deepLink}\n\nVeya manuel kod gir: ${inviteCode}`;
  };

  // Davet paylaşma fonksiyonu
  const shareInviteLink = async (inviteCode: string) => {
    try {
      setShareLoading(true);
      
      const message = generateInviteText(inviteCode);
      
      const result = await Share.share({
        message: message,
        url: generateInviteLink(inviteCode), // iOS için URL parametresi
        title: `${group?.name} grubuna katıl`
      });

      if (result.action === Share.sharedAction) {
        // Share successful
      } else if (result.action === Share.dismissedAction) {
        // Share dismissed
      }
    } catch (_error) {
      // Error handled silently
      Alert.alert('Paylaşım Hatası', 'Davet paylaşılırken bir hata oluştu.');
    } finally {
      setShareLoading(false);
    }
  };

  // Deep link kopyalama fonksiyonu
  const copyInviteLink = async (inviteCode: string) => {
    try {
      // Önce diğer butonların success state'ini temizle
      clearAllSuccessStates();
      
      // Deep link kopyala
      const deepLink = generateInviteLink(inviteCode);
      await Clipboard.setStringAsync(deepLink);
      
      setLinkCopySuccess(true);
      
      // Yeni timeout'ı referansla kaydet
      linkTimeoutRef.current = setTimeout(() => {
        setLinkCopySuccess(false);
      }, 2000);
    } catch (_error) {
      // Error handled silently

      Alert.alert("❌ Hata", `Kopyalama başarısız: ${_error instanceof Error ? _error.message : String(_error)}`);
    }
  };

  // Kişi ID'sine göre renk getir
  const getMemberColor = (userId: string) => {
    if (!group?.members) return memberColors[0];
    
    // Eğer custom renk seçilmişse onu kullan
    if (memberCustomColors[userId] !== undefined) {
      return memberColors[memberCustomColors[userId]] || memberColors[0];
    }
    
    // Yoksa default sıralamayı kullan
    const memberIndex = group.members.findIndex(member => member.user_id === userId);
    return memberColors[memberIndex % memberColors.length] || memberColors[0];
  };
  
  // Kişi ID'sine göre index getir (harcamalarda kullanmak için)
  const getMemberColorByUserId = (userId: string) => {
    if (!group?.members) return memberColors[0];
    
    // Eğer custom renk seçilmişse onu kullan
    if (memberCustomColors[userId] !== undefined) {
      return memberColors[memberCustomColors[userId]] || memberColors[0];
    }
    
    // Yoksa default sıralamayı kullan
    const memberIndex = group.members.findIndex(member => member.user_id === userId);
    return memberColors[memberIndex % memberColors.length] || memberColors[0];
  };
  
  // Renk değiştirme fonksiyonu
  const handleColorChange = async (userId: string, colorIndex: number) => {
    const newColors = {
      ...memberCustomColors,
      [userId]: colorIndex
    };
    
    setMemberCustomColors(newColors);
    setShowColorPicker(false);
    setSelectedMember(null);
    
    // AsyncStorage'da sakla
    try {
      await AsyncStorage.setItem(`memberColors_${id}`, JSON.stringify(newColors));
    } catch (_err) {
      // Error handled silently
      // Error handled silently
    }
  };
  
  // Renk seçici aç
  const openColorPicker = (userId: string) => {
    setSelectedMember(userId);
    setShowColorPicker(true);
  };

  // Kişilerin harcama dağılımını hesapla
  const calculateMemberExpenseDistribution = () => {
    // MOD SEÇİMİ: Bu değeri değiştirerek isim görünümünü değiştirebilirsiniz
    // 'first_name' = Sadece ilk isim gösterilir (Ahmet)
    // 'full_name' = Tam isim gösterilir (Ahmet Yılmaz)
    const nameDisplayMode = 'full_name' as 'first_name' | 'full_name';
    
    if (!group?.members || !expenses.length) return [];

    // Her üye için toplam harcamayı hesapla
    const memberExpenses: { [key: string]: number } = {};
    
    expenses.forEach(expense => {
      if (memberExpenses[expense.created_by]) {
        memberExpenses[expense.created_by] += expense.amount;
      } else {
        memberExpenses[expense.created_by] = expense.amount;
      }
    });

    // Chart için data formatına çevir
    return group.members
      .filter(member => memberExpenses[member.user_id] > 0)
      .map((member) => {
        const memberColor = getMemberColor(member.user_id);
        
        // Moda göre isim formatını belirle
        let displayName: string;
        if (nameDisplayMode === 'full_name') {
          displayName = member.users?.full_name || member.users?.email?.split('@')[0] || 'Üye';
        } else {
          displayName = member.users?.full_name?.split(' ')[0] || member.users?.email?.split('@')[0] || 'Üye';
        }
        
        return {
          name: displayName,
          population: memberExpenses[member.user_id],
          color: memberColor.bg,
          legendFontColor: '#FFFFFF',
          legendFontSize: 12,
        };
      });
  };


  
  // Ayarları yükle
  const loadSettings = async () => {
    try {
      // monthStartDay'i veritabanından çek
      if (user?.id) {
        const { data, error } = await supabase
          .from('users')
          .select('month_start_day')
          .eq('id', user.id)
          .single();
        
        if (!error && data) {
          const startDay = data.month_start_day ?? 1;
          setMonthStartDay(startDay);
        } else {

          setMonthStartDay(1); // Default değer
        }
      }
      
      // Üye renklerini yükle
      const savedColors = await AsyncStorage.getItem(`memberColors_${id}`);
      if (savedColors) {
        setMemberCustomColors(JSON.parse(savedColors));
      }
      
      // Settings yükleme tamamlandı
      setIsSettingsLoaded(true);
    } catch (_err) {
      // Error handled silently

      setMonthStartDay(1); // Hata durumunda default değer
      setIsSettingsLoaded(true); // Hata durumunda da flag'i set et
    }
  };

  // Filtre seçenekleri
  const filterOptions = [
    { value: 'thisMonth', label: '📅 Bu Ay' },
    { value: 'monthToDate', label: '📅 Ay Başından Beri' },
    { value: 'lastMonth', label: '📅 Geçen Ay' },
    { value: 'last3Months', label: '📅 Son 3 Ay' },
    { value: 'yearToDate', label: '📅 Yıl Başından Beri' },
    { value: 'custom', label: '📅 Özel Aralık' },
    { value: 'all', label: '📅 Tümü' },
  ];

  // Stats label'ını filtre göre belirle
  const getStatsLabel = () => {
    const currentFilter = filterOptions.find(f => f.value === selectedFilter);
    return currentFilter?.label.replace('📅 ', '') || 'Bu Ay';
  };

  // Tarih string'ini YYYY-MM-DD formatına çevir (yerel saat)
  const formatDateToString = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // Tarih aralığı hesaplama (DateTime objelerle)
  const getDateRange = (filter: string, overrideStart?: Date, overrideEnd?: Date) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const currentDay = now.getDate();

    switch (filter) {
      case 'thisMonth': {
        // Ayarlanabilir aylık dönem
        let periodStart: Date, periodEnd: Date;
        
        if (currentDay >= monthStartDay) {
          // Bu ayın dönemindeyiz
          periodStart = new Date(year, month, monthStartDay);
          periodEnd = new Date(year, month + 1, monthStartDay - 1);
        } else {
          // Geçen ayın dönemindeyiz
          periodStart = new Date(year, month - 1, monthStartDay);
          periodEnd = new Date(year, month, monthStartDay - 1);
        }
        
        return {
          start: formatDateToString(periodStart),
          end: formatDateToString(periodEnd)
        };
      }
        
      case 'monthToDate': {
        // Bu ayın 1'inden bugüne kadar
        const monthStart = new Date(year, month, 1);
        return {
          start: formatDateToString(monthStart),
          end: formatDateToString(now)
        };
      }
        
      case 'lastMonth': {
        // Geçen ayın dönemini hesapla
        let thisStart: Date, thisEnd: Date;
        
        if (currentDay >= monthStartDay) {
          // Bu ayın dönemindeyiz → 1 dönem geriye git
          thisStart = new Date(year, month, monthStartDay);
          thisEnd = new Date(year, month + 1, monthStartDay - 1);
        } else {
          // Geçen ayın dönemindeyiz → 1 dönem daha geriye git
          thisStart = new Date(year, month - 1, monthStartDay);
          thisEnd = new Date(year, month, monthStartDay - 1);
        }
        
        // 1 dönem geriye kaydır
        const lastStart = new Date(thisStart);
        lastStart.setMonth(lastStart.getMonth() - 1);
        const lastEnd = new Date(thisEnd);
        lastEnd.setMonth(lastEnd.getMonth() - 1);
        
        return {
          start: formatDateToString(lastStart),
          end: formatDateToString(lastEnd)
        };
      }
        
      case 'last3Months': {
        // Son 3 aylık dönemi hesapla
        let currentStart: Date, currentEnd: Date;
        
        if (currentDay >= monthStartDay) {
          // Bu ayın dönemindeyiz
          currentStart = new Date(year, month, monthStartDay);
          currentEnd = new Date(year, month + 1, monthStartDay - 1);
        } else {
          // Geçen ayın dönemindeyiz
          currentStart = new Date(year, month - 1, monthStartDay);
          currentEnd = new Date(year, month, monthStartDay - 1);
        }
        
        // 3 dönem geriye git
        const threeMonthsStart = new Date(currentStart);
        threeMonthsStart.setMonth(threeMonthsStart.getMonth() - 2);
        
        return {
          start: formatDateToString(threeMonthsStart),
          end: formatDateToString(currentEnd)
        };
      }
        
      case 'yearToDate': {
        // Yıl başından bugüne kadar
        const yearStart = new Date(year, 0, 1);
        return {
          start: formatDateToString(yearStart),
          end: formatDateToString(now)
        };
      }
        
      case 'custom': {
        // Özel tarih aralığı (override değerlerini kullan)
        const actualStartDate = overrideStart || customStartDate;
        const actualEndDate = overrideEnd || customEndDate;
        const customRange = {
          start: formatDateToString(actualStartDate),
          end: formatDateToString(actualEndDate)
        };
        console.log('Custom date range calculated:', {
          ...customRange,
          startDateRaw: customStartDate.toString(),
          endDateRaw: customEndDate.toString(),
          startDateState: customStartDate.getTime(),
          endDateState: customEndDate.getTime()
        });
        return customRange;
      }
        
      default: // 'all'
        return null;
    }
  };

  // Sadece harcama verilerini yenile (filtre için)
  const fetchExpensesOnly = async () => {
    if (isNewGroup || !group?.id) return;
    
    setExpenseLoading(true);
    setIsDataRefreshing(true);
    
    try {
      const dateRange = getDateRange(selectedFilter);
      
      let query = supabase
        .from('expenses')
        .select(`
          id,
          title,
          amount,
          created_by,
          expense_date,
          users(email, full_name)
        `)
        .eq('group_id', group.id);
      
      // Tarih filtresi uygula
      if (dateRange) {
        query = query
          .gte('expense_date', dateRange.start)
          .lte('expense_date', dateRange.end);
      }
      
      const { data, error } = await query
        .order('expense_date', { ascending: false })
        .limit(50);
      
      if (error) {

        return;
      }
      
      // Transform data to match Expense type (consistent with expense list page)
      const transformedExpenses = (data || []).map(expense => ({
        ...expense,
        users: Array.isArray(expense.users) ? expense.users[0] : expense.users
      }));
      
      setExpenses(transformedExpenses);
    } catch (_err) {
      // Error handled silently
      // Error handled silently
    } finally {
      setExpenseLoading(false);
      setIsDataRefreshing(false);
    }
  };

  // Filtre değiştirme fonksiyonu - scroll pozisyonunu korur
  const handleFilterChange = (newFilter: string) => {
    setSelectedFilter(newFilter);
  };
  
  // Sadece grup bilgilerini çek (hızlı yükleme için)
  const fetchGroupBasicInfo = useCallback(async () => {
    if (isNewGroup) return;
    
    if (!id || id === 'undefined') {

      Alert.alert("Hata", "Grup ID bulunamadı. Ana sayfaya dönülüyor.");
      router.replace('/(home)/');
      return;
    }
    
    try {
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select(`
          id,
          name,
          description,
          created_by,
          invite_code,
          created_at,
          group_members(
            id,
            user_id,
            role,
            joined_at,
            users(email, full_name)
          )
        `)
        .eq('id', id)
        .single();

      if (groupError) {

        Alert.alert("Hata", "Ev bilgileri yüklenemedi.");
        return;
      }

      // Temel ev bilgilerini set et (stats olmadan)
      setGroup({
        ...groupData,
        member_count: groupData.group_members?.length || 0,
        total_expenses: 0, // Placeholder
        members: (groupData.group_members || []).map(member => ({
          ...member,
          users: Array.isArray(member.users) ? member.users[0] : member.users
        }))
      });
      
      setLoading(false); // Temel bilgiler yüklendi
      
      // İlk yükleme sonrası scroll compensation aktif olsun
      setTimeout(() => {
        setIsInitialLoadComplete(true);
      }, 1000); // 1 saniye sonra initial load tamamlandı say
      
    } catch (_err) {
      // Error handled silently

      setLoading(false);
      
      // Hata durumunda da initial load'u tamamla
      setTimeout(() => {
        setIsInitialLoadComplete(true);
      }, 1000);
    }
  }, [id, isNewGroup, router]);

  // Grup detaylarını çek (Paralel optimizasyon)
  const fetchGroupDetails = useCallback(async (isRefresh = false, filterOverride?: string) => {
    if (isNewGroup) return;
    
    if (!id || id === 'undefined') {

      Alert.alert("Hata", "Grup ID bulunamadı. Ana sayfaya dönülüyor.");
      router.replace('/(home)/');
      return;
    }
    
    const activeFilter = filterOverride || selectedFilter;
    
    console.log('📊 fetchGroupDetails çağrıldı:', { 
      isRefresh, 
      selectedFilter, 
      activeFilter,
      groupId: id,
      currentExpenseCount: expenses.length 
    });
    
    if (isRefresh) setRefreshing(true);
    setExpenseLoading(true);
    setStatsLoading(true);
    setIsDataRefreshing(true);
    
    try {
      // Tüm query'leri paralel çalıştır
      const [
        { data: groupData, error: groupError },
        { data: expensesData, error: expensesError },
        { data: totalData, error: totalError }
      ] = await Promise.all([
        // Grup bilgileri ve üyeler
        supabase
          .from('groups')
          .select(`
            id,
            name,
            description,
            created_by,
            invite_code,
            created_at,
            group_members(
              id,
              user_id,
              role,
              joined_at,
              users(email, full_name)
            )
          `)
          .eq('id', id)
          .single(),
        
        // Filtrelenmiş harcamalar
        (() => {
          const dateRange = getDateRange(activeFilter);
          console.log("Filter debug:", { 
            selectedFilter,
            activeFilter, 
            dateRange,
            currentDate: new Date().toISOString(),
            monthStartDay: monthStartDay,
            currentDay: new Date().getDate()
          });
          
          let query = supabase
            .from('expenses')
            .select(`
              id,
              title,
              amount,
              created_by,
              expense_date,
              users(email, full_name)
            `)
            .eq('group_id', id);
          
          // Tarih filtresi uygula
          if (dateRange) {
            console.log('Applying date filter:', {
              start: dateRange.start,
              end: dateRange.end,
              filter: activeFilter
            });
            query = query
              .gte('expense_date', dateRange.start)
              .lte('expense_date', dateRange.end);
          }
          
          return query
            .order('expense_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(20);
        })(),
        
        // Filtrelenmiş toplam harcama
        (() => {
          const dateRange = getDateRange(activeFilter);
          let query = supabase
            .from('expenses')
            .select('amount')
            .eq('group_id', id);
          
          // Tarih filtresi uygula
          if (dateRange) {
            console.log('Applying date filter:', {
              start: dateRange.start,
              end: dateRange.end,
              filter: activeFilter
            });
            query = query
              .gte('expense_date', dateRange.start)
              .lte('expense_date', dateRange.end);
          }
          
          return query;
        })()
      ]);

      // Hata kontrolü
      if (groupError) {

        Alert.alert("Hata", "Ev bilgileri yüklenemedi.");
        return;
      }

      if (expensesError) {
        // Error handled silently
      }

      if (totalError) {
        // Error handled silently
      }

      const totalExpenses = totalData?.reduce((sum, exp) => sum + exp.amount, 0) || 0;

      setGroup({
        ...groupData,
        member_count: groupData.group_members?.length || 0,
        total_expenses: totalExpenses,
        members: (groupData.group_members || []).map(member => ({
          ...member,
          users: Array.isArray(member.users) ? member.users[0] : member.users
        }))
      });
      
      const processedExpenses = (expensesData || []).map(expense => ({
        ...expense,
        users: Array.isArray(expense.users) ? expense.users[0] : expense.users
      }));
      
      console.log('💰 Harcamalar set ediliyor:', { 
        rawCount: expensesData?.length || 0,
        processedCount: processedExpenses.length,
        firstExpense: processedExpenses[0] ? {
          title: processedExpenses[0].title,
          amount: processedExpenses[0].amount,
          date: processedExpenses[0].expense_date
        } : null
      });
      
      setExpenses(processedExpenses);
    } catch (_err) {
      // Error handled silently

      Alert.alert("Bağlantı Hatası", "İnternet bağlantınızı kontrol edin.");
    } finally {
      setRefreshing(false);
      setExpenseLoading(false);
      setStatsLoading(false);
      setIsDataRefreshing(false);
    }
  }, [id, isNewGroup, router, selectedFilter, monthStartDay, expenses.length, getDateRange]);

  // useEffect ekle
  useEffect(() => {
    const initializeGroup = async () => {
      // Önce temel grup bilgilerini hızlıca yükle
      await fetchGroupBasicInfo();
      // Sonra settings'i yükle
      await loadSettings();
    };
    
    initializeGroup();
  }, [id]);

  // Settings yüklendikten sonra expense details'ı çek
  useEffect(() => {
    if (!isNewGroup && isSettingsLoaded && group) {
      fetchGroupDetails();
    }
  }, [isSettingsLoaded, isNewGroup, group?.id]);

  // Filtre değiştiğinde sadece harcama verilerini yenile
  useEffect(() => {
    if (!isNewGroup && group && filterSectionY > 0) {
      const _filterChangeTime = new Date().toLocaleTimeString();





      
      // Filtre aktif durumunu güncelle
      setIsFilterActive(true);
      
      fetchExpensesOnly().then(() => {

        
        // Layout değişikliği main container tarafından zaten handle ediliyor
        // Sadece filter pozisyonuna scroll et
        setTimeout(() => {
          const targetScrollY = Math.max(0, filterSectionY - 80);
          





          
          if (scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ 
              y: targetScrollY, 
              animated: false 
            });

          }
        }, 150);
      });
    }
  }, [selectedFilter]);

  // Sayfa focus olduğunda yenile (harcama ekleme sonrası ve navigation sonrası için)
  useFocusEffect(
    useCallback(() => {
      if (!isNewGroup && id) {

        
        // Focus durumunda filtre aktif durumunu sıfırla (scroll restoration devre dışı)
        setIsFilterActive(false);
        setIsDataRefreshing(false);
        
        // Scroll pozisyonunu da sıfırla (ışınlanmayı önlemek için)
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: 0, animated: false });
          setScrollPosition(0);
        }
        
        // Güvenli şekilde verileri yenile
        const reloadData = async () => {
          try {

            await fetchGroupBasicInfo();

            await fetchGroupDetails(true, 'all');

          } catch (_error) {
      // Error handled silently
            // Error handled silently
          }
        };
        
        // Küçük bir delay ekleyelim (navigation tamamlansın diye)
        setTimeout(reloadData, 100);
      }
    }, [id, isNewGroup])
  );
  
  const validateInputs = () => {
    const newErrors: {name?: string; description?: string} = {};
    
    if (!name.trim()) {
      newErrors.name = "Ev ismi zorunludur";
    } else if (name.trim().length < 2) {
      newErrors.name = "Ev ismi en az 2 karakter olmalı";
    }
    
    if (description.length > 200) {
      newErrors.description = "Açıklama en fazla 200 karakter olabilir";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateInputs()) return;
    
    setBusy(true);
    setErrors({});
    
    try {
      // 1. Ev oluştur
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          created_by: user?.id
        })
        .select()
        .single();
        
      if (groupError) {

        Alert.alert("Hata", "Ev oluşturulamadı: " + groupError.message);
        return;
      }

      // 2. Kendini admin olarak ekle
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user?.id,
          role: 'admin'
        });

      if (memberError) {

        // Ev oluşturuldu ama üye ekleme başarısız - yine de devam et
      }

      // 3. Varsayılan bildirim tercihlerini oluştur
      await notificationService.createDefaultPreferences(user?.id!, group.id);

      // 4. Akıllı renk seçimi ile kullanıcı tercihlerini oluştur
      await UserHouseholdPreferencesService.createDefaultPreference(user?.id!, group.id);

      // Modal için veri kaydet ve göster
      setCreatedGroup({
        name: name.trim(),
        invite_code: group.invite_code
      });
      setShowSuccessModal(true);
    } catch (_err) {
      // Error handled silently

      Alert.alert("Bağlantı Hatası", "İnternet bağlantınızı kontrol edin.");
    } finally {
      setBusy(false);
    }
  };

  // Policy test fonksiyonu
  const testPolicyLogic = async () => {
    if (!group || !user?.id) return;


    
    // Manuel olarak policy mantığını test et
    const { data: adminCheck, error: adminError } = await supabase
      .from('group_members')
      .select('user_id, role')
      .eq('group_id', group.id)
      .eq('role', 'admin');





    if (adminError) {
      // Admin error handled silently
    }
  };

  // Grup silme modal'ını aç
  const handleDeleteGroup = () => {
    if (!group || !isCurrentUserAdmin()) {
      Alert.alert("Hata", "Bu işlemi yapmaya yetkiniz yok.");
      return;
    }

    // Modal aç
    setShowDeleteModal(true);
  };

  // Gerçek silme işlemi
  const confirmDeleteGroup = async () => {
    setShowDeleteModal(false);
    
    // Policy test et
    await testPolicyLogic();

    if (!group) {
      Alert.alert("Hata", "Grup bilgileri bulunamadı.");
      return;
    }

    setBusy(true);
    try {

      console.log("📋 Debug bilgileri:", {
        groupId: group.id,
        userId: user?.id,
        isAdmin: isCurrentUserAdmin(),
        groupName: group.name
      });

      // 1. Önce grubu sil (admin kontrolü hala mevcut)

      const { error: groupError, data: deletedData } = await supabase
        .from('groups')
        .delete()
        .eq('id', group.id)
        .select();

      console.log("🏠 Grup silme sonucu:", { 
        error: groupError, 
        deletedData: deletedData,
        groupId: group.id 
      });

      if (groupError) {

        console.error("🔍 Detaylı hata:", {
          message: groupError.message,
          details: groupError.details,
          hint: groupError.hint,
          code: groupError.code
        });
        Alert.alert("Hata", "Grup silinemedi: " + groupError.message);
        return;
      }

      if (!deletedData || deletedData.length === 0) {

        Alert.alert("Hata", "Grup silinemedi - yetki sorunu olabilir");
        return;
      }



      // 2. Sonra üyeleri sil

      const { error: membersError } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', group.id);

      if (membersError) {

        // Grup zaten silindi, üye silme hatası kritik değil
      } else {
        // Handle other errors if needed
      }

      // 3. Son olarak harcamaları sil

      const { error: expensesError } = await supabase
        .from('expenses')
        .delete()
        .eq('group_id', group.id);

      if (expensesError) {

        // Grup zaten silindi, harcama silme hatası kritik değil
      } else {
        // Handle other expense errors if needed
      }

      // Direkt ana sayfaya dön - alert gösterme

      router.replace("/(home)/");
    } catch (_err) {
      // Error handled silently

      Alert.alert("Bağlantı Hatası", "İnternet bağlantınızı kontrol edin.");
    } finally {
      setBusy(false);
    }
  };

  // Üye çıkarma fonksiyonu
  const handleRemoveMember = async (member: NonNullable<GroupData['members']>[0]) => {
    if (!group || !isCurrentUserAdmin()) {
      Alert.alert("Hata", "Bu işlemi yapmaya yetkiniz yok.");
      return;
    }

    if (member.user_id === user?.id) {
      Alert.alert("Hata", "Kendinizi gruptan çıkaramazsınız.");
      return;
    }

    const memberName = member.users?.full_name || member.users?.email || 'Bilinmeyen Kullanıcı';
    
    Alert.alert(
      "Üyeyi Çıkar",
      `${memberName} adlı kullanıcıyı gruptan çıkarmak istediğinizden emin misiniz?`,
      [
        { text: "İptal", style: "cancel" },
        { 
          text: "Çıkar", 
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              const { error } = await supabase
                .from('group_members')
                .delete()
                .eq('group_id', group.id)
                .eq('user_id', member.user_id);

              if (error) throw error;

              Alert.alert("Başarılı", "Üye gruptan çıkarıldı.");
              fetchGroupDetails();
            } catch (_error) {
      // Error handled silently

              Alert.alert("Hata", "Üye çıkarılamadı. Tekrar deneyin.");
            } finally {
              setBusy(false);
            }
          }
        }
      ]
    );
  };

  // Harcama silme fonksiyonu
  const handleDeleteExpense = async (expense: Expense) => {
    if (!group || !isCurrentUserAdmin()) {
      Alert.alert("Hata", "Bu işlemi yapmaya yetkiniz yok.");
      return;
    }

    Alert.alert(
      "Harcamayı Sil",
      `"${expense.title}" harcamasını silmek istediğinizden emin misiniz?`,
      [
        { text: "İptal", style: "cancel" },
        { 
          text: "Sil", 
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              const { error } = await supabase
                .from('expenses')
                .delete()
                .eq('id', expense.id);

              if (error) throw error;

              Alert.alert("Başarılı", "Harcama silindi.");
              fetchGroupDetails();
            } catch (_error) {
      // Error handled silently

              Alert.alert("Hata", "Harcama silinemedi. Tekrar deneyin.");
            } finally {
              setBusy(false);
            }
          }
        }
      ]
    );
  };

  // Davet kodu yenileme fonksiyonu
  const handleRegenerateInviteCode = async () => {
    if (!group || !isCurrentUserAdmin()) {
      Alert.alert("Hata", "Bu işlemi yapmaya yetkiniz yok.");
      return;
    }

    setShowRegenerateConfirmModal(true);
  };

  // Davet kodu iptal etme fonksiyonu
  const handleDisableInviteCode = async () => {
    if (!group || !isCurrentUserAdmin()) {
      Alert.alert("Hata", "Bu işlemi yapmaya yetkiniz yok.");
      return;
    }

    // Davet kodu zaten yoksa uyarı ver
    if (!group.invite_code) {
      setShowInviteCodeWarningModal(true);
      return;
    }

    setShowDisableConfirmModal(true);
  };

  // Davet kodunu iptal etme işlemi
  const handleDisableInviteCodeConfirm = async () => {
    setShowDisableConfirmModal(false);
    setBusy(true);
    try {
      const { data, error } = await supabase
        .rpc('disable_invite_code', {
          group_id: group?.id,
          admin_user_id: user?.id
        });

      if (error) throw error;

      Alert.alert("Başarılı", "Davet kodu iptal edildi.");
      fetchGroupDetails();
    } catch (_error) {
      // Error handled silently

      Alert.alert("Hata", "Davet kodu iptal edilemedi. Tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  };

  if (!isNewGroup) {
    if (loading || !group) {
      return (
        <>
          <StatusBar style="light" />
          <SafeAreaView style={styles.container}>
            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Skeleton Loading */}
              <View style={styles.skeletonHeader}>
                <View style={styles.skeletonTitle} />
                <View style={styles.skeletonSubtitle} />
              </View>

              <View style={styles.skeletonStats}>
                <View style={styles.skeletonStatCard}>
                  <View style={styles.skeletonStatNumber} />
                  <View style={styles.skeletonStatLabel} />
                </View>
                <View style={styles.skeletonStatCard}>
                  <View style={styles.skeletonStatNumber} />
                  <View style={styles.skeletonStatLabel} />
                </View>
              </View>

              <View style={styles.skeletonSection}>
                <View style={styles.skeletonSectionTitle} />
                <View style={styles.skeletonCard} />
              </View>

              <View style={styles.skeletonSection}>
                <View style={styles.skeletonSectionTitle} />
                <View style={styles.skeletonCard} />
                <View style={styles.skeletonCard} />
              </View>
            </ScrollView>
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
              <Text style={styles.errorTitle}>Ev bulunamadı 😔</Text>
              <Text style={styles.errorText}>Bu ev mevcut değil veya erişim izniniz yok.</Text>
              <Button
                title="Ana Sayfaya Dön"
                onPress={() => router.back()}
                variant="outline"
                style={styles.backButton}
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
          {/* Floating Geri Butonu */}
          <TouchableOpacity 
            style={styles.floatingBackButton}
            onPress={() => router.back()}
          >
            <Text style={styles.floatingBackButtonText}>◀</Text>
          </TouchableOpacity>
          
          <ScrollView 
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            onScroll={(event) => {
              const newScrollY = event.nativeEvent.contentOffset.y;
              // Sadece büyük değişikliklerde log at (spam'i önlemek için)
              if (Math.abs(newScrollY - scrollPosition) > 10) {
                // Scroll position logging could be added here if needed
              }
              setScrollPosition(newScrollY);
            }}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchGroupDetails(true)}
                tintColor="#00D4FF"
                colors={['#00D4FF']}
              />
            }
          >
            {/* Filtrenin Üstündeki Tüm Content */}
            <View 
              ref={aboveFilterContentRef}
              onLayout={(event) => {
                const newHeight = event.nativeEvent.layout.height;
                const heightDiff = newHeight - aboveFilterHeight;
                const _currentTime = new Date().toLocaleTimeString();
                




                
                // Height'ı önce güncelle
                setAboveFilterHeight(newHeight);
                
                // Eğer boyut değişikliği varsa scroll'ü kompanse et
                // SADECE initial load tamamlandıktan sonra VE filtre aktif iken VE chart type değişmiyorken VE veri yenilenmiyor iken
                if (aboveFilterHeight > 0 && heightDiff !== 0 && isInitialLoadComplete && isFilterActive && !isChartTypeChanging && !isDataRefreshing) {
                  const currentScrollY = scrollPosition;
                  // İçerik küçülürse scroll yukarı kayar, büyürse aşağı kayar
                  // Bu durumda scroll pozisyonunu ters yönde ayarlamamız gerekir
                  const targetScrollY = Math.max(0, currentScrollY + heightDiff);
                  





                  
                  // setTimeout ile smooth güncelleme
                  setTimeout(() => {
                    if (scrollViewRef.current) {
                      scrollViewRef.current.scrollTo({ 
                        y: targetScrollY, 
                        animated: false 
                      });


                    }
                  }, 0);
                } else if (aboveFilterHeight === 0) {
                  // Initial layout - no scroll adjustment needed
                } else {
                  // No height change - no scroll adjustment needed
                }
              }}
            >
            
            {/* Header */}
            {loading ? (
              <SkeletonGroupHeader />
            ) : (
              <View style={styles.futuristicHeaderContainer}>
                <View style={styles.fadeBackground} />
                <View style={styles.fadeOverlay} />
                
                <View style={styles.futuristicHeader}>
                  <View style={styles.heroSection}>
                    <View style={styles.iconContainer}>
                      <View style={styles.iconGlowRing} />
                      <View style={styles.iconCircle}>
                        <Text style={styles.iconText}>🏛️</Text>
                      </View>
                    </View>
                    
                    <View style={styles.heroTextSection}>
                      <Text style={styles.heroTitle}>{group.name}</Text>
                      {group.description && (
                        <Text style={styles.heroSubtitle}>{group.description}</Text>
                      )}
                    </View>
                  </View>
                </View>
                
                <View style={styles.btnShadowContainer}>
                  <TouchableOpacity 
                    style={styles.modernBtn}
                    onPress={() => router.push(`/(home)/group/${id}/notifications`)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.notificationButtonText}>🔔</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Harcama Dağılım Grafiği */}
            {loading ? (
              <SkeletonChart />
            ) : (
            (() => {
              const chartData = calculateMemberExpenseDistribution();
              if (chartData.length > 0) {
                const totalAmount = chartData.reduce((sum, item) => sum + item.population, 0);
                
                // NeonDonutChart için data formatı
                const donutData = chartData.map(item => {
                  // İlgili member'ı bul - hem full name hem de first name ile karşılaştır
                  const member = group.members?.find(m => {
                    const fullName = m.users?.full_name || m.users?.email?.split('@')[0] || 'Üye';
                    const firstName = m.users?.full_name?.split(' ')[0] || m.users?.email?.split('@')[0] || 'Üye';
                    
                    // Item name'i hem full name hem de first name ile karşılaştır
                    return fullName === item.name || firstName === item.name;
                  });
                  
                  // Donut ortasında gösterilecek kısa isim (first name)
                  const shortName = member?.users?.full_name?.split(' ')[0] || 
                                  member?.users?.email?.split('@')[0] || 'Üye';
                  
                  return {
                    label: item.name, // Legend'da tam isim
                    shortLabel: shortName, // Donut ortasında kısa isim
                    value: item.population,
                    color: item.color,
                    userId: member?.user_id // User ID'yi ekle
                  };
                });
                
                return (
                  <View style={[
                    styles.chartSection,
                    chartType === 'bar' && styles.chartSectionBar,
                    chartType === 'donut' && styles.chartSectionDonut
                  ]}>
                    <View style={[
                      styles.chartContainer, 
                      chartType === 'donut' && styles.chartContainerTransparent,
                      chartType === 'bar' && styles.chartContainerHidden
                    ]}>
                      {/* Floating grafik türü seçimi */}
                      <View style={[
                        styles.floatingToggleContainer, 
                        chartType === 'bar' && styles.floatingToggleContainerBar
                      ]}>
                        <View style={styles.floatingToggle}>
                          <TouchableOpacity
                            style={[styles.floatingToggleButton, chartType === 'bar' && styles.floatingToggleButtonActive]}
                            onPress={() => {
                              setIsChartTypeChanging(true);
                              setChartType('bar');
                              setTimeout(() => setIsChartTypeChanging(false), 100);
                            }}
                          >
                            <Text style={[styles.floatingToggleText, chartType === 'bar' && styles.floatingToggleTextActive]}>
                              📊
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.floatingToggleButton, chartType === 'donut' && styles.floatingToggleButtonActive]}
                            onPress={() => {
                              setIsChartTypeChanging(true);
                              setChartType('donut');
                              setTimeout(() => setIsChartTypeChanging(false), 100);
                            }}
                          >
                            <Text style={[styles.floatingToggleText, chartType === 'donut' && styles.floatingToggleTextActive]}>
                              🍩
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      {chartType === 'bar' ? (
                        /* Bar Chart */
                        <View style={[styles.simpleChart, styles.chartContentSpacingBar]}>
                          {chartData.map((item, index) => {
                            const percentage = (item.population / totalAmount) * 100;
                            return (
                              <View key={index} style={styles.chartRow}>
                                <View style={styles.chartLabelContainer}>
                                  <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                                  <Text style={styles.chartLabel}>{item.name}</Text>
                                </View>
                                <View style={styles.chartBarContainer}>
                                  <View 
                                    style={[
                                      styles.chartBar, 
                                      { 
                                        backgroundColor: item.color,
                                        width: `${percentage}%`
                                      }
                                    ]} 
                                  />
                                  <Text style={styles.chartValue}>
                                    ₺{item.population.toFixed(0)} ({percentage.toFixed(0)}%)
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        /* Custom Donut Chart */
                        <View style={styles.chartContentSpacingDonut}>
                          <CustomDonut 
                            data={donutData}
                            size={280}
                            thickness={42}
                            currentUserId={user?.id}
                          />
                        </View>
                      )}
                    </View>
                  </View>
                );
              } else {
                // Veri olmadığında sadece boşluk
                return <View style={styles.emptyChartSpacer} />;
              }
            })())}

            {/* İstatistikler */}
            {loading ? (
              <SkeletonStats />
            ) : (
              <View style={[
              styles.statsContainer,
              chartType === 'donut' && styles.statsContainerDonut
            ]}>
              <View style={[styles.statCard, styles.memberStatCard]}>
                <View style={styles.statIconContainer}>
                  <View style={styles.memberIcon}>
                    <View style={styles.memberIconDot} />
                    <View style={styles.memberIconBody} />
                  </View>
                </View>
                <Text style={[styles.statNumber, { color: '#FF0080', textShadowColor: 'rgba(255, 0, 128, 0.4)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }]} numberOfLines={1} adjustsFontSizeToFit>{group.member_count}</Text>
                <Text style={styles.statLabel} numberOfLines={2}>Kişi</Text>
              </View>
              <View style={[styles.statCard, styles.expenseStatCard]}>
                <View style={styles.statIconContainer}>
                  <View style={styles.expenseIcon}>
                    <View style={styles.expenseIconCircle} />
                    <View style={styles.expenseIconSymbol} />
                  </View>
                </View>
                {statsLoading ? (
                  <View style={styles.statLoadingContainer}>
                    <Animated.View style={[styles.statLoadingDot, { opacity: statDot1Opacity }]} />
                    <Animated.View style={[styles.statLoadingDot, { opacity: statDot2Opacity }]} />
                    <Animated.View style={[styles.statLoadingDot, styles.statLoadingDot3, { opacity: statDot3Opacity }]} />
                  </View>
                ) : (
                  <Text style={[styles.statNumber, { color: '#00FF94', textShadowColor: 'rgba(0, 255, 148, 0.4)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 }]} numberOfLines={1} adjustsFontSizeToFit>₺{group.total_expenses?.toFixed(2)}</Text>
                )}
                <Text style={styles.statLabel} numberOfLines={2}>{getStatsLabel()}</Text>
              </View>
            </View>
            )}

            {/* Harcama Ekle */}
            {!loading && (
              <View style={styles.addExpenseSection}>
              <Button
                title="💸 Harcama Ekle"
                onPress={() => {
                  router.push(`/(home)/expense/add?groupId=${group.id}`);
                }}
                style={styles.addExpenseButton}
              />
            </View>
            )}

            {/* Kişiler */}
            {loading ? (
              <SkeletonMembers />
            ) : (
              <View style={styles.membersSection}>
              <Text style={styles.sectionTitle}>👥 Kişiler</Text>
              {group.members?.map((member) => {
                const memberColor = getMemberColor(member.user_id);
                return (
                  <View key={member.id} style={[
                    styles.memberCard,
                    { 
                      backgroundColor: memberColor.lightBg,
                      borderLeftWidth: 4,
                      borderLeftColor: memberColor.bg
                    }
                  ]}>
                    <View style={[
                      styles.memberAvatar, 
                      { 
                        backgroundColor: memberColor.bg,
                        shadowColor: memberColor.shadow,
                      }
                    ]}>
                      <Text style={styles.memberAvatarText}>
                        {member.users?.full_name?.charAt(0) || 
                         member.users?.email?.charAt(0) || 
                         '?'}
                      </Text>
                    </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>
                      {member.users?.full_name || member.users?.email || 'Bilinmeyen Kullanıcı'}
                    </Text>
                    <Text style={[
                      styles.memberRole,
                      { color: memberColor.bg }
                    ]}>
                      {member.role === 'admin' ? '👑 Admin' : '👤 Kişi'}
                    </Text>
                  </View>
                  
                  <View style={styles.memberActions}>
                    {/* Renk değiştirme butonu */}
                    <TouchableOpacity
                      style={[styles.colorChangeButton, { borderColor: memberColor.bg }]}
                      onPress={() => openColorPicker(member.user_id)}
                    >
                      <Text style={styles.colorChangeButtonText}>🎨</Text>
                    </TouchableOpacity>
                    
                    {/* Admin için üye çıkarma butonu */}
                    {isCurrentUserAdmin() && member.user_id !== user?.id && (
                      <TouchableOpacity
                        style={[styles.removeMemberButton, { borderColor: '#FF6B6B' }]}
                        onPress={() => handleRemoveMember(member)}
                      >
                        <Text style={styles.removeMemberButtonText}>🗑️</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                );
              })}
            </View>
            )}
            
            {/* Above Filter Content Container sonu */}
            </View>

             {/* Son Harcamalar */}
             <View 
               ref={filterSectionRef}
               style={styles.expensesSection}
               onLayout={(event) => {
                 setFilterSectionY(event.nativeEvent.layout.y);
               }}
             >
               <Text style={styles.sectionTitle}>💰 Son Harcamalar</Text>
               
               {/* Filtre Butonları */}
               <ScrollView 
                 horizontal 
                 showsHorizontalScrollIndicator={false}
                 style={styles.filterScroll}
                 contentContainerStyle={styles.filterContainer}
               >
                 {filterOptions.map((option) => (
                   <Button
                     key={option.value}
                     title={option.label}
                     onPress={() => handleFilterChange(option.value)}
                     variant={selectedFilter === option.value ? 'primary' : 'secondary'}
                     size="small"
                     style={styles.filterButton}
                   />
                 ))}
               </ScrollView>
               
               {/* Seçili Tarih Aralığını Göster */}
               {(() => {
                 const currentRange = getDateRange(selectedFilter);
                 if (currentRange && selectedFilter !== 'all') {
                   const startDate = new Date(currentRange.start);
                   const endDate = new Date(currentRange.end);
                   const startFormatted = startDate.toLocaleDateString('tr-TR');
                   const endFormatted = endDate.toLocaleDateString('tr-TR');
                   
                   return (
                     <View style={styles.dateRangeDisplay}>
                       <Text style={styles.dateRangeText}>
                         📅 {startFormatted} - {endFormatted}
                       </Text>
                     </View>
                   );
                 }
                 return null;
               })()}
              
              {/* Özel Tarih Aralığı */}
              {selectedFilter === 'custom' && (
                <View style={styles.customDateContainer}>
                  <View style={styles.dateRow}>
                    <View style={styles.dateInputContainer}>
                      <Text style={styles.dateLabel}>Başlangıç</Text>
                      <TouchableOpacity 
                        style={styles.dateButton}
                        onPress={() => setShowStartDatePicker(true)}
                      >
                        <Text style={styles.dateButtonText}>
                          📅 {customStartDate.toLocaleDateString('tr-TR')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    
                    <View style={styles.dateInputContainer}>
                      <Text style={styles.dateLabel}>Bitiş</Text>
                      <TouchableOpacity 
                        style={styles.dateButton}
                        onPress={() => setShowEndDatePicker(true)}
                      >
                        <Text style={styles.dateButtonText}>
                          📅 {customEndDate.toLocaleDateString('tr-TR')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              {/* Date Pickers */}
              {showStartDatePicker && (
                <DateTimePicker
                  value={customStartDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_: any, selectedDate?: Date) => {
                    setShowStartDatePicker(false);
                    if (selectedDate) {
                      setCustomStartDate(selectedDate);
                      console.log('Custom start date selected:', {
                        iso: selectedDate.toISOString().split('T')[0],
                        local: `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`,
                        raw: selectedDate.toString()
                      });
                      // Seçilen tarihi direkt kullanarak veriyi yenile
                      if (selectedFilter === 'custom') {
                        const tempRange = getDateRange('custom', selectedDate, customEndDate);

                        setTimeout(() => fetchGroupDetails(), 100);
                      }
                    }
                  }}
                  maximumDate={new Date()}
                />
              )}

              {showEndDatePicker && (
                <DateTimePicker
                  value={customEndDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_: any, selectedDate?: Date) => {
                    setShowEndDatePicker(false);
                    if (selectedDate) {
                      console.log('Setting custom end date:', {
                        oldDate: customEndDate.toString(),
                        newDate: selectedDate.toString(),
                        oldTime: customEndDate.getTime(),
                        newTime: selectedDate.getTime()
                      });
                      setCustomEndDate(selectedDate);
                      console.log('Custom end date selected:', {
                        iso: selectedDate.toISOString().split('T')[0],
                        local: `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`,
                        raw: selectedDate.toString()
                      });
                      // Seçilen tarihi direkt kullanarak veriyi yenile
                      if (selectedFilter === 'custom') {
                        const tempRange = getDateRange('custom', customStartDate, selectedDate);

                        setTimeout(() => fetchGroupDetails(), 100);
                      }
                    }
                  }}
                  maximumDate={new Date()}
                  minimumDate={customStartDate}
                />
              )}
              
              {expenseLoading ? (
                <View style={styles.expenseLoadingContainer}>
                  <Text style={styles.expenseLoadingText}>Harcamalar yükleniyor...</Text>
                </View>
              ) : expenses.length === 0 ? (
                <View style={styles.emptyExpenses}>
                  <Text style={styles.emptyExpensesText}>Henüz harcama yok</Text>
                </View>
              ) : (
                expenses.slice(0, 5).map((expense) => {
                  const expenseColor = getMemberColorByUserId(expense.created_by);
                  return (
                    <View key={expense.id} style={[
                      styles.expenseCard,
                      { 
                        borderLeftWidth: 4, 
                        borderLeftColor: expenseColor.bg,
                        backgroundColor: expenseColor.lightBg
                      }
                    ]}>
                      <View style={styles.expenseInfo}>
                        <Text style={styles.expenseTitle}>{expense.title}</Text>
                        <Text style={[
                          styles.expenseUser,
                          { color: expenseColor.bg, fontWeight: '600' }
                        ]}>
                          {expense.users?.full_name || 
                           expense.users?.email || 
                           'Bilinmeyen Kullanıcı'}
                        </Text>
                        <Text style={styles.expenseDate}>
                          {new Date(expense.expense_date).toLocaleDateString('tr-TR')}
                        </Text>
                      </View>
                      
                      <View style={styles.expenseRight}>
                        <Text style={[
                          styles.expenseAmount,
                          { color: expenseColor.bg }
                        ]}>₺{expense.amount.toFixed(2)}</Text>
                        
                        {/* Admin için harcama silme butonu */}
                        {isCurrentUserAdmin() && (
                          <TouchableOpacity
                            style={[styles.deleteExpenseButton, { borderColor: '#FF6B6B' }]}
                            onPress={() => handleDeleteExpense(expense)}
                          >
                            <Text style={styles.deleteExpenseButtonText}>🗑️</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
              
              {/* Tüm Harcamaları Görüntüle Butonu */}
              {expenses.length > 0 && (
                <TouchableOpacity 
                  style={styles.viewAllExpensesButton}
                  onPress={() => router.push(`/(home)/expense/list?groupId=${id}`)}
                >
                  <Text style={styles.viewAllExpensesButtonText}>
                    + Tüm Harcamaları Görüntüle ({expenses.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Davet Kodu - Modern Tasarım */}
            <View style={styles.modernInviteSection}>
              <View style={styles.modernInviteHeader}>
                <View style={styles.modernInviteIcon}>
                  <Text style={styles.modernInviteIconText}>🔗</Text>
                </View>
                <View style={styles.modernInviteTextContainer}>
                  <Text style={styles.modernInviteTitle}>Grup Davet Kodu</Text>
                  <Text style={styles.modernInviteSubtitle}>Bu kodu paylaşarak yeni üyeler ekleyin</Text>
                </View>
              </View>

              {/* Davet Kodu Display */}
              <View style={styles.modernInviteCodeContainer}>
                <View style={styles.modernInviteCodeDisplay}>
                  <Text style={styles.modernInviteCode}>{group.invite_code || 'Kod Yok'}</Text>
                </View>
                
                {/* Ana Aksiyonlar */}
                <View style={styles.modernInviteActions}>
                  <TouchableOpacity 
                    style={[styles.modernActionButton, styles.copyActionButton, copySuccess && styles.actionButtonSuccess, !group.invite_code && !copySuccess && styles.actionButtonDisabled]}
                    disabled={!group.invite_code || copySuccess}
                    onPress={async () => {
                      try {
                        clearAllSuccessStates();
                        await Clipboard.setStringAsync(group.invite_code);
                        setCopySuccess(true);
                        copyTimeoutRef.current = setTimeout(() => {
                          setCopySuccess(false);
                        }, 2000);
                      } catch (_error) {
      // Error handled silently

                        Alert.alert("❌ Hata", `Kopyalama başarısız: ${_error instanceof Error ? _error.message : String(_error)}`);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modernActionIcon}>
                      {copySuccess ? '✓' : '📋'}
                    </Text>
                    <Text style={[styles.modernActionText, copySuccess && styles.actionTextSuccess]}>
                      {copySuccess ? 'Kopyalandı' : 'Kopyala'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.modernActionButton, styles.linkActionButton, linkCopySuccess && styles.actionButtonSuccess, !group.invite_code && !linkCopySuccess && styles.actionButtonDisabled]}
                    disabled={!group.invite_code || linkCopySuccess}
                    onPress={() => group.invite_code && copyInviteLink(group.invite_code)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modernActionIcon}>
                      {linkCopySuccess ? '✓' : '🔗'}
                    </Text>
                    <Text style={[styles.modernActionText, linkCopySuccess && styles.actionTextSuccess]}>
                      {linkCopySuccess ? 'Link Kopyalandı' : 'Link Kopyala'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.modernActionButton, styles.shareActionButton, (!group.invite_code || shareLoading) && styles.actionButtonDisabled]}
                    disabled={!group.invite_code || shareLoading}
                    onPress={() => group.invite_code && shareInviteLink(group.invite_code)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modernActionIcon}>
                      {shareLoading ? '⏳' : '📤'}
                    </Text>
                    <Text style={styles.modernActionText}>
                      {shareLoading ? 'Paylaşılıyor...' : 'Paylaş'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Admin Yönetimi */}
                {isCurrentUserAdmin() && (
                  <View style={styles.modernAdminSection}>
                    <View style={styles.modernAdminDivider} />
                    <View style={styles.modernAdminActions}>
                      <TouchableOpacity 
                        style={styles.modernAdminButton}
                        onPress={handleRegenerateInviteCode}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.modernAdminIcon}>🔄</Text>
                        <Text style={styles.modernAdminText}>Yeni Kod Oluştur</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[styles.modernAdminButton, styles.modernAdminDangerButton]}
                        onPress={handleDisableInviteCode}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.modernAdminIcon}>🚫</Text>
                        <Text style={[styles.modernAdminText, styles.modernAdminDangerText]}>Kodu İptal Et</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </View>


            {/* Admin için Grup Silme Butonu */}
            {isCurrentUserAdmin() && (
              <View style={styles.deleteSection}>
                <Button
                  title="🗑️ Grubu Sil"
                  onPress={handleDeleteGroup}
                  variant="outline"
                  style={styles.deleteButton}
                  textStyle={{ color: '#FF6B6B' }}
                  disabled={busy}
                />
              </View>
            )}

            {/* Geri Dön */}
            <Button
              title="← Ana Sayfaya Dön"
              onPress={() => router.back()}
              variant="outline"
              style={styles.backButton}
            />
          </ScrollView>
          
          {/* Basit Renk Seçici Overlay - Ana sayfa ile aynı */}
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
                backgroundColor: '#151524',
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
                }}>Profilin ve harcamalarının rengini seç</Text>
                
                <View style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  gap: 12,
                  marginBottom: 24,
                }}>
                  {memberColors.map((color, index) => {
                    // Mevcut seçili rengi bul
                    const currentColorIndex = selectedMember ? 
                      (memberCustomColors[selectedMember] !== undefined ? 
                        memberCustomColors[selectedMember] : 
                        (group?.members?.findIndex(m => m.user_id === selectedMember) || 0) % memberColors.length
                      ) : 0;
                    
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
                        onPress={() => selectedMember && handleColorChange(selectedMember, index)}
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
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    paddingVertical: 12,
                    paddingHorizontal: 24,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.2)',
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

          {/* Delete Modal */}
          {showDeleteModal && (
            <View style={{
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
            }}>
              <View style={{
                backgroundColor: '#151524',
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
                    <Text style={{ fontSize: 28 }}>🗑️</Text>
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
                }}>Grubu Sil</Text>
                
                {/* Message */}
                <Text style={{
                  fontSize: 16,
                  color: '#9CA3AF',
                  textAlign: 'center',
                  marginBottom: 24,
                  lineHeight: 22,
                }}>{`"${group?.name}" grubunu silmek istediğinizden emin misiniz?\n\n⚠️ Bu işlem geri alınamaz ve tüm harcama kayıtları silinecektir.`}</Text>
                
                {/* Buttons */}
                <View style={{
                  flexDirection: 'row',
                  gap: 12,
                }}>
                  {/* Cancel Button */}
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 12,
                      paddingVertical: 14,
                      paddingHorizontal: 20,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    }}
                    onPress={() => setShowDeleteModal(false)}
                  >
                    <Text style={{
                      color: '#FFFFFF',
                      fontSize: 16,
                      fontWeight: '600',
                      textAlign: 'center',
                    }}>İptal</Text>
                  </TouchableOpacity>
                  
                  {/* Delete Button */}
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      backgroundColor: '#1A1A2F',
                      borderWidth: 2,
                      borderColor: '#FF6B6B',
                      shadowColor: '#FF6B6B',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 5,
                      paddingHorizontal: 24,
                      paddingVertical: 14,
                      minHeight: 48,
                    }}
                    onPress={confirmDeleteGroup}
                  >
                    <Text style={{
                      fontWeight: '700',
                      textAlign: 'center',
                      textShadowColor: 'rgba(255, 255, 255, 0.3)',
                      textShadowOffset: { width: 0, height: 0 },
                      textShadowRadius: 10,
                      color: '#FF6B6B',
                      fontSize: 16,
                    }}>Sil</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Invite Code Warning Modal */}
          {showInviteCodeWarningModal && (
            <View style={{
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
            }}>
              <View style={{
                backgroundColor: '#151524',
                borderRadius: 20,
                padding: 24,
                width: 300,
                borderWidth: 2,
                borderColor: '#FFB84D',
                margin: 20,
                shadowColor: '#FFB84D',
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
                    backgroundColor: 'rgba(255, 184, 77, 0.15)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 2,
                    borderColor: 'rgba(255, 184, 77, 0.3)',
                  }}>
                    <Text style={{ fontSize: 28 }}>⚠️</Text>
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
                }}>Uyarı</Text>
                
                {/* Message */}
                <Text style={{
                  fontSize: 16,
                  color: '#9CA3AF',
                  textAlign: 'center',
                  marginBottom: 24,
                  lineHeight: 22,
                }}>Zaten iptal edilmiş bir davet kodu bulunmuyor.</Text>
                
                {/* Button */}
                <TouchableOpacity
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  }}
                  onPress={() => setShowInviteCodeWarningModal(false)}
                >
                  <Text style={{
                    color: '#FFFFFF',
                    fontSize: 16,
                    fontWeight: '600',
                    textAlign: 'center',
                  }}>Tamam</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Regenerate Confirmation Modal */}
          {showRegenerateConfirmModal && (
            <View style={{
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
            }}>
              <View style={{
                backgroundColor: '#151524',
                borderRadius: 20,
                padding: 24,
                width: 300,
                borderWidth: 2,
                borderColor: '#00D4FF',
                margin: 20,
                shadowColor: '#00D4FF',
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
                    backgroundColor: 'rgba(0, 212, 255, 0.15)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 2,
                    borderColor: 'rgba(0, 212, 255, 0.3)',
                  }}>
                    <Text style={{ fontSize: 28 }}>🔄</Text>
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
                }}>Davet Kodunu Yenile</Text>
                
                {/* Message */}
                <Text style={{
                  fontSize: 16,
                  color: '#9CA3AF',
                  textAlign: 'center',
                  marginBottom: 24,
                  lineHeight: 22,
                }}>Yeni davet kodu oluşturulacak. Eski kod çalışmayacak. Devam etmek istiyor musunuz?</Text>
                
                {/* Buttons */}
                <View style={{
                  flexDirection: 'row',
                  gap: 12,
                }}>
                  {/* Cancel Button */}
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 12,
                      paddingVertical: 14,
                      paddingHorizontal: 20,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    }}
                    onPress={() => setShowRegenerateConfirmModal(false)}
                  >
                    <Text style={{
                      color: '#FFFFFF',
                      fontSize: 16,
                      fontWeight: '600',
                      textAlign: 'center',
                    }}>İptal</Text>
                  </TouchableOpacity>
                  
                  {/* Confirm Button */}
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      backgroundColor: '#1A1A2F',
                      borderWidth: 2,
                      borderColor: '#00D4FF',
                      shadowColor: '#00D4FF',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 5,
                      paddingHorizontal: 24,
                      paddingVertical: 14,
                      minHeight: 48,
                    }}
                    onPress={async () => {
                      setShowRegenerateConfirmModal(false);
                      setBusy(true);
                      try {
                        // Backend fonksiyonunu kullanarak yeni davet kodu oluştur
                        const { data: newInviteCode, error } = await supabase
                          .rpc('regenerate_invite_code', {
                            group_id: group.id,
                            admin_user_id: user?.id
                          });

                        if (error) throw error;

                        setNewGeneratedCode(newInviteCode);
                        setShowRegenerateSuccessModal(true);
                        fetchGroupDetails();
                      } catch (_error) {
      // Error handled silently

                        Alert.alert("Hata", "Davet kodu yenilenemedi. Tekrar deneyin.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Text style={{
                      fontWeight: '700',
                      textAlign: 'center',
                      textShadowColor: 'rgba(255, 255, 255, 0.3)',
                      textShadowOffset: { width: 0, height: 0 },
                      textShadowRadius: 10,
                      color: '#00D4FF',
                      fontSize: 16,
                    }}>Yenile</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Regenerate Success Modal */}
          {showRegenerateSuccessModal && (
            <View style={{
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
            }}>
              <View style={{
                backgroundColor: '#151524',
                borderRadius: 20,
                padding: 24,
                width: 300,
                borderWidth: 2,
                borderColor: '#4ADE80',
                margin: 20,
                shadowColor: '#4ADE80',
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
                    backgroundColor: 'rgba(74, 222, 128, 0.15)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderWidth: 2,
                    borderColor: 'rgba(74, 222, 128, 0.3)',
                  }}>
                    <Text style={{ fontSize: 28 }}>✅</Text>
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
                }}>Başarılı!</Text>
                
                {/* Message */}
                <Text style={{
                  fontSize: 16,
                  color: '#9CA3AF',
                  textAlign: 'center',
                  marginBottom: 16,
                  lineHeight: 22,
                }}>Yeni davet kodu oluşturuldu:</Text>

                {/* New Code Display */}
                <View style={{
                  backgroundColor: 'rgba(0, 212, 255, 0.1)',
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 24,
                  borderWidth: 1,
                  borderColor: 'rgba(0, 212, 255, 0.3)',
                }}>
                  <Text style={{
                    fontSize: 20,
                    fontWeight: '800',
                    color: '#00D4FF',
                    textAlign: 'center',
                    textShadowColor: 'rgba(0, 212, 255, 0.8)',
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 15,
                  }}>{newGeneratedCode}</Text>
                </View>
                
                {/* Button */}
                <TouchableOpacity
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    paddingVertical: 14,
                    paddingHorizontal: 20,
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  }}
                  onPress={() => {
                    setShowRegenerateSuccessModal(false);
                    setNewGeneratedCode('');
                  }}
                >
                  <Text style={{
                    color: '#FFFFFF',
                    fontSize: 16,
                    fontWeight: '600',
                    textAlign: 'center',
                  }}>Tamam</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Disable Confirmation Modal */}
          {showDisableConfirmModal && (
            <View style={{
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
            }}>
              <View style={{
                backgroundColor: '#151524',
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
                    <Text style={{ fontSize: 28 }}>⚠️</Text>
                  </View>
                </View>
                
                {/* Title */}
                <Text style={{
                  fontSize: 22,
                  fontWeight: '700',
                  color: '#FFFFFF',
                  textAlign: 'center',
                  marginBottom: 8,
                  textShadowColor: 'rgba(255, 255, 255, 0.3)',
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 8,
                }}>Kodu İptal Et</Text>
                
                {/* Message */}
                <Text style={{
                  fontSize: 16,
                  color: '#9CA3AF',
                  textAlign: 'center',
                  marginBottom: 24,
                  lineHeight: 22,
                }}>Davet kodu iptal edilecek ve kimse bu gruptan davet kodunu kullanarak katılamayacak. Devam etmek istiyor musunuz?</Text>
                
                {/* Buttons */}
                <View style={{
                  flexDirection: 'row',
                  gap: 12,
                }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: 12,
                      paddingVertical: 14,
                      paddingHorizontal: 20,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    }}
                    onPress={() => setShowDisableConfirmModal(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={{
                      color: '#FFFFFF',
                      fontSize: 16,
                      fontWeight: '600',
                      textAlign: 'center',
                    }}>Vazgeç</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      backgroundColor: '#1A1A2F',
                      borderWidth: 2,
                      borderColor: '#FF6B6B',
                      shadowColor: '#FF6B6B',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 5,
                      paddingHorizontal: 24,
                      paddingVertical: 14,
                      minHeight: 48,
                    }}
                    onPress={handleDisableInviteCodeConfirm}
                    activeOpacity={0.8}
                  >
                    <Text style={{
                      fontWeight: '700',
                      textAlign: 'center',
                      textShadowColor: 'rgba(255, 255, 255, 0.3)',
                      textShadowOffset: { width: 0, height: 0 },
                      textShadowRadius: 10,
                      color: '#FF6B6B',
                      fontSize: 16,
                    }}>İptal Et</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </SafeAreaView>
      </>
    );
  }

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
            contentContainerStyle={styles.createScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Modern Header - Gruba katıl sayfası gibi */}
            <View style={styles.futuristicHeaderContainer}>
              <View style={styles.fadeBackground} />
              <View style={styles.fadeOverlay} />
              
              <View style={styles.futuristicHeader}>
                <View style={styles.heroSection}>
                  <View style={styles.iconContainer}>
                    <View style={styles.iconGlowRing} />
                    <View style={styles.iconCircle}>
                      <Text style={styles.iconText}>✨</Text>
                    </View>
                  </View>
                  
                  <View style={styles.heroTextSection}>
                    <Text style={styles.heroTitle}>Yeni Grup Oluştur</Text>
                    <Text style={styles.heroSubtitle}>
                      Arkadaşlarınla harcamalarınızı paylaşmaya başla
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Grup Bilgileri Section */}
            <View style={[styles.modernSection, styles.primarySection]}>
              <View style={styles.modernSectionHeader}>
                <View style={[styles.sectionIconContainer, styles.primaryIconContainer]}>
                  <Text style={styles.sectionIcon}>📝</Text>
                </View>
                <Text style={styles.modernSectionTitle}>Grup Bilgileri</Text>
              </View>
              
              <View style={styles.formContainer}>
              <Input
                label="Grup İsmi"
                placeholder="Örn: Tatil Grubu, Ofis Masrafları..."
          value={name}
          onChangeText={setName}
                error={errors.name}
                editable={!busy}
                autoFocus
                  focusColor="#00FF94"
                  containerStyle={styles.standardInputContainer}
              />
              
              <Input
                label="Açıklama (Opsiyonel)"
                  placeholder="Grup hakkında kısa bir açıklama..."
                value={description}
                onChangeText={setDescription}
                error={errors.description}
          editable={!busy}
                multiline
                numberOfLines={3}
                  focusColor="#00FF94"
                  containerStyle={styles.standardInputContainer}
                />
        
        <Button
                  title="Grubu Oluştur"
          onPress={handleSave}
                loading={busy}
          disabled={busy}
                style={styles.createButton}
                  textStyle={styles.createButtonText}
                />
              </View>
            </View>

            {/* Bilgi Section */}
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
                    • Grup oluşturulduktan sonra otomatik davet kodu oluşturulur{'\n'}
                    • Diğer kişiler bu kodla grubunuza katılabilir{'\n'}
                    • Sen otomatik olarak grup yöneticisi olursun{'\n'}
                    • İstediğin kadar üye ekleyebilirsin
                  </Text>
                </View>
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

        {/* Success Modal */}
        {showSuccessModal && createdGroup && (
          <View style={{
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
          }}>
            <View style={{
              backgroundColor: '#151524',
              borderRadius: 20,
              padding: 24,
              width: 320,
              borderWidth: 2,
              borderColor: '#00FF94',
              margin: 20,
              shadowColor: '#00FF94',
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
                  backgroundColor: 'rgba(0, 255, 148, 0.15)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 2,
                  borderColor: 'rgba(0, 255, 148, 0.3)',
                }}>
                  <Text style={{ fontSize: 28 }}>🎉</Text>
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
              }}>Harika!</Text>
              
              {/* Message */}
              <Text style={{
                fontSize: 16,
                color: '#9CA3AF',
                textAlign: 'center',
                marginBottom: 24,
                lineHeight: 22,
              }}>{`"${createdGroup.name}" evi başarıyla oluşturuldu!`}</Text>

              {/* Davet Kodu Alanı */}
              <View style={{
                marginBottom: 24,
              }}>
                <Text style={{
                  fontSize: 14,
                  color: '#9CA3AF',
                  textAlign: 'center',
                  marginBottom: 12,
                }}>Davet Kodu</Text>
                
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#1A1A2E',
                  borderRadius: 16,
                  padding: 4, // Daha az padding - buton bitişik olsun
                  borderWidth: 3,
                  borderColor: '#00D4FF',
                  shadowColor: '#00D4FF',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.8,
                  shadowRadius: 20,
                  elevation: 15,
                }}>
                  <View style={{
                    flex: 1,
                    backgroundColor: '#0F0F1A',
                    borderRadius: 12,
                    padding: 16,
                    borderWidth: 2,
                    borderColor: 'rgba(0, 212, 255, 0.5)',
                  }}>
                    <Text style={{
                      fontSize: 20,
                      fontWeight: '900',
                      color: '#00D4FF',
                      letterSpacing: 4,
                      textAlign: 'center',
                      textShadowColor: 'rgba(0, 212, 255, 0.8)',
                      textShadowOffset: { width: 0, height: 0 },
                      textShadowRadius: 15,
                    }}>{createdGroup.invite_code}</Text>
                  </View>
                  
                  <TouchableOpacity 
                    style={{
                      backgroundColor: successCopySuccess ? '#00FF94' : '#00D4FF',
                      borderRadius: 12,
                      width: 52, // Biraz daha büyük - iç container yüksekliğine uygun
                      height: 52,
                      justifyContent: 'center',
                      alignItems: 'center',
                      shadowColor: successCopySuccess ? '#00FF94' : '#00D4FF',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.6,
                      shadowRadius: 12,
                      elevation: 10,
                      marginLeft: 4, // İç border'a bitişik
                    }}
                    disabled={successCopySuccess}
                    onPress={async () => {
                      try {
                        await Clipboard.setStringAsync(createdGroup.invite_code);
                        setSuccessCopySuccess(true);
                        setTimeout(() => {
                          setSuccessCopySuccess(false);
                        }, 2000);
                      } catch (_error) {
      // Error handled silently

                      }
                    }}
                  >
                    {successCopySuccess ? (
                      <Text style={{ 
                        fontSize: 20, 
                        color: '#FFFFFF',
                        fontWeight: '700'
                      }}>✓</Text>
                    ) : (
                      <View style={{
                        width: 18,
                        height: 18,
                        position: 'relative',
                      }}>
                        <View style={{
                          width: 12,
                          height: 14,
                          borderWidth: 2,
                          borderColor: '#FFFFFF',
                          borderRadius: 2,
                          position: 'absolute',
                          top: 2,
                          left: 4,
                          backgroundColor: 'transparent',
                        }} />
                        <View style={{
                          width: 12,
                          height: 14,
                          borderWidth: 2,
                          borderColor: '#FFFFFF',
                          borderRadius: 2,
                          position: 'absolute',
                          top: 0,
                          left: 2,
                          backgroundColor: '#00D4FF',
                        }} />
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
              
              {/* Ana Sayfaya Dön Button */}
              <TouchableOpacity
                style={{
                  backgroundColor: '#151524',
                  borderRadius: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 24,
                  borderWidth: 2,
                  borderColor: '#00FF94',
                  shadowColor: '#00FF94',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 5,
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 48,
                }}
                onPress={() => {
                  setShowSuccessModal(false);
                  router.replace("/(home)/");
                }}
              >
                <Text style={{
                  fontWeight: '700',
                  textAlign: 'center',
                  textShadowColor: 'rgba(255, 255, 255, 0.3)',
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 10,
                  color: '#00FF94',
                  fontSize: 16,
                }}>Ana Sayfaya Dön</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  
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
    borderColor: 'rgba(0, 212, 255, 0.4)',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 15,
    zIndex: 1000,
  },
  floatingBackButtonText: {
    color: '#00D4FF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
    includeFontPadding: false,
    textAlignVertical: 'center',
    textShadowColor: 'rgba(0, 212, 255, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  createScrollContent: {
    paddingBottom: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
    textShadowColor: '#FF0080',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#00D4FF',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
    textShadowColor: 'rgba(0, 212, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  form: {
    flex: 1,
    gap: 20,
  },
  infoBox: {
    backgroundColor: '#151524',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#16213E',
    marginVertical: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00D4FF',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 212, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  futuristicHeaderContainer: { position: 'relative', overflow: 'hidden', minHeight: 140, marginBottom: 32 },
  fadeBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00D4FF', opacity: 0.15 },
  fadeOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  futuristicHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 32, paddingLeft: 50, flex: 1},
  heroSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1 },
  iconContainer: { position: 'relative', marginRight: 20 },
  iconGlowRing: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: 'rgba(0, 212, 255, 0.4)', top: -6, left: -6, shadowColor: '#00D4FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 16, elevation: 12 },
  iconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#00D4FF', justifyContent: 'center', alignItems: 'center', shadowColor: '#00D4FF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 24, elevation: 20, borderWidth: 3, borderColor: 'rgba(255, 255, 255, 0.3)' },
  iconText: { fontSize: 24, textShadowColor: 'rgba(0, 0, 0, 0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  heroTextSection: { flex: 1 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', marginBottom: 4, textShadowColor: 'rgba(255, 255, 255, 0.6)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20, letterSpacing: 0.5 },
  heroSubtitle: { fontSize: 14, color: '#B0B7C3', fontWeight: '500', lineHeight: 20, letterSpacing: 0.2 },
  // Modern Button Styles (ana sayfadan)
  btnShadowContainer: {
    position: 'absolute',
    top: 32,
    right: 20,
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
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#00D4FF',
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 50, //stats ile Harcama Ekle arası boşluk
    paddingHorizontal: 20,
    gap: 10, // Kartlar arası sabit boşluk
  },
  statsContainerDonut: {
    marginTop: -18, // Donut chart ile stats arası boşluğu azalt
  },
  statCard: {
    backgroundColor: '#151524',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    borderWidth: 0,
    width: 150, // Biraz daha geniş
    minHeight: 120, // Biraz daha yüksek
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  memberStatCard: {
    backgroundColor: '#151524',
    shadowColor: '#FF0080',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 128, 0.2)',
  },
  expenseStatCard: {
    backgroundColor: '#151524',
    shadowColor: '#00FF94',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 148, 0.2)',
  },
  statIconContainer: {
    marginBottom: -5,
  },
  memberIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  memberIconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF0080',
    position: 'absolute',
    top: 2,
    shadowColor: '#FF0080',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 6,
  },
  memberIconBody: {
    width: 16,
    height: 12,
    backgroundColor: '#FF0080',
    borderRadius: 8,
    position: 'absolute',
    bottom: 2,
    shadowColor: '#FF0080',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
  expenseIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  expenseIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#00FF94',
    position: 'absolute',
    shadowColor: '#00FF94',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
  expenseIconSymbol: {
    width: 2,
    height: 10,
    backgroundColor: '#00FF94',
    position: 'absolute',
    shadowColor: '#00FF94',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    flexShrink: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 14,
    flexShrink: 1,
    flexWrap: 'wrap',
    maxWidth: '100%',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  
  // Chart Section Styles
  chartSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  chartSectionBar: {
    marginTop: -4, // Histogram için üst başlık ile arasındaki boşluk
  },
  chartSectionDonut: {
    marginTop: 8, // Donut chart için üst başlık ile arasındaki boşluk
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  floatingToggleContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  floatingToggleContainerBar: {
    top: -15, // Histogram için floating button konumu
    zIndex: 999,
  },
  floatingToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 25,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  floatingToggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 22,
    marginHorizontal: 1,
  },
  floatingToggleButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  floatingToggleText: {
    fontSize: 16,
    opacity: 0.7,
  },
  floatingToggleTextActive: {
    opacity: 1,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    marginHorizontal: 2,
  },
  toggleButtonActive: {
    backgroundColor: '#00D4FF',
  },
  toggleButtonText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
  },
  chartContainer: {
    position: 'relative',
    backgroundColor: '#151524',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#16213E',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  chartContainerTransparent: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    marginTop: -20, // Donut grafiğini yukarıya al
  },
  chartContainerHidden: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    padding: 0, // Padding'i de kaldır
    marginTop: 25, // Histogram için daha fazla üstten margin
  },
  simpleChart: {
    width: '100%',
  },
  chartContentSpacingBar: {
    marginTop: 26, // Histogram için floating button ile arasındaki boşluk
  },
  chartContentSpacingDonut: {
    marginTop: 10, // Donut chart için floating button ile arasındaki boşluk
  },
  chartRow: {
    marginBottom: 20,
  },
  chartLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  chartLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  chartBarContainer: {
    position: 'relative',
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  chartBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    borderRadius: 12,
    minWidth: 2,
  },
  chartValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
    zIndex: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  comingSoonText: {
    fontSize: 14,
    color: '#00D4FF',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },
  


  inviteSection: {
    paddingHorizontal: 12,
    marginBottom: 30,
  },
  inviteSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inviteIconContainer: {
    marginRight: 12,
  },
  inviteIcon: {
    width: 20,
    height: 16,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteIconChain1: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#00D4FF',
    position: 'absolute',
    left: 0,
    top: 5,
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
  inviteIconChain2: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#00D4FF',
    position: 'absolute',
    left: 7,
    top: 5,
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
  inviteIconChain3: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: '#00D4FF',
    position: 'absolute',
    right: 0,
    top: 5,
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
  inviteSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  inviteCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    gap: 8,
  },
  inviteCodeWrapper: {
    flex: 1,
    backgroundColor: '#0F0F1A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#16213E',
  },
  inviteCode: {
    fontSize: 18,
    fontWeight: '800',
    color: '#00D4FF',
    letterSpacing: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 212, 255, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  copyButton: {
    backgroundColor: '#00D4FF',
    borderRadius: 10,
    width: 40, // Sabit genişlik
    height: 40, // Sabit yükseklik
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  copyButtonSuccess: {
    backgroundColor: '#00FF94',
    shadowColor: '#00FF94'
  },
  copyIcon: {
    width: 18,
    height: 18,
    position: 'relative',
  },
  copyIconRect1: {
    width: 12,
    height: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 2,
    position: 'absolute',
    top: 2,
    left: 4,
    backgroundColor: 'transparent',
  },
  copyIconRect2: {
    width: 12,
    height: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 2,
    position: 'absolute',
    top: 0,
    left: 2,
    backgroundColor: '#00D4FF',
  },
  
  // Tüm butonları içeren container
  inviteButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkButton: {
    backgroundColor: '#00A8CC',
    borderRadius: 10,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00A8CC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  linkButtonIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  linkButtonSuccess: {
    backgroundColor: '#00FF94',
    shadowColor: '#00FF94',
  },
  shareButton: {
    backgroundColor: '#0077B6',
    borderRadius: 10,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0077B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  shareButtonDisabled: {
    backgroundColor: '#555',
    shadowOpacity: 0.2,
  },
  shareButtonIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },

  membersSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 0,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  memberAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  expensesSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  emptyExpenses: {
    backgroundColor: '#0F0F1A',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#16213E',
  },
  emptyExpensesText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  emptyChartSpacer: {
    marginBottom: 20,
  },
  expenseCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#151524',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 0,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  expenseUser: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  expenseDate: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00FF94',
    textShadowColor: 'rgba(0, 255, 148, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  addExpenseSection: {
    paddingHorizontal: 20,
    marginBottom: 50, // Harcama ekle ve Üye Davet Et arası
  },
  addExpenseButton: {
    marginHorizontal: 0,
    backgroundColor: '#151524',
  },
  actionsSection: {
    paddingHorizontal: 20,
    marginBottom: 12, //Üye davet et ve Ana sayfaya dön arası
    gap: 12,
  },
  actionButton: {
    marginBottom: 30, // Harcama ekle ve Üye Davet Et arası
  },
  
  // Skeleton Loading Styles
  skeletonHeader: {
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  skeletonTitle: {
    width: '60%',
    height: 32,
    backgroundColor: '#151524',
    borderRadius: 8,
    marginBottom: 12,
  },
  skeletonSubtitle: {
    width: '40%',
    height: 16,
    backgroundColor: '#151524',
    borderRadius: 4,
  },
  skeletonStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  skeletonStatCard: {
    backgroundColor: '#151524',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  skeletonStatNumber: {
    width: 60,
    height: 24,
    backgroundColor: '#16213E',
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonStatLabel: {
    width: 40,
    height: 12,
    backgroundColor: '#16213E',
    borderRadius: 4,
  },
  skeletonSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  skeletonSectionTitle: {
    width: 120,
    height: 18,
    backgroundColor: '#151524',
    borderRadius: 4,
    marginBottom: 16,
  },
  skeletonCard: {
    height: 60,
    backgroundColor: '#151524',
    borderRadius: 12,
    marginBottom: 12,
  },
  
  // Filtre Styles
  filterScroll: {
    marginBottom: 16,
  },
  filterContainer: {
    paddingRight: 20,
  },
     filterButton: {
     marginRight: 8,
     minWidth: 90,
   },
   
   // Seçili Tarih Aralığı Gösterimi
   dateRangeDisplay: {
     backgroundColor: '#0F0F1A',
     borderRadius: 8,
     paddingHorizontal: 12,
     paddingVertical: 8,
     marginBottom: 16,
     borderWidth: 1,
     borderColor: '#16213E',
     alignItems: 'center',
   },
   dateRangeText: {
     fontSize: 13,
     color: '#00D4FF',
     fontWeight: '500',
     textShadowColor: 'rgba(0, 212, 255, 0.3)',
     textShadowOffset: { width: 0, height: 0 },
     textShadowRadius: 4,
   },
   
   // Özel Tarih Aralığı Styles
  customDateContainer: {
    backgroundColor: '#151524',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#16213E',
    marginBottom: 16,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateInputContainer: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00D4FF',
    marginBottom: 6,
    textShadowColor: 'rgba(0, 212, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  dateButton: {
    backgroundColor: '#0F0F1A',
    borderWidth: 1,
    borderColor: '#16213E',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  
  // Renk değiştirme butonu
  colorChangeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  colorChangeButtonText: {
    fontSize: 16,
  },
  
  // Modal stilleri
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  colorPickerModal: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 350,
    borderWidth: 1,
    borderColor: '#16213E',
  },
  colorPickerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  colorPickerSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  colorOption: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  selectedColorIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  colorPickerButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  colorPickerButton: {
    flex: 1,
  },
  
  // Loading states for stats and expenses
  statLoadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 24,
  },
  statLoadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00FF94',
    marginHorizontal: 2,
    shadowColor: '#00FF94',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
  statLoadingDot3: {
    marginRight: 0,
  },
  expenseLoadingContainer: {
    backgroundColor: '#0F0F1A',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#16213E',
    marginBottom: 16,
  },
  expenseLoadingText: {
    fontSize: 16,
    color: '#9CA3AF',
    fontWeight: '500',
  },

  
  // Tüm Harcamaları Görüntüle Butonu
  viewAllExpensesButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 255, 148, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#00FF94',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewAllExpensesButtonText: {
    color: '#00FF94',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 255, 148, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  
  // Ev Detayları Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#9CA3AF',
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
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  createButton: {
    marginTop: 16,
    backgroundColor: '#1A1A2E',
    borderColor: '#00FF94',
    shadowColor: '#00FF94',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 8,
  },
  createButtonText: {
    color: '#00FF94',
    textShadowColor: 'rgba(0, 255, 148, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: 8,
  },
  backButton: {
    marginTop: 20,
    marginHorizontal: 20,
    backgroundColor: '#151524',
  },
  deleteSection: {
    paddingHorizontal: 20,
    marginBottom: 0,
  },
  deleteButton: {
    borderColor: '#FF6B6B',
    backgroundColor: '#151524',
  },
  modernSection: { 
    backgroundColor: '#151524', 
    borderRadius: 20, 
    padding: 24, 
    marginBottom: 20, 
    marginHorizontal: 20, 
    borderWidth: 2, 
    borderColor: 'rgba(155, 89, 182, 0.4)', 
    shadowColor: '#9B59B6', 
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 20, 
    elevation: 15 
  },
  primarySection: {
    borderColor: 'rgba(0, 255, 148, 0.4)',
    shadowColor: '#00FF94',
  },
  infoSection: {
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
    backgroundColor: 'rgba(155, 89, 182, 0.2)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12, 
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    elevation: 8,
  },
  primaryIconContainer: {
    backgroundColor: 'rgba(0, 255, 148, 0.2)',
  },
  infoIconContainer: {
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    borderColor: 'rgba(255, 255, 255, 0.6)',
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
  formContainer: { 
    gap: 0 
  },
  standardInputContainer: { 
    marginBottom: 16 
  },
  modernButtonContent: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8 
  },
  cancelSection: {
    marginHorizontal: 20,
    marginTop: 20,
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
  modernCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF6B6B',
    textAlign: 'center',
    textShadowColor: 'rgba(255, 107, 107, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  
  // Admin Styles
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  removeMemberButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeMemberButtonText: {
    fontSize: 16,
    color: '#FF6B6B',
  },
  expenseRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  deleteExpenseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteExpenseButtonText: {
    fontSize: 16,
    color: '#FF6B6B',
  },
  adminInviteActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
    justifyContent: 'center',
  },
  regenerateInviteButton: {
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
    borderWidth: 1,
    borderColor: '#00D4FF',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  disableInviteButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderWidth: 1,
    borderColor: '#FF6B6B',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  adminButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  
  // Modern Davet Kodu Stilleri
  modernInviteSection: {
    backgroundColor: '#151524',
    borderRadius: 20,
    margin: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#16213E',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  modernInviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modernInviteIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#00D4FF',
  },
  modernInviteIconText: {
    fontSize: 20,
    textAlign: 'center',
  },
  modernInviteTextContainer: {
    flex: 1,
  },
  modernInviteTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 212, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  modernInviteSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  modernInviteCodeContainer: {
    gap: 16,
  },
  modernInviteCodeDisplay: {
    backgroundColor: '#0A0A0F',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#16213E',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  modernInviteCode: {
    fontSize: 28,
    fontWeight: '900',
    color: '#00D4FF',
    textAlign: 'center',
    letterSpacing: 4,
    textShadowColor: 'rgba(0, 212, 255, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  modernInviteCodeBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modernInviteActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modernActionButton: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#16213E',
    minHeight: 72,
    justifyContent: 'center',
  },
  copyActionButton: {
    borderColor: '#00D4FF',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  linkActionButton: {
    borderColor: '#00A8CC',
    shadowColor: '#00A8CC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  shareActionButton: {
    borderColor: '#0077B6',
    shadowColor: '#0077B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonSuccess: {
    backgroundColor: '#00FF94',
    borderColor: '#00FF94',
    shadowColor: '#00FF94',
  },
  actionButtonDisabled: {
    backgroundColor: '#0F0F1A',
    borderColor: '#16213E',
    opacity: 0.6,
    shadowOpacity: 0.1,
  },
  modernActionIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  modernActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  actionTextSuccess: {
    color: '#FFFFFF',
  },
  modernAdminSection: {
    marginTop: 8,
  },
  modernAdminDivider: {
    height: 1,
    backgroundColor: '#16213E',
    marginBottom: 16,
  },
  modernAdminActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modernAdminButton: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#00D4FF',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  modernAdminDangerButton: {
    borderColor: '#FF6B6B',
    shadowColor: '#FF6B6B',
  },
  modernAdminIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  modernAdminText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modernAdminDangerText: {
    color: '#FF6B6B',
  },
});
