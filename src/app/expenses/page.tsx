'use client';

import { useState, useEffect } from "react";
import MainLayout from "@/components/main-layout";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Wallet, Tag, Trash2, Settings2 } from "lucide-react";

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState(0);

    // Modallar
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isCatOpen, setIsCatOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // Formlar
    const [formData, setFormData] = useState({
        category: "",
        amount: "",
        description: "",
    });
    const [newCategory, setNewCategory] = useState("");

    const fetchData = async () => {
        setLoading(true);
        // Giderler
        const { data: expData } = await supabase
            .from('expenses')
            .select('*')
            .order('created_at', { ascending: false });

        if (expData) {
            setExpenses(expData);
            const total = expData.reduce((acc, curr) => acc + curr.amount, 0);
            setSummary(total);
        }

        // Kategoriler
        const { data: catData } = await supabase
            .from('expense_categories')
            .select('*')
            .order('name');

        if (catData) setCategories(catData);

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSaveExpense = async () => {
        if (!formData.amount || !formData.description || !formData.category) {
            alert("Lütfen tüm alanları doldurunuz.");
            return;
        }

        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();

        const { error } = await supabase.from('expenses').insert({
            user_id: user?.id,
            category: formData.category,
            amount: parseFloat(formData.amount),
            description: formData.description,
            created_at: new Date().toISOString()
        });

        if (error) {
            alert("Hata: " + error.message);
        } else {
            setIsAddOpen(false);
            setFormData({ category: "", amount: "", description: "" });
            fetchData();
        }
        setSaving(false);
    };

    const handleAddCategory = async () => {
        if (!newCategory) return;
        setSaving(true);
        const { error } = await supabase.from('expense_categories').insert({ name: newCategory });

        if (error) {
            alert("Kategori eklenemedi: " + error.message);
        } else {
            setNewCategory("");
            fetchData(); // Listeyi yenile
        }
        setSaving(false);
    };

    const handleDeleteCategory = async (id: string) => {
        if (!confirm("Kategoriyi silmek istediğinize emin misiniz?")) return;
        const { error } = await supabase.from('expense_categories').delete().eq('id', id);
        if (!error) fetchData();
    };

    return (
        <MainLayout>
            <div className="flex flex-col gap-6 max-w-6xl mx-auto p-4">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
                            <Wallet className="w-8 h-8 text-red-600" /> Gider Yönetimi
                        </h1>
                        <p className="text-slate-500">İşletme harcamalarını takip edin ve yönetin.</p>
                    </div>
                </div>

                {/* Özet ve Butonlar */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-red-50 border-red-100 md:col-span-2">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-red-600">Toplam Gider</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold text-red-700">{summary.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</div>
                        </CardContent>
                    </Card>

                    <div className="flex flex-col gap-2 justify-center">
                        <Button onClick={() => setIsAddOpen(true)} className="bg-red-600 hover:bg-red-700 h-12 text-lg">
                            <Plus className="w-5 h-5 mr-2" /> Harcama Ekle
                        </Button>
                        <Button variant="outline" onClick={() => setIsCatOpen(true)} className="h-12 text-lg border-slate-300">
                            <Settings2 className="w-5 h-5 mr-2 text-slate-600" /> Kategorileri Yönet
                        </Button>
                    </div>
                </div>

                {/* Liste */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Harcama Geçmişi</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                                    <tr>
                                        <th className="p-4">Tarih</th>
                                        <th className="p-4">Kategori</th>
                                        <th className="p-4">Açıklama</th>
                                        <th className="p-4 text-right">Tutar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={4} className="p-8 text-center"><Loader2 className="animate-spin mx-auto" /></td></tr>
                                    ) : expenses.length === 0 ? (
                                        <tr><td colSpan={4} className="p-8 text-center text-slate-400">Henüz harcama kaydı yok.</td></tr>
                                    ) : (
                                        expenses.map(ex => (
                                            <tr key={ex.id} className="border-b last:border-0 hover:bg-slate-50">
                                                <td className="p-4">{new Date(ex.created_at).toLocaleDateString()}</td>
                                                <td className="p-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-medium text-slate-600">{ex.category}</span></td>
                                                <td className="p-4 font-medium">{ex.description}</td>
                                                <td className="p-4 text-right font-bold text-red-600">-{ex.amount.toFixed(2)} ₺</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Harcama Ekleme Modalı */}
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Yeni Harcama Ekle</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Kategori</Label>
                                <Select
                                    value={formData.category}
                                    onValueChange={(val) => setFormData({ ...formData, category: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Kategori Seç" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Tutar (₺)</Label>
                                <Input
                                    type="number"
                                    value={formData.amount}
                                    onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Açıklama</Label>
                                <Input
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Örn: Yemek ücreti"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddOpen(false)}>İptal</Button>
                            <Button onClick={handleSaveExpense} disabled={saving} className="bg-red-600 hover:bg-red-700">
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Kaydet
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Kategori Yönetim Modalı */}
                <Dialog open={isCatOpen} onOpenChange={setIsCatOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Kategori Yönetimi</DialogTitle>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Yeni Kategori Adı"
                                    value={newCategory}
                                    onChange={e => setNewCategory(e.target.value)}
                                />
                                <Button onClick={handleAddCategory} disabled={saving || !newCategory}>
                                    <Plus className="w-4 h-4" /> Ekle
                                </Button>
                            </div>

                            <div className="border rounded-md max-h-60 overflow-y-auto">
                                {categories.map(c => (
                                    <div key={c.id} className="flex justify-between items-center p-2 border-b last:border-0 hover:bg-slate-50">
                                        <span className="text-sm">{c.name}</span>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(c.id)} className="h-6 w-6 text-red-500">
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsCatOpen(false)}>Kapat</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </MainLayout>
    );
}
