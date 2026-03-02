import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Animated, Dimensions } from 'react-native';

interface FABAction {
  label: string;
  onPress: () => void;
  icon?: string;
  color?: string;
  shadowColor?: string;
}

interface FloatingActionButtonProps {
  actions: FABAction[];
  onMenuStateChange?: (isOpen: boolean) => void;
  forceClose?: boolean;
}

export default function FloatingActionButton({ actions, onMenuStateChange, forceClose }: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [animation] = useState(new Animated.Value(0));

  // Force close effect
  useEffect(() => {
    if (forceClose && isOpen) {
      // Menüyü kapat
      Animated.spring(animation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
      
      setIsOpen(false);
      onMenuStateChange?.(false);
    }
  }, [forceClose]);

  const toggleMenu = () => {
    const toValue = isOpen ? 0 : 1;
    
    Animated.spring(animation, {
      toValue,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
    
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    onMenuStateChange?.(newIsOpen);
  };

  const rotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <View style={styles.container}>
      {/* Background overlay when menu is open - blocks background touches */}
      {isOpen && (
        <View style={styles.backgroundOverlay} />
      )}
      
      {/* Action buttons */}
      {actions.map((action, index) => {
        const translateY = animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -(54 * (index + 0.95))],
        });

        const opacity = animation.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, 0, 1],
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.actionButton,
              {
                transform: [{ translateY }],
                opacity,
              },
            ]}
          >
            <View style={[styles.shadowWrap, { 
              shadowColor: action.shadowColor || '#00D4FF',
            }]}>
              <TouchableOpacity
                style={[
                  styles.actionButtonOuter,
                  { 
                    backgroundColor: action.color || '#1A1A2E',
                    borderColor: action.shadowColor || '#00D4FF',
                  }
                ]}
                onPress={() => {
                  console.log('FAB Action:', action.label, 'Color:', action.color);
                  action.onPress();
                  toggleMenu();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.actionIcon}>{action.icon || '+'}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.actionLabel, { 
                borderColor: action.shadowColor || '#00D4FF',
                backgroundColor: action.color || '#1A1A2E',
              }]}
              onPress={() => {
                console.log('FAB Label clicked:', action.label);
                action.onPress();
                toggleMenu();
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.actionLabelText, {
                textShadowColor: `rgba(${action.shadowColor === '#00FF94' ? '0, 255, 148' : '0, 212, 255'}, 0.3)`
              }]}>{action.label}</Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      {/* Main FAB */}
      <View style={styles.fabShadowWrap}>
        <TouchableOpacity
          style={styles.fab}
          onPress={toggleMenu}
          activeOpacity={0.8}
        >
          <Animated.Text
            style={[styles.fabIcon, { transform: [{ rotate: rotation }] }]}
          >
            +
          </Animated.Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const { width: screenWidth } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 60,
    right: Math.min(30, screenWidth * 0.05), // En az 30px, küçük ekranlarda %5
    alignItems: 'center',
    zIndex: 9999, // Çok yüksek z-index
  },
  fabShadowWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    elevation: 8, // Ana FAB gölgesi
    backgroundColor: '#1A1A2E', // Opak zemin
    shadowColor: '#FF0080',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30, // Tam yarısı - mükemmel daire
    backgroundColor: '#FF0080',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF0080',
    elevation: 0, // Gölge yok - shadowWrap'te
    shadowOpacity: 0,
  },
  fabIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '300',
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  actionButton: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    right: 0,
    height: 48, // Action button ile aynı yükseklik
    justifyContent: 'center',
    marginBottom: 0, // Margin'i sıfırla
  },
  shadowWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    elevation: 8, // Gölge burada
    backgroundColor: '#1A1A2E', // Opak zemin
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  actionButtonOuter: {
    width: 50,
    height: 50,
    borderRadius: 25, // Tam yarısı - mükemmel daire
    borderWidth: 2,
    borderColor: '#00D4FF', // Ana sayfa border stili
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 0, // Gölge yok - shadowWrap'te
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  actionIcon: {
    fontSize: 18,
    color: '#FFFFFF', // Beyaz - koyu arka planda okunabilir
    fontWeight: '600',
    lineHeight: 18, // Icon için sabit line-height
    textAlign: 'center',
  },
  actionLabel: {
    marginRight: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    // backgroundColor dinamik olarak veriliyor
    borderRadius: 8,
    borderWidth: 2,
    // borderColor dinamik olarak veriliyor
    maxWidth: Math.min(120, screenWidth * 0.3), // En fazla ekran genişliğinin %30'u
    minWidth: 80, // Minimum genişlik garantisi
    overflow: 'hidden',
    height: 40, // Daha yüksek - alt uzantılı harfler için
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabelText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18, // Daha yüksek line-height - p, g, j, y harfleri için
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  backgroundOverlay: {
    position: 'absolute',
    top: -1000,
    left: -1000,
    width: 2000,
    height: 2000,
    backgroundColor: 'transparent',
    zIndex: -1,
  },
});
