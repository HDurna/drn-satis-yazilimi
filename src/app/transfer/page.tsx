'use client';

import { useState, useEffect } from "react";
import MainLayout from "@/components/main-layout";
import { supabase, DatabaseProduct, DatabaseWarehouse } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, Plus, Trash2, Search, Loader2, ArrowRight } from "lucide-react";

type TransferItem = {
    product: DatabaseProduct;
    quantity: number;
    currentStock: number; // Stock in Source Warehouse
};

export default function TransferPage() {
    const [warehouses, setWarehouses] = useState<DatabaseWarehouse[]>([]);
    const [sourceId, setSourceId] = useState<string>("");
    const [destId, setDestId] = useState<string>("");

    // Item Logic
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState<DatabaseProduct[]>([]);
    const [items, setItems] = useState<TransferItem[]>([]);

    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchWarehouses = async () => {
            const { data } = await supabase.from('warehouses').select('*').eq('is_active', true);
            if (data) setWarehouses(data);
        };
        fetchWarehouses();
    }, []);

    // Search Products
    useEffect(() => {
        const search = async () => {
            if (searchTerm.length < 2) {
                setSearchResults([]);
                return;
            }
            // If source selected, ideally we should check stock in that warehouse.
            // But complex. Let's just search products and fetch stock separately.
            const { data } = await supabase
                .from('products')
                .select('*')
                .ilike('name', `%${searchTerm}%`)
                .limit(5);

            if (data) setSearchResults(data);
        };
        const timer = setTimeout(search, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const addItem = async (product: DatabaseProduct) => {
        if (!sourceId) {
            alert("Önce çıkış deposunu seçiniz.");
            return;
        }

        // Fetch stock in source warehouse
        const { data: stockData } = await supabase
            .from('product_stocks')
            .select('quantity')
            .eq('product_id', product.id)
            .eq('warehouse_id', sourceId)
            .single();

        const currentStock = stockData?.quantity || 0;

        setItems(prev => {
            if (prev.find(i => i.product.id === product.id)) return prev;
            return [...prev, { product, quantity: 1, currentStock }];
        });
        setSearchTerm("");
        setSearchResults([]);
    };

    const updateQuantity = (id: number, qty: number) => {
        setItems(prev => prev.map(i => i.product.id === id ? { ...i, quantity: qty } : i));
    };

    const removeItem = (id: number) => {
        setItems(prev => prev.filter(i => i.product.id !== id));
    };

    const handleTransfer = async () => {
        if (submitting) return;
        if (!sourceId || !destId) {
            alert("Lütfen kaynak ve hedef depoları seçiniz.");
            return;
        }
        if (sourceId === destId) {
            alert("Kaynak ve hedef depo aynı olamaz.");
            return;
        }
        if (items.length === 0) {
            alert("Transfer edilecek ürün ekleyin.");
            return;
        }

        // Validate Stock
        for (const item of items) {
            if (item.quantity > item.currentStock) {
                alert(`"${item.product.name}" için yeterli stok yok. Mevcut: ${item.currentStock}`);
                return;
            }
            if (item.quantity <= 0) {
                alert(`"${item.product.name}" miktarı geçersiz.`);
                return;
            }
        }

        if (!confirm(`${items.length} çeşit ürün transfer edilecek. Onaylıyor musunuz?`)) return;

        setSubmitting(true);
        const { data: { user } } = await supabase.auth.getUser();

        const timestamp = Date.now();
        const docRef = `TRF-${timestamp}`;

        let movements = [];

        for (const item of items) {
            // OUT Movement
            movements.push({
                product_id: item.product.id,
                warehouse_id: sourceId,
                to_warehouse_id: destId,
                quantity: -item.quantity,
                type: 'TRANSFER_OUT',
                user_id: user?.id,
                document_ref: docRef,
                reason: `Transfer: ${warehouses.find(w => w.id === destId)?.name}`
            });
            // IN Movement
            movements.push({
                product_id: item.product.id,
                warehouse_id: destId,
                to_warehouse_id: sourceId, // Or from... let's keep to/from semantics loosely or add from_column
                quantity: item.quantity,
                type: 'TRANSFER_IN',
                user_id: user?.id,
                document_ref: docRef,
                reason: `Transfer: ${warehouses.find(w => w.id === sourceId)?.name}`
            });
        }

        const { error } = await supabase.from('stock_movements').insert(movements);

        if (error) {
            alert("Hata: " + error.message);
        } else {
            alert("Transfer başarıyla tamamlandı.");
            setItems([]);
            setSearchTerm("");
        }
        setSubmitting(false);
    };

    return (
        <MainLayout>
            <div className="flex flex-col gap-6 max-w-5xl mx-auto">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-2">
                        <ArrowRightLeft className="w-8 h-8" /> Depo Transferi
                    </h1>
                    <p className="text-muted-foreground">Depolar arası stok transferi işlemleri.</p>
                </div>

                <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 items-end bg-white p-6 rounded-lg border shadow-sm">
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Label>Kaynak Depo (Çıkış)</Label>
                            {(sourceId || destId) && (
                                <Button
                                    variant="link"
                                    size="sm"
                                    className="h-auto p-0 text-xs text-red-500"
                                    onClick={() => {
                                        if (items.length > 0 && !confirm("Seçimleri temizlemek listeyi sıfırlayacaktır. Devam?")) return;
                                        setSourceId("");
                                        setDestId("");
                                        setItems([]);
                                    }}
                                >
                                    Seçimleri Temizle
                                </Button>
                            )}
                        </div>
                        <Select
                            value={sourceId}
                            onValueChange={(val) => {
                                if (items.length > 0) {
                                    if (confirm("Kaynak depo değişirse eklenen ürünler silinecek. Onaylıyor musunuz?")) {
                                        setItems([]);
                                        setSourceId(val);
                                    }
                                } else {
                                    setSourceId(val);
                                }
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Seçiniz..." />
                            </SelectTrigger>
                            <SelectContent>
                                {warehouses.map(w => (
                                    <SelectItem key={w.id} value={w.id} disabled={w.id === destId}>
                                        {w.name} ({w.type})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex pb-2">
                        <Button
                            variant="outline"
                            size="icon"
                            className="rounded-full shadow-sm hover:bg-slate-100"
                            onClick={() => {
                                if (items.length > 0) {
                                    if (!confirm("Depoları yer değiştirmek listeyi temizleyecektir. Devam?")) return;
                                    setItems([]);
                                }
                                const temp = sourceId;
                                setSourceId(destId);
                                setDestId(temp);
                            }}
                            title="Depoları Yer Değiştir"
                        >
                            <ArrowRightLeft className="text-primary w-5 h-5 rotate-90" />
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <Label>Hedef Depo (Giriş)</Label>
                        <Select value={destId} onValueChange={setDestId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seçiniz..." />
                            </SelectTrigger>
                            <SelectContent>
                                {warehouses.map(w => (
                                    <SelectItem key={w.id} value={w.id} disabled={w.id === sourceId}>
                                        {w.name} ({w.type})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Ürünler</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative">
                            <Label>Ürün Ekle</Label>
                            <div className="flex gap-2 mt-1">
                                <div className="relative flex-1">
                                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Ürün Ara..."
                                        className="pl-8"
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        disabled={!sourceId}
                                    />
                                    {searchResults.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 bg-white border rounded shadow-lg z-10 mt-1 max-h-60 overflow-y-auto">
                                            {searchResults.map(p => (
                                                <div
                                                    key={p.id}
                                                    className="p-2 hover:bg-slate-100 cursor-pointer flex justify-between"
                                                    onClick={() => addItem(p)}
                                                >
                                                    <span>{p.name}</span>
                                                    <span className="text-muted-foreground text-xs">{p.barcode}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {items.length > 0 && (
                            <div className="border rounded-md">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b">
                                        <tr>
                                            <th className="p-3 text-left">Ürün</th>
                                            <th className="p-3 text-right">Mevcut (Kaynak)</th>
                                            <th className="p-3 text-right w-32">Miktar</th>
                                            <th className="p-3 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map(item => (
                                            <tr key={item.product.id} className="border-b last:border-0 hover:bg-slate-50">
                                                <td className="p-3 font-medium">{item.product.name}</td>
                                                <td className="p-3 text-right text-muted-foreground">{item.currentStock}</td>
                                                <td className="p-3 text-right">
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        max={item.currentStock}
                                                        value={item.quantity}
                                                        onChange={e => updateQuantity(item.product.id, parseInt(e.target.value))}
                                                        className="text-right h-8"
                                                    />
                                                </td>
                                                <td className="p-3 text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => removeItem(item.product.id)}>
                                                        <Trash2 className="w-4 h-4 text-red-500" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="flex justify-end pt-4">
                            <Button size="lg" onClick={handleTransfer} disabled={submitting || items.length === 0}>
                                {submitting && <Loader2 className="animate-spin w-4 h-4 mr-2" />}
                                Transferi Onayla
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
