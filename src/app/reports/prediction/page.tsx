'use client';

import { useState, useEffect } from "react";
import MainLayout from "@/components/main-layout";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingDown, AlertTriangle, Loader2 } from "lucide-react";

type PredictionItem = {
    id: number;
    name: string;
    barcode: string;
    current_stock: number;
    avg_daily_sales: number;
    days_left: number;
    suggestion: string;
};

export default function PredictionPage() {
    const [predictions, setPredictions] = useState<PredictionItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const analyzeStock = async () => {
            setLoading(true);

            // 1. Fetch Products
            const { data: products } = await supabase
                .from('products')
                .select('id, name, barcode, current_stock, critical_stock')
                .is('deleted_at', null)
                .gt('current_stock', 0); // Only analyze items in stock

            if (!products) {
                setLoading(false);
                return;
            }

            // 2. Fetch Sales History (Last 30 Days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: movements } = await supabase
                .from('stock_movements')
                .select('product_id, quantity, type, created_at')
                .eq('type', 'SALE')
                .gte('created_at', thirtyDaysAgo.toISOString());

            // 3. Calculate Velocity
            const salesMap = new Map<number, number>();
            if (movements) {
                movements.forEach(m => {
                    const qty = Math.abs(m.quantity);
                    salesMap.set(m.product_id, (salesMap.get(m.product_id) || 0) + qty);
                });
            }

            // 4. Generate Predictions
            const result: PredictionItem[] = products.map(p => {
                const totalSold = salesMap.get(p.id) || 0;
                const avgDaily = totalSold / 30;

                let daysLeft = 999;
                if (avgDaily > 0) {
                    daysLeft = Math.round(p.current_stock / avgDaily);
                }

                let suggestion = "Stok yeterli";
                if (daysLeft < 3) suggestion = "ACİL SİPARİŞ VER!";
                else if (daysLeft < 7) suggestion = "Bu hafta sipariş ver";
                else if (daysLeft < 15) suggestion = "İzlemeye al";

                return {
                    id: p.id,
                    name: p.name,
                    barcode: p.barcode,
                    current_stock: p.current_stock,
                    avg_daily_sales: avgDaily,
                    days_left: daysLeft,
                    suggestion
                };
            }).filter(item => item.days_left < 30) // Only show items running out in a month
                .sort((a, b) => a.days_left - b.days_left);

            setPredictions(result);
            setLoading(false);
        };
        analyzeStock();
    }, []);

    return (
        <MainLayout>
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <TrendingDown className="w-8 h-8" /> Akıllı Stok Tahmini
                    </h1>
                    <p className="text-muted-foreground">Satış hızına göre stok tükenme tahminleri (Yapay Zeka Destekli).</p>
                </div>

                <div className="grid gap-6">
                    {loading ? (
                        <div className="flex justify-center p-20"><Loader2 className="animate-spin w-10 h-10 text-primary" /></div>
                    ) : predictions.length === 0 ? (
                        <Card>
                            <CardContent className="p-10 text-center text-muted-foreground">
                                <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>Şimdilik kritik bir durum görünmüyor. Satış verileri biriktikçe burası güncellenecektir.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        predictions.map(item => (
                            <Card key={item.id} className={`border-l-4 ${item.days_left < 3 ? 'border-l-red-600 bg-red-50' : item.days_left < 7 ? 'border-l-orange-500' : 'border-l-yellow-400'}`}>
                                <CardContent className="p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg">{item.name}</h3>
                                        <p className="text-sm text-muted-foreground font-mono">{item.barcode}</p>
                                    </div>
                                    <div className="flex items-center gap-8 text-sm">
                                        <div className="text-center">
                                            <div className="font-medium text-muted-foreground">Mevcut Stok</div>
                                            <div className="text-xl font-bold">{item.current_stock}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="font-medium text-muted-foreground">Günlük Satış</div>
                                            <div className="text-xl font-bold">{item.avg_daily_sales.toFixed(1)}</div>
                                        </div>
                                        <div className="text-center min-w-[100px]">
                                            <div className="font-medium text-muted-foreground">Kalan Gün</div>
                                            <div className={`text-2xl font-black ${item.days_left < 3 ? 'text-red-600' : 'text-orange-600'}`}>
                                                {item.days_left < 1 ? "< 1 Gün" : `${item.days_left} Gün`}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white px-4 py-2 rounded border shadow-sm font-bold text-primary min-w-[150px] text-center">
                                        {item.suggestion}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
