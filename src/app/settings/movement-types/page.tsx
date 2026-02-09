'use client';

import { useState, useEffect } from "react";
import MainLayout from "@/components/main-layout";
import { supabase, DatabaseMovementType } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Tag, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";

export default function MovementTypesPage() {
    const router = useRouter();
    const [types, setTypes] = useState<DatabaseMovementType[]>([]);
    const [loading, setLoading] = useState(true);

    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState({ name: "", type: "OUT" });
    const [saveLoading, setSaveLoading] = useState(false);

    const fetchTypes = async () => {
        setLoading(true);
        const { data } = await supabase.from('movement_types').select('*').order('created_at');
        if (data) setTypes(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchTypes();
    }, []);

    const handleSave = async () => {
        if (!formData.name) return alert("İsim zorunludur.");
        setSaveLoading(true);

        const { error } = await supabase.from('movement_types').insert({
            name: formData.name,
            type: formData.type,
            is_system: false
        });

        if (error) {
            alert("Hata: " + error.message);
        } else {
            setIsOpen(false);
            setFormData({ name: "", type: "OUT" });
            fetchTypes();
        }
        setSaveLoading(false);
    };

    const handleDelete = async (id: string, isSystem: boolean) => {
        if (isSystem) return alert("Sistem kayıtları silinemez.");
        if (!confirm("Bu hareket tipini silmek istediğinize emin misiniz?")) return;

        const { error } = await supabase.from('movement_types').delete().eq('id', id);
        if (error) {
            alert("Silme hatası (Kullanımda olabilir): " + error.message);
        } else {
            fetchTypes();
        }
    };

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold text-primary">Hareket Tipleri</h1>
                        <p className="text-muted-foreground">Stok giriş/çıkış işlem türlerini yönetin.</p>
                    </div>
                    <Button onClick={() => setIsOpen(true)} className="gap-2">
                        <Plus className="w-4 h-4" /> Yeni Tip Ekle
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Tag className="w-5 h-5" /> Tanımlı Tipler
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Loader2 className="animate-spin" /> : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {types.map((item) => (
                                    <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                                        <div>
                                            <div className="font-semibold flex items-center gap-2">
                                                {item.name}
                                                {item.is_system && <Lock className="w-3 h-3 text-muted-foreground" title="Sistem Kaydı" />}
                                            </div>
                                            <div className="text-sm text-muted-foreground">
                                                YÖN: <span className={item.type === 'IN' ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                                                    {item.type === 'IN' ? 'GİRİŞ (Stok Artar)' : 'ÇIKIŞ (Stok Azalır)'}
                                                </span>
                                            </div>
                                        </div>
                                        {!item.is_system && (
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id, item.is_system)}>
                                                <Trash2 className="w-4 h-4 text-red-600" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Yeni Hareket Tipi</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="grid gap-2">
                                <Label>Tip Adı</Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Örn: Promosyon, Zayi, Numune"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Yön</Label>
                                <Select onValueChange={(val) => setFormData({ ...formData, type: val })} defaultValue="OUT">
                                    <SelectTrigger>
                                        <SelectValue placeholder="Yön Seçin" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="IN">GİRİŞ (Stok Artar)</SelectItem>
                                        <SelectItem value="OUT">ÇIKIŞ (Stok Azalır)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
                            <Button onClick={handleSave} disabled={saveLoading}>
                                {saveLoading ? "Kaydediliyor..." : "Kaydet"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </MainLayout>
    );
}
