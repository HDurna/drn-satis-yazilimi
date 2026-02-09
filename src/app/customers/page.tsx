'use client';

import { useState, useEffect } from "react";
import MainLayout from "@/components/main-layout";
import { supabase, DatabaseCustomer } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { User, Search, Plus, Phone, Wallet, Edit2, Trash2, Loader2, Save, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CustomersPage() {
    const [customers, setCustomers] = useState<DatabaseCustomer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Modal State
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<DatabaseCustomer | null>(null);
    const [formData, setFormData] = useState({
        full_name: "",
        phone: "",
        email: "",
        address: "",
        notes: ""
    });
    const [saving, setSaving] = useState(false);

    const fetchCustomers = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('customers')
            .select('*')
            .is('deleted_at', null)
            .order('full_name');

        if (data) setCustomers(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    const handleSave = async () => {
        if (!formData.full_name) {
            alert("Müşteri adı zorunludur.");
            return;
        }
        setSaving(true);

        if (editingCustomer) {
            // Update
            const { error } = await supabase
                .from('customers')
                .update(formData)
                .eq('id', editingCustomer.id);

            if (error) alert("Hata: " + error.message);
        } else {
            // Create
            const { error } = await supabase
                .from('customers')
                .insert({
                    ...formData,
                    balance: 0,
                    is_active: true
                });

            if (error) alert("Hata: " + error.message);
        }

        setSaving(false);
        setIsEditOpen(false);
        setEditingCustomer(null);
        setFormData({ full_name: "", phone: "", email: "", address: "", notes: "" });
        fetchCustomers();
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Bu müşteriyi silmek istediğinize emin misiniz?")) return;
        const { error } = await supabase
            .from('customers')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) alert("Hata: " + error.message);
        else fetchCustomers();
    };

    const filteredCustomers = customers.filter(c =>
        c.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phone && c.phone.includes(searchTerm))
    );

    return (
        <MainLayout>
            <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
                            <User className="w-8 h-8" /> Müşteri ve Cari Hesaplar
                        </h1>
                        <p className="text-muted-foreground">Veresiye müşterileri ve borç takibi.</p>
                    </div>
                    <Button
                        className="gap-2"
                        onClick={() => {
                            setEditingCustomer(null);
                            setFormData({ full_name: "", phone: "", email: "", address: "", notes: "" });
                            setIsEditOpen(true);
                        }}
                    >
                        <Plus className="w-4 h-4" /> Yeni Müşteri Ekle
                    </Button>
                </div>

                {/* Özet Kartları */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Toplam Müşteri</CardTitle>
                            <User className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-primary">{customers.length}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Toplam Alacak (Veresiye)</CardTitle>
                            <Wallet className="h-4 w-4 text-red-600" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">
                                {customers.reduce((acc, c) => acc + (c.balance || 0), 0).toFixed(2)} ₺
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Müşteri Ara..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-md">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b text-primary font-bold">
                                    <tr>
                                        <th className="p-4">Müşteri Adı</th>
                                        <th className="p-4">Telefon</th>
                                        <th className="p-4">Notlar</th>
                                        <th className="p-4 text-right">Bakiye</th>
                                        <th className="p-4 text-center">İşlem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="animate-spin mx-auto" /></td></tr>
                                    ) : filteredCustomers.length === 0 ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Kayıt bulunamadı.</td></tr>
                                    ) : (
                                        filteredCustomers.map(c => (
                                            <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50">
                                                <td className="p-4 font-medium">{c.full_name}</td>
                                                <td className="p-4 text-muted-foreground">{c.phone || "-"}</td>
                                                <td className="p-4 text-muted-foreground max-w-xs truncate">{c.notes}</td>
                                                <td className={cn("p-4 text-right font-bold", c.balance > 0 ? "text-red-600" : "text-green-600")}>
                                                    {c.balance.toFixed(2)} ₺
                                                </td>
                                                <td className="p-4 text-center flex justify-center gap-2">
                                                    <Button variant="ghost" size="icon" onClick={() => {
                                                        setEditingCustomer(c);
                                                        setFormData({
                                                            full_name: c.full_name,
                                                            phone: c.phone || "",
                                                            email: c.email || "",
                                                            address: c.address || "",
                                                            notes: c.notes || ""
                                                        });
                                                        setIsEditOpen(true);
                                                    }}>
                                                        <Edit2 className="w-4 h-4 text-blue-600" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => window.location.href = `/customers/${c.id}`}>
                                                        <FileText className="w-4 h-4 text-slate-600" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                                                        <Trash2 className="w-4 h-4 text-red-600" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Ekle/Düzenle Modal */}
                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingCustomer ? 'Müşteri Düzenle' : 'Yeni Müşteri Ekle'}</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Ad Soyad / Firma Adı *</Label>
                                <Input value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Telefon</Label>
                                <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="05..." />
                            </div>
                            <div className="grid gap-2">
                                <Label>E-posta</Label>
                                <Input value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} type="email" />
                            </div>
                            <div className="grid gap-2">
                                <Label>Adres</Label>
                                <Input value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Notlar</Label>
                                <Input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsEditOpen(false)}>İptal</Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Kaydet
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </MainLayout>
    );
}
