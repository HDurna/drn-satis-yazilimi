
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    ClipboardList,
    BarChart3,
    Building2,
    Users,
    Settings,
    ShieldCheck,
    Wallet,
    Tag,
    Gift
} from "lucide-react";

export interface AppModule {
    id: string;
    name: string;
    description: string;
    isEnabled: boolean;
    path?: string; // Ana rota
    icon?: any;
    roleAccess?: ('admin' | 'store_manager' | 'cashier')[]; // Hangi roller görebilir
    subItems?: {
        id?: string;
        name: string;
        path: string;
    }[];
}

// MODÜL KONFİGÜRASYONU
// Buradan modülleri açıp kapatabilirsiniz.
export const MODULES: Record<string, AppModule> = {
    dashboard: {
        id: 'dashboard',
        name: 'Ana Sayfa',
        description: 'Genel Bakış',
        isEnabled: true,
        path: '/',
        icon: LayoutDashboard,
        roleAccess: ['admin', 'store_manager', 'cashier']
    },
    pos: {
        id: 'pos',
        name: 'POS Terminali',
        description: 'Satış Ekranı',
        isEnabled: true,
        path: '/pos',
        icon: ShoppingCart,
        roleAccess: ['admin', 'store_manager', 'cashier']
    },
    customers: {
        id: 'customers',
        name: 'Veresiye & Cari',
        description: 'Müşteri Yönetimi',
        isEnabled: true, // Şimdilik açık
        path: '/customers',
        icon: Users,
        roleAccess: ['admin', 'store_manager']
    },
    inventory: {
        id: 'inventory',
        name: 'Stok Yönetimi',
        description: 'Ürün ve Kategori Yönetimi',
        isEnabled: true,
        path: '/inventory',
        icon: Package,
        roleAccess: ['admin', 'store_manager']
    },
    stockCount: {
        id: 'stockCount',
        name: 'Sayım Modülü',
        description: 'Stok Sayım ve Düzeltme',
        isEnabled: true,
        path: '/stock-count',
        icon: ClipboardList,
        roleAccess: ['admin', 'store_manager', 'cashier']
    },
    reports: {
        id: 'reports',
        name: 'Raporlar',
        description: 'Satış ve Stok Analizleri',
        isEnabled: true,
        path: '/reports',
        icon: BarChart3,
        roleAccess: ['admin', 'store_manager']
    },
    // --- YENİ EKLENECEK MODÜLLER (İSKELET) ---
    multiBranch: {
        id: 'multiBranch',
        name: 'Şube & Depo',
        description: 'Çoklu Şube Yönetimi',
        isEnabled: false, // Henüz aktif değil
        path: '/warehouses',
        icon: Building2,
        roleAccess: ['admin'],
        subItems: [
            { name: 'Şube Listesi', path: '/warehouses' },
            { name: 'Transferler', path: '/transfer' }
        ]
    },
    expenses: {
        id: 'expenses',
        name: 'Gider Yönetimi',
        description: 'Masraf ve Personel Giderleri',
        isEnabled: true,
        path: '/expenses',
        icon: Wallet,
        roleAccess: ['admin', 'store_manager']
    },
    loyalty: {
        id: 'loyalty',
        name: 'Sadakat Programı',
        description: 'Puan ve Müşteri Sadakati',
        isEnabled: true,
        path: '/loyalty',
        icon: Gift,
        roleAccess: ['admin', 'store_manager']
    },
    labelPrinting: {
        id: 'labelPrinting',
        name: 'Etiket Basımı',
        description: 'Raf ve Barkod Etiketleri',
        isEnabled: true,
        path: '/labels',
        icon: Tag,
        roleAccess: ['admin', 'store_manager']
    },
    users: {
        id: 'users',
        name: 'Kullanıcılar',
        description: 'Personel Yönetimi',
        isEnabled: true,
        path: '/users',
        icon: Users,
        roleAccess: ['admin']
    },
    settings: {
        id: 'settings',
        name: 'Ayarlar',
        description: 'Uygulama Ayarları',
        isEnabled: true,
        path: '/settings',
        icon: Settings,
        roleAccess: ['admin', 'store_manager'],
        subItems: [
            { id: 'general', name: 'Genel Ayarlar', path: '/settings' },
            { id: 'license', name: 'Modül Mağazası', path: '/settings/license' }
        ]
    },
};

export const isModuleEnabled = (moduleId: string) => {
    return MODULES[moduleId]?.isEnabled ?? false;
};
