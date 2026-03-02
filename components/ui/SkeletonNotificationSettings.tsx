import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ScrollView } from 'react-native';

export default function SkeletonNotificationSettings() {
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
    outputRange: [0.3, 0.8],
  });

  return (
    <View style={styles.container}>
      {/* Header Skeleton */}
      <View style={styles.headerSection}>
        <View style={styles.heroSection}>
          <View style={styles.iconContainer}>
            <Animated.View 
              style={[
                styles.iconSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
          </View>
          
          <View style={styles.heroTextSection}>
            <Animated.View 
              style={[
                styles.titleSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
            <Animated.View 
              style={[
                styles.subtitleSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
          </View>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Expense Notifications Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Animated.View 
              style={[
                styles.sectionIconSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
            <Animated.View 
              style={[
                styles.sectionTitleSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
          </View>
          
          {/* Expense notification setting */}
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Animated.View 
                style={[
                  styles.settingLabelSkeleton, 
                  { opacity: shimmerOpacity }
                ]} 
              />
              <Animated.View 
                style={[
                  styles.settingDescSkeleton, 
                  { opacity: shimmerOpacity }
                ]} 
              />
            </View>
            <Animated.View 
              style={[
                styles.switchSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
          </View>

          {/* Threshold Section */}
          <View style={styles.thresholdSection}>
            <View style={styles.thresholdHeader}>
              <Animated.View 
                style={[
                  styles.thresholdLabelSkeleton, 
                  { opacity: shimmerOpacity }
                ]} 
              />
              <Animated.View 
                style={[
                  styles.thresholdBadgeSkeleton, 
                  { opacity: shimmerOpacity }
                ]} 
              />
            </View>
            <Animated.View 
              style={[
                styles.thresholdDescSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
            <Animated.View 
              style={[
                styles.inputSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
          </View>
        </View>

        {/* Member Join Notifications Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Animated.View 
              style={[
                styles.sectionIconSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
            <Animated.View 
              style={[
                styles.sectionTitleSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Animated.View 
                style={[
                  styles.settingLabelSkeleton, 
                  { opacity: shimmerOpacity }
                ]} 
              />
              <Animated.View 
                style={[
                  styles.settingDescSkeleton, 
                  { opacity: shimmerOpacity }
                ]} 
              />
            </View>
            <Animated.View 
              style={[
                styles.switchSkeleton, 
                { opacity: shimmerOpacity }
              ]} 
            />
          </View>
        </View>

        {/* Buttons Section */}
        <View style={styles.buttonsSection}>
          <Animated.View 
            style={[
              styles.buttonSkeleton, 
              { opacity: shimmerOpacity }
            ]} 
          />
          <Animated.View 
            style={[
              styles.buttonSkeleton, 
              { opacity: shimmerOpacity }
            ]} 
          />
        </View>
      </ScrollView>
    </View>
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
    paddingBottom: 20,
  },
  headerSection: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 140,
    marginBottom: 32,
    paddingHorizontal: 32,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconContainer: {
    position: 'relative',
    marginRight: 20,
  },
  iconSkeleton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#374151',
  },
  heroTextSection: {
    flex: 1,
  },
  titleSkeleton: {
    height: 26,
    backgroundColor: '#374151',
    borderRadius: 8,
    marginBottom: 4,
    width: '70%',
  },
  subtitleSkeleton: {
    height: 14,
    backgroundColor: '#374151',
    borderRadius: 6,
    width: '90%',
  },
  sectionCard: {
    backgroundColor: '#151524',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    marginHorizontal: 20,
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 255, 0.2)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionIconSkeleton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#374151',
    marginRight: 12,
  },
  sectionTitleSkeleton: {
    height: 20,
    backgroundColor: '#374151',
    borderRadius: 6,
    width: '50%',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  settingLeft: {
    flex: 1,
    marginRight: 16,
  },
  settingLabelSkeleton: {
    height: 17,
    backgroundColor: '#374151',
    borderRadius: 4,
    marginBottom: 6,
    width: '60%',
  },
  settingDescSkeleton: {
    height: 14,
    backgroundColor: '#374151',
    borderRadius: 3,
    width: '85%',
  },
  switchSkeleton: {
    height: 32,
    width: 52,
    backgroundColor: '#374151',
    borderRadius: 16,
  },
  thresholdSection: {
    marginTop: 16,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 212, 255, 0.3)',
  },
  thresholdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  thresholdLabelSkeleton: {
    height: 16,
    backgroundColor: '#374151',
    borderRadius: 4,
    width: '35%',
  },
  thresholdBadgeSkeleton: {
    height: 24,
    width: 60,
    backgroundColor: '#374151',
    borderRadius: 12,
  },
  thresholdDescSkeleton: {
    height: 14,
    backgroundColor: '#374151',
    borderRadius: 3,
    marginBottom: 16,
    width: '95%',
  },
  inputSkeleton: {
    height: 56,
    backgroundColor: '#374151',
    borderRadius: 16,
    width: '100%',
  },
  buttonsSection: {
    marginTop: 32,
    marginBottom: 20,
    marginHorizontal: 20,
    gap: 16,
  },
  buttonSkeleton: {
    height: 56,
    backgroundColor: '#374151',
    borderRadius: 12,
    width: '100%',
  },
});