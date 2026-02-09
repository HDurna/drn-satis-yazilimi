# Sistem Mimari Planı ve Modül Yapısı

## 1. Mimari Değişiklik: Merkezi Ürün / Dağıtık Stok (Hibrit Yapı)

Şu anki tek `current_stock` yapısından, şube bazlı stok yapısına geçilecektir.

### Veritabanı Değişiklikleri (`migrations`)
1.  **Tablo: `warehouses` (Genişletilecek)**
    *   `is_store`: Bu deponun bir satış noktası (şube) olup olmadığını belirtir.
    *   `address`, `phone`: Şube bilgileri.

2.  **Tablo: `product_stocks` (Yeni)**
    *   `product_id`: Ürün referansı.
    *   `warehouse_id`: Depo/Şube referansı.
    *   `quantity`: O depodaki miktar.
    *   *Not:* `products` tablosundaki `current_stock` sanal bir alana (toplam) veya merkez depo değerine dönüşecek.

3.  **Tablo: `registers` (Yeni - Çoklu Kasa)**
    *   `warehouse_id`: Hangi şubede?
    *   `name`: Kasa Adı (Örn: Ana Kasa).
    *   `ip_address`: Kısıtlama için opsiyonel.

4.  **Tablo: `register_sessions` (Yeni - Oturum Bazlı Kasa)**
    *   `register_id`
    *   `user_id`: Açan personel.
    *   `opening_amount`: Açılış nakiti.
    *   `closing_amount`: Kapanış nakiti (sayılan).
    *   `status`: OPEN/CLOSED.

## 2. Modül Yapısı (`src/lib/modules.ts`)

Tüm özellikler artık birer "Modül" olarak tanımlanmıştır. `MODULES` sabiti üzerinden `isEnabled: true/false` yapılarak özellikler açılıp kapatılabilir.

### Klasör Yapısı (Hedeflenen)
```
src/
  app/
    (modules)/
       pos/           -> POS Modülü
       inventory/     -> Stok Modülü
       expenses/      -> Gider Modülü (Yeni)
       loyalty/       -> Sadakat Modülü (Yeni)
  components/
    modules/          -> Modüllere özel komponentler
      pos/
      shared/
  lib/
    modules.ts        -> Konfigürasyon dosyası
```

## 3. Öncelikli Geçiş Planı

1.  **Yedekleme:** Mevcut kod yedeklendi (`backups/v1_stable`).
2.  **Modül Entegrasyonu:** `MainLayout` bileşeni `modules.ts` dosyasını dinleyecek şekilde güncellenecek.
3.  **Veritabanı Göçü (Migration):**
    *   Mevcut `current_stock` verilerini kaybetmeden yeni `product_stocks` tablosuna taşıyan SQL script hazırlanacak.
4.  **POS Güncellemesi:**
    *   POS açılırken "Kasa Seçimi" ve "Oturum Açma" ekranı eklenecek.
