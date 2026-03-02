import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ViewStyle, TouchableOpacity } from "react-native";
import Svg, {
  G,
  Path,
  Circle,
  Defs,
  RadialGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import * as d3 from "d3-shape";

type DonutData = { 
  label: string; // Legend'da gösterilecek tam isim
  value: number; 
  color: string;
  userId?: string; // User ID eklendi
  shortLabel?: string; // Donut ortasında gösterilecek kısa isim
};

type CustomDonutProps = {
  data: DonutData[];
  size?: number;
  thickness?: number;
  onSegmentPress?: (datum: DonutData, index: number) => void;
  style?: ViewStyle;
  currentUserId?: string; // Giriş yapan kullanıcının ID'si
  onLegendSizeChange?: (height: number) => void; // Legend boyutu değişikliği callback
};

export default function CustomDonut({
  data,
  size = 240,
  thickness = 36,
  onSegmentPress,
  style,
  currentUserId,
  onLegendSizeChange
}: CustomDonutProps) {
  // Mod türleri
  type SelectionMode = 'highest' | 'current_user';
  
  // MOD SEÇİMİ: Bu değeri değiştirerek farklı modlar arasında geçiş yapabilirsiniz
  // 'highest' = En yüksek paya sahip segment seçili olur
  // 'current_user' = Giriş yapan kullanıcının payı seçili olur
  const selectionMode: SelectionMode = 'current_user';

  // En büyük değere sahip segmentin indeksini bul
  const getMaxValueIndex = () => {
    if (data.length === 0) return null;
    let maxIndex = 0;
    let maxValue = data[0].value;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i].value > maxValue) {
        maxValue = data[i].value;
        maxIndex = i;
      }
    }
    return maxIndex;
  };

  // Mevcut kullanıcının segmentini bul
  const getCurrentUserIndex = () => {
    if (!currentUserId || data.length === 0) return null;
    
    // Debug için
    console.log('🔍 getCurrentUserIndex - currentUserId:', currentUserId);
    console.log('🔍 getCurrentUserIndex - data:', data.map(d => ({ label: d.label, userId: d.userId })));
    
    for (let i = 0; i < data.length; i++) {
      // User ID'yi direkt karşılaştır
      if (data[i].userId === currentUserId) {
        console.log('✅ Kullanıcı bulundu, index:', i);
        return i;
      }
    }
    console.log('❌ Kullanıcı bulunamadı, fallback to highest');
    return null;
  };

  // Moda göre seçilecek indeksi belirle
  const getSelectedIndexByMode = (mode: SelectionMode) => {
    switch (mode) {
      case 'highest':
        return getMaxValueIndex();
      case 'current_user':
        return getCurrentUserIndex() ?? getMaxValueIndex(); // Kullanıcı bulunamazsa en yüksek payı seç
      default:
        return getMaxValueIndex();
    }
  };

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Data değiştiğinde uygun segmenti seç
  useEffect(() => {
    const newIndex = getSelectedIndexByMode(selectionMode);
    setSelectedIndex(newIndex);
  }, [data, currentUserId]);

  // Temel hesaplamalar
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const center = size / 2;
  const outerRadius = size * 0.4;
  const innerRadius = outerRadius - thickness;
  
  // D3 ile açıları hesapla
  const pie = d3.pie<DonutData>()
    .value(d => d.value)
    .sort(null)
    .padAngle(0.06); // Segmentler arası boşluk
    
  const pieData = pie(data);
  
  // Arc path generator
  const arc = d3.arc<d3.PieArcDatum<DonutData>>()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius)
    .cornerRadius(6);

  // Glow arc (seçili segment için)
  const glowArc = d3.arc<d3.PieArcDatum<DonutData>>()
    .innerRadius(innerRadius - 6)
    .outerRadius(outerRadius + 6)
    .cornerRadius(8);

  const handleSegmentPress = (datum: DonutData, index: number) => {
    const newIndex = selectedIndex === index ? null : index;
    setSelectedIndex(newIndex);
    onSegmentPress?.(datum, index);
  };

  return (
    <View style={[styles.container, style]}>
      {/* SVG Donut Chart */}
      <View style={styles.chartWrapper}>
        <Svg width={size} height={size}>
          <Defs>
            {/* Her segment için gradient */}
            {data.map((item, index) => (
              <RadialGradient 
                id={`gradient-${index}`} 
                cx="50%" 
                cy="50%" 
                r="50%" 
                key={index}
              >
                <Stop offset="0%" stopColor={item.color} stopOpacity="0.8" />
                <Stop offset="100%" stopColor={item.color} stopOpacity="1" />
              </RadialGradient>
            ))}
          </Defs>

          {/* Ana donut */}
          <G x={center} y={center}>
            {pieData.map((arcData, index) => {
              const isSelected = selectedIndex === index;
              const pathData = arc(arcData);
              const glowPath = glowArc(arcData);
              
              if (!pathData) return null;
              
              return (
                <G key={index}>
                  {/* Glow effect - sadece seçili için */}
                  {isSelected && glowPath && data[index] && (
                    <Path
                      d={glowPath}
                      fill={data[index].color}
                      opacity={0.4}
                    />
                  )}
                  
                  {/* Ana segment */}
                  <Path
                    d={pathData}
                    fill={`url(#gradient-${index})`}
                    opacity={isSelected ? 1 : 0.85}
                    onPress={() => data[index] && handleSegmentPress(data[index], index)}
                  />
                </G>
              );
            })}
          </G>
        </Svg>

        {/* Absolute positioned center content - React Native Text */}
        <View style={styles.centerContent}>
          {selectedIndex !== null && data[selectedIndex] ? (
            // Seçili segment detayları
            <View style={styles.centerGroup}>
              <Text style={styles.centerName}>
                {data[selectedIndex].shortLabel || data[selectedIndex].label}
              </Text>
              <Text style={[styles.centerAmount, { color: data[selectedIndex].color }]}>
                ₺{data[selectedIndex].value.toFixed(0)}
              </Text>
              <Text style={styles.centerPercent}>
                {((data[selectedIndex].value / total) * 100).toFixed(1)}%
              </Text>
            </View>
          ) : (
            // Toplam bilgiler
            <View style={styles.centerGroup}>
              <Text style={styles.centerTotal}>
                {total.toFixed(0)}
              </Text>
              <Text style={styles.centerLabel}>
                Toplam ₺
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* İnteraktif Legend */}
      <View 
        style={styles.legend}
        onLayout={(event) => {
          const legendHeight = event.nativeEvent.layout.height;
          onLegendSizeChange?.(legendHeight);
          console.log(`🏷️ Legend height: ${legendHeight}px (items: ${data.length})`);
        }}
      >
        {data.map((item, index) => {
          const percentage = (item.value / total) * 100;
          const isSelected = selectedIndex === index;
          
          
          return (
            <TouchableOpacity
              key={index}
              style={[styles.legendItem, isSelected && styles.legendItemSelected]}
              onPress={() => item && handleSegmentPress(item, index)}
              activeOpacity={0.7}
            >
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <View style={styles.legendContent}>
                <Text style={[styles.legendLabel, isSelected && styles.legendLabelSelected]}>
                  {item.label || 'İsimsiz'}
                </Text>
                <Text style={[styles.legendValue, isSelected && styles.legendValueSelected]}>
                  ₺{item.value.toLocaleString('tr-TR')} ({percentage.toFixed(0)}%)
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    alignItems: "center",
  },
  chartWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  centerGroup: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  centerAmount: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  centerPercent: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  centerTotal: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  centerLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  legend: { 
    width: "100%", 
    marginTop: 0,
    paddingHorizontal: 10,
  },
  legendItem: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  legendItemSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    transform: [{ scale: 1.02 }],
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 12,
    shadowColor: "#00D4FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  legendContent: {
    flex: 1,
  },
  legendLabel: { 
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  legendLabelSelected: {
    fontWeight: '700',
    color: "#FFFFFF",
  },
  legendValue: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  legendValueSelected: {
    color: "#00D4FF",
    fontWeight: '600',
  },
});
