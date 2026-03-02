import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Animated } from 'react-native';

interface GroupCardProps {
  id: string;
  name: string;
  description?: string;
  memberCount?: number;
  totalExpenses?: number;
  createdAt: string;
  onPress: () => void;
  color?: string; // Sol border rengi için
  isExpenseLoading?: boolean; // Harcama verisi yüklenirken
  showColorPicker?: boolean; // Edit modunda renk seçici göster
  onColorPickerPress?: () => void; // Renk seçici tıklama
}

export default function GroupCard({ 
  name, 
  description, 
  memberCount = 1, 
  totalExpenses = 0, 
  createdAt, 
  onPress,
  color = '#FF0080', // Varsayılan renk
  isExpenseLoading = false,
  showColorPicker = false,
  onColorPickerPress
}: GroupCardProps) {
  // Loading animasyonu için animated values
  const dot1Opacity = useRef(new Animated.Value(0.3)).current;
  const dot2Opacity = useRef(new Animated.Value(0.3)).current;
  const dot3Opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (isExpenseLoading) {
      // Basit loop animasyonu
      const createAnimation = () => {
        return Animated.loop(
          Animated.sequence([
            // İlk nokta parlar
            Animated.timing(dot1Opacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            // İkinci nokta parlar, birinci söner
            Animated.parallel([
              Animated.timing(dot1Opacity, {
                toValue: 0.3,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(dot2Opacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }),
            ]),
            // Üçüncü nokta parlar, ikinci söner
            Animated.parallel([
              Animated.timing(dot2Opacity, {
                toValue: 0.3,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(dot3Opacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }),
            ]),
            // Üçüncü söner
            Animated.timing(dot3Opacity, {
              toValue: 0.3,
              duration: 200,
              useNativeDriver: true,
            }),
            // Kısa bekleme
            Animated.delay(200),
          ]),
          { iterations: -1 } // Sonsuz döngü
        );
      };
      
      const animation = createAnimation();
      animation.start();
      
      // Cleanup function
      return () => {
        animation.stop();
      };
    } else {
      // Loading bitince tüm noktaları resetle
      dot1Opacity.setValue(0.3);
      dot2Opacity.setValue(0.3);
      dot3Opacity.setValue(0.3);
    }
  }, [isExpenseLoading]);
  // Açık renkli arka plan oluştur - hex rengini rgba'ya çevir
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  
  // Parlaklığı azaltmak için rengi koyulaştır
  const darkenColor = (hex: string, factor: number) => {
    const r = Math.floor(parseInt(hex.slice(1, 3), 16) * factor);
    const g = Math.floor(parseInt(hex.slice(3, 5), 16) * factor);
    const b = Math.floor(parseInt(hex.slice(5, 7), 16) * factor);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };
  
  const darkenedColor = darkenColor(color, 0.7); // Rengi %70'ine düşür (optimal koyuluk)
  const lightBackgroundColor = hexToRgba(darkenedColor, 0.35); // %35 opacity - dengeli opaklık

  return (
    <TouchableOpacity 
      style={[
        styles.card,
        { 
          backgroundColor: lightBackgroundColor, // Açık renkli arka plan
          borderLeftWidth: 4,
          borderLeftColor: color, // Sol renkli çizgi
        }
      ]} 
      onPress={onPress} 
      activeOpacity={0.8}
    >
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{name}</Text>
        <View style={styles.memberBadge}>
          <Text style={styles.memberCount}>{memberCount}</Text>
        </View>
      </View>
      
      {description && (
        <Text style={styles.description} numberOfLines={2} ellipsizeMode="tail">{description}</Text>
      )}
      
      <View style={styles.footer}>
        <View style={styles.expenseInfo}>
          <Text style={styles.expenseLabel}>Bu Ay</Text>
          {isExpenseLoading ? (
            <View style={styles.loadingContainer}>
              <Animated.View style={[styles.loadingDot, { opacity: dot1Opacity }]} />
              <Animated.View style={[styles.loadingDot, { opacity: dot2Opacity }]} />
              <Animated.View style={[styles.loadingDot, styles.loadingDot3, { opacity: dot3Opacity }]} />
            </View>
          ) : (
            <Text style={styles.expenseAmount}>₺{totalExpenses.toFixed(2)}</Text>
          )}
        </View>
        
        <Text style={styles.date}>
          {new Date(createdAt).toLocaleDateString('tr-TR')}
        </Text>
      </View>
      
      {/* Color Picker Button - Sağ tarafta dikey ortada */}
      {showColorPicker && onColorPickerPress && (
        <TouchableOpacity
          style={[styles.colorPickerButton, { borderColor: color }]}
          onPress={onColorPickerPress}
          activeOpacity={0.7}
        >
          <Text style={styles.colorPickerIcon}>🎨</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1A2E', // Base arka plan
    borderRadius: 16,
    padding: 16,
    borderWidth: 0,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 123, // Minimum yükseklik (responsive)
    maxHeight: 143, // Maximum yükseklik (taşmayı önle)
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textShadowColor: 'rgba(255, 255, 255, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  memberBadge: {
    backgroundColor: '#FF0080',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: '#FF0080',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  memberCount: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 12,
    color: '#FFFFFF',
    marginBottom: 6,
    lineHeight: 16,
    opacity: 0.8,
  },
  footer: {
    position: 'absolute',
    bottom: 16, // padding ile aynı
    left: 16,   // padding ile aynı
    right: 16,  // padding ile aynı
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  expenseInfo: {
    flex: 1,
  },
  expenseLabel: {
    fontSize: 12,
    color: '#FFFFFF',
    marginBottom: 0,
    opacity: 0.85,
    fontWeight: '500',
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00FF94',
    textShadowColor: 'rgba(0, 255, 148, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
    height: 22, // Loading container ile aynı yükseklik
    lineHeight: 22, // Text'i dikey olarak ortala
  },
  date: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.8,
    fontWeight: '500',
  },
  // Loading animation styles
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    height: 22, // expenseAmount ile aynı yükseklik (fontSize 18 + lineHeight)
    minHeight: 22, // Minimum yükseklik garantisi
    paddingTop: 1, // Noktaları biraz aşağı indir
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00FF94',
    marginRight: 4,
    shadowColor: '#00FF94',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
  loadingDot3: {
    marginRight: 0,
  },
  // Color Picker Button Styles
  colorPickerButton: {
    position: 'absolute',
    top: '57%', // Yüzde değeri - responsive
    right: '5%', // Yüzde değeri - responsive
    width: 28, // Biraz daha küçük, responsive friendly
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5, // Daha ince border
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    // Minimum ve maximum boyutlar
    minWidth: 24,
    maxWidth: 32,
    minHeight: 24,
    maxHeight: 32,
  },
  colorPickerIcon: {
    fontSize: 12, // Biraz daha küçük icon
  },
});
