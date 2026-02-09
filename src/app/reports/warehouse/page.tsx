'use client';

import { useState, useEffect } from "react";
import MainLayout from "@/components/main-layout";
import { supabase, DatabaseWarehouse } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Filter } from "lucide-react";
import * as XLSX from 'xlsx';

export default function WarehouseReportPage() {
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<DatabaseWarehouse[]>([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>("ALL");

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);

            // 1. Fetch Warehouses
            const { data: wData } = await supabase.from('warehouses').select('*');
            if (wData) setWarehouses(wData);

            // 2. Fetch Product Stocks with Product info
            // Notes: Supabase join returns an array for 1:N but 1:1 is object. 
            // product_stocks M:1 products, M:1 warehouses
            const { data: sData } = await supabase
                .from('product_stocks')
                .select(`
                    id,
                    quantity,
                    warehouse_id,
                    warehouses (name),
                    products (name, barcode, cost_price, price)
                `);

            if (sData) {
                // Flatten and Calculate
                const processed = sData.map((item: any) => ({
                    warehouse_name: item.warehouses?.name || 'Bilinmiyor',
                    warehouse_id: item.warehouse_id,
                    product_name: item.products?.name || 'Silinmiş',
                    barcode: item.products?.barcode || '-',
                    quantity: item.quantity,
                    cost_price: item.products?.cost_price || 0,
                    total_cost: item.quantity * (item.products?.cost_price || 0),
                    sales_price: item.products?.price || 0,
                    total_sales_value: item.quantity * (item.products?.price || 0)
                }));
                setReportData(processed);
            }
            setLoading(false);
        };
        loadData();
    }, []);

    const filteredData = selectedWarehouse === "ALL"
        ? reportData
        : reportData.filter(d => d.warehouse_id === selectedWarehouse);

    const totals = filteredData.reduce((acc, curr) => ({
        qty: acc.qty + curr.quantity,
        cost: acc.cost + curr.total_cost,
        sales: acc.sales + curr.total_sales_value
    }), { qty: 0, cost: 0, sales: 0 });

    const downloadExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filteredData.map(d => ({
            "Depo": d.warehouse_name,
            "Ürün": d.product_name,
            "Barkod": d.barcode,
            "Adet": d.quantity,
            "Birim Maliyet": d.cost_price,
            "Toplam Maliyet": d.total_cost,
            "Toplam Satış Değeri": d.total_sales_value
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Depo Raporu");
        XLSX.writeFile(wb, `Depo_Stok_Raporu_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    return (
        <MainLayout>
            <div className="flex flex-col gap-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-primary">Depo Stok & Maliyet Raporu</h1>
                        <p className="text-muted-foreground">Depo bazlı stok dağılımı ve maliyet analizi.</p>
                    </div>
                    <Button variant="outline" className="gap-2" onClick={downloadExcel}>
                        <Download className="w-4 h-4" /> Excel İndir
                    </Button>
                </div>

                <div className="flex bg-white p-4 rounded-lg shadow-sm border items-center gap-4">
                    <Filter className="w-5 h-5 text-muted-foreground" />
                    <span className="font-medium text-sm">Depo Filtrele:</span>
                    <select
                        className="border rounded p-2 text-sm min-w-[200px]"
                        value={selectedWarehouse}
                        onChange={e => setSelectedWarehouse(e.target.value)}
                    >
                        <option value="ALL">Tüm Depolar</option>
                        {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Toplam Stok Adedi</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold">{totals.qty}</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Toplam Maliyet</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-red-600">{totals.cost.toLocaleString('tr-TR')} ₺</div></CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Toplam Satış Değeri</CardTitle></CardHeader>
                        <CardContent><div className="text-2xl font-bold text-blue-600">{totals.sales.toLocaleString('tr-TR')} ₺</div></CardContent>
                    </Card>
                </div>

                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Depo</TableHead>
                                    <TableHead>Ürün</TableHead>
                                    <TableHead className="text-right">Adet</TableHead>
                                    <TableHead className="text-right">Birim Maliyet</TableHead>
                                    <TableHead className="text-right">Top. Maliyet</TableHead>
                                    <TableHead className="text-right">Top. Satış Değeri</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={6} className="text-center p-8"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                                ) : filteredData.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center p-8">Kayıt bulunamadı.</TableCell></TableRow>
                                ) : filteredData.map((row, i) => (
                                    <TableRow key={i} className="hover:bg-slate-50">
                                        <TableCell className="font-medium text-muted-foreground">{row.warehouse_name}</TableCell>
                                        <TableCell>
                                            <div className="font-bold text-primary">{row.product_name}</div>
                                            <div className="text-xs text-muted-foreground font-mono">{row.barcode}</div>
                                        </TableCell>
                                        <TableCell className="text-right font-bold">{row.quantity}</TableCell>
                                        <TableCell className="text-right">{row.cost_price.toFixed(2)} ₺</TableCell>
                                        <TableCell className="text-right text-red-600">{row.total_cost.toFixed(2)} ₺</TableCell>
                                        <TableCell className="text-right text-blue-600 font-bold">{row.total_sales_value.toFixed(2)} ₺</TableCell>
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
