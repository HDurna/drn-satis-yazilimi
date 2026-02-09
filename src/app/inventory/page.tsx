'use client';

import { useState, useEffect } from "react";
import MainLayout from "@/components/main-layout";
import { supabase, DatabaseProduct } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Archive, Search, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';
import { Upload, Download, Image as ImageIcon } from "lucide-react";
import { compressImage } from "@/lib/image-utils";

export default function InventoryPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [products, setProducts] = useState<DatabaseProduct[]>([]);
    const [categories, setCategories] = useState<{ id: string, name: string }[]>([]); // Categories State
    const [loading, setLoading] = useState(true);

    // Yeni Ürün State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newProduct, setNewProduct] = useState({
        name: "",
        barcode: "",
        price: "",
        cost_price: "",
        category_id: "null", // "null" string for select placeholder
        critical_stock: "5",
        is_active: true
    });
    const [addLoading, setAddLoading] = useState(false);

    // Excel Import State
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [importLoading, setImportLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<File | null>(null);

    const fetchInventory = async () => {
        setLoading(true);
        // Parallel fetch
        const [prodRes, catRes] = await Promise.all([
            supabase.from('products').select('*').is('deleted_at', null).order('name'),
            supabase.from('categories').select('id, name').order('name')
        ]);

        if (prodRes.data) setProducts(prodRes.data);
        if (catRes.data) setCategories(catRes.data);
        setLoading(false);
    };

    useEffect(() => {
        fetchInventory();
    }, []);

    const handleDownloadTemplate = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet([
            { "Ürün Adı": "Örnek Ürün", "Barkod": "123456789", "Kategori": "İçecekler", "Satış Fiyatı": 100, "Maliyet": 80, "Kritik Stok": 5 },
            { "Ürün Adı": "Domates", "Barkod": "", "Kategori": "Sebze", "Satış Fiyatı": 25.50, "Maliyet": 15, "Kritik Stok": 10 }
        ]);
        XLSX.utils.book_append_sheet(wb, ws, "Şablon");
        XLSX.writeFile(wb, "Urun_Yukleme_Sablonu.xlsx");
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImportLoading(true);
        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                let successCount = 0;
                let errorCount = 0;

                for (const row of (data as any[])) {
                    const name = row["Ürün Adı"];
                    const barcode = row["Barkod"] ? row["Barkod"].toString() : `GEN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                    const price = parseFloat(row["Satış Fiyatı"]);
                    const cost = parseFloat(row["Maliyet"]);
                    const critical = parseInt(row["Kritik Stok"]) || 5;

                    const categoryName = row["Kategori"];
                    let categoryId = null;

                    if (categoryName) {
                        const foundCat = categories.find(c => c.name.toLowerCase() === categoryName.toString().toLowerCase().trim());
                        if (foundCat) categoryId = foundCat.id;
                    }

                    if (!name || isNaN(price) || isNaN(cost)) {
                        errorCount++;
                        continue;
                    }

                    const { error } = await supabase.from('products').insert({
                        name,
                        barcode,
                        price,
                        cost_price: cost,
                        category_id: categoryId,
                        critical_stock: critical,
                        current_stock: 0,
                        is_active: true
                    });

                    if (error) {
                        console.error("Import Error", error);
                        errorCount++;
                    } else {
                        successCount++;
                    }
                }

                alert(`İşlem Tamamlandı!\nBaşarılı: ${successCount}\nHatalı: ${errorCount}`);
                setIsImportOpen(false);
                fetchInventory();

            } catch (err: any) {
                console.error(err);
                alert("Dosya okuma hatası: " + err.message);
            }
            setImportLoading(false);
        };
        reader.readAsBinaryString(file);
    };

    const handleAddProduct = async () => {
        // Barcode boşsa otomatik üret
        const finalBarcode = newProduct.barcode.trim() === ""
            ? `GEN-${Date.now()}`
            : newProduct.barcode;

        if (!newProduct.name || !newProduct.price || !newProduct.cost_price) {
            alert("Lütfen İsim ve Fiyat alanlarını doldurun.");
            return;
        }
        setAddLoading(true);

        let imagePath = null;
        if (selectedImage) {
            try {
                const compressed = await compressImage(selectedImage);
                // "products/" onekini kaldirdik, dogrudan bucket icine kaydedelim.
                const fileName = `${Date.now()}-${selectedImage.name.replace(/[^a-zA-Z0-9.-]/g, '')}`;
                const { data, error: uploadError } = await supabase.storage
                    .from('products')
                    .upload(fileName, compressed, {
                        contentType: 'image/jpeg',
                        upsert: false
                    });

                if (uploadError) {
                    console.error("Upload error:", uploadError);
                    if (uploadError.message.includes("bucket not found")) {
                        alert("Hata: 'products' isimli depolama alanı bulunamadı. Lütfen Supabase panelinden 'products' bucket'ını oluşturun.");
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
                console.error("Compression/Upload error:", err);
            }
        }

        const { error } = await supabase.from('products').insert({
            name: newProduct.name,
            barcode: finalBarcode,
            price: parseFloat(newProduct.price),
            wholesale_price: (newProduct as any).wholesale_price ? parseFloat((newProduct as any).wholesale_price) : null,
            cost_price: parseFloat(newProduct.cost_price),
            category_id: newProduct.category_id === "null" ? null : newProduct.category_id,
            critical_stock: parseInt(newProduct.critical_stock) || 5,
            current_stock: 0,
            image_path: imagePath,
            is_active: newProduct.is_active
        });

        if (error) {
            console.error("Supabase Error:", error);
            alert("Hata: " + error.message + " (" + error.details + ")");
        } else {
            setIsAddOpen(false);
            setNewProduct({ name: "", barcode: "", price: "", cost_price: "", category_id: "null", critical_stock: "5", is_active: true }); // Reset
            setSelectedImage(null);
            fetchInventory(); // Refresh
        }
        setAddLoading(false);
    };

    const filteredInventory = products.filter(
        (item) =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.barcode.includes(searchTerm)
    );

    return (
        <MainLayout>
            <div className="flex flex-col gap-6">

                {/* Üst Bar */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-primary">Stok Yönetimi</h1>
                        <p className="text-muted-foreground">Ürün listesi ve stok durumları.</p>
                    </div>
                    <div className="flex gap-2">
                        <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="gap-2 border-green-600 text-green-700 hover:bg-green-50">
                                    <Upload className="w-4 h-4" />
                                    Excel İçe Aktar
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Excel ile Ürün Yükle</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="bg-blue-50 p-4 rounded text-sm text-blue-800">
                                        Toplu ürün yüklemek için önce şablonu indirin, doldurun ve yükleyin.
                                    </div>
                                    <Button variant="secondary" className="w-full gap-2" onClick={handleDownloadTemplate}>
                                        <Download className="w-4 h-4" />
                                        Örnek Şablonu İndir
                                    </Button>
                                    <div className="grid gap-2">
                                        <Label>Excel Dosyası Seç</Label>
                                        <Input
                                            type="file"
                                            accept=".xlsx, .xls"
                                            onChange={handleFileUpload}
                                            disabled={importLoading}
                                        />
                                    </div>
                                    {importLoading && (
                                        <div className="flex items-center gap-2 text-primary animate-pulse">
                                            <Loader2 className="animate-spin w-4 h-4" />
                                            Yükleniyor, lütfen bekleyin...
                                        </div>
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>

                        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-2 bg-primary hover:bg-primary/90">
                                    <Plus className="w-4 h-4" />
                                    Yeni Ürün Ekle
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Yeni Ürün Ekle</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="name">Ürün Adı</Label>
                                        <Input
                                            id="name"
                                            value={newProduct.name}
                                            onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                            placeholder="Örn: Coca Cola 330ml"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="barcode">Barkod</Label>
                                        <Input
                                            id="barcode"
                                            value={newProduct.barcode}
                                            onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
                                            placeholder="Boş bırakırsanız otomatik üretilir"
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label>Ürün Görseli</Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => setSelectedImage(e.target.files?.[0] || null)}
                                            />
                                            {selectedImage && <span className="text-xs text-green-600 font-bold">Seçildi</span>}
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">Resimler otomatik olarak küçültülür (~800px).</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="price">Satış Fiyatı (₺)</Label>
                                            <Input
                                                id="price"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={newProduct.price}
                                                onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="wholesale_price">Toptan Fiyat (₺)</Label>
                                            <Input
                                                id="wholesale_price"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={(newProduct as any).wholesale_price || ""}
                                                onChange={(e) => setNewProduct({ ...newProduct, wholesale_price: e.target.value } as any)}
                                                placeholder="Opsiyonel"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="cost">Maliyet Fiyatı (₺)</Label>
                                            <Input
                                                id="cost"
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={newProduct.cost_price}
                                                onChange={(e) => setNewProduct({ ...newProduct, cost_price: e.target.value })}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2">
                                            <Label>Kategori</Label>
                                            <select
                                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                                                value={newProduct.category_id}
                                                onChange={(e) => setNewProduct({ ...newProduct, category_id: e.target.value })}
                                            >
                                                <option value="null">Kategorisiz</option>
                                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                            </select>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Kritik Stok</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                value={newProduct.critical_stock}
                                                onChange={(e) => setNewProduct({ ...newProduct, critical_stock: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            id="active"
                                            className="h-4 w-4"
                                            checked={newProduct.is_active}
                                            onChange={(e) => setNewProduct({ ...newProduct, is_active: e.target.checked })}
                                        />
                                        <Label htmlFor="active">Ürün Aktif (Satışa Açık)</Label>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsAddOpen(false)}>İptal</Button>
                                    <Button onClick={handleAddProduct} disabled={addLoading}>
                                        {addLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4 mr-2" />}
                                        Kaydet
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* İstatistikler */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Toplam Çeşit</CardTitle>
                            <Archive className="h-4 w-4 text-primary" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-primary">{products.length}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Toplam Stok Değeri</CardTitle>
                            <span className="text-xl font-bold text-primary">₺</span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-primary">
                                {products.reduce((acc, item) => acc + (item.price * item.current_stock), 0).toLocaleString('tr-TR')} ₺
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Tablo */}
                <Card className="flex-1 shadow-md border-primary/10">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Ürün Ara..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Button variant="ghost" size="icon" onClick={fetchInventory}>
                            <Loader2 className={cn("w-4 h-4 text-muted-foreground", loading && "animate-spin")} />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b text-primary font-bold">
                                    <tr>
                                        <th className="p-4">Ürün Adı</th>
                                        <th className="p-4">Barkod</th>
                                        <th className="p-4 text-center">Durum</th>
                                        <th className="p-4 text-right">Stok Adedi</th>
                                        <th className="p-4 text-right">Satış Fiyatı</th>
                                        <th className="p-4 text-center">İşlem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center">
                                                <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                                            </td>
                                        </tr>
                                    ) : filteredInventory.map((item) => (
                                        <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors group">
                                            <td className="p-4 font-medium text-primary cursor-pointer hover:underline flex items-center gap-3" onClick={() => window.location.href = `/inventory/${item.id}`}>
                                                {item.image_path ? (
                                                    <img src={item.image_path} alt={item.name} className="w-10 h-10 object-cover rounded shadow-sm border" />
                                                ) : (
                                                    <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-slate-300">
                                                        <ImageIcon className="w-5 h-5" />
                                                    </div>
                                                )}
                                                {item.name}
                                            </td>
                                            <td className="p-4 text-muted-foreground font-mono">{item.barcode}</td>
                                            <td className="p-4 text-center">
                                                {item.is_active === false ? (
                                                    <span className="px-2 py-1 rounded text-xs font-bold bg-gray-200 text-gray-600">Pasif</span>
                                                ) : item.current_stock <= 0 ? (
                                                    <span className="px-2 py-1 rounded text-xs font-bold bg-orange-100 text-orange-800">Stok Yok</span>
                                                ) : (
                                                    <span className="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-800">Aktif</span>
                                                )}
                                            </td>
                                            <td className={cn(
                                                "p-4 text-right font-bold",
                                                item.current_stock < 5 ? "text-red-600" : "text-green-600"
                                            )}>
                                                {item.current_stock}
                                            </td>
                                            <td className="p-4 text-right">{item.price.toFixed(2)} ₺</td>
                                            <td className="p-4 text-center">
                                                <Button variant="ghost" size="sm" className="h-8" onClick={() => window.location.href = `/inventory/${item.id}`}>
                                                    Detay
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {!loading && filteredInventory.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-8 text-center text-muted-foreground">Kayıt Yok</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

            </div>
        </MainLayout>
    );
}
