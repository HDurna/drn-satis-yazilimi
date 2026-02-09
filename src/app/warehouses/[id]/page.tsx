'use client';

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import MainLayout from "@/components/main-layout";
import { supabase, DatabaseWarehouse, DatabaseProductStock } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Package, Loader2 } from "lucide-react";

export default function WarehouseDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;

    const [warehouse, setWarehouse] = useState<DatabaseWarehouse | null>(null);
    const [stocks, setStocks] = useState<(DatabaseProductStock & { products: any })[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!id) return;
            setLoading(true);

            // Fetch Warehouse
            const { data: wData } = await supabase.from('warehouses').select('*').eq('id', id).single();
            setWarehouse(wData);

            // Fetch Stocks in this warehouse
            const { data: sData } = await supabase
                .from('product_stocks')
                .select('*, products(name, barcode, current_stock)')
                .eq('warehouse_id', id);

            if (sData) setStocks(sData as any);
            setLoading(false);
        };
        fetchData();
    }, [id]);

    if (loading) return <MainLayout><Loader2 className="animate-spin mx-auto mt-20" /></MainLayout>;
    if (!warehouse) return <MainLayout><div className="text-center mt-20">Depo bulunamadı.</div></MainLayout>;

    return (
        <MainLayout>
            <div className="flex flex-col gap-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-primary">{warehouse.name}</h1>
                        <p className="text-muted-foreground">Depo Stok Durumu</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Toplam Kalem</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold">{stocks.length}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Depodaki Toplam Ürün Adedi</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-blue-600">{stocks.reduce((acc, s) => acc + s.quantity, 0)}</div></CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader><CardTitle>Ürün Listesi</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ürün Adı</TableHead>
                                    <TableHead>Barkod</TableHead>
                                    <TableHead className="text-right">Bu Depodaki Stok</TableHead>
                                    <TableHead className="text-right">Genel Toplam Stok</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stocks.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="text-center p-8">Bu depoda henüz ürün yok.</TableCell></TableRow>
                                ) : stocks.map(stock => (
                                    <TableRow key={stock.id}>
                                        <TableCell className="font-medium">{stock.products?.name}</TableCell>
                                        <TableCell className="font-mono text-muted-foreground">{stock.products?.barcode}</TableCell>
                                        <TableCell className="text-right font-bold text-lg">{stock.quantity}</TableCell>
                                        <TableCell className="text-right text-muted-foreground">{stock.products?.current_stock}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
