'use client';

import { useState, useEffect } from "react";
import MainLayout from "@/components/main-layout";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MODULES } from "@/lib/modules";
import { Loader2, CheckCircle, Lock, Play, AlertCircle, Key, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export default function LicensePage() {
    // Loading state is TRUE initially to prevent flickering
    const [loading, setLoading] = useState(true);
    const [moduleStates, setModuleStates] = useState<Record<string, any>>({});

    // License Key Modal
    const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
    const [licenseKey, setLicenseKey] = useState("");
    const [activating, setActivating] = useState(false);

    // Global Trial
    const [trialProcessing, setTrialProcessing] = useState(false);

    const fetchModuleStates = async () => {
        // Don't set loading true here if it's a refresh, to avoid layout shift
        // Only set it on initial mount (which is handled by default state)

        const { data } = await supabase.from('module_states').select('*');
        const states: Record<string, any> = {};

        if (data) {
            data.forEach((item) => {
                states[item.module_key] = item;
            });
        }
        setModuleStates(states);
        setLoading(false); // Data ready, show UI
    };

    useEffect(() => {
        fetchModuleStates();
    }, []);

    const handleActivateModule = async (moduleKey: string, method: 'TRIAL' | 'KEY') => {
        setActivating(true);

        const { data: { user } } = await supabase.auth.getUser();

        let updates: any = {
            module_key: moduleKey,
            is_enabled: true,
            updated_at: new Date().toISOString()
        };

        if (method === 'TRIAL') {
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(startDate.getDate() + 7); // 7 Gün

            updates = {
                ...updates,
                license_type: 'TRIAL',
                trial_start_date: startDate.toISOString(),
                expires_at: endDate.toISOString(),
                user_id: user?.id
            };
        } else {
            // Mock Key Activation
            const startDate = new Date();
            const endDate = new Date();
            endDate.setFullYear(startDate.getFullYear() + 1); // 1 Yıl

            updates = {
                ...updates,
                license_type: 'SUBSCRIPTION',
                trial_start_date: null,
                expires_at: endDate.toISOString(),
                user_id: user?.id
            };
        }

        const { error } = await supabase
            .from('module_states')
            .upsert(updates, { onConflict: 'module_key' });

        if (error) {
            alert("Hata: " + error.message);
        } else {
            // Başarılı
            await fetchModuleStates();
            if (method === 'KEY') setIsKeyModalOpen(false);
        }
        setActivating(false);
    };

    const handleActivateAllTrials = async () => {
        if (!confirm("Tüm modüller için 7 günlük deneme sürümünü başlatmak istiyor musunuz?")) return;

        setTrialProcessing(true);
        const { data: { user } } = await supabase.auth.getUser();
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + 7);

        const updates = Object.values(MODULES).map(mod => ({
            module_key: mod.id,
            is_enabled: true,
            license_type: 'TRIAL',
            trial_start_date: startDate.toISOString(),
            expires_at: endDate.toISOString(),
            user_id: user?.id,
            updated_at: new Date().toISOString()
        }));

        const { error } = await supabase.from('module_states').upsert(updates, { onConflict: 'module_key' });

        if (error) {
            alert("İşlem sırasında hata oluştu: " + error.message);
        } else {
            alert("Tüm modüller 7 gün boyunca aktif edildi! Keyifli çalışmalar.");
            fetchModuleStates();
        }
        setTrialProcessing(false);
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-slate-500">Lisans durumu kontrol ediliyor...</p>
                </div>
            </MainLayout>
        );
    }

    // Check if any module is legally active to decide if we show the "Activate All" button prominently
    const hasActiveModules = Object.values(moduleStates).some(m => m.is_enabled);

    return (
        <MainLayout>
            <div className="flex flex-col gap-8 max-w-5xl mx-auto py-8">

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">Modül ve Lisans Merkezi</h1>
                        <p className="text-slate-500 mt-1">Uygulama modüllerini buradan yönetebilir, deneme süresi başlatabilirsiniz.</p>
                    </div>
                    <Button variant="outline" onClick={() => setIsKeyModalOpen(true)}>
                        <Key className="w-4 h-4 mr-2" /> Lisans Anahtarı Gir
                    </Button>
                </div>

                {/* Toplu Aktivasyon Banner */}
                {!hasActiveModules && (
                    <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white rounded-full shadow-sm text-indigo-600">
                                <ShieldCheck className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="font-bold text-indigo-900 text-lg">DRN Satış Yazılımı'nı Tam Güçle Deneyin!</h3>
                                <p className="text-indigo-700 text-sm">Tüm modülleri (Stok, POS, Muhasebe) tek tıkla 7 gün boyunca ücretsiz deneyebilirsiniz.</p>
                            </div>
                        </div>
                        <Button
                            size="lg"
                            className="bg-indigo-600 hover:bg-indigo-700 shadow text-white whitespace-nowrap"
                            onClick={handleActivateAllTrials}
                            disabled={trialProcessing}
                        >
                            {trialProcessing && <Loader2 className="mr-2 w-4 h-4 animate-spin" />}
                            Tümünü 7 Gün Dene
                        </Button>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.values(MODULES).filter(m => m.id !== 'settings').map((module) => {
                        const state = moduleStates[module.id];
                        const isActive = state?.is_enabled;
                        const isTrial = state?.license_type === 'TRIAL';

                        // Kalan gün hesabı
                        let daysLeft = 0;
                        if (isActive && state.expires_at) {
                            const expires = new Date(state.expires_at);
                            const now = new Date();
                            const diff = expires.getTime() - now.getTime();
                            daysLeft = Math.ceil(diff / (1000 * 3600 * 24));
                        }

                        return (
                            <Card key={module.id} className={`transition-all duration-200 ${isActive ? 'border-primary/50 shadow-sm' : 'opacity-90 grayscale-[0.5] hover:grayscale-0'}`}>
                                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                                    <module.icon className={`h-8 w-8 ${isActive ? 'text-primary' : 'text-slate-400'}`} />
                                    {isActive ? (
                                        <Badge variant="default" className="bg-green-600 hover:bg-green-700">Aktif</Badge>
                                    ) : (
                                        <Badge variant="secondary">Pasif</Badge>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    <CardTitle className="mb-2">{module.name}</CardTitle>
                                    <CardDescription className="min-h-[40px]">
                                        {module.description}
                                    </CardDescription>

                                    <div className="mt-4 pt-4 border-t space-y-3">
                                        {isActive ? (
                                            <div className="text-sm">
                                                <div className="flex justify-between mb-1">
                                                    <span className="text-slate-500">Lisans Tipi:</span>
                                                    <span className="font-medium">{isTrial ? "Deneme Sürümü" : "Pro Lisans"}</span>
                                                </div>
                                                {state.expires_at && (
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-500">Kalan Süre:</span>
                                                        <span className={`font-bold ${daysLeft < 3 ? 'text-red-600' : 'text-green-600'}`}>
                                                            {daysLeft} Gün
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-2">
                                                <Button
                                                    className="w-full"
                                                    variant="outline"
                                                    onClick={() => handleActivateModule(module.id, 'TRIAL')}
                                                    disabled={activating}
                                                >
                                                    <Play className="w-4 h-4 mr-2" />
                                                    7 Gün Dene
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* Key Modal */}
                <Dialog open={isKeyModalOpen} onOpenChange={setIsKeyModalOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Lisans Anahtarı Aktivasyonu</DialogTitle>
                            <DialogDescription>
                                Satın aldığınız ürün anahtarını girerek modülleri sınırsız aktifleştirebilirsiniz.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <Input
                                placeholder="XXXX-XXXX-XXXX-XXXX"
                                value={licenseKey}
                                onChange={(e) => setLicenseKey(e.target.value)}
                                className="text-center font-mono text-lg tracking-widest uppercase"
                            />
                        </div>
                        <DialogFooter>
                            <Button onClick={() => {
                                const key = licenseKey.trim().toUpperCase();
                                // Basit bir doğrulama algoritması (DRN-YIL-XXXX)
                                // Gerçek dünyada bu sunucu tabanlı olmalı.
                                const currentYear = new Date().getFullYear();
                                const isValid = key.startsWith("DRN-") && key.length > 10;

                                if (isValid) {
                                    // Tüm modülleri "PRO" olarak aç
                                    setTrialProcessing(true);
                                    const endDate = new Date();
                                    endDate.setFullYear(endDate.getFullYear() + 1);

                                    const updates = Object.values(MODULES).map(mod => ({
                                        module_key: mod.id,
                                        is_enabled: true,
                                        license_type: 'PRO',
                                        trial_start_date: null,
                                        expires_at: endDate.toISOString(),
                                        updated_at: new Date().toISOString()
                                    }));

                                    supabase.from('module_states').upsert(updates, { onConflict: 'module_key' })
                                        .then(({ error }) => {
                                            if (error) alert("Hata: " + error.message);
                                            else {
                                                alert("Lisans başarıyla aktif edildi! Tüm modüller kullanımınıza açık.");
                                                fetchModuleStates();
                                                setIsKeyModalOpen(false);
                                            }
                                            setTrialProcessing(false);
                                        });

                                } else {
                                    alert("Geçersiz Lisans Anahtarı! Lütfen kontrol ediniz.\nÖrnek Format: DRN-2025-ABCD");
                                }
                            }}>
                                Aktifleştir
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </div>
        </MainLayout>
    );
}
