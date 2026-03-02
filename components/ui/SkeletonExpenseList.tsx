import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

export function SkeletonExpenseHeader() {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1200,
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
    <View style={styles.futuristicHeaderContainer}>
      <View style={styles.fadeBackground} />
      <View style={styles.fadeOverlay} />
      
      <View style={styles.futuristicHeader}>
        <View style={styles.heroSection}>
          <View style={styles.iconContainer}>
            <View style={styles.iconGlowRing} />
            <Animated.View 
              style={[
                styles.iconCircle, 
                { opacity: shimmerOpacity }
              ]} 
            />
          </View>
          
          <View style={styles.heroTextSection}>
            <Animated.View 
              style={[
                styles.heroTitleSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
            <Animated.View 
              style={[
                styles.heroSubtitleSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
          </View>
        </View>
      </View>
    </View>
  );
}

export function SkeletonExpenseChart() {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.6],
  });

  return (
    <View style={styles.chartSection}>
      <View style={styles.chartContainer}>
        {/* Floating Toggle */}
        <View style={styles.floatingToggleContainer}>
          <View style={styles.floatingToggle}>
            <Animated.View 
              style={[
                styles.toggleButtonSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
            <Animated.View 
              style={[
                styles.toggleButtonSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
          </View>
        </View>
        
        {/* Chart Placeholder */}
        <View style={styles.chartContentSpacing}>
          <Animated.View 
            style={[
              styles.donutChartSkeleton, 
              { opacity: shimmerOpacity }
            ]} 
          />
          
          {/* Legend Skeleton */}
          <View style={styles.legendContainer}>
            {[1, 2].map((_, index) => (
              <View key={index} style={styles.legendItem}>
                <Animated.View 
                  style={[
                    styles.legendDotSkeleton, 
                    { opacity: shimmerOpacity }
                  ]} 
                />
                <View style={styles.legendContent}>
                  <Animated.View 
                    style={[
                      styles.legendLabelSkeleton, 
                      { opacity: shimmerOpacity }
                    ]} 
                  />
                  <Animated.View 
                    style={[
                      styles.legendValueSkeleton, 
                      { opacity: shimmerOpacity }
                    ]} 
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

export function SkeletonExpenseSummary() {
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
    <View style={styles.summaryCard}>
      <View style={styles.summaryItem}>
        <Animated.View 
          style={[
            styles.summaryLabelSkeleton, 
            { opacity: shimmerOpacity }
          ]} 
        />
        <Animated.View 
          style={[
            styles.summaryCountSkeleton, 
            { opacity: shimmerOpacity }
          ]} 
        />
      </View>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryItem}>
        <Animated.View 
          style={[
            styles.summaryLabelSkeleton, 
            { opacity: shimmerOpacity }
          ]} 
        />
        <Animated.View 
          style={[
            styles.summaryValueSkeleton, 
            { opacity: shimmerOpacity }
          ]} 
        />
      </View>
    </View>
  );
}

export function SkeletonExpenseMembers() {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1300,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1300,
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
    <View style={styles.membersSection}>
      {/* Section Title */}
      <Animated.View 
        style={[
          styles.sectionTitleSkeleton, 
          { opacity: shimmerOpacity }
        ]} 
      />
      
      {/* Member Cards */}
      {[1, 2, 3].map((_, index) => (
        <View key={index} style={styles.memberCard}>
          <Animated.View 
            style={[
              styles.memberAvatarSkeleton, 
              { opacity: shimmerOpacity }
            ]} 
          />
          <View style={styles.memberInfo}>
            <Animated.View 
              style={[
                styles.memberNameSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
            <Animated.View 
              style={[
                styles.memberRoleSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
          </View>
          <Animated.View 
            style={[
              styles.colorChangeButtonSkeleton, 
              { opacity: shimmerOpacity }
            ]} 
          />
        </View>
      ))}
    </View>
  );
}

export function SkeletonExpenseList() {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1100,
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
    <View style={styles.expensesSection}>
      {/* Section Title */}
      <Animated.View 
        style={[
          styles.sectionTitleSkeleton, 
          { opacity: shimmerOpacity }
        ]} 
      />
      
      {/* Filter Buttons Skeleton */}
      <View style={styles.filterContainer}>
        {[1, 2, 3, 4].map((_, index) => (
          <Animated.View 
            key={index}
            style={[
              styles.filterButtonSkeleton, 
              { opacity: shimmerOpacity }
            ]} 
          />
        ))}
      </View>
      
      {/* Member Filter Skeleton */}
      <View style={styles.filterContainer}>
        {[1, 2, 3].map((_, index) => (
          <Animated.View 
            key={index}
            style={[
              styles.memberFilterButtonSkeleton, 
              { opacity: shimmerOpacity }
            ]} 
          />
        ))}
      </View>
      
      {/* Expense Cards Skeleton */}
      {[1, 2, 3, 4, 5].map((_, index) => (
        <View key={index} style={styles.expenseCard}>
          <View style={styles.expenseInfo}>
            <Animated.View 
              style={[
                styles.expenseTitleSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
            <Animated.View 
              style={[
                styles.expenseUserSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
            <Animated.View 
              style={[
                styles.expenseDateSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
          </View>
          <Animated.View 
            style={[
              styles.expenseAmountSkeleton, 
              { opacity: shimmerOpacity }
            ]} 
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Header Skeleton Styles (similar to detail page but with green theme)
  futuristicHeaderContainer: { 
    position: 'relative', 
    overflow: 'hidden', 
    minHeight: 140, 
    marginBottom: 32 
  },
  fadeBackground: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    backgroundColor: '#00FF94', // Green theme
    opacity: 0.2 
  },
  fadeOverlay: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0 
  },
  futuristicHeader: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 32, 
    paddingVertical: 32,
    minHeight: 140
  },
  heroSection: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'flex-start', 
    flex: 1 
  },
  iconContainer: { 
    position: 'relative', 
    marginRight: 24 
  },
  iconGlowRing: { 
    position: 'absolute', 
    width: 72, 
    height: 72, 
    borderRadius: 36, 
    borderWidth: 2, 
    borderColor: 'rgba(0, 255, 148, 0.4)',
    top: -6, 
    left: -6, 
    shadowColor: '#00FF94', 
    shadowOffset: { width: 0, height: 0 }, 
    shadowOpacity: 0.6, 
    shadowRadius: 16, 
    elevation: 12 
  },
  iconCircle: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    backgroundColor: '#374151',
    borderWidth: 3, 
    borderColor: 'rgba(255, 255, 255, 0.3)' 
  },
  heroTextSection: { 
    flex: 1,
    alignItems: 'flex-start'
  },
  heroTitleSkeleton: { 
    height: 32,
    width: 200,
    backgroundColor: '#374151',
    borderRadius: 8,
    marginBottom: 8,
  },
  heroSubtitleSkeleton: { 
    height: 16,
    width: 150,
    backgroundColor: '#374151',
    borderRadius: 6,
  },

  // Chart Skeleton Styles
  chartSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
    marginTop: 8,
  },
  chartContainer: {
    position: 'relative',
    backgroundColor: 'transparent',
    marginTop: -20,
  },
  floatingToggleContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
  },
  floatingToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 25,
    padding: 3,
  },
  toggleButtonSkeleton: {
    width: 40,
    height: 32,
    backgroundColor: '#374151',
    borderRadius: 22,
    marginHorizontal: 1,
  },
  chartContentSpacing: {
    marginTop: 10,
    alignItems: 'center',
  },
  donutChartSkeleton: {
    width: 280,
    height: 280,
    backgroundColor: '#374151',
    borderRadius: 140,
    marginBottom: 20,
  },
  legendContainer: {
    width: '100%',
    paddingHorizontal: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  legendDotSkeleton: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#374151',
    marginRight: 12,
  },
  legendContent: {
    flex: 1,
  },
  legendLabelSkeleton: {
    height: 16,
    width: 80,
    backgroundColor: '#374151',
    borderRadius: 4,
    marginBottom: 4,
  },
  legendValueSkeleton: {
    height: 14,
    width: 120,
    backgroundColor: '#374151',
    borderRadius: 4,
  },

  // Summary Skeleton Styles
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
  summaryLabelSkeleton: {
    height: 16,
    width: 80,
    backgroundColor: '#374151',
    borderRadius: 4,
    marginBottom: 8,
  },
  summaryCountSkeleton: {
    height: 20,
    width: 40,
    backgroundColor: '#374151',
    borderRadius: 6,
  },
  summaryValueSkeleton: {
    height: 22,
    width: 100,
    backgroundColor: '#374151',
    borderRadius: 6,
  },

  // Members Skeleton Styles
  membersSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitleSkeleton: {
    height: 20,
    width: 100,
    backgroundColor: '#374151',
    borderRadius: 6,
    marginBottom: 16,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#374151',
  },
  memberAvatarSkeleton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#374151',
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameSkeleton: {
    height: 18,
    width: 120,
    backgroundColor: '#374151',
    borderRadius: 4,
    marginBottom: 4,
  },
  memberRoleSkeleton: {
    height: 14,
    width: 60,
    backgroundColor: '#374151',
    borderRadius: 4,
  },
  colorChangeButtonSkeleton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#374151',
    marginLeft: 8,
  },

  // Expense List Skeleton Styles
  expensesSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  filterButtonSkeleton: {
    height: 36,
    width: 90,
    backgroundColor: '#374151',
    borderRadius: 18,
  },
  memberFilterButtonSkeleton: {
    height: 36,
    width: 70,
    backgroundColor: '#374151',
    borderRadius: 18,
  },
  expenseCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#151524',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#374151',
  },
  expenseInfo: {
    flex: 1,
  },
  expenseTitleSkeleton: {
    height: 18,
    width: 150,
    backgroundColor: '#374151',
    borderRadius: 4,
    marginBottom: 6,
  },
  expenseUserSkeleton: {
    height: 14,
    width: 100,
    backgroundColor: '#374151',
    borderRadius: 4,
    marginBottom: 4,
  },
  expenseDateSkeleton: {
    height: 12,
    width: 120,
    backgroundColor: '#374151',
    borderRadius: 4,
  },
  expenseAmountSkeleton: {
    height: 20,
    width: 80,
    backgroundColor: '#374151',
    borderRadius: 6,
  },
});