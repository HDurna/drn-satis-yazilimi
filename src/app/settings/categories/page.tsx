'use client';

import { useState, useEffect } from "react";
import MainLayout from "@/components/main-layout";
import { supabase, DatabaseCategory } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Edit, Trash2, Layers, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CategoriesPage() {
    const router = useRouter();
    const [categories, setCategories] = useState<DatabaseCategory[]>([]);
    const [loading, setLoading] = useState(true);

    // Create/Edit State
    const [isOpen, setIsOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ name: "", description: "" });
    const [saveLoading, setSaveLoading] = useState(false);

    const fetchCategories = async () => {
        setLoading(true);
        const { data } = await supabase.from('categories').select('*').order('name');
        if (data) setCategories(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleOpen = (category?: DatabaseCategory) => {
        if (category) {
            setEditingId(category.id);
            setFormData({ name: category.name, description: category.description || "" });
        } else {
            setEditingId(null);
            setFormData({ name: "", description: "" });
        }
        setIsOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name) return alert("Kategori adı zorunludur.");
        setSaveLoading(true);

        const payload = {
            name: formData.name,
            description: formData.description
        };

        let error;
        if (editingId) {
            const { error: e } = await supabase.from('categories').update(payload).eq('id', editingId);
            error = e;
        } else {
            const { error: e } = await supabase.from('categories').insert(payload);
            error = e;
        }

        if (error) {
            alert("Hata: " + error.message);
        } else {
            setIsOpen(false);
            fetchCategories();
        }
        setSaveLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Bu kategoriyi silmek istediğinize emin misiniz?")) return;

        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) {
            alert("Silme hatası (Kullanılan kategori silinemez): " + error.message);
        } else {
            fetchCategories();
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
                        <h1 className="text-3xl font-bold text-primary">Kategoriler</h1>
                        <p className="text-muted-foreground">Ürünlerinizi gruplandırın.</p>
                    </div>
                    <Button onClick={() => handleOpen()} className="gap-2">
                        <Plus className="w-4 h-4" /> Yeni Kategori
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Layers className="w-5 h-5" /> Tanımlı Kategoriler
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Loader2 className="animate-spin" /> : (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {categories.map((cat) => (
                                    <div key={cat.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors">
                                        <div>
                                            <div className="font-semibold">{cat.name}</div>
                                            <div className="text-sm text-muted-foreground">{cat.description}</div>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => handleOpen(cat)}>
                                                <Edit className="w-4 h-4 text-blue-600" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id)}>
                                                <Trash2 className="w-4 h-4 text-red-600" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {categories.length === 0 && <div className="text-muted-foreground p-4">Henüz kategori eklenmemiş.</div>}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingId ? "Kategoriyi Düzenle" : "Yeni Kategori"}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="grid gap-2">
                                <Label>Kategori Adı</Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Örn: İçecekler"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Açıklama</Label>
                                <Input
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Opsiyonel"
                                />
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
