import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

export function SkeletonGroupHeader() {
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
    <View style={styles.settingsStyleHeaderContainer}>
      <View style={styles.headerBackgroundSkeleton} />
      <View style={styles.headerOverlaySkeleton} />
      
      <View style={styles.settingsStyleHeaderSkeleton}>
        <View style={styles.headerHeroSectionSkeleton}>
          <View style={styles.headerIconContainerSkeleton}>
            <View style={styles.headerIconGlowSkeleton} />
            <Animated.View 
              style={[
                styles.headerIconCircleSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
          </View>
          
          <View style={styles.headerTextSkeleton}>
            <Animated.View 
              style={[
                styles.headerTitleSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
            <Animated.View 
              style={[
                styles.headerSubtitleSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
          </View>
          
          <Animated.View 
            style={[
              styles.headerNotificationButtonSkeleton, 
              { opacity: shimmerOpacity }
            ]} 
          />
        </View>
      </View>
    </View>
  );
}

export function SkeletonChart() {
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
            {[1, 2, 3].map((_, index) => (
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

export function SkeletonStats() {
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
    <View style={styles.statsContainer}>
      {/* Member Stat Card */}
      <View style={[styles.statCard, styles.memberStatCard]}>
        <View style={styles.statIconContainer}>
          <Animated.View 
            style={[
              styles.statIconSkeleton, 
              { opacity: shimmerOpacity }
            ]} 
          />
        </View>
        <Animated.View 
          style={[
            styles.statNumberSkeleton, 
            { opacity: shimmerOpacity }
          ]} 
        />
        <Animated.View 
          style={[
            styles.statLabelSkeleton, 
            { opacity: shimmerOpacity }
          ]} 
        />
      </View>
      
      {/* Expense Stat Card */}
      <View style={[styles.statCard, styles.expenseStatCard]}>
        <View style={styles.statIconContainer}>
          <Animated.View 
            style={[
              styles.statIconSkeleton, 
              { opacity: shimmerOpacity }
            ]} 
          />
        </View>
        <Animated.View 
          style={[
            styles.statNumberSkeleton, 
            { opacity: shimmerOpacity }
          ]} 
        />
        <Animated.View 
          style={[
            styles.statLabelSkeleton, 
            { opacity: shimmerOpacity }
          ]} 
        />
      </View>
    </View>
  );
}

export function SkeletonMembers() {
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

const styles = StyleSheet.create({
  // Settings Style Header Skeleton Styles
  settingsStyleHeaderContainer: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 100,
    marginBottom: 16,
    marginHorizontal: -20,
    marginTop: -20,
  },
  headerBackgroundSkeleton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#00D4FF',
    opacity: 0.12,
  },
  headerOverlaySkeleton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  settingsStyleHeaderSkeleton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingTop: 40,
  },
  headerHeroSectionSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  headerIconContainerSkeleton: {
    position: 'relative',
    marginRight: 16,
  },
  headerIconGlowSkeleton: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 255, 0.4)',
    top: -4,
    left: -4,
  },
  headerIconCircleSkeleton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#374151',
  },
  headerTextSkeleton: {
    flex: 1,
    marginRight: 16,
  },
  headerTitleSkeleton: {
    height: 24,
    width: 140,
    backgroundColor: '#374151',
    borderRadius: 6,
    marginBottom: 8,
  },
  headerSubtitleSkeleton: {
    height: 16,
    width: 100,
    backgroundColor: '#374151',
    borderRadius: 4,
  },
  headerNotificationButtonSkeleton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#374151',
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

  // Stats Skeleton Styles
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 50,
    paddingHorizontal: 20,
    gap: 10,
    marginTop: -18,
  },
  statCard: {
    backgroundColor: '#151524',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    width: 150,
    minHeight: 120,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  memberStatCard: {
    shadowColor: '#FF0080',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 128, 0.2)',
  },
  expenseStatCard: {
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
  statIconSkeleton: {
    width: 24,
    height: 24,
    backgroundColor: '#374151',
    borderRadius: 4,
  },
  statNumberSkeleton: {
    height: 24,
    width: 60,
    backgroundColor: '#374151',
    borderRadius: 6,
  },
  statLabelSkeleton: {
    height: 14,
    width: 40,
    backgroundColor: '#374151',
    borderRadius: 4,
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
});