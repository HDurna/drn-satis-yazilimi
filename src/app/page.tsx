'use client';

import { useEffect, useState } from "react";
import MainLayout from "@/components/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Package, TrendingUp, AlertTriangle, ArrowRight, Wallet, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
    const router = useRouter();
    const [stats, setStats] = useState({
        dailySales: 0,
        totalRevenue: 0,
        lowStockCount: 0,
        totalProducts: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            const today = new Date().toISOString().split('T')[0];

            // 1. Günlük Ciro Hesabı (Bugünkü Satışların Toplam Fiyatı)
            // Not: Gerçek ciro için StockMovement tablosunda 'sale_price' da tutulmalıydı.
            // Şimdilik sadece kaç adet satıldığını çekiyoruz.
            // Daha doğru hesap için: stock_movements join products (fiyat değişebilir ama yaklaşık değer)
            // Basitlik için: Bugün girilen "SALE" hareketleri
            const { data: salesData } = await supabase
                .from('stock_movements')
                .select('quantity, product_id, products(price)')
                .eq('type', 'SALE')
                .gte('created_at', today);

            let dailyRevenue = 0;
            if (salesData) {
                salesData.forEach((sale: any) => {
                    // Supabase Type Relations trick
                    const price = sale.products?.price || 0;
                    dailyRevenue += (sale.quantity * price); // Sale quantity is usually stored as negative for deduction? 
                    // Schema check: "Giriş (+), Çıkış (-)". So sales are negative. 
                    // We should take absolute value.
                });
                // Ancak bizim UI'da satış yaparken quantity pozitif gönderiliyor mu?
                // POS sayfasında: type: 'SALE', quantity: negative number.
                // O yüzden Math.abs kullanacağız.
                dailyRevenue = salesData.reduce((acc, curr: any) => acc + (Math.abs(curr.quantity) * (curr.products?.price || 0)), 0);
            }

            // 2. Kritik Stok Sayısı
            const { count: lowStock } = await supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .lt('current_stock', 5)
                .is('deleted_at', null);

            // 3. Toplam Ürün
            const { count: totalProd } = await supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .is('deleted_at', null);


            setStats({
                dailySales: dailyRevenue,
                totalRevenue: 0, // Toplam ciro için ayrı tablo gerekir, şimdilik atla
                lowStockCount: lowStock || 0,
                totalProducts: totalProd || 0
            });
            setLoading(false);
        };

        fetchStats();
    }, []);

    return (
        <MainLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-primary">Ana Sayfa</h1>
                    <p className="text-muted-foreground">İşletmenizin genel durumu.</p>
                </div>

                {/* Özet Kartları */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Günlük Ciro */}
                    <Card className="bg-gradient-to-br from-blue-900 to-blue-800 text-white border-0 shadow-lg">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-medium text-blue-100 flex items-center gap-2">
                                <Wallet className="w-5 h-5" />
                                Günlük Tahmini Ciro
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold">
                                {stats.dailySales.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                            </div>
                            <p className="text-sm text-blue-200 mt-2">Bugünkü satışlardan hesaplandı.</p>
                        </CardContent>
                    </Card>

                    {/* Kritik Stok */}
                    <Card className={stats.lowStockCount > 0 ? "border-red-500/50 bg-red-50" : ""}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-medium text-muted-foreground flex items-center gap-2">
                                <AlertTriangle className={`w-5 h-5 ${stats.lowStockCount > 0 ? "text-red-600" : "text-gray-400"}`} />
                                Kritik Stok
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-4xl font-bold ${stats.lowStockCount > 0 ? "text-red-600" : "text-primary"}`}>
                                {stats.lowStockCount}
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">
                                {stats.lowStockCount > 0 ? "bu ürünler tükenmek üzere!" : "Her şey yolunda."}
                            </p>
                            {stats.lowStockCount > 0 && (
                                <Button variant="link" className="p-0 h-auto text-red-600" onClick={() => router.push('/inventory')}>
                                    Stokları İncele <ArrowRight className="w-4 h-4 ml-1" />
                                </Button>
                            )}
                        </CardContent>
                    </Card>

                    {/* Toplam Ürün */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-medium text-muted-foreground flex items-center gap-2">
                                <Package className="w-5 h-5" />
                                Kayıtlı Çeşit
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold text-primary">
                                {stats.totalProducts}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Hızlı Erişim */}
                <div>
                    <h2 className="text-xl font-bold text-primary mb-4">Hızlı İşlemler</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        <Button className="h-24 text-lg bg-primary hover:bg-primary/90 flex flex-col gap-2" onClick={() => router.push('/pos')}>
                            <ShoppingCart className="w-8 h-8" />
                            Satış Ekranı
                        </Button>
                        <Button variant="outline" className="h-24 text-lg flex flex-col gap-2 hover:bg-slate-50 border-primary/20" onClick={() => router.push('/inventory')}>
                            <Package className="w-8 h-8 text-primary" />
                            Stok Yönetimi
                        </Button>
                        <Button variant="outline" className="h-24 text-lg flex flex-col gap-2 hover:bg-slate-50 border-primary/20" onClick={() => router.push('/reports')}>
                            <TrendingUp className="w-8 h-8 text-green-600" />
                            Raporlar
                        </Button>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
