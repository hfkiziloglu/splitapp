import { useState } from "react";
import { View, Text, Alert, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/state/auth-context";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { notificationService } from "@/services/NotificationService";

const EXPENSE_CATEGORIES = [
  { value: 'rent', label: '🏠 Kira' },
  { value: 'market', label: '🛒 Market' },
  { value: 'bills', label: '📄 Faturalar' },
  { value: 'transport', label: '🚗 Ulaşım' },
  { value: 'food', label: '🍕 Yemek' },
  { value: 'entertainment', label: '🎬 Eğlence' },
  { value: 'health', label: '🏥 Sağlık' },
  { value: 'shopping', label: '🛍️ Alışveriş' },
  { value: 'other', label: '📦 Diğer' },
];

export default function AddExpense() {
  const { householdId, groupId } = useLocalSearchParams<{ householdId?: string; groupId?: string }>();
  const actualGroupId = groupId || householdId;
  const { user } = useAuth();
  
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [expenseDate, setExpenseDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{
    title?: string;
    amount?: string;
    description?: string;
  }>({});

  const validateInputs = () => {
    const newErrors: typeof errors = {};
    
    if (!title.trim()) {
      newErrors.title = "Harcama başlığı zorunludur";
    } else if (title.trim().length < 2) {
      newErrors.title = "Başlık en az 2 karakter olmalı";
    }
    
    if (!amount.trim()) {
      newErrors.amount = "Tutar zorunludur";
    } else {
      const numAmount = parseFloat(amount.replace(',', '.'));
      if (isNaN(numAmount) || numAmount <= 0) {
        newErrors.amount = "Geçerli bir tutar girin";
      } else if (numAmount > 999999) {
        newErrors.amount = "Tutar çok yüksek";
      }
    }
    
    if (description.length > 500) {
      newErrors.description = "Açıklama en fazla 500 karakter olabilir";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateInputs()) return;
    
    setBusy(true);
    setErrors({});
    
    try {
      const numAmount = parseFloat(amount.replace(',', '.'));
      
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          group_id: actualGroupId,
          created_by: user?.id,
          title: title.trim(),
          description: description.trim() || null,
          amount: numAmount,
          category: category,
          expense_date: expenseDate.toISOString().split('T')[0]
        })
        .select()
        .single();
        
      if (error) {
        console.error("Expense create error:", error);
        Alert.alert("Hata", "Harcama eklenirken hata oluştu: " + error.message);
        return;
      }

      // Harcama başarıyla eklendi, bildirim gönder
      await notificationService.sendExpenseNotification(
        actualGroupId!,
        numAmount,
        title.trim(),
        user?.id!
      );

      Alert.alert(
        "🎉 Başarılı!", 
        `"${title.trim()}" harcaması başarıyla eklendi!\n\nTutar: ₺${numAmount.toFixed(2)}`,
        [{ text: "Tamam", onPress: () => router.back() }]
      );
    } catch (err) {
      console.error("Expense create catch:", err);
      Alert.alert("Bağlantı Hatası", "İnternet bağlantınızı kontrol edin.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          style={styles.keyboardView} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.title}>Harcama Ekle 💸</Text>
              <Text style={styles.subtitle}>
                Yeni bir harcama kaydı oluştur
              </Text>
            </View>

            <View style={styles.form}>
              <Input
                label="Harcama Başlığı"
                placeholder="Örn: Market alışverişi, Elektrik faturası..."
                value={title}
                onChangeText={setTitle}
                error={errors.title}
                editable={!busy}
                autoFocus
              />
              
              <Input
                label="Tutar (₺)"
                placeholder="0.00"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                error={errors.amount}
                editable={!busy}
              />

              {/* Kategori Seçimi */}
              <View style={styles.categorySection}>
                <Text style={styles.categoryLabel}>Kategori</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.categoryScroll}
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <Button
                      key={cat.value}
                      title={cat.label}
                      onPress={() => setCategory(cat.value)}
                      variant={category === cat.value ? 'primary' : 'secondary'}
                      size="small"
                      style={styles.categoryButton}
                    />
                  ))}
                </ScrollView>
              </View>

              {/* Tarih Seçici */}
              <View style={styles.dateSection}>
                <Text style={styles.dateLabel}>Tarih</Text>
                <TouchableOpacity 
                  style={styles.dateButton}
                  onPress={() => setShowDatePicker(true)}
                  disabled={busy}
                >
                  <Text style={styles.dateButtonText}>
                    📅 {expenseDate.toLocaleDateString('tr-TR')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Date Picker Modal */}
              {showDatePicker && (
                <DateTimePicker
                  value={expenseDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selectedDate) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      setExpenseDate(selectedDate);
                    }
                  }}
                  maximumDate={new Date()}
                  minimumDate={new Date(2020, 0, 1)}
                />
              )}
              
              <Input
                label="Açıklama (Opsiyonel)"
                placeholder="Harcama hakkında ek bilgi..."
                value={description}
                onChangeText={setDescription}
                error={errors.description}
                editable={!busy}
                multiline
                numberOfLines={3}
              />

              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>💡 Bilgi</Text>
                <Text style={styles.infoText}>
                  • Harcama tüm grup üyelerine görünür olacak{'\n'}
                  • Tutarı virgül veya nokta ile girebilirsin{'\n'}
                  • Tarihi takvimden seçebilirsin (varsayılan bugün)
                </Text>
              </View>

              <Button
                title="Harcamayı Kaydet"
                onPress={handleSave}
                loading={busy}
                disabled={busy}
                style={styles.saveButton}
              />
              
              <Button
                title="İptal"
                onPress={() => router.back()}
                variant="outline"
                disabled={busy}
                style={styles.cancelButton}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
    textShadowColor: '#FF0080',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#00D4FF',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
    textShadowColor: 'rgba(0, 212, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  form: {
    flex: 1,
    gap: 20,
  },
  categorySection: {
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00D4FF',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 212, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  categoryScroll: {
    flexDirection: 'row',
  },
  categoryButton: {
    marginRight: 8,
    minWidth: 80,
  },
  infoBox: {
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#16213E',
    marginVertical: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00D4FF',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 212, 255, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  saveButton: {
    marginTop: 20,
  },
  cancelButton: {
    marginTop: 8,
  },
  
  // Date Picker Styles
  dateSection: {
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00D4FF',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 212, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  dateButton: {
    backgroundColor: '#0F0F1A',
    borderWidth: 2,
    borderColor: '#16213E',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 56,
    justifyContent: 'center',
    shadowColor: '#16213E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
