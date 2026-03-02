import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

export default function SkeletonGroupCard() {
  // Shimmer animasyonu için
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    
    shimmer.start();
    
    return () => shimmer.stop();
  }, [shimmerAnim]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.card}>
      {/* Neon Glow Background */}
      <View style={styles.neonGlow} />
      
      <View style={styles.header}>
        {/* Ev ismi placeholder */}
        <Animated.View 
          style={[
            styles.nameSkeleton, 
            { opacity: shimmerOpacity }
          ]} 
        />
        {/* Üye sayısı badge placeholder */}
        <Animated.View 
          style={[
            styles.memberBadgeSkeleton, 
            { opacity: shimmerOpacity }
          ]} 
        />
      </View>
      
      {/* Açıklama placeholder */}
      <Animated.View 
        style={[
          styles.descriptionSkeleton, 
          { opacity: shimmerOpacity }
        ]} 
      />
      
      <View style={styles.footer}>
        <View style={styles.expenseInfo}>
          {/* "Bu Ay" label placeholder */}
          <Animated.View 
            style={[
              styles.expenseLabelSkeleton, 
              { opacity: shimmerOpacity }
            ]} 
          />
          {/* Harcama miktarı placeholder */}
          <Animated.View 
            style={[
              styles.expenseAmountSkeleton, 
              { opacity: shimmerOpacity }
            ]} 
          />
        </View>
        {/* Tarih placeholder */}
        <Animated.View 
          style={[
            styles.dateSkeleton, 
            { opacity: shimmerOpacity }
          ]} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 128, 0.3)', // Varsayılan neon border
    borderLeftWidth: 4,
    borderLeftColor: '#FF0080', // Varsayılan sol border
    shadowColor: '#FF0080',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 123, // GroupCard ile aynı minimum yükseklik
    maxHeight: 143, // GroupCard ile aynı maximum yükseklik
  },
  neonGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FF0080',
    opacity: 0.05,
    borderRadius: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameSkeleton: {
    height: 24,
    backgroundColor: '#374151',
    borderRadius: 8,
    flex: 1,
    marginRight: 12,
  },
  memberBadgeSkeleton: {
    width: 32,
    height: 24,
    backgroundColor: '#374151',
    borderRadius: 12,
  },
  descriptionSkeleton: {
    height: 14,
    backgroundColor: '#374151',
    borderRadius: 6,
    marginBottom: 6,
    width: '70%', // Daha küçük ve doğal görünsün
  },
  footer: {
    position: 'absolute',
    bottom: 18, // padding ile aynı
    left: 18,   // padding ile aynı
    right: 18,  // padding ile aynı
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  expenseInfo: {
    flex: 1,
  },
  expenseLabelSkeleton: {
    height: 14,
    width: 40,
    backgroundColor: '#374151',
    borderRadius: 4,
    marginBottom: 4,
  },
  expenseAmountSkeleton: {
    height: 22, // GroupCard ile aynı yükseklik
    width: 80,
    backgroundColor: '#374151',
    borderRadius: 6,
  },
  dateSkeleton: {
    height: 14,
    width: 60,
    backgroundColor: '#374151',
    borderRadius: 4,
  },
});
