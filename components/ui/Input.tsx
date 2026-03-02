import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  Text, 
  StyleSheet, 
  TextInputProps, 
  ViewStyle,
  TouchableOpacity 
} from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  showPasswordToggle?: boolean;
  focusColor?: string;
}

export default function Input({ 
  label, 
  error, 
  containerStyle, 
  style,
  showPasswordToggle = false,
  secureTextEntry,
  focusColor = '#FF0080',
  ...props 
}: InputProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
  const isPassword = showPasswordToggle || secureTextEntry;
  const actualSecureTextEntry = isPassword && !isPasswordVisible;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View style={styles.inputContainer}>
        <TextInput
          {...props}
          style={[
            styles.input,
            isFocused && [styles.inputFocused, { 
              borderColor: focusColor,
              shadowColor: focusColor,
            }],
            error && styles.inputError,
            isPassword && styles.inputWithIcon,
            style
          ]}
          secureTextEntry={actualSecureTextEntry}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          placeholderTextColor="#6B7280"
        />
        
        {isPassword && (
          <TouchableOpacity
            style={styles.passwordToggle}
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
          >
            <Text style={styles.passwordToggleText}>
              {isPasswordVisible ? '🙈' : '👁️'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00D4FF',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 212, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  inputContainer: {
    position: 'relative',
  },
  input: {
    backgroundColor: '#0F0F1A',
    borderWidth: 2,
    borderColor: '#16213E',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: '#FFFFFF',
    minHeight: 56,
    shadowColor: '#16213E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  inputFocused: {
    borderColor: '#FF0080',
    backgroundColor: '#1A1A2E',
    shadowColor: '#FF0080',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 8,
  },
  inputError: {
    borderColor: '#FF3366',
    backgroundColor: '#2A1A20',
    shadowColor: '#FF3366',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 8,
  },
  inputWithIcon: {
    paddingRight: 50,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
  },
  passwordToggleText: {
    fontSize: 18,
  },
  error: {
    fontSize: 12,
    color: '#FF3366',
    marginTop: 6,
    marginLeft: 4,
    fontWeight: '600',
    textShadowColor: 'rgba(255, 51, 102, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
});
