'use client';

import { useState, useEffect } from "react";
import MainLayout from "@/components/main-layout";
import { supabase, DatabaseStockCount } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClipboardList, Plus, Search, Loader2, ArrowRight, CheckCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function StockCountListPage() {
    const router = useRouter();
    const [counts, setCounts] = useState<DatabaseStockCount[]>([]);
    const [loading, setLoading] = useState(true);

    // New Count State
    const [isNewOpen, setIsNewOpen] = useState(false);
    const [newNote, setNewNote] = useState("");
    const [createLoading, setCreateLoading] = useState(false);

    const fetchCounts = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('stock_counts')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setCounts(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchCounts();
    }, []);

    const handleCreate = async () => {
        setCreateLoading(true);
        const name = `Sayım #${new Date().toLocaleDateString('tr-TR')} - ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;

        const { data, error } = await supabase.from('stock_counts').insert({
            name: name,
            status: 'OPEN',
            note: newNote
        }).select().single();

        if (error) {
            alert("Hata: " + error.message);
        } else {
            setIsNewOpen(false);
            setNewNote("");
            // Redirect to detail
            router.push(`/stock-count/${data.id}`);
        }
        setCreateLoading(false);
    };

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-primary">Sayım Modülü</h1>
                        <p className="text-muted-foreground">Geçmiş sayımlar ve yeni sayım işlemi.</p>
                    </div>
                    <Button onClick={() => setIsNewOpen(true)} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Yeni Sayım Başlat
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><ClipboardList className="w-5 h-5" /> Sayım Listesi</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Loader2 className="animate-spin" /> : (
                            <div className="rounded-md border">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 border-b">
                                        <tr>
                                            <th className="p-4">Sayım Adı</th>
                                            <th className="p-4">Tarih</th>
                                            <th className="p-4">Durum</th>
                                            <th className="p-4">Not</th>
                                            <th className="p-4 text-right">İşlem</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {counts.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-muted-foreground">Kayıt Bulunamadı.</td>
                                            </tr>
                                        ) : counts.map(count => (
                                            <tr key={count.id} className="border-b last:border-0 hover:bg-slate-50">
                                                <td className="p-4 font-medium">{count.name}</td>
                                                <td className="p-4 text-muted-foreground">{new Date(count.created_at).toLocaleString('tr-TR')}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${count.status === 'OPEN' ? 'bg-blue-100 text-blue-800' :
                                                            count.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                        }`}>
                                                        {count.status === 'OPEN' ? 'AÇIK' : count.status === 'COMPLETED' ? 'TAMAMLANDI' : 'İPTAL'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-muted-foreground max-w-xs truncate">{count.note || "-"}</td>
                                                <td className="p-4 text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => router.push(`/stock-count/${count.id}`)}>
                                                        {count.status === 'OPEN' ? 'Devam Et' : 'Detay'} <ArrowRight className="w-4 h-4 ml-1" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Dialog open={isNewOpen} onOpenChange={setIsNewOpen}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Yeni Sayım Başlat</DialogTitle></DialogHeader>
                        <div className="gap-4 py-4">
                            <Label>Not (Opsiyonel)</Label>
                            <Input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Sayım ile ilgili not..." />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsNewOpen(false)}>İptal</Button>
                            <Button onClick={handleCreate} disabled={createLoading}>
                                {createLoading ? <Loader2 className="animate-spin w-4 h-4" /> : "Başlat"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </MainLayout>
    );
}
