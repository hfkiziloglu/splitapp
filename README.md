# SplitApp — Bölüşelim

**YMH339 Veritabanı Dersi Projesi** · Ankara Üniversitesi

Ev arkadaşlarıyla ortak harcamaları takip etmek ve şeffaf şekilde paylaşmak için geliştirilmiş mobil uygulama.

---

## Özellikler

- **Grup Yönetimi** — Ev/grup oluştur, davet kodu ile üye ekle, üye rollerini yönet
- **Harcama Takibi** — Kategori bazlı harcama girişi (kira, market, fatura, ulaşım, yemek vb.)
- **Grafik Görselleştirme** — Neon donut chart ile harcama dağılımı
- **Gerçek Zamanlı Bildirimler** — Yeni harcama ve üye katılımında anlık bildirim (Supabase Realtime)
- **Esnek Filtreleme** — Bu ay, geçen ay veya özel tarih aralığı
- **Davet Sistemi** — Bağlantı veya QR kodu ile gruba katılım
- **Sürükle-Bırak** — Ana ekranda grup kartı sıralama
- **Özelleştirme** — Her gruba farklı renk atama
- **Beni Hatırla** — Şifreli depolama ile güvenli otomatik giriş

---

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Dil | TypeScript |
| Navigasyon | Expo Router (file-based) |
| Backend | Supabase (Auth, PostgreSQL, Realtime) |
| Grafikler | d3-shape + react-native-svg |
| Animasyon | react-native-reanimated + react-native-gesture-handler |
| Form | react-hook-form + Zod |
| Güvenli Depolama | expo-secure-store |
| Bildirimler | expo-notifications |

---

## Kurulum

### Gereksinimler

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Supabase hesabı

### Adımlar

```bash
# 1. Depoyu klonla
git clone https://github.com/hfkiziloglu/splitapp.git
cd splitapp

# 2. Bağımlılıkları yükle
npm install

# 3. Ortam değişkenlerini ayarla
cp .env.example .env.local
# .env.local dosyasını düzenleyerek kendi Supabase bilgilerini gir

# 4. Uygulamayı başlat
expo start
```

### Ortam Değişkenleri

`.env.example` dosyasını `.env.local` olarak kopyala ve doldur:

```
EXPO_PUBLIC_SUPABASE_URL=https://<proje-id>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

---

## Veritabanı Şeması

Supabase (PostgreSQL) üzerinde aşağıdaki tablolar kullanılmaktadır:

| Tablo | Açıklama |
|---|---|
| `users` | Kullanıcı profilleri |
| `groups` | Ev/grup bilgileri ve davet kodları |
| `group_members` | Kullanıcı-grup ilişkisi ve roller |
| `expenses` | Harcama kayıtları (kategori, tutar, tarih) |
| `notifications` | Kullanıcı bildirimleri |
| `notification_preferences` | Grup bazlı bildirim ayarları |
| `user_group_preferences` | Grup sıralama ve renk tercihleri |

Detaylı şema ve ER diyagramı için proje raporuna bakınız.

---

## Uygulama Yapısı

```
app/
├── (auth)/          # Giriş ve kayıt ekranları
├── (home)/          # Ana uygulama ekranları
│   ├── index.tsx       # Dashboard (grup listesi)
│   ├── group/[id].tsx  # Grup detayı ve harcamalar
│   ├── expense/        # Harcama ekleme ve listeleme
│   ├── settings.tsx    # Kullanıcı ayarları
│   └── join-group.tsx  # Davet koduyla katılım
└── join/[token].tsx # Bağlantı ile katılım

components/ui/       # Yeniden kullanılabilir UI bileşenleri
services/            # İş mantığı (bildirim, tercih servisleri)
state/               # Auth context
lib/                 # Supabase istemcisi, logger
```

---

## Ekran Görüntüleri

> *(Eklenecek)*

---

## Katkıda Bulunanlar

| | Kullanıcı |
|---|---|
| [@hfkiziloglu](https://github.com/hfkiziloglu) | Furkan Kızıloğlu |
| [@yusufekerl](https://github.com/yusufekerl) | Yusuf Ekerl |
| [@emiirbas](https://github.com/emiirbas) | Emir Baş |

---

## Lisans

Bu proje yalnızca akademik amaçla geliştirilmiştir.
