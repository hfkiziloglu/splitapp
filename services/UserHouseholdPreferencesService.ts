import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserGroupPreference {
  id: string;
  user_id: string;
  group_id: string;
  sort_order: number;
  custom_color: string | null;
  updated_at: string;
  created_at: string;
}

export interface GroupWithPreferences {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  member_count?: number;
  total_expenses?: number;
  sort_order?: number;
  custom_color?: string | null;
  display_color: string; // computed field
}

// Varsayılan renk paleti - 8 canlı renk
export const DEFAULT_COLORS = [
  '#FF0080', '#00D4FF', '#00FF94', '#FFD700', 
  '#FF6B6B', '#9B59B6', '#FF9500', '#1ABC9C'
] as const;

export class UserHouseholdPreferencesService {
  
  // Kullanıcının ev tercihlerini getir
  static async getUserHouseholdPreferences(userId: string): Promise<UserGroupPreference[]> {
    try {
      logger.log('🔍 Kullanıcı ev tercihleri getiriliyor:', userId);
      
      const { data, error } = await supabase
        .from('user_group_preferences')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });
      
      if (error) {
        logger.error('❌ Tercih getirme hatası:', error);
        throw error;
      }
      
      logger.log('✅ Tercihler getirildi:', data?.length || 0, 'kayıt');
      return data || [];
      
    } catch (error) {
      logger.error('❌ getUserHouseholdPreferences error:', error);
      return [];
    }
  }
  
  // Ev sıralamasını güncelle
  static async updateHouseholdOrder(userId: string, orderedHouseholdIds: string[]): Promise<void> {
    try {
      logger.log('📋 Ev sıralaması güncelleniyor:', orderedHouseholdIds);
      
      // Strategi: İki aşamalı güncelleme
      // 1. Önce tüm kayıtları çok yüksek değerlere taşı (çakışmayı önle)
      // 2. Sonra gerçek değerleri ata
      
      const TEMP_OFFSET = 10000; // Geçici yüksek değer
      
      // Aşama 1: Geçici yüksek değerler
      logger.log('🔄 Aşama 1: Geçici değerler atanıyor...');
      for (let i = 0; i < orderedHouseholdIds.length; i++) {
        const householdId = orderedHouseholdIds[i];
        const tempOrder = TEMP_OFFSET + i + 1;
        
        const { error } = await supabase
          .from('user_group_preferences')
          .upsert({
            user_id: userId,
            group_id: householdId,
            sort_order: tempOrder,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id, group_id'
          });
        
        if (error) {
          logger.error('❌ Geçici güncelleme hatası:', error);
          throw error;
        }
      }
      
      // Aşama 2: Gerçek değerler
      logger.log('🎯 Aşama 2: Gerçek değerler atanıyor...');
      for (let i = 0; i < orderedHouseholdIds.length; i++) {
        const householdId = orderedHouseholdIds[i];
        const realOrder = i + 1;
        
        const { error } = await supabase
          .from('user_group_preferences')
          .upsert({
            user_id: userId,
            group_id: householdId,
            sort_order: realOrder,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id, group_id'
          });
        
        if (error) {
          logger.error('❌ Gerçek değer güncelleme hatası:', error);
          throw error;
        }
      }
      
      logger.log('✅ Sıralama güncellendi');
      
    } catch (error) {
      logger.error('❌ updateHouseholdOrder error:', error);
      throw error;
    }
  }
  
  // Ev rengini güncelle
  static async updateHouseholdColor(
    userId: string, 
    householdId: string, 
    color: string | null
  ): Promise<void> {
    try {
      logger.log('🎨 Ev rengi güncelleniyor:', householdId, color);
      
      const { error } = await supabase
        .from('user_group_preferences')
        .upsert({
          user_id: userId,
          group_id: householdId,
          custom_color: color,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id, group_id'
        });
      
      if (error) {
        logger.error('❌ Renk güncelleme hatası:', error);
        throw error;
      }
      
      logger.log('✅ Renk güncellendi');
      
    } catch (error) {
      logger.error('❌ updateHouseholdColor error:', error);
      throw error;
    }
  }
  
  // Yeni grup için akıllı renk seçimi ile varsayılan tercih oluştur
  static async createDefaultPreference(
    userId: string, 
    householdId: string
  ): Promise<void> {
    try {
      logger.log('🆕 Yeni grup için varsayılan tercih oluşturuluyor:', householdId);
      
      // En yüksek sort_order'ı bul ve son 2 kartın renklerini al
      const { data } = await supabase
        .from('user_group_preferences')
        .select('sort_order, custom_color')
        .eq('user_id', userId)
        .order('sort_order', { ascending: false })
        .limit(2);
      
      const nextOrder = (data?.[0]?.sort_order || 0) + 1;
      
      // Son 2 kartın renklerini al
      const lastTwoColors = data?.map(pref => pref.custom_color).filter(Boolean) || [];
      logger.log('🎨 Son 2 kartın renkleri:', lastTwoColors);
      
      // Kullanılabilir renkleri filtrele (son 2 ile aynı olmayanlar)
      const availableColors = DEFAULT_COLORS.filter(color => !lastTwoColors.includes(color));
      
      // Eğer tüm renkler kullanıldıysa (çok nadir), tüm paleti kullan
      const colorsToChooseFrom = availableColors.length > 0 ? availableColors : DEFAULT_COLORS;
      
      // Rastgele renk seç (son 2 ile aynı olmayan)
      const randomIndex = Math.floor(Math.random() * colorsToChooseFrom.length);
      const selectedColor = colorsToChooseFrom[randomIndex];
      
      logger.log(`🎨 Akıllı renk seçimi: ${selectedColor}`);
      logger.log(`📊 Mevcut renkler: ${DEFAULT_COLORS.length}, Kullanılabilir: ${availableColors.length}, Seçilen: ${selectedColor}`);
      
      // Upsert kullan - varsa güncelle, yoksa oluştur
      const { error } = await supabase
        .from('user_group_preferences')
        .upsert({
          user_id: userId,
          group_id: householdId,
          sort_order: nextOrder,
          custom_color: selectedColor, // Akıllı seçilen rengi kaydet
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id, group_id',
          ignoreDuplicates: false // Güncelleme yapmaya zorla
        });
      
      if (error) {
        logger.error('❌ Varsayılan tercih oluşturma hatası:', error);
        throw error;
      }
      
      logger.log('✅ Varsayılan tercih oluşturuldu/güncellendi, sıralama:', nextOrder, 'renk:', selectedColor);
      
    } catch (error) {
      logger.error('❌ createDefaultPreference error:', error);
      throw error;
    }
  }
  
  // Fallback varsayılan renk (nadiren kullanılır - çoğunlukla custom_color var)
  static getDefaultColor(householdId: string): string {
    // Eğer veritabanında custom_color yoksa fallback olarak ilk rengi döndür
    logger.log(`🎨 Fallback renk kullanılıyor grup ${householdId} için: ${DEFAULT_COLORS[0]}`);
    return DEFAULT_COLORS[0]; // Neon Pink - fallback
  }
  
  // Evleri tercihlerle birleştir
  static async getHouseholdsWithPreferences(
    userId: string,
    households: any[]
  ): Promise<GroupWithPreferences[]> {
    try {
      logger.log('🔄 Evler tercihlerle birleştiriliyor...');
      
      const preferences = await this.getUserHouseholdPreferences(userId);
      const preferencesMap = new Map(preferences.map(p => [p.group_id, p]));
      
      const householdsWithPrefs = households.map((household, index) => {
        const pref = preferencesMap.get(household.id);
        
        return {
          ...household,
          sort_order: pref?.sort_order || (index + 1000), // Tercihi olmayan evler sona
          custom_color: pref?.custom_color,
          display_color: pref?.custom_color || this.getDefaultColor(household.id)
        };
      });
      
      // Sırala
      const sorted = householdsWithPrefs.sort((a, b) => a.sort_order - b.sort_order);
      
      logger.log('✅ Evler birleştirildi ve sıralandı:', sorted.map(h => ({ 
        name: h.name, 
        order: h.sort_order, 
        color: h.display_color 
      })));
      
      return sorted;
      
    } catch (error) {
      logger.error('❌ getHouseholdsWithPreferences error:', error);
      return households.map((household, index) => ({
        ...household,
        sort_order: index + 1,
        custom_color: null,
        display_color: this.getDefaultColor(household.id)
      }));
    }
  }
  
  // Mevcut AsyncStorage verilerini migrate et
  static async migrateFromAsyncStorage(userId: string): Promise<void> {
    try {
      logger.log('🔄 AsyncStorage verilerini migrate ediliyor...');
      
      const savedOrder = await AsyncStorage.getItem(`householdOrder_${userId}`);
      if (savedOrder) {
        const parsedOrder = JSON.parse(savedOrder);
        logger.log('📱 AsyncStorage\'dan sıralama bulundu:', parsedOrder);
        
        // Database'e kaydet
        await this.updateHouseholdOrder(userId, parsedOrder);
        
        // AsyncStorage'dan temizle
        await AsyncStorage.removeItem(`householdOrder_${userId}`);
        
        logger.log('✅ Migration tamamlandı');
      } else {
        logger.log('📝 AsyncStorage\'da sıralama bulunamadı');
      }
      
    } catch (error) {
      logger.error('❌ Migration error:', error);
    }
  }
  
  // Yeni evler için otomatik tercih oluştur
  static async ensurePreferencesExist(userId: string, householdIds: string[]): Promise<void> {
    try {
      // Çıkış işlemi sırasında çalışmaması için session kontrolü
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session || !userId) {
        logger.log('⚠️ Session yok veya kullanıcı ID yok, tercihler oluşturulmayacak');
        return;
      }

      const existingPrefs = await this.getUserHouseholdPreferences(userId);
      const existingHouseholdIds = existingPrefs.map(p => p.group_id);
      
      const newHouseholds = householdIds.filter(id => !existingHouseholdIds.includes(id));
      
      if (newHouseholds.length > 0) {
        logger.log('🆕 Yeni evler için tercih oluşturuluyor:', newHouseholds);
        
        for (const householdId of newHouseholds) {
          try {
            await this.createDefaultPreference(userId, householdId);
          } catch (prefError: any) {
            if (prefError.code === '42501') {
              logger.log('⚠️ RLS policy hatası - çıkış işlemi sırasında normal');
              break; // Diğer grupları da denemeye gerek yok
            } else {
              logger.error('Tercih oluşturma hatası:', prefError);
            }
          }
        }
      }
      
    } catch (error) {
      logger.log('⚠️ ensurePreferencesExist error (çıkış işlemi olabilir):', error);
    }
  }
}
