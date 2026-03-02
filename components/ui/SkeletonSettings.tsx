import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ScrollView } from 'react-native';

export default function SkeletonSettings() {
  // Shimmer animasyonu için
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

      {/* Scrollable Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Notification Settings Section Skeleton */}
        <View style={styles.sectionCard}>
          <Animated.View 
            style={[
              styles.sectionTitleSkeleton, 
              { opacity: shimmerOpacity }
            ]} 
          />
          
          {/* Notification Switch Items */}
          {[1, 2].map((index) => (
            <View key={index} style={styles.settingItem}>
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
          ))}

          {/* Notification Threshold Input */}
          <View style={styles.inputGroup}>
            <Animated.View 
              style={[
                styles.labelSkeleton, 
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

          {/* Button */}
          <Animated.View 
            style={[
              styles.buttonSkeleton, 
              { opacity: shimmerOpacity }
            ]} 
          />
        </View>

        {/* Period Settings Section Skeleton */}
        <View style={styles.sectionCard}>
          <Animated.View 
            style={[
              styles.sectionTitleSkeleton, 
              { opacity: shimmerOpacity }
            ]} 
          />
          
          {/* Setting Item */}
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
          </View>

          {/* Input Field */}
          <View style={styles.inputGroup}>
            <Animated.View 
              style={[
                styles.labelSkeleton, 
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

          {/* Button */}
          <Animated.View 
            style={[
              styles.buttonSkeleton, 
              { opacity: shimmerOpacity }
            ]} 
          />
        </View>

        {/* Profile Section Skeleton */}
        <View style={styles.sectionCard}>
          <Animated.View 
            style={[
              styles.sectionTitleSkeleton, 
              { opacity: shimmerOpacity }
            ]} 
          />
          
          {/* Input Fields */}
          {[1, 2, 3].map((index) => (
            <View key={index} style={styles.inputGroup}>
              <Animated.View 
                style={[
                  styles.labelSkeleton, 
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
          ))}

          {/* Button */}
          <Animated.View 
            style={[
              styles.buttonSkeleton, 
              { opacity: shimmerOpacity }
            ]} 
          />
        </View>

        {/* Password Section Skeleton */}
        <View style={styles.sectionCard}>
          <Animated.View 
            style={[
              styles.sectionTitleSkeleton, 
              { opacity: shimmerOpacity }
            ]} 
          />
          
          {/* Password Input Fields */}
          {[1, 2, 3].map((index) => (
            <View key={index} style={styles.inputGroup}>
              <Animated.View 
                style={[
                  styles.labelSkeleton, 
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
          ))}

          {/* Button */}
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
    // futuristicHeaderContainer ile aynı
    position: 'relative',
    overflow: 'hidden',
    minHeight: 140,
    marginBottom: 32,
    paddingHorizontal: 32,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  titleSkeleton: {
    // heroTitle ile aynı
    height: 26,
    backgroundColor: '#374151',
    borderRadius: 8,
    marginBottom: 4,
    width: '60%',
  },
  subtitleSkeleton: {
    // heroSubtitle ile aynı
    height: 14,
    backgroundColor: '#374151',
    borderRadius: 6,
    width: '80%',
  },
  sectionCard: {
    // modernSection ile aynı
    backgroundColor: '#151524',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    marginHorizontal: 20,
    borderWidth: 2,
    borderColor: 'rgba(0, 212, 255, 0.2)',
  },
  sectionTitleSkeleton: {
    // modernSectionTitle ile aynı
    height: 20,
    backgroundColor: '#374151',
    borderRadius: 6,
    marginBottom: 20,
    width: '40%',
  },
  inputGroup: {
    // standardInputContainer ile aynı
    marginBottom: 16,
  },
  labelSkeleton: {
    // Input label ile aynı
    height: 14,
    backgroundColor: '#374151',
    borderRadius: 4,
    marginBottom: 8,
    width: '30%',
  },
  inputSkeleton: {
    // Input ile aynı
    height: 56, // minHeight: 56
    backgroundColor: '#374151',
    borderRadius: 16,
    width: '100%',
  },
  settingItem: {
    // modernSettingRow ile aynı
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  settingLeft: {
    // modernSettingInfo ile aynı
    flex: 1,
    marginRight: 16,
  },
  settingLabelSkeleton: {
    // modernSettingLabel ile aynı
    height: 17,
    backgroundColor: '#374151',
    borderRadius: 4,
    marginBottom: 6,
    width: '70%',
  },
  settingDescSkeleton: {
    // modernSettingDescription ile aynı
    height: 14,
    backgroundColor: '#374151',
    borderRadius: 3,
    width: '90%',
  },
  settingInputSkeleton: {
    // Input küçük versiyonu
    height: 56,
    width: 80,
    backgroundColor: '#374151',
    borderRadius: 16,
  },
  switchSkeleton: {
    // Switch skeleton
    height: 32,
    width: 52,
    backgroundColor: '#374151',
    borderRadius: 16,
  },
  buttonsSection: {
    marginHorizontal: 20,
    marginTop: 16, // saveButton ile aynı
    gap: 12,
  },
  buttonSkeleton: {
    // modernSaveButton ile aynı
    height: 56, // paddingVertical: 18 * 2 + font height
    backgroundColor: '#374151',
    borderRadius: 12,
    width: '100%',
  },
});
