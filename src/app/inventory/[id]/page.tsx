'use client';

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import MainLayout from "@/components/main-layout";
import { supabase, DatabaseProduct, DatabaseStockMovement, DatabaseCategory, DatabaseMovementType } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Trash2, TrendingUp, History, Package, DollarSign, Save, Image as ImageIcon, ClipboardList } from "lucide-react";
import { compressImage } from "@/lib/image-utils";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function ProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id;

    const [product, setProduct] = useState<DatabaseProduct | null>(null);
    const [movements, setMovements] = useState<DatabaseStockMovement[]>([]);
    const [categories, setCategories] = useState<DatabaseCategory[]>([]);
    const [movementTypes, setMovementTypes] = useState<DatabaseMovementType[]>([]);
    const [loading, setLoading] = useState(true);
    const [countHistory, setCountHistory] = useState<any[]>([]);

    // Edit State
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editProduct, setEditProduct] = useState<Partial<DatabaseProduct>>({});
    const [editProductImage, setEditProductImage] = useState<File | null>(null);
    const [editLoading, setEditLoading] = useState(false);

    // Delete State
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Stock Entry State
    const [isStockOpen, setIsStockOpen] = useState(false);
    const [stockForm, setStockForm] = useState({ quantity: "1", cost: "", type_id: "" });
    const [selectedType, setSelectedType] = useState<DatabaseMovementType | null>(null);
    const [stockLoading, setStockLoading] = useState(false);

    const handleAddStock = async () => {
        setStockLoading(true);
        if (!product) return;

        // Parse input: boş string kontrolü yok, doğrudan parseInt/Float
        // number input html'den string döner.
        const qty = parseInt(stockForm.quantity);
        const cost = stockForm.cost ? parseFloat(stockForm.cost) : NaN;

        if (isNaN(qty) || qty <= 0) {
            alert("Geçerli bir miktar giriniz.");
            setStockLoading(false);
            return;
        }

        if (!selectedType) {
            alert("Lütfen işlem tipi seçiniz.");
            setStockLoading(false);
            return;
        }

        // Miktar Yönü (IN/OUT)
        // IN: Pozitif, OUT: Negatif
        const finalQty = selectedType.type === 'OUT' ? -Math.abs(qty) : Math.abs(qty);

        // 1. Stok Hareketi Ekle
        const { error: moveError } = await supabase.from('stock_movements').insert({
            product_id: product.id,
            user_id: (await supabase.auth.getUser()).data.user?.id,
            quantity: finalQty,
            type: selectedType.is_system ? (selectedType.type === 'IN' ? 'PURCHASE' : 'SALE') : 'OTHER', // Backward compatibility or logic
            movement_type_id: selectedType.id,
            reason: selectedType.name + ' (Manuel)'
        });

        if (moveError) {
            alert("Hata: " + moveError.message);
        } else {
            // 2. Maliyet Fiyatını Güncelle (Eğer girildiyse)
            if (!isNaN(cost) && cost >= 0) {
                await supabase.from('products').update({ cost_price: cost }).eq('id', product.id);
            }

            setIsStockOpen(false);
            setStockForm({ quantity: "1", cost: "", type_id: "" });
            setSelectedType(null);
            fetchData(); // Verileri yenile
            alert("Stok girişi başarılı!");
        }
        setStockLoading(false);
    }

    const fetchData = async () => {
        if (!id) return;
        setLoading(true);

        // 1. Ürün Bilgisi
        const { data: productData } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        setProduct(productData);

        // 2. Hareket Geçmişi (Son 10)
        if (productData) {
            const { data: movementData } = await supabase
                .from('stock_movements')
                .select('*')
                .eq('product_id', id)
                .order('created_at', { ascending: false })
                .limit(10);

            if (movementData) setMovements(movementData);
        }



        // 3. Sayım Geçmişi
        const { data: countData } = await supabase
            .from('stock_count_items')
            .select(`
                *,
                stock_counts (
                    id,
                    name,
                    status,
                    created_at,
                    completed_at
                )
            `)
            .eq('product_id', id)
            .order('created_at', { ascending: false });

        if (countData) setCountHistory(countData);

        // 4. Kategoriler ve Tipler
        const [catRes, typeRes] = await Promise.all([
            supabase.from('categories').select('*').order('name'),
            supabase.from('movement_types').select('*').order('name')
        ]);
        if (catRes.data) setCategories(catRes.data);
        if (typeRes.data) setMovementTypes(typeRes.data);

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [id]);

    const handleEditOpen = () => {
        if (product) {
            setEditProduct(product);
            setIsEditOpen(true);
        }
    }

    const handleUpdate = async () => {
        setEditLoading(true);
        let imagePath = editProduct.image_path;

        if (editProductImage) {
            try {
                const compressed = await compressImage(editProductImage);
                const fileName = `${Date.now()}-${editProductImage.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
                const { error: uploadError } = await supabase.storage
                    .from('products')
                    .upload(fileName, compressed, {
                        contentType: 'image/jpeg',
                        upsert: false
                    });

                if (uploadError) {
                    console.error("Upload Error", uploadError);
                    if (uploadError.message.includes("bucket not found")) {
                        alert("Hata: 'products' depolama alanı yok. Lütfen yönetici ile iletişime geçin.");
                    } else if (uploadError.message.includes("row-level security") || uploadError.message.includes("violates new row")) {
                        alert("YETKİ HATASI: Resim yükleme izniniz yok.\n\nÇözüm: Proje ana dizinindeki 'setup_storage_policies.sql' dosyasının içeriğini kopyalayıp Supabase SQL Editöründe çalıştırın.");
                    } else {
                        alert("Resim yüklenirken hata oluştu: " + uploadError.message);
                    }
                } else {
                    const { data: urlData } = supabase.storage
                        .from('products')
                        .getPublicUrl(fileName);
                    imagePath = urlData.publicUrl;
                }
            } catch (err) {
                console.error(err);
            }
        }

        const { error } = await supabase
            .from('products')
            .update({
                name: editProduct.name,
                image_path: imagePath,
                barcode: editProduct.barcode,
                price: editProduct.price,
                wholesale_price: (editProduct.wholesale_price === undefined || editProduct.wholesale_price === null || isNaN(editProduct.wholesale_price)) ? null : editProduct.wholesale_price,
                cost_price: editProduct.cost_price,
                category_id: editProduct.category_id,
                critical_stock: editProduct.critical_stock,
                is_active: editProduct.is_active
            })
            .eq('id', id);

        if (error) {
            alert("Güncelleme hatası: " + error.message);
        } else {
            setIsEditOpen(false);
            fetchData(); // Refresh data
        }
        setEditLoading(false);
    };

    const handleDelete = async () => {
        setDeleteLoading(true);
        const user = (await supabase.auth.getUser()).data.user;

        // Soft Delete: deleted_at alanını güncelle
        const { error } = await supabase
            .from('products')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            console.error(error);
            alert("Silme hatası: " + error.message);
        } else {
            // Audit Log Ekle
            await supabase.from('audit_logs').insert({
                user_id: user?.id,
                action: 'SOFT_DELETE',
                table_name: 'products',
                record_id: id?.toString(),
                details: `Ürün silindi: ${product?.name} (${product?.barcode})`,
                old_data: product as any
            });

            alert("Ürün arşive kaldırıldı.");
            router.push('/inventory');
        }
        setDeleteLoading(false);
    };

    if (loading) {
        return (
            <MainLayout>
                <div className="flex h-full items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            </MainLayout>
        );
    }

    if (!product) {
        return (
            <MainLayout>
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <p className="text-muted-foreground">Ürün bulunamadı.</p>
                    <Button onClick={() => router.back()}>Geri Dön</Button>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex-1 flex items-center gap-4">
                        {product.image_path ? (
                            <img src={product.image_path} alt={product.name} className="w-20 h-20 object-cover rounded-lg border shadow-sm" />
                        ) : (
                            <div className="w-20 h-20 bg-slate-100 rounded-lg flex items-center justify-center text-slate-300 border shadow-sm">
                                <ImageIcon className="w-10 h-10" />
                            </div>
                        )}
                        <div>
                            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                                {product.name}
                                {product.is_active === false && <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">PASİF (KAPALI)</span>}
                                {product.is_active !== false && product.current_stock <= 0 && <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded font-bold">STOK TÜKENDİ</span>}
                            </h1>
                            <p className="text-muted-foreground font-mono text-sm">{product.barcode}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={() => setIsStockOpen(true)}>
                            <Package className="w-4 h-4" /> Stok İşlemi
                        </Button>
                        <Button variant="outline" className="gap-2" onClick={handleEditOpen}>
                            <Edit className="w-4 h-4" /> Düzenle
                        </Button>
                        <Button variant="destructive" className="gap-2" onClick={() => setIsDeleteOpen(true)}>
                            <Trash2 className="w-4 h-4" /> Sil
                        </Button>
                    </div>
                </div>

                {/* İstatistik Kartları */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card className={product.current_stock <= product.critical_stock ? "border-red-500 bg-red-50" : ""}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Anlık Stok</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold flex items-center gap-2 ${product.current_stock <= product.critical_stock ? "text-red-600" : ""}`}>
                                <Package className="w-5 h-5" />
                                {product.current_stock}
                            </div>
                            {product.current_stock <= product.critical_stock && (
                                <span className="text-xs text-red-600 font-semibold animate-pulse">Kritik Seviye!</span>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Satış Fiyatı</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-green-600" />
                                {product.price.toFixed(2)} ₺
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Maliyet</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">
                                {product.cost_price.toFixed(2)} ₺
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">Kâr Marjı</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600">
                                % {product.cost_price > 0 ? (((product.price - product.cost_price) / product.cost_price) * 100).toFixed(0) : 100}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Hareket Geçmişi */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <History className="w-5 h-5" />
                            Stok Hareket Geçmişi
                        </CardTitle>
                        <CardDescription>Bu ürüne ait son işlemler.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="p-3">Tarih</th>
                                    <th className="p-3">İşlem</th>
                                    <th className="p-3 text-right">Miktar</th>
                                    <th className="p-3">Açıklama</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movements.map((mov) => (
                                    <tr key={mov.id} className="border-b last:border-0 hover:bg-slate-50">
                                        <td className="p-3 text-muted-foreground">
                                            {new Date(mov.created_at).toLocaleString('tr-TR')}
                                        </td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${mov.type === 'SALE' ? 'bg-green-100 text-green-800' :
                                                mov.type === 'PURCHASE' ? 'bg-blue-100 text-blue-800' :
                                                    mov.type === 'WASTAGE' ? 'bg-red-100 text-red-800' :
                                                        'bg-gray-100 text-gray-800'
                                                }`}>
                                                {mov.type === 'SALE' ? 'SATIŞ' :
                                                    mov.type === 'PURCHASE' ? 'ALIM' :
                                                        mov.type === 'WASTAGE' ? 'ZAYİ' : mov.type}
                                            </span>
                                        </td>
                                        <td className={`p-3 text-right font-bold ${mov.quantity > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                            {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                                        </td>
                                        <td className="p-3 text-muted-foreground">{mov.reason || "-"}</td>
                                    </tr>
                                ))}
                                {movements.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-4 text-center text-muted-foreground">Kayıt yok.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>

                {/* Sayım Geçmişi */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ClipboardList className="w-5 h-5" />
                            Sayım Geçmişi
                        </CardTitle>
                        <CardDescription>Bu ürünün dahil olduğu sayımlar ve sonuçları.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="p-3">Sayım Adı / Tarih</th>
                                    <th className="p-3 text-center">Durum</th>
                                    <th className="p-3 text-center">Beklenen</th>
                                    <th className="p-3 text-center">Sayılan (Sağlam)</th>
                                    <th className="p-3 text-center">Kusurlu/Zayi</th>
                                    <th className="p-3 text-center">Fark</th>
                                </tr>
                            </thead>
                            <tbody>
                                {countHistory.map((item) => {
                                    const diff = (item.counted_stock + (item.defective_quantity || 0)) - item.expected_stock;
                                    return (
                                        <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50">
                                            <td className="p-3">
                                                <div className="font-medium">{item.stock_counts?.name}</div>
                                                <div className="text-xs text-muted-foreground">{new Date(item.stock_counts?.created_at).toLocaleString('tr-TR')}</div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.stock_counts?.status === 'OPEN' ? 'bg-blue-100 text-blue-800' :
                                                    item.stock_counts?.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                                        item.stock_counts?.status === 'PENDING_APPROVAL' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {item.stock_counts?.status === 'OPEN' ? 'AÇIK' :
                                                        item.stock_counts?.status === 'PENDING_APPROVAL' ? 'ONAYDA' :
                                                            item.stock_counts?.status === 'COMPLETED' ? 'TAMAMLANDI' : 'İPTAL'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center text-muted-foreground">{item.expected_stock}</td>
                                            <td className="p-3 text-center font-bold">{item.counted_stock}</td>
                                            <td className="p-3 text-center font-bold text-orange-600">{item.defective_quantity || 0}</td>
                                            <td className={`p-3 text-center font-bold ${diff === 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {diff > 0 ? '+' : ''}{diff}
                                            </td>
                                        </tr>
                                    )
                                })}
                                {countHistory.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-4 text-center text-muted-foreground">Sayım kaydı bulunamadı.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>

                {/* Stock Entry Dialog */}
                <Dialog open={isStockOpen} onOpenChange={setIsStockOpen}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Stok Hareketi Ekle</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>İşlem Tipi</Label>
                                <select
                                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                                    onChange={(e) => {
                                        const type = movementTypes.find(t => t.id === e.target.value);
                                        setSelectedType(type || null);
                                        setStockForm({ ...stockForm, type_id: e.target.value });
                                    }}
                                >
                                    <option value="">Seçiniz</option>
                                    {movementTypes.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.name} ({t.type === 'IN' ? 'Giriş' : 'Çıkış'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid gap-2">
                                <Label>Miktar ({selectedType?.type === 'OUT' ? 'Çıkış' : 'Giriş'})</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    className={selectedType?.type === 'OUT' ? 'border-red-500 ring-red-500 focus:ring-red-500' : ''}
                                    value={stockForm.quantity}
                                    onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })}
                                />
                            </div>
                            {selectedType?.type === 'IN' && (
                                <div className="grid gap-2">
                                    <Label>Birim Maliyet (Opsiyonel - Değiştiyse)</Label>
                                    <Input
                                        type="number"
                                        placeholder={product.cost_price.toString()}
                                        value={stockForm.cost}
                                        onChange={(e) => setStockForm({ ...stockForm, cost: e.target.value })}
                                    />
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsStockOpen(false)}>İptal</Button>
                            <Button
                                onClick={handleAddStock}
                                disabled={stockLoading || !selectedType}
                                variant={selectedType?.type === 'OUT' ? 'destructive' : 'default'}
                            >
                                {stockLoading ? "İşleniyor..." : selectedType?.type === 'OUT' ? 'Stoktan Düş' : 'Stoka Ekle'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Dialog */}
                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Ürünü Düzenle</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label>Ürün Adı</Label>
                                <Input
                                    value={editProduct.name || ""}
                                    onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Barkod</Label>
                                <Input
                                    value={editProduct.barcode || ""}
                                    onChange={(e) => setEditProduct({ ...editProduct, barcode: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Satış Fiyatı</Label>
                                    <Input
                                        type="number"
                                        value={editProduct.price || 0}
                                        onChange={(e) => setEditProduct({ ...editProduct, price: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Toptan Fiyat</Label>
                                    <Input
                                        type="number"
                                        value={editProduct.wholesale_price || ""}
                                        onChange={(e) => setEditProduct({ ...editProduct, wholesale_price: parseFloat(e.target.value) })}
                                        placeholder="Opsiyonel"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Maliyet</Label>
                                    <Input
                                        type="number"
                                        value={editProduct.cost_price || 0}
                                        onChange={(e) => setEditProduct({ ...editProduct, cost_price: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label>Ürün Görseli</Label>
                                <Input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setEditProductImage(e.target.files?.[0] || null)}
                                />
                                {editProduct.image_path && (
                                    <div className="mt-2">
                                        <p className="text-xs text-muted-foreground mb-1">Mevcut Resim:</p>
                                        <img src={editProduct.image_path} alt="Mevcut" className="h-20 w-auto rounded border" />
                                    </div>
                                )}
                            </div>
                            <div className="cursor-pointer flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="edit-active"
                                    className="h-4 w-4"
                                    checked={editProduct.is_active !== false}
                                    onChange={(e) => setEditProduct({ ...editProduct, is_active: e.target.checked })}
                                />
                                <Label htmlFor="edit-active">Ürün Aktif (Satışa Açık)</Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsEditOpen(false)}>İptal</Button>
                            <Button onClick={handleUpdate} disabled={editLoading}>Kaydet</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation Dialog */}
                <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Ürünü Sil</DialogTitle></DialogHeader>
                        <p className="text-muted-foreground">
                            Bu ürünü silmek istediğinize emin misiniz? <br />
                            <span className="text-red-500 font-bold">DİKKAT:</span> Ürüne ait stok hareketleri de etkilenebilir.
                        </p>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>İptal</Button>
                            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
                                {deleteLoading ? "Siliniyor..." : "Evet, Sil"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </MainLayout>
    );
}
