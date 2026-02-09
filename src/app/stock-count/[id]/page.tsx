'use client';

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import MainLayout from "@/components/main-layout";
import { supabase, DatabaseStockCount, DatabaseStockCountItem } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, CheckCircle, Save, Ban, Play, Search, AlertTriangle, Trash2, FileSpreadsheet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import * as XLSX from 'xlsx';

type CountItemWithProduct = DatabaseStockCountItem;

export default function StockCountDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id;

    const [count, setCount] = useState<DatabaseStockCount | null>(null);
    const [items, setItems] = useState<CountItemWithProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [userRole, setUserRole] = useState<string>("");

    const fetchDetails = async () => {
        if (!id) return;
        setLoading(true);

        // Fetch Count Info
        const { data: countData } = await supabase
            .from('stock_counts')
            .select('*')
            .eq('id', id)
            .single();

        if (countData) setCount(countData);

        // Fetch Items
        if (countData) {
            const { data: itemsData } = await supabase
                .from('stock_count_items')
                .select(`
                    *,
                    products (*)
                `)
                .eq('count_id', id)
                .order('created_at'); // You might want to order by product name but sorting joined tables is tricky in one go

            if (itemsData) {
                // Client side sort by name
                const sorted = (itemsData as any).sort((a: any, b: any) => a.products.name.localeCompare(b.products.name));
                setItems(sorted);
            }
        }
        // Check User Role
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
            if (profile) setUserRole(profile.role);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchDetails();
    }, [id]);

    const handleStartPopulate = async () => {
        if (!confirm("Tüm aktif ürünler sayım listesine eklenecek. Onaylıyor musunuz?")) return;
        setProcessing(true);

        // 1. Fetch active products
        const { data: products } = await supabase
            .from('products')
            .select('*')
            .is('deleted_at', null); // Include inactive products too

        if (!products || products.length === 0) {
            alert("Ürün bulunamadı.");
            setProcessing(false);
            return;
        }

        // 2. Prepare Items
        const countItems = products.map(p => ({
            count_id: id,
            product_id: p.id,
            expected_stock: p.current_stock,
            counted_stock: 0 // Default to 0 or maybe expected_stock? Valid choice is 0 to force count.
        }));

        // 3. Batch Insert
        const { error } = await supabase.from('stock_count_items').insert(countItems);

        if (error) {
            alert("Hata: " + error.message);
        } else {
            fetchDetails();
        }
        setProcessing(false);
    };

    const handleUpdateCount = async (itemId: string, val: string, field: 'counted_stock' | 'defective_quantity' = 'counted_stock') => {
        let num = parseInt(val);
        if (val === "" || isNaN(num)) num = 0;

        // Update local state
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, [field]: num } : i));

        // Update DB
        await supabase
            .from('stock_count_items')
            .update({ [field]: num })
            .eq('id', itemId);
    };

    const handleSendToApproval = async () => {
        if (!confirm("Sayım yönetici onayına gönderilecek. Devam etmek istiyor musunuz?")) return;
        setProcessing(true);
        const { error } = await supabase.from('stock_counts').update({ status: 'PENDING_APPROVAL' }).eq('id', id);
        if (error) alert(error.message);
        else fetchDetails();
        setProcessing(false);
    }

    const handleApprove = async () => {
        if (!confirm("Sayım ONAYLANACAK ve stok farkları sisteme işlenecek. Bu işlem geri alınamaz!")) return;
        setProcessing(true);

        const diffItems = items.filter(i => i.counted_stock !== i.expected_stock);
        let errorCount = 0;

        for (const item of diffItems) {
            const diff = item.counted_stock - item.expected_stock;
            // 1. Create Stock Movement (Trigger updates stock)
            const { error: moveError } = await supabase.from('stock_movements').insert({
                product_id: item.product_id,
                user_id: (await supabase.auth.getUser()).data.user?.id,
                quantity: diff,
                type: 'OTHER',
                reason: `Sayım Farkı (Onaylı): ${count?.name}`,
                movement_type_id: null
            });

            if (moveError) {
                console.error("Move Error", moveError);
                errorCount++;
            }
        }

        if (errorCount > 0) alert(`${errorCount} ürün güncellenirken hata oluştu.`);

        // Close Count
        await supabase
            .from('stock_counts')
            .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
            .eq('id', id);

        fetchDetails();
        alert("Sayım başarıyla onaylandı ve stoklar güncellendi.");
        setProcessing(false);
    };


    const handleCancel = async () => {
        if (!confirm("Sayım iptal edilecek. Emin misiniz?")) return;
        setProcessing(true);

        const { error } = await supabase
            .from('stock_counts')
            .update({ status: 'CANCELLED' })
            .eq('id', id);

        if (error) {
            alert("Hata: " + error.message);
        } else {
            alert("Sayım iptal edildi.");
            fetchDetails();
        }
        setProcessing(false);
    };

    const handleDelete = async () => {
        if (!confirm("BU SAYIM KAYDI VE İÇERİĞİ TAMAMEN SİLİNECEK! Bu işlem geri alınamaz. Emin misiniz?")) return;
        setProcessing(true);

        const { error } = await supabase.from('stock_counts').delete().eq('id', id);

        if (error) {
            alert("Hata: " + error.message);
        } else {
            alert("Sayım başarıyla silindi.");
            router.push('/stock-count');
        }
        setProcessing(false);
    };

    const filteredItems = items.filter(i =>
        i.products?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.products?.barcode.includes(searchTerm)
    );

    if (loading) return <MainLayout><div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div></MainLayout>;
    if (!count) return <MainLayout><div className="p-10">Sayım bulunamadı.</div></MainLayout>;

    // APPROVAL LOGIC
    // Admins can edit if OPEN or PENDING_APPROVAL.
    // Staff can only edit if OPEN.
    const canEdit = count.status === 'OPEN' || ((count.status === 'PENDING_APPROVAL') && (userRole === 'admin' || userRole === 'store_manager'));

    // Read only if you cannot edit
    const isReadOnly = !canEdit;
    const isCancelled = count.status === 'CANCELLED';

    const getBadgeLabel = (status: string) => {
        switch (status) {
            case 'OPEN': return 'AÇIK - SAYIM SÜRÜYOR';
            case 'PENDING_APPROVAL': return 'ONAY BEKLİYOR';
            case 'COMPLETED': return 'TAMAMLANDI';
            case 'CANCELLED': return 'İPTAL EDİLDİ';
            default: return status;
        }
    };

    const getBadgeVariant = (status: string) => {
        switch (status) {
            case 'OPEN': return 'default';
            case 'PENDING_APPROVAL': return 'outline';
            case 'COMPLETED': return 'secondary';
            case 'CANCELLED': return 'destructive';
            default: return 'outline';
        }
    };

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/stock-count')}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-primary">{count.name}</h1>
                        <div className="flex items-center gap-2">
                            <Badge variant={getBadgeVariant(count.status)}>{getBadgeLabel(count.status)}</Badge>
                            <span className="text-sm text-muted-foreground">{new Date(count.created_at).toLocaleDateString('tr-TR')}</span>
                        </div>
                    </div>
                    {/* Toolbar Actions */}
                    <div className="flex gap-2">
                        {/* Excel Export is always useful */}
                        {items.length > 0 && (
                            <Button variant="outline" className="gap-2" onClick={() => {
                                const ws = XLSX.utils.json_to_sheet(items.map(i => ({
                                    "Barkod": i.products?.barcode,
                                    "Ürün Adı": i.products?.name,
                                    "Beklenen": i.expected_stock,
                                    "Sayım (Sağlam)": i.counted_stock,
                                    "Kusurlu/Defolu": i.defective_quantity || 0,
                                    "Fark": (i.counted_stock + (i.defective_quantity || 0)) - i.expected_stock
                                })));
                                const wb = XLSX.utils.book_new();
                                XLSX.utils.book_append_sheet(wb, ws, "Sayim_Listesi");
                                XLSX.writeFile(wb, `Sayim_Listesi_${new Date().toISOString().slice(0, 10)}.xlsx`);
                            }}>
                                <FileSpreadsheet className="w-4 h-4" /> Excel İndir
                            </Button>
                        )}


                        {/* Actions for OPEN state */}
                        {count.status === 'OPEN' && items.length > 0 && (
                            <>
                                {(userRole === 'admin' || userRole === 'store_manager') && (
                                    <Button variant="secondary" className="bg-red-100 text-red-800 hover:bg-red-200" onClick={handleCancel} disabled={processing}>
                                        <Ban className="w-4 h-4 mr-2" />
                                        İptal Et
                                    </Button>
                                )}

                                <Button variant="default" onClick={handleSendToApproval} disabled={processing} className="bg-blue-600 hover:bg-blue-700">
                                    {processing ? <Loader2 className="animate-spin w-4 h-4" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                                    Onaya Gönder
                                </Button>
                            </>
                        )}

                        {/* Actions for PENDING_APPROVAL state (Admin Only) */}
                        {count.status === 'PENDING_APPROVAL' && (userRole === 'admin' || userRole === 'store_manager') && (
                            <>
                                <Button variant="secondary" className="bg-red-100 text-red-800 hover:bg-red-200" onClick={handleCancel} disabled={processing}>
                                    <Ban className="w-4 h-4 mr-2" />
                                    Reddet / İptal Et
                                </Button>

                                <Button variant="destructive" onClick={handleApprove} disabled={processing} className="bg-green-600 hover:bg-green-700">
                                    {processing ? <Loader2 className="animate-spin w-4 h-4" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                                    Onayla ve Stokları İşle
                                </Button>
                            </>
                        )}
                        {/* Actions for CANCELLED state (Delete) */}

                        {/* Actions for CANCELLED state (Delete) */}
                        {isCancelled && (userRole === 'admin' || userRole === 'store_manager') && (
                            <Button variant="destructive" className="gap-2" onClick={handleDelete} disabled={processing}>
                                <Trash2 className="w-4 h-4" /> Sil
                            </Button>
                        )}
                    </div>
                </div>

                {/* Content */}
                {items.length === 0 && count.status === 'OPEN' ? (
                    <Card className="flex flex-col items-center justify-center p-10 gap-4">
                        <div className="bg-blue-100 p-4 rounded-full"><Play className="w-8 h-8 text-blue-600" /></div>
                        <h2 className="text-xl font-bold">Henüz ürün eklenmemiş</h2>
                        <p className="text-muted-foreground text-center">
                            Sayımı başlatmak için mevcut aktif ürünlerin listesini çekin.<br />
                            Bu işlem o anki stokları "Beklenen" olarak kaydedecektir.
                        </p>
                        <Button size="lg" onClick={handleStartPopulate} disabled={processing}>
                            {processing ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                            Ürünleri Getir ve Başlat
                        </Button>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 bg-white p-2 rounded shadow-sm border">
                            <Search className="w-5 h-5 text-muted-foreground ml-2" />
                            <Input
                                placeholder="Ürün Ara..."
                                className="border-0 shadow-none focus-visible:ring-0"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <Card>
                            <CardContent className="p-0">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 border-b font-bold">
                                        <tr>
                                            <th className="p-4">Ürün</th>
                                            {(userRole === 'admin' || userRole === 'store_manager' || isReadOnly) && <th className="p-4 text-center">Beklenen</th>}
                                            <th className="p-4 text-center">Sayılan (Sağlam)</th>
                                            <th className="p-4 text-center bg-orange-50 text-orange-700">Kusurlu / Zayi</th>
                                            {(userRole === 'admin' || userRole === 'store_manager' || isReadOnly) && <th className="p-4 text-center">Fark</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredItems.map(item => {
                                            const totalFound = (item.counted_stock || 0) + (item.defective_quantity || 0);
                                            const diff = totalFound - item.expected_stock;
                                            const showExpected = userRole === 'admin' || userRole === 'store_manager' || isReadOnly;

                                            // Highlight only if user can see expected, OR if it's read only (completed)
                                            const rowClass = (showExpected && diff !== 0) ? 'bg-red-50' : '';

                                            return (
                                                <tr key={item.id} className={`border-b last:border-0 ${rowClass}`}>
                                                    <td className="p-4">
                                                        <div className="font-medium">{item.products?.name}</div>
                                                        <div className="text-xs text-muted-foreground font-mono">{item.products?.barcode}</div>
                                                    </td>
                                                    {showExpected && (
                                                        <td className="p-4 text-center text-muted-foreground">
                                                            {item.expected_stock}
                                                        </td>
                                                    )}
                                                    <td className="p-4 text-center w-32">
                                                        {isReadOnly ? (
                                                            <span className="font-bold">{item.counted_stock}</span>
                                                        ) : (
                                                            <Input
                                                                type="number"
                                                                className={`text-center font-bold ${showExpected && diff !== 0 ? 'border-orange-400 bg-orange-50' : ''}`}
                                                                value={item.counted_stock}
                                                                onChange={(e) => handleUpdateCount(item.id, e.target.value, 'counted_stock')}
                                                                onFocus={(e) => e.target.select()}
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-center w-32 bg-orange-50/50">
                                                        {isReadOnly ? (
                                                            <span className="font-bold text-orange-700">{item.defective_quantity || 0}</span>
                                                        ) : (
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                className="text-center font-bold text-orange-700 border-orange-200 focus:ring-orange-500 bg-orange-50"
                                                                value={item.defective_quantity || 0}
                                                                onChange={(e) => handleUpdateCount(item.id, e.target.value, 'defective_quantity')}
                                                                onFocus={(e) => e.target.select()}
                                                            />
                                                        )}
                                                    </td>
                                                    {showExpected && (
                                                        <td className="p-4 text-center">
                                                            <div className={`flex items-center justify-center gap-1 font-bold ${diff === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                {diff > 0 ? "+" : ""}{diff}
                                                                {diff !== 0 && <AlertTriangle className="w-4 h-4" />}
                                                                {diff === 0 && <CheckCircle className="w-4 h-4 ml-1" />}
                                                            </div>
                                                            {/* Show breakdown if there are defective items */}
                                                            {(item.defective_quantity || 0) > 0 && (
                                                                <div className="text-[10px] text-muted-foreground mt-1 whitespace-nowrap">
                                                                    (Topla: {totalFound})
                                                                </div>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                        {filteredItems.length === 0 && (
                                            <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Ürün bulunamadı.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </MainLayout >
    );
}
