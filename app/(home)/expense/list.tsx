import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { View, Text, Alert, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Modal, Dimensions, Animated, RefreshControl } from "react-native";
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
import { SkeletonExpenseHeader, SkeletonExpenseChart, SkeletonExpenseSummary, SkeletonExpenseMembers, SkeletonExpenseList } from "@/components/ui/SkeletonExpenseList";
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
  created_at: string;
  users: {
    email: string;
    full_name?: string;
  };
};

export default function ExpenseList() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{name?: string; description?: string}>({});
  
  // Grup detayları için state'ler
  const [group, setGroup] = useState<GroupData | null>(null);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]); // Tüm harcamalar
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expenseLoading, setExpenseLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Filtre state'i
  const [selectedFilter, setSelectedFilter] = useState('thisMonth');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]); // Çoklu kişi filtresi için
  const [monthStartDay, setMonthStartDay] = useState(1);
  
  // Özel tarih aralığı state'leri
  const [customStartDate, setCustomStartDate] = useState(new Date());
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  // Renk seçici state'leri
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedMemberForColor, setSelectedMemberForColor] = useState<string | null>(null);
  const [memberCustomColors, setMemberCustomColors] = useState<{[key: string]: number}>({});
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Chart tipi state'i
  const [chartType, setChartType] = useState<'bar' | 'donut'>('donut');
  
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdGroup, setCreatedGroup] = useState<{name: string, invite_code: string} | null>(null);
  
  const [successCopySuccess, setSuccessCopySuccess] = useState(false);
  
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

  // Loading animasyonu için ref'ler
  const statDot1Opacity = useRef(new Animated.Value(0.3)).current;
  const statDot2Opacity = useRef(new Animated.Value(0.3)).current;
  const statDot3Opacity = useRef(new Animated.Value(0.3)).current;

  // Kullanıcının admin olup olmadığını kontrol et
  const isCurrentUserAdmin = () => {
    if (!group?.members || !user?.id) return false;
    const currentUserMember = group.members.find(member => member.user_id === user.id);
    return currentUserMember?.role === 'admin';
  };

  // Kişi renkleri paleti
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

  // Harcama kartları için renk getir (eski fonksiyon adını koruyoruz)
  const getMemberColorByUserId = (userId: string) => {
    return getMemberColor(userId);
  };

  // Renk seçiciyi aç
  const openColorPicker = (userId: string) => {
    setSelectedMemberForColor(userId);
    setShowColorPicker(true);
  };

  // Renk değişikliği
  const handleColorChange = async (userId: string, colorIndex: number) => {
    try {
      const newColors = { ...memberCustomColors, [userId]: colorIndex };
      setMemberCustomColors(newColors);
      await AsyncStorage.setItem(`memberColors_${groupId}`, JSON.stringify(newColors));
      setShowColorPicker(false);
      setSelectedMemberForColor(null);
    } catch (err) {
      console.error("Save member color error:", err);
    }
  };

  // Admin için harcama silme fonksiyonu
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
              // Listeyi yenile
              await fetchGroupBasicInfo();
            } catch (error) {
              console.error("Delete expense error:", error);
              Alert.alert("Hata", "Harcama silinemedi. Tekrar deneyin.");
            } finally {
              setBusy(false);
            }
          }
        }
      ]
    );
  };

  // Kişilerin harcama dağılımını hesapla
  const calculateMemberExpenseDistribution = () => {
    // MOD SEÇİMİ: Bu değeri değiştirerek isim görünümünü değiştirebilirsiniz
    // 'first_name' = Sadece ilk isim gösterilir (Ahmet)
    // 'full_name' = Tam isim gösterilir (Ahmet Yılmaz)
    const nameDisplayMode = 'full_name' as 'first_name' | 'full_name';
    
    if (!group?.members || !filteredExpenses.length) return [];

    // Her üye için toplam harcamayı hesapla
    const memberExpenses: { [key: string]: number } = {};
    
    filteredExpenses.forEach(expense => {
      if (memberExpenses[expense.created_by]) {
        memberExpenses[expense.created_by] += expense.amount;
      } else {
        memberExpenses[expense.created_by] = expense.amount;
      }
    });

    // Chart için data formatına çevir
    return group.members
      .filter(member => memberExpenses[member.user_id] > 0)
      .map((member, index) => {
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

  // Tarih string'ini YYYY-MM-DD formatına çevir (yerel saat)
  const formatDateToString = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  // Tarih aralığı hesaplama
  const getDateRange = (filter: string, overrideStart?: Date, overrideEnd?: Date) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const currentDay = now.getDate();

    switch (filter) {
      case 'thisMonth': {
        const startOfMonth = new Date(year, month, monthStartDay);
        let endOfMonth: Date;
        
        if (monthStartDay === 1) {
          // Normal ay başı
          endOfMonth = new Date(year, month + 1, 0); // Ayın son günü
        } else {
          // Özel ay başı
          if (currentDay >= monthStartDay) {
            // Bu ayın monthStartDay'inden sonuç ay aynı günün bir öncesine
            endOfMonth = new Date(year, month + 1, monthStartDay - 1);
          } else {
            // Geçen ayın monthStartDay'inden bu ayın aynı günün bir öncesine
            startOfMonth.setMonth(month - 1);
            endOfMonth = new Date(year, month, monthStartDay - 1);
          }
        }
        
        return { 
          start: formatDateToString(startOfMonth), 
          end: formatDateToString(endOfMonth) 
        };
      }
      
      case 'monthToDate': {
        const startOfMonth = new Date(year, month, monthStartDay);
        const today = new Date(year, month, currentDay);
        
        if (monthStartDay > 1 && currentDay < monthStartDay) {
          // Özel ay başı ve henüz o güne gelmedik
          startOfMonth.setMonth(month - 1);
        }
        
        return { 
          start: formatDateToString(startOfMonth), 
          end: formatDateToString(today) 
        };
      }
      
      case 'lastMonth': {
        let startOfLastMonth: Date;
        let endOfLastMonth: Date;
        
        if (monthStartDay === 1) {
          // Normal geçen ay
          startOfLastMonth = new Date(year, month - 1, 1);
          endOfLastMonth = new Date(year, month, 0); // Geçen ayın son günü
        } else {
          // Özel ay başı
          if (currentDay >= monthStartDay) {
            // Geçen ayın monthStartDay'inden bu ayın monthStartDay-1'ine
            startOfLastMonth = new Date(year, month - 1, monthStartDay);
            endOfLastMonth = new Date(year, month, monthStartDay - 1);
          } else {
            // 2 ay öncenin monthStartDay'inden geçen ayın monthStartDay-1'ine
            startOfLastMonth = new Date(year, month - 2, monthStartDay);
            endOfLastMonth = new Date(year, month - 1, monthStartDay - 1);
          }
        }
        
        return { 
          start: formatDateToString(startOfLastMonth), 
          end: formatDateToString(endOfLastMonth) 
        };
      }
      
      case 'last3Months': {
        const start3MonthsAgo = new Date(year, month - 3, monthStartDay);
        const today = new Date(year, month, currentDay);
        
        return { 
          start: formatDateToString(start3MonthsAgo), 
          end: formatDateToString(today) 
        };
      }
      
      case 'yearToDate': {
        const startOfYear = new Date(year, 0, 1);
        const today = new Date(year, month, currentDay);
        
        return { 
          start: formatDateToString(startOfYear), 
          end: formatDateToString(today) 
        };
      }
      
      case 'custom': {
        const startDate = overrideStart || customStartDate;
        const endDate = overrideEnd || customEndDate;
        
        return { 
          start: formatDateToString(startDate), 
          end: formatDateToString(endDate) 
        };
      }
      
      default:
        return null;
    }
  };

  // Stats label'ı belirle
  const getStatsLabel = () => {
    switch (selectedFilter) {
      case 'thisMonth': return 'Bu Ay';
      case 'monthToDate': return 'Ay Başından Beri';
      case 'lastMonth': return 'Geçen Ay';
      case 'last3Months': return 'Son 3 Ay';
      case 'yearToDate': return 'Yıl Başından Beri';
      case 'custom': return 'Özel Aralık';
      case 'all': return 'Toplam';
      default: return 'Bu Ay';
    }
  };

  // Ayarları yükle
  const loadSettings = async () => {
    try {
      // monthStartDay'i veritabanından çek
      if (user?.id) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('month_start_day')
          .eq('id', user.id)
          .single();

        if (!userError && userData?.month_start_day) {
          const day = userData.month_start_day;
          if (day >= 1 && day <= 31) {
            setMonthStartDay(day);
          } else {
            setMonthStartDay(1);
          }
        } else {
          setMonthStartDay(1);
        }
      }
      
      // Üye renklerini yükle
      const savedColors = await AsyncStorage.getItem(`memberColors_${groupId}`);
      if (savedColors) {
        setMemberCustomColors(JSON.parse(savedColors));
      }
    } catch (err) {
      console.error("Load settings error:", err);
      setMonthStartDay(1);
    }
  };

  // Temel grup bilgilerini getir (hızlı yükleme için)
  const fetchGroupBasicInfo = async () => {
    if (!groupId) return;
    
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
          group_members!inner (
            id,
            user_id,
            role,
            joined_at,
            users (
              email,
              full_name
            )
          )
        `)
        .eq('id', groupId)
        .single();

      if (groupError) {
        console.error("Group fetch error:", groupError);
        Alert.alert("Hata", "Grup bilgileri alınamadı.");
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
      }, 1000);
      
    } catch (err) {
      console.error("Fetch group basic info error:", err);
      setLoading(false);
      
      // Hata durumunda da initial load'u tamamla
      setTimeout(() => {
        setIsInitialLoadComplete(true);
      }, 1000);
    }
  };

  // Harcamaları ve istatistikleri getir
  const fetchGroupDetails = async (isRefresh: boolean = false) => {
    if (!groupId) return;
    
    console.log('📊 fetchGroupDetails çağrıldı (expense list):', { 
      isRefresh, 
      selectedFilter, 
      groupId,
      currentExpenseCount: allExpenses.length 
    });
    
    try {
      if (!isRefresh) {
        setExpenseLoading(true);
        setStatsLoading(true);
      }

      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select(`
          id,
          name,
          description,
          created_by,
          invite_code,
          created_at,
          group_members!inner (
            id,
            user_id,
            role,
            joined_at,
            users (
              email,
              full_name
            )
          )
        `)
        .eq('id', groupId)
        .single();

      if (groupError) {
        console.error("Group fetch error:", groupError);
        if (!isRefresh) {
          setExpenseLoading(false);
          setStatsLoading(false);
        }
        return;
      }

      // Harcamaları getir
      let expenseQuery = supabase
        .from('expenses')
        .select(`
          id,
          title,
          amount,
          created_by,
          expense_date,
          created_at,
          users (
            email,
            full_name
          )
        `)
        .eq('group_id', groupId)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

      // Tarih filtresi uygula
      const dateRange = getDateRange(selectedFilter);
      if (dateRange) {
        expenseQuery = expenseQuery
          .gte('expense_date', dateRange.start)
          .lte('expense_date', dateRange.end);
      }

      // Kişi filtresi artık API'de değil, local'de yapılacak

      const { data: expensesData, error: expensesError } = await expenseQuery;

      if (expensesError) {
        console.error("Expenses fetch error:", expensesError);
        if (!isRefresh) {
          setExpenseLoading(false);
          setStatsLoading(false);
        }
        return;
      }

      setGroup({
        ...groupData,
        member_count: groupData.group_members?.length || 0,
        total_expenses: 0, // Bu değer useMemo ile hesaplanacak
        members: (groupData.group_members || []).map(member => ({
          ...member,
          users: Array.isArray(member.users) ? member.users[0] : member.users
        }))
      });
      
      const processedExpenses = (expensesData || []).map(expense => ({
        ...expense,
        users: Array.isArray(expense.users) ? expense.users[0] : expense.users
      }));
      
      console.log('💰 Harcamalar set ediliyor (expense list):', { 
        rawCount: expensesData?.length || 0,
        processedCount: processedExpenses.length,
        selectedFilter,
        firstExpense: processedExpenses[0] ? {
          title: processedExpenses[0].title,
          amount: processedExpenses[0].amount,
          date: processedExpenses[0].expense_date
        } : null
      });
      
      setAllExpenses(processedExpenses);
    } catch (err) {
      console.error("Fetch group details catch:", err);
    } finally {
      if (!isRefresh) {
        setExpenseLoading(false);
        setStatsLoading(false);
      }
      setRefreshing(false);
    }
  };

  // Loading animasyonu
  const startLoadingAnimation = () => {
    const createPulseAnimation = (animatedValue: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 600,
            delay: delay,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
    };

    Animated.parallel([
      createPulseAnimation(statDot1Opacity, 0),
      createPulseAnimation(statDot2Opacity, 200),
      createPulseAnimation(statDot3Opacity, 400),
    ]).start();
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

  // Filtrelenmiş harcamaları hesapla (local filtreleme)
  const filteredExpenses = useMemo(() => {
    let filtered = [...allExpenses];

    // Kişi filtresi uygula
    if (selectedMembers.length > 0) {
      filtered = filtered.filter(expense => selectedMembers.includes(expense.created_by));
    }

    return filtered;
  }, [allExpenses, selectedMembers]);

  // Toplam harcamayı hesapla
  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  }, [filteredExpenses]);

  // İlk yükleme
  useEffect(() => {
    const initializeExpenseList = async () => {
      console.log('🚀 Expense list başlatılıyor...');
      await loadSettings();
      await fetchGroupBasicInfo();
      // İlk veri yükleme
      await fetchGroupDetails();
    };
    
    if (groupId) {
      initializeExpenseList();
    }
  }, [groupId]);

  // Sadece tarih filtresi değiştiğinde verileri yenile
  useEffect(() => {
    if (groupId && group?.id) {
      console.log('🔄 Tarih filtresi değişti, veriler yenileniyor...', { selectedFilter });
      fetchGroupDetails();
    }
  }, [selectedFilter]);

  // Sayfa odaklandığında verileri getir (sadece harcama ekleme sonrası için)
  useFocusEffect(
    useCallback(() => {
      if (groupId && group?.id) {
        console.log('👁️ Sayfa odaklandı, veriler yenileniyor...');
        fetchGroupDetails();
      }
    }, [groupId, group?.id])
  );

  // Loading animasyonunu başlat
  useEffect(() => {
    if (statsLoading) {
      startLoadingAnimation();
    }
  }, [statsLoading]);

  if (loading) {
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
          >
            <SkeletonExpenseHeader />
            <SkeletonExpenseChart />
            <SkeletonExpenseSummary />
            <SkeletonExpenseMembers />
            <SkeletonExpenseList />
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
            <Text style={styles.errorTitle}>Grup Bulunamadı</Text>
            <Text style={styles.errorText}>Bu grup mevcut değil veya erişim yetkiniz yok.</Text>
            <Button
              title="← Geri Dön"
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
              console.log(`📱 Scroll position: ${scrollPosition.toFixed(0)}px → ${newScrollY.toFixed(0)}px`);
            }
            setScrollPosition(newScrollY);
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchGroupDetails(true);
              }}
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
              const currentTime = new Date().toLocaleTimeString();
              
              console.log(`\n🏗️ [${currentTime}] CONTAINER LAYOUT EVENT:`);
              console.log(`📦 Above-filter content height: ${aboveFilterHeight}px → ${newHeight}px`);
              console.log(`📏 Height difference: ${heightDiff}px ${heightDiff > 0 ? '(BÜYÜDÜ ⬆️)' : heightDiff < 0 ? '(KÜÇÜLDÜ ⬇️)' : '(DEĞİŞMEDİ ➡️)'}`);
              console.log(`📍 Current scroll position: ${scrollPosition}px`);
              
              // Height'ı önce güncelle
              setAboveFilterHeight(newHeight);
              
              // Eğer boyut değişikliği varsa scroll'ü kompanse et
              // SADECE initial load tamamlandıktan sonra (filtre değişiklikleri için)
              if (aboveFilterHeight > 0 && heightDiff !== 0 && isInitialLoadComplete) {
                const currentScrollY = scrollPosition;
                // İçerik küçülürse scroll yukarı kayar, büyürse aşağı kayar
                // Bu durumda scroll pozisyonunu ters yönde ayarlamamız gerekir
                const targetScrollY = Math.max(0, currentScrollY + heightDiff);
                
                console.log(`🧮 SCROLL CALCULATION:`);
                console.log(`   Current scroll: ${currentScrollY}px`);
                console.log(`   Height change: ${heightDiff}px`);
                console.log(`   Formula: ${currentScrollY} + (${heightDiff}) = ${currentScrollY + heightDiff}`);
                console.log(`   Target scroll: ${targetScrollY}px (after Math.max)`);
                
                // requestAnimationFrame ile smooth güncelleme
                requestAnimationFrame(() => {
                  if (scrollViewRef.current) {
                    scrollViewRef.current.scrollTo({ 
                      y: targetScrollY, 
                      animated: false 
                    });
                    console.log(`✅ SCROLL APPLIED: ${currentScrollY}px → ${targetScrollY}px`);
                    console.log(`📐 Net scroll movement: ${targetScrollY - currentScrollY}px\n`);
                  }
                });
              } else if (aboveFilterHeight === 0) {
                console.log(`🚀 Initial layout - no scroll adjustment needed`);
              } else {
                console.log(`⚪ No height change - no scroll adjustment needed\n`);
              }
            }}
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
                  <Text style={styles.iconText}>📊</Text>
                </View>
                </View>
                
                <View style={styles.heroTextSection}>
                <Text style={styles.heroTitle}>Tüm Harcamalar</Text>
                <Text style={styles.heroSubtitle}>
                  {group.name}
                  </Text>
              </View>
            </View>
          </View>
        </View>


          {/* Harcama Dağılım Grafiği */}
          {(() => {
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
                          onPress={() => setChartType('bar')}
                        >
                          <Text style={[styles.floatingToggleText, chartType === 'bar' && styles.floatingToggleTextActive]}>
                            📊
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.floatingToggleButton, chartType === 'donut' && styles.floatingToggleButtonActive]}
                          onPress={() => setChartType('donut')}
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
            }
            return null;
          })()}

          {/* Özet Bilgi */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Harcama Sayısı</Text>
              <Text style={styles.summaryCount}>{filteredExpenses.length}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Toplam Harcama</Text>
              {statsLoading ? (
                <View style={styles.statLoadingContainer}>
                  <Animated.View style={[styles.statLoadingDot, { opacity: statDot1Opacity }]} />
                  <Animated.View style={[styles.statLoadingDot, { opacity: statDot2Opacity }]} />
                  <Animated.View style={[styles.statLoadingDot, styles.statLoadingDot3, { opacity: statDot3Opacity }]} />
                </View>
              ) : (
                <Text style={styles.summaryValue}>₺{totalExpenses.toFixed(2)}</Text>
              )}
            </View>
          </View>

          {/* Harcama Ekle */}
          <View style={styles.addExpenseSection}>
            <Button
              title="💸 Harcama Ekle"
              onPress={() => {
                router.push(`/(home)/expense/add?groupId=${group.id}`);
              }}
              style={styles.addExpenseButton}
            />
          </View>

          {/* Kişiler */}
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
                
                {/* Renk değiştirme butonu */}
                <TouchableOpacity
                  style={[styles.colorChangeButton, { borderColor: memberColor.bg }]}
                  onPress={() => openColorPicker(member.user_id)}
                >
                  <Text style={styles.colorChangeButtonText}>🎨</Text>
                </TouchableOpacity>
              </View>
              );
            })}
          </View>
          
          {/* Above Filter Content Container sonu */}
          </View>

          {/* Harcamalar */}
          <View 
            ref={filterSectionRef}
            style={styles.expensesSection}
            onLayout={(event) => {
              setFilterSectionY(event.nativeEvent.layout.y);
            }}
          >
            <Text style={styles.sectionTitle}>💰 Tüm Harcamalar</Text>
            
            {/* Tarih Filtre Butonları */}
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
                  onPress={() => setSelectedFilter(option.value)}
                  variant={selectedFilter === option.value ? 'primary' : 'secondary'}
                  size="small"
                  style={styles.filterButton}
                />
              ))}
            </ScrollView>

            {/* Kişi Filtre Butonları */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.memberFilterScroll}
              contentContainerStyle={styles.filterContainer}
            >
              <Button
                title="👥 Tümü"
                onPress={() => setSelectedMembers([])}
                variant={selectedMembers.length === 0 ? 'primary' : 'secondary'}
                size="small"
                style={StyleSheet.flatten([
                  styles.filterButton,
                  selectedMembers.length > 0 && {
                    borderColor: '#FFFFFF',
                    shadowColor: '#FFFFFF'
                  }
                ])}
                textStyle={selectedMembers.length === 0 ? undefined : { color: '#FFFFFF' }}
              />
              {group.members?.map((member) => {
                const memberColor = getMemberColor(member.user_id);
                const memberName = member.users?.full_name?.split(' ')[0] || 
                                 member.users?.email?.split('@')[0] || 'Üye';
                const isSelected = selectedMembers.includes(member.user_id);
                
                const handleMemberToggle = () => {
                  if (isSelected) {
                    // Seçili ise çıkar
                    setSelectedMembers(prev => prev.filter(id => id !== member.user_id));
                  } else {
                    // Seçili değilse ekle
                    setSelectedMembers(prev => [...prev, member.user_id]);
                  }
                };
                
                return (
                  <Button
                    key={member.user_id}
                    title={`${isSelected ? '✓ ' : ''}${memberName}`}
                    onPress={handleMemberToggle}
                    variant={isSelected ? 'primary' : 'secondary'}
                    size="small"
                    style={StyleSheet.flatten([
                      styles.filterButton,
                      isSelected ? { 
                        borderColor: memberColor.bg,
                        shadowColor: memberColor.bg
                      } : {
                        borderColor: '#FFFFFF',
                        shadowColor: '#FFFFFF'
                      }
                    ])}
                    textStyle={
                      isSelected 
                        ? { color: memberColor.bg, fontWeight: '700' } 
                        : { color: '#FFFFFF' }
                    }
                  />
                );
              })}
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
               onChange={(event: any, selectedDate?: Date) => {
                 setShowStartDatePicker(false);
                 if (selectedDate) {
                   setCustomStartDate(selectedDate);
                   if (selectedFilter === 'custom') {
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
               onChange={(event: any, selectedDate?: Date) => {
                 setShowEndDatePicker(false);
                 if (selectedDate) {
                   setCustomEndDate(selectedDate);
                   if (selectedFilter === 'custom') {
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
           ) : filteredExpenses.length === 0 ? (
             <View style={styles.emptyExpenses}>
               <Text style={styles.emptyExpensesText}>
                 {selectedMembers.length > 0
                   ? 'Seçilen kişiler için harcama bulunamadı.'
                   : selectedFilter === 'all' 
                     ? 'Henüz hiç harcama eklenmemiş.'
                     : 'Seçilen dönemde harcama bulunamadı.'
                 }
               </Text>
             </View>
           ) : (
             filteredExpenses.map((expense) => {
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
                       {new Date(expense.expense_date).toLocaleDateString('tr-TR')} • {new Date(expense.created_at).toLocaleTimeString('tr-TR', {
                         hour: '2-digit',
                         minute: '2-digit'
                       })}
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
          </View>
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
                  const currentColorIndex = selectedMemberForColor ? 
                    (memberCustomColors[selectedMemberForColor] !== undefined ? 
                      memberCustomColors[selectedMemberForColor] : 
                      (group?.members?.findIndex(m => m.user_id === selectedMemberForColor) || 0) % memberColors.length
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
                      onPress={() => selectedMemberForColor && handleColorChange(selectedMemberForColor, index)}
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
                onPress={() => {
                  setShowColorPicker(false);
                  setSelectedMemberForColor(null);
                }}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
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
  
  futuristicHeaderContainer: { position: 'relative', overflow: 'hidden', minHeight: 140, marginBottom: 32 },
  fadeBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#00FF94', opacity: 0.15 },
  fadeOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  futuristicHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 32, paddingLeft: 50, flex: 1},
  heroSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1 },
  iconContainer: { position: 'relative', marginRight: 20 },
  iconGlowRing: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 2, borderColor: 'rgba(0, 255, 148, 0.4)', top: -6, left: -6, shadowColor: '#00FF94', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 16, elevation: 12 },
  iconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#00FF94', justifyContent: 'center', alignItems: 'center', shadowColor: '#00FF94', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 24, elevation: 20, borderWidth: 3, borderColor: 'rgba(255, 255, 255, 0.3)' },
  iconText: { fontSize: 24, textShadowColor: 'rgba(0, 0, 0, 0.4)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 },
  heroTextSection: { flex: 1 },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', marginBottom: 4, textShadowColor: 'rgba(255, 255, 255, 0.6)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20, letterSpacing: 0.5 },
  heroSubtitle: { fontSize: 14, color: '#B0B7C3', fontWeight: '500', lineHeight: 20, letterSpacing: 0.2 },
  modernBackButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 255, 148, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 148, 0.3)',
    shadowColor: '#00FF94',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  modernBackButtonText: {
    color: '#00FF94',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20,
    includeFontPadding: false,
    textAlignVertical: 'center',
    textShadowColor: 'rgba(0, 255, 148, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
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
    borderColor: 'rgba(0, 255, 148, 0.4)',
    shadowColor: '#00FF94',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 15,
    zIndex: 1000,
  },
  floatingBackButtonText: {
    color: '#00FF94',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
    includeFontPadding: false,
    textAlignVertical: 'center',
    textShadowColor: 'rgba(0, 255, 148, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
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
  cancelButton: {
    marginTop: 8,
  },
  deleteSection: {
    paddingHorizontal: 6,
    marginBottom: 0,
  },
  deleteButton: {
    borderColor: '#FF6B6B',
    backgroundColor: '#151524',
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
  backButton: {
    marginTop: 20,
    backgroundColor: '#151524',
  },
  groupHeader: {
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 6, // Diğer bölümlerle uyumlu padding
  },
  headerCardContainer: {
    width: '100%',
    position: 'relative',
    alignItems: 'center',
  },
  headerCardGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    backgroundColor: 'transparent',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: 'rgba(0, 255, 148, 0.4)', // Neon yeşil glow
    shadowColor: '#00FF94',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 25,
    elevation: 20,
  },
  headerCard: {
    backgroundColor: '#0F0F1A',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 24,
    width: '100%',
    borderWidth: 2,
    borderColor: '#00D4FF',
    shadowColor: '#00D4FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 15,
    elevation: 16,
    position: 'relative',
    zIndex: 2,
  },
  groupName: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: '#FF0080',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  groupDescription: {
    fontSize: 16,
    color: '#00FF94', // Neon yeşil renk
    textAlign: 'center',
    lineHeight: 22,
    textShadowColor: 'rgba(0, 255, 148, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
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
    marginBottom: 16,
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
    marginBottom: 40, // Eşitlenmiş mesafe
  },
  addExpenseButton: {
    marginHorizontal: 0,
    backgroundColor: '#151524',
  },
  
  // Filtre Styles
  filterScroll: {
    marginBottom: 16,
  },
  memberFilterScroll: {
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

  // Özet Bilgi Kartı (birleşik tasarım)
  summaryCard: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 36,
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 20,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#B0B7C3',
    marginBottom: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#00FF94',
    textShadowColor: 'rgba(0, 255, 148, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
    textAlign: 'center',
  },
  summaryCount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
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

  // Header içerik stilleri
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerTextSection: {
    flex: 1,
    alignItems: 'center',
  },
  
  // Admin Styles
  expenseRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  deleteExpenseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteExpenseButtonText: {
    fontSize: 12,
    color: '#FF6B6B',
    textAlign: 'center',
  },
});