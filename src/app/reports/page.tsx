'use client';

import { useState, useEffect, useMemo } from "react";
import MainLayout from "@/components/main-layout";
import { supabase, DatabaseStockMovement, DatabaseProduct, DatabaseWarehouse, DatabaseExpense, DatabaseRegisterSession } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, TrendingUp, Package, Calendar, Download, FileSpreadsheet, Warehouse, Filter } from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts';
import * as XLSX from 'xlsx';

type MovementWithProduct = DatabaseStockMovement & {
    products: DatabaseProduct | null;
};

export default function ReportsPage() {
    const [loading, setLoading] = useState(true);
    const [allProducts, setAllProducts] = useState<DatabaseProduct[]>([]);
    const [salesMovements, setSalesMovements] = useState<MovementWithProduct[]>([]);

    // Finance State
    const [expenses, setExpenses] = useState<DatabaseExpense[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);

    // Warehouse Report State
    const [warehouseReportData, setWarehouseReportData] = useState<any[]>([]);
    const [warehouses, setWarehouses] = useState<DatabaseWarehouse[]>([]);
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>("ALL");

    // Filters
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [selectedDay, setSelectedDay] = useState(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD

    // Data Fetching
    const fetchData = async () => {
        setLoading(true);

        // 1. Fetch Products for Stock Report
        const { data: prodData } = await supabase
            .from('products')
            .select('*')
            .is('deleted_at', null)
            .order('name');

        if (prodData) setAllProducts(prodData);

        // 2. Dates
        const startOfMonth = `${selectedMonth}-01`;
        const [y, m] = selectedMonth.split('-');
        const endOfMonth = new Date(parseInt(y), parseInt(m), 0).toISOString().slice(0, 10);

        // 3. Fetch Sales
        const { data: salesData } = await supabase
            .from('stock_movements')
            .select('*, products(*)')
            .eq('type', 'SALE')
            .gte('created_at', `${startOfMonth}T00:00:00`)
            .lte('created_at', `${endOfMonth}T23:59:59`)
            .order('created_at', { ascending: true });

        if (salesData) setSalesMovements(salesData as any);

        // 4. Fetch Expenses
        const { data: expData } = await supabase
            .from('expenses')
            .select('*, expense_categories(*)')
            .gte('created_at', `${startOfMonth}T00:00:00`)
            .lte('created_at', `${endOfMonth}T23:59:59`)
            .order('created_at', { ascending: false });

        if (expData) setExpenses(expData as any);

        // 5. Fetch Sessions
        const { data: sessData } = await supabase
            .from('register_sessions')
            .select('*, registers(*)')
            .gte('opened_at', `${startOfMonth}T00:00:00`)
            .lte('opened_at', `${endOfMonth}T23:59:59`)
            .order('opened_at', { ascending: false });

        if (sessData) setSessions(sessData);

        // 6. Fetch Warehouse Data
        const { data: wData } = await supabase.from('warehouses').select('*');
        if (wData) setWarehouses(wData);

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
            // Flatten
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
            setWarehouseReportData(processed);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [selectedMonth]);

    // --- CHART DATA PREPARATION ---

    // 1. Daily Sales in Month (Area Chart)
    const monthlyChartData = useMemo(() => {
        const daysInMonth = new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]), 0).getDate();
        const data = Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dayStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
            return {
                day: day,
                date: dayStr,
                total: 0,
                count: 0
            };
        });

        salesMovements.forEach(sale => {
            const saleDate = sale.created_at.slice(0, 10);
            const dayIndex = parseInt(saleDate.split('-')[2]) - 1;
            if (data[dayIndex]) {
                const amount = Math.abs(sale.quantity) * (sale.products?.price || 0);
                data[dayIndex].total += amount;
                data[dayIndex].count += 1;
            }
        });

        return data;
    }, [salesMovements, selectedMonth]);

    // 2. Hourly Sales for Selected Day (Bar Chart)
    const hourlyChartData = useMemo(() => {
        const hours = Array.from({ length: 24 }, (_, i) => ({
            hour: `${i.toString().padStart(2, '0')}:00`,
            total: 0,
            transactionCount: 0
        }));

        salesMovements.forEach(sale => {
            if (sale.created_at.startsWith(selectedDay)) {
                const hour = parseInt(sale.created_at.split('T')[1].split(':')[0]);
                if (hours[hour]) {
                    const amount = Math.abs(sale.quantity) * (sale.products?.price || 0);
                    hours[hour].total += amount;
                    hours[hour].transactionCount += 1;
                }
            }
        });

        return hours;
    }, [salesMovements, selectedDay]);

    // --- STOCK REPORT CALCULATIONS ---
    const stockReport = useMemo(() => {
        let totalCost = 0;
        let totalRetail = 0;
        let totalCount = 0;

        const items = allProducts.map(p => {
            const costVal = p.cost_price * p.current_stock;
            const retailVal = p.price * p.current_stock;
            totalCost += costVal;
            totalRetail += retailVal;
            totalCount += p.current_stock;
            return {
                ...p,
                costVal,
                retailVal,
                profitPotential: retailVal - costVal
            };
        });

        return { items, totalCost, totalRetail, totalCount };
    }, [allProducts]);

    // --- WAREHOUSE REPORT CALCULATIONS ---
    const filteredWarehouseData = selectedWarehouse === "ALL"
        ? warehouseReportData
        : warehouseReportData.filter(d => d.warehouse_id === selectedWarehouse);

    const warehouseTotals = filteredWarehouseData.reduce((acc, curr) => ({
        qty: acc.qty + curr.quantity,
        cost: acc.cost + curr.total_cost,
        sales: acc.sales + curr.total_sales_value
    }), { qty: 0, cost: 0, sales: 0 });


    // --- EXPORT FUNCTIONS ---
    const exportStockToExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(stockReport.items.map(i => ({
            "Ürün Adı": i.name,
            "Barkod": i.barcode,
            "Kategori": i.category_id || "-",
            "Stok": i.current_stock,
            "Maliyet": i.cost_price,
            "Satış Fiyatı": i.price,
            "Toplam Maliyet": i.costVal,
            "Toplam Satış Değeri": i.retailVal,
            "Potansiyel Kar": i.profitPotential
        })));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Stok Raporu");
        XLSX.writeFile(workbook, `Stok_Raporu_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const exportSalesToExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(salesMovements.map(s => ({
            "Tarih": new Date(s.created_at).toLocaleString('tr-TR'),
            "Ürün": s.products?.name,
            "Barkod": s.products?.barcode,
            "Miktar": Math.abs(s.quantity),
            "Birim Fiyat": s.products?.price,
            "Toplam Tutar": Math.abs(s.quantity) * (s.products?.price || 0)
        })));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Satis_Raporu");
        XLSX.writeFile(workbook, `Satis_Raporu_${selectedMonth}.xlsx`);
    };

    const exportWarehouseToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(filteredWarehouseData.map(d => ({
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
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-primary">Gelişmiş Raporlar</h1>
                    <p className="text-muted-foreground">Satış analizleri, grafikler, stok ve depo durumu.</p>
                </div>

                <Tabs defaultValue="sales" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 lg:w-[800px]">
                        <TabsTrigger value="sales">Satış Analizi</TabsTrigger>
                        <TabsTrigger value="finance">Finans & Kasa</TabsTrigger>
                        <TabsTrigger value="stock">Genel Stok Raporu</TabsTrigger>
                        <TabsTrigger value="warehouse">Depo Raporu</TabsTrigger>
                    </TabsList>

                    {/* SALES TAB */}
                    <TabsContent value="sales" className="space-y-6">
                        {/* Filters */}
                        <div className="flex flex-wrap gap-4 bg-white p-4 rounded-lg shadow-sm border">
                            <div className="grid gap-2">
                                <span className="text-sm font-medium">Ay Seçimi (Genel Grafik)</span>
                                <Input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="w-48"
                                />
                            </div>
                            <div className="grid gap-2">
                                <span className="text-sm font-medium">Gün Seçimi (Saatlik Grafik)</span>
                                <Input
                                    type="date"
                                    value={selectedDay}
                                    onChange={(e) => setSelectedDay(e.target.value)}
                                    className="w-48"
                                />
                            </div>
                            <div className="ml-auto flex items-end">
                                <Button variant="outline" className="gap-2" onClick={exportSalesToExcel}>
                                    <FileSpreadsheet className="w-4 h-4 text-green-600" />
                                    Listeyi Excel'e Al
                                </Button>
                            </div>
                        </div>

                        {/* Monthly Chart */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-blue-600" />
                                    Aylık Satış Grafiği ({selectedMonth})
                                </CardTitle>
                                <CardDescription>Seçili aydaki günlük toplam ciro.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={monthlyChartData}>
                                        <defs>
                                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="day" />
                                        <YAxis />
                                        <Tooltip formatter={(value) => `${Number(value).toFixed(2)} ₺`} />
                                        <Area type="monotone" dataKey="total" stroke="#2563eb" fillOpacity={1} fill="url(#colorTotal)" name="Ciro" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Hourly Chart */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-orange-600" />
                                    Günlük Saatlik Dağılım ({selectedDay})
                                </CardTitle>
                                <CardDescription>Seçili gündeki saatlik satış yoğunluğu.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px] w-full">
                                {loading ? <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin" /></div> :
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={hourlyChartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="hour" />
                                            <YAxis />
                                            <Tooltip formatter={(value) => `${Number(value).toFixed(2)} ₺`} />
                                            <Legend />
                                            <Bar dataKey="total" fill="#f97316" name="Ciro" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                }
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* STOCK TAB */}
                    <TabsContent value="stock" className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="bg-slate-50">
                                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Toplam Maliyet Değeri</CardTitle></CardHeader>
                                <CardContent><div className="text-2xl font-bold text-slate-700">{stockReport.totalCost.toLocaleString('tr-TR')} ₺</div></CardContent>
                            </Card>
                            <Card className="bg-blue-50 border-blue-100">
                                <CardHeader className="pb-2"><CardTitle className="text-sm text-blue-700">Toplam Satış Değeri</CardTitle></CardHeader>
                                <CardContent><div className="text-2xl font-bold text-blue-700">{stockReport.totalRetail.toLocaleString('tr-TR')} ₺</div></CardContent>
                            </Card>
                            <Card className="bg-green-50 border-green-100">
                                <CardHeader className="pb-2"><CardTitle className="text-sm text-green-700">Potansiyel Kâr</CardTitle></CardHeader>
                                <CardContent><div className="text-2xl font-bold text-green-700">{(stockReport.totalRetail - stockReport.totalCost).toLocaleString('tr-TR')} ₺</div></CardContent>
                            </Card>
                        </div>

                        <div className="flex justify-end">
                            <Button variant="outline" className="gap-2" onClick={exportStockToExcel}>
                                <Download className="w-4 h-4" />
                                Excel İndir
                            </Button>
                        </div>

                        {/* Stock Table */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Package className="w-5 h-5" /> Detaylı Stok Listesi</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 border-b font-bold text-primary">
                                            <tr>
                                                <th className="p-3">Ürün Adı</th>
                                                <th className="p-3 text-right">Stok</th>
                                                <th className="p-3 text-right">Maliyet</th>
                                                <th className="p-3 text-right">Satış Fiyatı</th>
                                                <th className="p-3 text-right">Top. Maliyet</th>
                                                <th className="p-3 text-right">Top. Satış</th>
                                                <th className="p-3 text-right">Kâr</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stockReport.items.map(item => (
                                                <tr key={item.id} className="border-b last:border-0 hover:bg-slate-50">
                                                    <td className="p-3 font-medium">{item.name}</td>
                                                    <td className="p-3 text-right">{item.current_stock}</td>
                                                    <td className="p-3 text-right">{item.cost_price.toFixed(2)} ₺</td>
                                                    <td className="p-3 text-right">{item.price.toFixed(2)} ₺</td>
                                                    <td className="p-3 text-right font-mono text-muted-foreground">{item.costVal.toFixed(2)} ₺</td>
                                                    <td className="p-3 text-right font-mono text-blue-600">{item.retailVal.toFixed(2)} ₺</td>
                                                    <td className="p-3 text-right font-bold text-green-600">{item.profitPotential.toFixed(2)} ₺</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* FINANCE TAB */}
                    <TabsContent value="finance" className="space-y-6">
                        {/* Financial Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card className="bg-red-50 border-red-100">
                                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-red-800">Toplam Giderler</CardTitle></CardHeader>
                                <CardContent><div className="text-2xl font-bold text-red-700">{expenses.reduce((a, b) => a + b.amount, 0).toLocaleString('tr-TR')} ₺</div></CardContent>
                            </Card>
                            <Card className="bg-emerald-50 border-emerald-100">
                                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-emerald-800">Net Kâr (Tahmini)</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-emerald-700">
                                        {((salesMovements.reduce((acc, sale) => acc + (Math.abs(sale.quantity) * ((sale.products?.price || 0) - (sale.products?.cost_price || 0))), 0)) - expenses.reduce((a, b) => a + b.amount, 0)).toLocaleString('tr-TR')} ₺
                                    </div>
                                    <div className="text-xs text-emerald-600">Brüt Kâr - Giderler</div>
                                </CardContent>
                            </Card>
                            <Card className="bg-purple-50 border-purple-100">
                                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-purple-800">Kasa Açık/Fazla</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-purple-700">
                                        {sessions.reduce((acc, s) => acc + ((s.actual_closing_amount || 0) - (s.closing_amount || 0)), 0).toLocaleString('tr-TR')} ₺
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Kasa Oturum Sayısı</CardTitle></CardHeader>
                                <CardContent><div className="text-2xl font-bold">{sessions.length}</div></CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Expenses List */}
                            <Card>
                                <CardHeader><CardTitle>Son Giderler</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="h-[300px] overflow-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow><TableHead>Açıklama</TableHead><TableHead className="text-right">Tutar</TableHead><TableHead className="text-right">Tarih</TableHead></TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {expenses.map(e => (
                                                    <TableRow key={e.id}>
                                                        <TableCell>
                                                            <div className="font-medium">{e.description || 'Gider'}</div>
                                                            <div className="text-xs text-muted-foreground">{e.expense_categories?.name}</div>
                                                        </TableCell>
                                                        <TableCell className="text-right text-red-600 font-bold">-{e.amount} ₺</TableCell>
                                                        <TableCell className="text-right text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</TableCell>
                                                    </TableRow>
                                                ))}
                                                {expenses.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">Gider yok.</TableCell></TableRow>}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Register Sessions */}
                            <Card>
                                <CardHeader><CardTitle>Kasa Oturumları (Z Raporları)</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="h-[300px] overflow-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow><TableHead>Kasa/Personel</TableHead><TableHead className="text-right">Açılış/Kapanış</TableHead><TableHead className="text-right">Fark</TableHead></TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {sessions.map(s => {
                                                    const diff = (s.actual_closing_amount || 0) - (s.closing_amount || 0);
                                                    return (
                                                        <TableRow key={s.id}>
                                                            <TableCell>
                                                                <div className="font-medium">{s.registers?.name}</div>
                                                                <div className="text-xs text-muted-foreground">Oturum: {s.id.slice(0, 4)}</div>
                                                            </TableCell>
                                                            <TableCell className="text-right text-xs">
                                                                <div>Açılış: {s.opening_amount} ₺</div>
                                                                <div>Kapanış: {s.actual_closing_amount} ₺</div>
                                                            </TableCell>
                                                            <TableCell className={`text-right font-bold ${diff < 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                                {diff > 0 ? '+' : ''}{diff} ₺
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                                {sessions.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">Kayıt yok.</TableCell></TableRow>}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* WAREHOUSE REPORT TAB */}
                    <TabsContent value="warehouse" className="space-y-6">
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
                            <Button variant="outline" className="ml-auto gap-2" onClick={exportWarehouseToExcel}>
                                <Download className="w-4 h-4" /> Excel İndir
                            </Button>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Toplam Stok Adedi</CardTitle></CardHeader>
                                <CardContent><div className="text-2xl font-bold">{warehouseTotals.qty}</div></CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Toplam Maliyet</CardTitle></CardHeader>
                                <CardContent><div className="text-2xl font-bold text-red-600">{warehouseTotals.cost.toLocaleString('tr-TR')} ₺</div></CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Toplam Satış Değeri</CardTitle></CardHeader>
                                <CardContent><div className="text-2xl font-bold text-blue-600">{warehouseTotals.sales.toLocaleString('tr-TR')} ₺</div></CardContent>
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
                                        ) : filteredWarehouseData.length === 0 ? (
                                            <TableRow><TableCell colSpan={6} className="text-center p-8">Kayıt bulunamadı.</TableCell></TableRow>
                                        ) : filteredWarehouseData.map((row, i) => (
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
                    </TabsContent>
                </Tabs>
            </div>
        </MainLayout>
    );
}
