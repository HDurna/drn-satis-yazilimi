'use client';

import { useState, useEffect } from "react";
import MainLayout from "@/components/main-layout";
import { supabase, DatabaseWarehouse } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Warehouse, Plus, Edit2, Trash2, Loader2, Save } from "lucide-react";
import { cn } from "@/lib/utils";

export default function WarehousesPage() {
    const [warehouses, setWarehouses] = useState<DatabaseWarehouse[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        type: "STORE" as 'MAIN' | 'STORE' | 'DAMAGED',
        is_active: true
    });
    const [saving, setSaving] = useState(false);

    const fetchWarehouses = async () => {
        setLoading(true);
        const { data } = await supabase.from('warehouses').select('*').order('created_at');
        if (data) setWarehouses(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchWarehouses();
    }, []);

    const handleSave = async () => {
        if (!formData.name) return alert("Depo adı zorunludur.");

        setSaving(true);
        if (editingId) {
            // Update
            const { error } = await supabase.from('warehouses').update(formData).eq('id', editingId);
            if (error) alert(error.message);
        } else {
            // Create
            const { error } = await supabase.from('warehouses').insert(formData);
            if (error) alert(error.message);
        }

        setSaving(false);
        setIsOpen(false);
        setEditingId(null);
        setFormData({ name: "", type: "STORE", is_active: true });
        fetchWarehouses();
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Bu depoyu silmek üzeresiniz. Emin misiniz?")) return;
        const { error } = await supabase.from('warehouses').delete().eq('id', id);
        if (error) alert("Silinemedi (İlişkili veri olabilir): " + error.message);
        else fetchWarehouses();
    };

    return (
        <MainLayout>
            <div className="flex flex-col gap-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
                            <Warehouse className="w-8 h-8" /> Depo Yönetimi
                        </h1>
                        <p className="text-muted-foreground">Depoları ekleyin, düzenleyin ve yönetin.</p>
                    </div>
                    <Button onClick={() => {
                        setEditingId(null);
                        setFormData({ name: "", type: "STORE", is_active: true });
                        setIsOpen(true);
                    }}>
                        <Plus className="mr-2 w-4 h-4" /> Yeni Depo Ekle
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Kayıtlı Depolar</CardTitle>
                        <CardDescription>Sistemde tanımlı tüm depoların listesi.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Depo Adı</TableHead>
                                    <TableHead>Tip</TableHead>
                                    <TableHead>Durum</TableHead>
                                    <TableHead className="text-right">İşlemler</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={4} className="text-center"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                                ) : warehouses.map(w => (
                                    <TableRow key={w.id}>
                                        <TableCell className="font-medium cursor-pointer hover:underline text-blue-600" onClick={() => window.location.href = `/warehouses/${w.id}`}>
                                            {w.name}
                                        </TableCell>
                                        <TableCell>
                                            <span className={cn(
                                                "px-2 py-1 rounded text-xs font-bold",
                                                w.type === 'MAIN' ? 'bg-purple-100 text-purple-800' :
                                                    w.type === 'STORE' ? 'bg-green-100 text-green-800' :
                                                        'bg-red-100 text-red-800'
                                            )}>
                                                {w.type === 'MAIN' ? 'Ana Depo' : w.type === 'STORE' ? 'Mağaza' : 'Hasarlı'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {w.is_active ? <span className="text-green-600 font-bold">Aktif</span> : <span className="text-gray-400">Pasif</span>}
                                        </TableCell>
                                        <TableCell className="text-right gap-2 flex justify-end">
                                            <Button variant="ghost" size="icon" onClick={() => {
                                                setEditingId(w.id);
                                                setFormData({ name: w.name, type: w.type, is_active: w.is_active });
                                                setIsOpen(true);
                                            }}>
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-red-600" onClick={() => handleDelete(w.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingId ? 'Depoyu Düzenle' : 'Yeni Depo Oluştur'}</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Depo Adı</Label>
                                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Örn: Merkez Depo" />
                            </div>
                            <div className="grid gap-2">
                                <Label>Depo Tipi</Label>
                                <select
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                                >
                                    <option value="MAIN">Ana Depo (Merkez)</option>
                                    <option value="STORE">Mağaza (Satış Noktası)</option>
                                    <option value="DAMAGED">Hasarlı / İade Deposu</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="w_active" className="w-4 h-4" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} />
                                <Label htmlFor="w_active">Aktif</Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsOpen(false)}>İptal</Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4 mr-2" />}
                                Kaydet
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </MainLayout>
    );
}
