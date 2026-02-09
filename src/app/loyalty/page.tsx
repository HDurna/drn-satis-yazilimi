'use client';

import { useState, useEffect } from "react";
import MainLayout from "@/components/main-layout";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Trophy, Settings, Users, Save, Loader2, Coins, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function LoyaltyPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Data
    const [customers, setCustomers] = useState<any[]>([]);
    const [settings, setSettings] = useState<any>({
        money_to_point_ratio: 100, // 100 TL Harcama = 1 Puan
        point_value: 1,            // 1 Puan = 1 TL
        min_spending: 0,
        is_active: true
    });

    const fetchLoyaltyData = async () => {
        setLoading(true);
        // 1. Ayarları Çek
        const { data: setRes } = await supabase.from('loyalty_settings').select('*').single();
        if (setRes) {
            setSettings(setRes);
        } else {
            // Ayar yoksa oluştur
            await supabase.from('loyalty_settings').insert({}).select('*');
        }

        // 2. Müşterileri ve Puanları Çek
        const { data: custRes } = await supabase
            .from('customers')
            .select('id, full_name, phone, loyalty_points')
            .gt('loyalty_points', 0) // Sadece puanı olanları getir (ilk etapta)
            .order('loyalty_points', { ascending: false });

        if (custRes) setCustomers(custRes);
        setLoading(false);
    };

    useEffect(() => {
        fetchLoyaltyData();
    }, []);

    const handleSaveSettings = async () => {
        setSaving(true);
        const { error } = await supabase
            .from('loyalty_settings')
            .update({
                money_to_point_ratio: parseFloat(settings.money_to_point_ratio),
                point_value: parseFloat(settings.point_value),
                min_spending: parseFloat(settings.min_spending),
                is_active: settings.is_active
            })
            .eq('id', settings.id);

        if (error) {
            alert("Hata: " + error.message);
        } else {
            alert("Ayarlar güncellendi!");
        }
        setSaving(false);
    };

    return (
        <MainLayout>
            <div className="flex flex-col gap-6 max-w-6xl mx-auto p-4">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                            <Trophy className="w-8 h-8 text-yellow-500" /> Sadakat Programı
                        </h1>
                        <p className="text-slate-500">Müşterilerinize puan kazandırın, sadakati artırın.</p>
                    </div>
                </div>

                <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList className="bg-white border p-1 h-auto">
                        <TabsTrigger value="overview" className="px-6 py-2 text-base"><Users className="w-4 h-4 mr-2" /> Puan Durumu</TabsTrigger>
                        <TabsTrigger value="settings" className="px-6 py-2 text-base"><Settings className="w-4 h-4 mr-2" /> Program Ayarları</TabsTrigger>
                    </TabsList>

                    {/* PUAN DURUMU */}
                    <TabsContent value="overview">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Özet Kartlar */}
                            <Card className="bg-yellow-50 border-yellow-200">
                                <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-yellow-700">Toplam Dağıtılan Puan</CardTitle></CardHeader>
                                <CardContent><div className="text-3xl font-bold text-yellow-800">{customers.reduce((a, c) => a + (c.loyalty_points || 0), 0).toLocaleString()} <span className="text-sm font-normal">Puan</span></div></CardContent>
                            </Card>
                            <Card className="bg-indigo-50 border-indigo-200">
                                <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-indigo-700">Parasal Değer</CardTitle></CardHeader>
                                <CardContent><div className="text-3xl font-bold text-indigo-800">{(customers.reduce((a, c) => a + (c.loyalty_points || 0), 0) * settings.point_value).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</div></CardContent>
                            </Card>
                        </div>

                        <div className="mt-6 bg-white rounded-xl border shadow-sm">
                            <div className="p-4 border-b font-medium text-slate-700 bg-slate-50 rounded-t-xl flex justify-between items-center">
                                <span>Puanlı Müşteriler</span>
                            </div>
                            <div className="divide-y">
                                {loading && <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-slate-400" /></div>}
                                {!loading && customers.length === 0 && <div className="p-8 text-center text-slate-400">Henüz puan kazanan müşteri yok.</div>}
                                {customers.map(cust => (
                                    <div key={cust.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                        <div className="flex gap-4 items-center">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                                                {cust.full_name?.charAt(0) || '?'}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800">{cust.full_name}</div>
                                                <div className="text-xs text-slate-500">{cust.phone}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-black text-lg text-indigo-600">{cust.loyalty_points} Puan</div>
                                            <div className="text-xs text-slate-500">~{cust.loyalty_points * settings.point_value} ₺ Değerinde</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </TabsContent>

                    {/* AYARLAR */}
                    <TabsContent value="settings">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Genel Kurallar</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <Alert className="bg-blue-50 border-blue-200">
                                        <AlertCircle className="h-4 w-4 text-blue-600" />
                                        <AlertTitle className="text-blue-800">Nasıl Çalışır?</AlertTitle>
                                        <AlertDescription className="text-blue-600 text-xs mt-1">
                                            Müşterileriniz alışveriş yaptıkça puan kazanır. Kazandıkları puanları sonraki alışverişlerinde indirim olarak kullanabilirler.
                                        </AlertDescription>
                                    </Alert>

                                    <div className="flex items-center justify-between border-b pb-4">
                                        <Label className="flex flex-col gap-1">
                                            <span className="font-bold">Sadakat Programı Aktif</span>
                                            <span className="font-normal text-xs text-slate-500">Programı geçici olarak durdurabilirsiniz.</span>
                                        </Label>
                                        <Switch
                                            checked={settings.is_active}
                                            onCheckedChange={c => setSettings({ ...settings, is_active: c })}
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <Label>Puan Kazanma Oranı (Kaç TL = 1 Puan)</Label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-2.5 text-slate-400 text-sm">Her</div>
                                            <Input
                                                type="number"
                                                className="pl-12 pr-16 font-bold"
                                                value={settings.money_to_point_ratio}
                                                onChange={e => setSettings({ ...settings, money_to_point_ratio: e.target.value })}
                                            />
                                            <div className="absolute right-3 top-2.5 text-slate-500 text-sm">TL Harcama</div>
                                        </div>
                                        <p className="text-xs text-slate-500">Örn: 100 yazarsanız, müşteri 500 TL alışverişte 5 Puan kazanır.</p>
                                    </div>

                                    <div className="space-y-3">
                                        <Label>Puan Değeri (1 Puan Kaç TL Eder?)</Label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-2.5 text-slate-400 text-sm">1 Puan =</div>
                                            <Input
                                                type="number"
                                                className="pl-20 pr-10 font-bold"
                                                value={settings.point_value}
                                                onChange={e => setSettings({ ...settings, point_value: e.target.value })}
                                            />
                                            <div className="absolute right-3 top-2.5 text-slate-500 text-sm">TL</div>
                                        </div>
                                        <p className="text-xs text-slate-500">Örn: 1 yazarsanız, 5 Puanı olan müşteri 5 TL indirim kazanır.</p>
                                    </div>

                                    <div className="space-y-3">
                                        <Label>Minimum Sepet Tutarı</Label>
                                        <Input
                                            type="number"
                                            value={settings.min_spending}
                                            onChange={e => setSettings({ ...settings, min_spending: e.target.value })}
                                        />
                                        <p className="text-xs text-slate-500">Puan kazanmak için gereken minimum alışveriş tutarı.</p>
                                    </div>

                                    <Button onClick={handleSaveSettings} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700">
                                        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                        Ayarları Kaydet
                                    </Button>
                                </CardContent>
                            </Card>

                            <Card className="bg-slate-50 border-dashed">
                                <CardHeader>
                                    <CardTitle className="text-slate-600">Simülasyon</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="bg-white p-4 rounded-lg border shadow-sm space-y-2">
                                        <div className="text-sm font-medium text-slate-500">Örnek Senaryo</div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span>Müşteri Harcaması:</span>
                                            <span className="font-bold">1.000 TL</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm text-green-600 font-bold border-t pt-2 mt-2">
                                            <span>Kazanılan Puan:</span>
                                            <span>{Math.floor(1000 / (settings.money_to_point_ratio || 1))} Puan</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm text-indigo-600 font-bold">
                                            <span>Kazanılan TL Değeri:</span>
                                            <span>{(Math.floor(1000 / (settings.money_to_point_ratio || 1)) * (settings.point_value || 0)).toFixed(2)} TL</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400 text-center">
                                        Bu ayarlara göre müşteriye %{((settings.point_value / settings.money_to_point_ratio) * 100).toFixed(2)} oranında geri ödeme yapıyorsunuz.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </MainLayout>
    );
}
