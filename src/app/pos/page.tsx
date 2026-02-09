'use client';

import { useState, useEffect } from "react";
import { supabase, DatabaseProduct } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, ShoppingCart, Package, Loader2, RefreshCw, Users } from "lucide-react";
import MainLayout from "@/components/main-layout";
import { cn } from "@/lib/utils";

type CartItem = {
    product: DatabaseProduct;
    quantity: number;
    unitPrice?: number;
};

const alertUser = (type: 'success' | 'error', msg: string) => {
    if (type === 'success') alert("✅ " + msg);
    else alert("❌ " + msg);
}

export default function POSPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [products, setProducts] = useState<DatabaseProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [storeId, setStoreId] = useState<string | null>(null);
    const [priceMode, setPriceMode] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');

    // Müşteri Yönetimi
    const [customers, setCustomers] = useState<any[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<string>("");

    // POS Session State
    const [registers, setRegisters] = useState<any[]>([]);
    const [currentSession, setCurrentSession] = useState<any | null>(null);
    const [selectedRegisterId, setSelectedRegisterId] = useState<string>("");
    const [openingAmount, setOpeningAmount] = useState<string>("0");
    const [sessionLoading, setSessionLoading] = useState(true);

    // Loyalty State
    const [loyaltySettings, setLoyaltySettings] = useState<any>(null);

    // Initial Load: Check Session & Store
    useEffect(() => {
        const initPOS = async () => {
            setSessionLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return; // Auth handled elsewhere ideally

            // 1. Get Store ID
            const { data: warehouse } = await supabase.from('warehouses').select('id').eq('type', 'STORE').single();
            if (warehouse) setStoreId(warehouse.id);

            // 2. Check Active Session for User
            const { data: activeSession } = await supabase
                .from('register_sessions')
                .select('*, registers(*)')
                .eq('user_id', user.id)
                .eq('status', 'OPEN')
                .single();

            if (activeSession) {
                setCurrentSession(activeSession);
                fetchProducts(); // Load products if we have a session
            } else {
                // 3. Fetch Available Registers if no session
                const { data: regList } = await supabase.from('registers').select('*').eq('is_active', true);
                if (regList) setRegisters(regList);
            }

            // 4. Fetch Customers
            const { data: custData, error: custError } = await supabase.from('customers').select('id, full_name, balance').order('full_name');
            if (custError) console.error("Customer fetch error:", custError);
            if (custData) setCustomers(custData);

            // 5. Fetch Loyalty Settings
            const { data: loySet } = await supabase.from('loyalty_settings').select('*').single();
            if (loySet && loySet.is_active) setLoyaltySettings(loySet);

            setSessionLoading(false);
        };
        initPOS();
    }, []);

    const handleOpenSession = async () => {
        if (!selectedRegisterId) return alert("Lütfen bir kasa seçiniz.");
        setProcessing(true);
        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase.from('register_sessions').insert({
            register_id: selectedRegisterId,
            user_id: user?.id,
            opening_amount: parseFloat(openingAmount) || 0,
            status: 'OPEN'
        }).select('*, registers(*)').single();

        if (error) {
            alert(error.message);
        } else {
            setCurrentSession(data);
            fetchProducts();
        }
        setProcessing(false);
    }

    // Ürünleri Getir
    const fetchProducts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .is('deleted_at', null)
            .order('name');

        if (data) {
            // Filter in memory
            const activeProducts = data.filter(p => p.is_active !== false);
            setProducts(activeProducts);
        }
        setLoading(false);
    };

    // Filtrelenmiş Ürünler
    const filteredProducts = products.filter(
        (p) =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.barcode.includes(searchTerm)
    );

    // Sepete Ekle
    const addToCart = (product: DatabaseProduct) => {
        setCart((prev) => {
            const existing = prev.find((item) => item.product.id === product.id);
            if (existing) {
                if (existing.quantity >= product.current_stock) {
                    alert("Stok yetersiz!"); // Basit uyarı
                    return prev;
                }
                return prev.map((item) =>
                    item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            // Determine price based on mode
            const unitPrice = priceMode === 'WHOLESALE' && product.wholesale_price && product.wholesale_price > 0
                ? product.wholesale_price
                : product.price;

            return [...prev, { product, quantity: 1, unitPrice }];
        });
    };

    // Sepetten Azalt
    const removeFromCart = (productId: number) => {
        setCart((prev) =>
            prev.map((item) =>
                item.product.id === productId ? { ...item, quantity: item.quantity - 1 } : item
            ).filter((item) => item.quantity > 0)
        );
    };

    // Sepetten Tamamen Sil
    const deleteFromCart = (productId: number) => {
        setCart((prev) => prev.filter((item) => item.product.id !== productId));
    };

    // Müşterileri Getir
    const fetchCustomers = async () => {
        const { data, error } = await supabase.from('customers').select('id, full_name, balance').order('full_name');
        if (error) {
            console.error("Müşteri listesi çekilemedi:", error);
            alertUser('error', "Müşteri listesi yüklenemedi: " + error.message);
        }
        if (data) setCustomers(data);
    };

    // Satışı Tamamla
    const completeSale = async (paymentMethod: 'CASH' | 'CARD' | 'ON_CREDIT') => {
        if (cart.length === 0) return;
        if (processing) return;

        // Veresiye Kontrolü
        if (paymentMethod === 'ON_CREDIT' && !selectedCustomer) {
            alertUser('error', "Veresiye satış için lütfen bir müşteri seçiniz!");
            return;
        }

        setProcessing(true);

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            alert("Kullanıcı oturumu bulunamadı.");
            setProcessing(false);
            return;
        }

        let errorOccurred = false;
        let transId = null;

        // 1. İşlem Kaydı (Financial Transaction)
        // Önce tablonun varlığını kontrol etmek gerekmiyor, migration ile eklenecek.
        try {
            const { data: transaction, error: transError } = await supabase.from('transactions').insert({
                session_id: currentSession?.id,
                user_id: user.id,
                customer_id: selectedCustomer ? parseInt(selectedCustomer) : null,
                warehouse_id: currentSession?.registers?.warehouse_id || storeId,
                amount: totalAmount,
                payment_method: paymentMethod,
                items: cart,
                notes: `POS Satış - ${paymentMethod}`
            }).select().single();

            if (transError) {
                console.error("Trans Error:", transError);
                // Eğer transactions tablosu yoksa (error.code '42P01'), eski usül devam et ama uyar
                if (transError.code !== '42P01') {
                    alert("İşlem kaydedilemedi: " + transError.message);
                    errorOccurred = true;
                }
            } else {
                transId = transaction?.id;
            }
        } catch (e) {
            console.log("Transaction table might not exist yet, continuing with stock movement only.");
        }

        // 2. Stok Hareketleri
        if (!errorOccurred) {
            // ... (stok hareketleri aynı)
            const movements = cart.map(item => ({
                product_id: item.product.id,
                user_id: user.id,
                warehouse_id: currentSession?.registers?.warehouse_id || storeId,
                session_id: currentSession?.id,
                quantity: -item.quantity,
                type: 'SALE',
                document_ref: transId || `POS-${Date.now()}`,
                reason: `Satış - ${paymentMethod}`
            }));

            const { error: moveError } = await supabase.from('stock_movements').insert(movements);

            if (moveError) {
                console.error(moveError);
                alert("Stok düşülürken hata oluştu: " + moveError.message);
            } else {
                // --- SADAKAT PROGRAMI (LOYALTY) ---
                if (loyaltySettings && selectedCustomer && loyaltySettings.is_active) {
                    const ratio = loyaltySettings.money_to_point_ratio || 100;
                    const minSpend = loyaltySettings.min_spending || 0;

                    if (totalAmount >= minSpend) {
                        const earnedPoints = Math.floor(totalAmount / ratio);
                        if (earnedPoints > 0) {
                            try {
                                // 1. Müşteri Puanını Güncelle
                                const custId = parseInt(selectedCustomer); // ID int ise
                                // Önce mevcut puanı al (State'den de alabiliriz ama DB daha güvenli)
                                const { data: currCust } = await supabase.from('customers').select('loyalty_points').eq('id', custId).single();
                                const newPoints = (currCust?.loyalty_points || 0) + earnedPoints;

                                await supabase.from('customers').update({ loyalty_points: newPoints }).eq('id', custId);

                                // 2. Log Kaydı At
                                await supabase.from('loyalty_transactions').insert({
                                    customer_id: custId, // UUID ise string kalmalı, int ise parse. Müşteri ID yapımıza göre değişir.
                                    // Bizim customers.id UUID mi INT mi? fix_customers_table.sql'de UUID idi.
                                    // POS sayfasında 'parseInt' kullanılmış (202. satır). Demek ki int.
                                    // Ancak loyalty_transactions customer_id UUID referanslı oluşturuldu!
                                    // DİKKAT: Müşteri tablosu yapısını kontrol etmeliyim. 
                                    // Eğer customers.id INT8 ise ve loyalty_transactions UUID bekliyorsa hata alırız.
                                    // Customers tablosu genelde supabase'de UUID olur ama bu projede BigInt olabilir.
                                    transaction_type: 'EARN',
                                    points: earnedPoints,
                                    amount_equivalent: earnedPoints * (loyaltySettings.point_value || 1),
                                    description: `Satış #${transId || '-'} kazancı`
                                });

                                alertUser('success', `Müşteri ${earnedPoints} Puan Kazandı!`);
                            } catch (loyKey) {
                                console.error("Loyalty Error:", loyKey);
                            }
                        }
                    }
                }
                // --- KOD SONU ---

                // Başarılı
                setCart([]);
                setSelectedCustomer("");
                fetchProducts();
                if (selectedCustomer) fetchCustomers();
                if (!loyaltySettings) alertUser('success', "Satış başarıyla tamamlandı!"); // Loyalty uyarısı yoksa normal uyarı
            }
        }
        setProcessing(false);
    };

    const [isCloseSessionOpen, setIsCloseSessionOpen] = useState(false);
    const [isExpenseOpen, setIsExpenseOpen] = useState(false);
    const [closeSummary, setCloseSummary] = useState({ expected: 0, cashSales: 0, cardSales: 0, expenses: 0 });
    const [closingCash, setClosingCash] = useState("");
    const [closingNote, setClosingNote] = useState("");

    // Expense Form
    const [expenseForm, setExpenseForm] = useState({ amount: "", desc: "", catId: "" });
    const [expenseCats, setExpenseCats] = useState<any[]>([]);

    const handlePreCloseSession = async () => {
        if (!currentSession) return;
        setProcessing(true);
        // Calculate totals for session
        // 1. Sales
        const { data: sales } = await supabase.from('stock_movements')
            .select('quantity, products(price)')
            .eq('session_id', currentSession.id)
            .eq('type', 'SALE');

        // Expenses
        const { data: expenses } = await supabase.from('expenses').select('*').eq('session_id', currentSession.id);
        const totalExpenses = expenses?.reduce((sum, item) => sum + item.amount, 0) || 0;

        setCloseSummary({
            expected: currentSession.opening_amount - totalExpenses, // Sales logic needs improvement with transaction table
            cashSales: 0,
            cardSales: 0,
            expenses: totalExpenses
        });

        setIsCloseSessionOpen(true);
        setProcessing(false);
    };

    const handleCloseSession = async () => {
        setProcessing(true);
        if (!currentSession) return;

        const { error } = await supabase.from('register_sessions').update({
            closed_at: new Date().toISOString(),
            closing_amount: parseFloat(closingCash) || 0,
            actual_closing_amount: parseFloat(closingCash) || 0, // In real world actual != expected
            status: 'CLOSED',
            notes: closingNote
        }).eq('id', currentSession.id);

        if (error) alert(error.message);
        else window.location.reload();
    };

    const handleAddExpense = async () => {
        if (!expenseForm.amount || !currentSession) return;
        setProcessing(true);
        const { error } = await supabase.from('expenses').insert({
            user_id: (await supabase.auth.getUser()).data.user?.id,
            warehouse_id: currentSession.registers.warehouse_id,
            session_id: currentSession.id,
            category_id: expenseForm.catId || null,
            amount: parseFloat(expenseForm.amount),
            description: expenseForm.desc
        });

        if (error) alert(error.message);
        else {
            setIsExpenseOpen(false);
            setExpenseForm({ amount: "", desc: "", catId: "" });
            alert("Gider işlendi.");
        }
        setProcessing(false);
    };

    // Load Expense Cats
    useEffect(() => {
        supabase.from('expense_categories').select('*').eq('is_active', true).then(res => {
            if (res.data) setExpenseCats(res.data);
        });
    }, []);

    // Toplam Tutar
    const totalAmount = cart.reduce((sum, item) => sum + ((item.unitPrice || item.product.price) * item.quantity), 0);

    if (sessionLoading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
    }

    if (!currentSession) {
        return (
            <MainLayout>
                <div className="flex h-[calc(100vh-100px)] items-center justify-center">
                    <Card className="w-full max-w-md">
                        <CardContent className="p-6 flex flex-col gap-4">
                            <h2 className="text-xl font-bold text-center">Kasa Oturumu Aç</h2>
                            <p className="text-center text-muted-foreground text-sm">Satış yapabilmek için lütfen bir kasa seçin ve açılış nakitini girin.</p>

                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Kasa Seçimi</label>
                                    <select
                                        className="w-full border rounded-md p-2"
                                        value={selectedRegisterId}
                                        onChange={(e) => setSelectedRegisterId(e.target.value)}
                                    >
                                        <option value="">Seçiniz...</option>
                                        {registers.map(r => (
                                            <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Açılış Nakiti (Opsiyonel)</label>
                                    <Input
                                        type="number"
                                        value={openingAmount}
                                        onChange={(e) => setOpeningAmount(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <Button className="w-full" onClick={handleOpenSession} disabled={processing || !selectedRegisterId}>
                                {processing ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null}
                                Oturumu Başlat
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </MainLayout>
        )
    }

    return (
        <MainLayout>
            {/* Dialogs */}
            {isCloseSessionOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md bg-white">
                        <CardContent className="p-6 space-y-4">
                            <h2 className="text-xl font-bold">Kasayı Kapat</h2>
                            <div className="bg-slate-50 p-4 rounded text-sm space-y-2">
                                <div className="flex justify-between">
                                    <span>Açılış Nakiti:</span>
                                    <span className="font-bold">{currentSession?.opening_amount} ₺</span>
                                </div>
                                <div className="flex justify-between text-red-600">
                                    <span>Kasadan Çıkan Gider:</span>
                                    <span className="font-bold">-{closeSummary.expenses} ₺</span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-2 border-t pt-2">
                                    * Satış tutarları henüz hesaplanamıyor (Satış tablosu gerekiyor). <br />
                                    Lütfen kasadaki güncel nakiti sayıp giriniz.
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium">Sayılan Nakit (Kasadaki)</label>
                                <Input
                                    type="number"
                                    value={closingCash}
                                    onChange={e => setClosingCash(e.target.value)}
                                    className="text-lg font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Notlar</label>
                                <Input value={closingNote} onChange={e => setClosingNote(e.target.value)} />
                            </div>

                            <div className="flex gap-2 justify-end mt-4">
                                <Button variant="outline" onClick={() => setIsCloseSessionOpen(false)}>İptal</Button>
                                <Button variant="destructive" onClick={handleCloseSession} disabled={processing}>Gün Sonu Yap</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {isExpenseOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-sm bg-white">
                        <CardContent className="p-6 space-y-4">
                            <h2 className="text-xl font-bold text-red-600">Gider / Masraf Ekle</h2>
                            <div>
                                <label className="text-sm font-medium">Kategori</label>
                                <select className="w-full border p-2 rounded" onChange={e => setExpenseForm({ ...expenseForm, catId: e.target.value })}>
                                    <option value="">Seçiniz</option>
                                    {expenseCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Tutar</label>
                                <Input type="number" onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Açıklama</label>
                                <Input onChange={e => setExpenseForm({ ...expenseForm, desc: e.target.value })} />
                            </div>
                            <div className="flex gap-2 justify-end mt-4">
                                <Button variant="outline" onClick={() => setIsExpenseOpen(false)}>İptal</Button>
                                <Button variant="destructive" onClick={handleAddExpense}>Kaydet</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-100px)]">
                {/* Sol Taraf: Ürün Izgarası */}
                <div className="flex-1 flex flex-col gap-4">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Ürün adı veya barkod okutun..."
                                className="pl-9 h-12 text-lg shadow-sm"
                                autoFocus
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {/* Price Mode Toggle */}
                        <Button
                            variant={priceMode === 'WHOLESALE' ? "destructive" : "secondary"}
                            onClick={() => setPriceMode(prev => prev === 'RETAIL' ? 'WHOLESALE' : 'RETAIL')}
                            className="h-12 w-32 font-bold"
                        >
                            {priceMode === 'RETAIL' ? 'Perakende' : 'Toptan'}
                        </Button>
                        <Button variant="outline" size="icon" className="h-12 w-12" onClick={fetchProducts}>
                            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 p-1">
                        {loading ? (
                            <div className="col-span-full flex justify-center items-center py-20">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : filteredProducts.map((product) => {
                            const itemPrice = priceMode === 'WHOLESALE' && product.wholesale_price ? product.wholesale_price : product.price;
                            return (
                                <Card
                                    key={product.id}
                                    className={cn(
                                        "cursor-pointer hover:border-primary transition-all active:scale-95 flex flex-col justify-between shadow-sm hover:shadow-md",
                                        product.current_stock <= 0 && "opacity-60 grayscale pointer-events-none"
                                    )}
                                    onClick={() => product.current_stock > 0 && addToCart(product)}
                                >
                                    <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                                        <div className="h-24 w-full flex items-center justify-center mb-2 overflow-hidden rounded-md bg-slate-50">
                                            {product.image_path ? (
                                                <img
                                                    src={product.image_path}
                                                    alt={product.name}
                                                    className="w-full h-full object-contain"
                                                />
                                            ) : (
                                                <div className="text-4xl">📦</div>
                                            )}
                                        </div>
                                        <h3 className="font-semibold line-clamp-2 text-primary">{product.name}</h3>
                                        <div className="text-xs text-muted-foreground">Stok: {product.current_stock}</div>
                                        <div className={cn(
                                            "mt-auto font-bold text-lg px-3 py-1 rounded-full",
                                            priceMode === 'WHOLESALE' ? "text-blue-700 bg-blue-100" : "text-secondary-foreground bg-secondary/20"
                                        )}>
                                            {priceMode === 'WHOLESALE' && product.wholesale_price
                                                ? itemPrice.toFixed(2)
                                                : product.price.toFixed(2)} ₺
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                        {!loading && filteredProducts.length === 0 && (
                            <div className="col-span-full text-center text-muted-foreground py-10 flex flex-col items-center gap-2">
                                <Package className="w-10 h-10 opacity-20" />
                                <p>Ürün bulunamadı.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sağ Taraf: Sepet */}
                <div className="w-full lg:w-96 bg-white border rounded-lg shadow-lg flex flex-col border-primary/10">
                    <div className="p-4 border-b bg-slate-50 rounded-t-lg space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="font-semibold text-lg flex items-center gap-2 text-primary">
                                <ShoppingCart className="w-5 h-5" />
                                Sepet
                            </h2>
                            {currentSession && (
                                <div className="text-xs text-right text-muted-foreground">
                                    <div className="font-bold">{currentSession.registers?.name}</div>
                                    <div>#OTR-{currentSession.id.slice(0, 4)}</div>
                                </div>
                            )}
                        </div>

                        {/* Session Actions */}
                        {currentSession && (
                            <div className="grid grid-cols-2 gap-2">
                                <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setIsExpenseOpen(true)}>
                                    Gider Gir
                                </Button>
                                <Button variant="secondary" size="sm" onClick={handlePreCloseSession}>
                                    Kasayı Kapat
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50 gap-2">
                                <ShoppingCart className="w-12 h-12" />
                                <p>Sepet boş</p>
                            </div>
                        ) : (
                            cart.map((item) => (
                                <div key={item.product.id} className="flex items-center justify-between p-2 border rounded-md bg-slate-50 group">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate text-primary">{item.product.name}</p>
                                        <div className="flex items-center gap-1">
                                            <p className="text-xs text-muted-foreground">
                                                {(item.unitPrice || item.product.price).toFixed(2)} ₺ x {item.quantity}
                                            </p>
                                            {item.product.wholesale_price && item.unitPrice === item.product.wholesale_price && (
                                                <span className="text-[10px] bg-blue-100 text-blue-800 px-1 rounded">TOPTAN</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => removeFromCart(item.product.id)}
                                        >
                                            <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => addToCart(item.product)}
                                        >
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => deleteFromCart(item.product.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-4 border-t bg-slate-50 rounded-b-lg space-y-4">
                        <div className="flex justify-between items-center text-2xl font-bold text-primary">
                            <span>Toplam:</span>
                            <span>{totalAmount.toFixed(2)} ₺</span>
                        </div>

                        <div className="mb-4">
                            <label className="text-sm font-medium block mb-1">Müşteri Seçimi {loyaltySettings?.is_active && <span className="text-yellow-600 font-bold text-xs ml-2">(Puan Kazanır)</span>}</label>
                            <select
                                className="w-full border p-2 rounded bg-white"
                                value={selectedCustomer}
                                onChange={(e) => setSelectedCustomer(e.target.value)}
                            >
                                <option value="">Genel Müşteri</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.full_name} (Bakiye: {c.balance || 0}₺)</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <Button
                                size="lg"
                                className="w-full gap-1 bg-green-600 hover:bg-green-700 text-white px-2"
                                disabled={cart.length === 0 || processing}
                                onClick={() => completeSale('CASH')}
                            >
                                <Banknote className="w-5 h-5" />
                                Nakit
                            </Button>
                            <Button
                                size="lg"
                                className="w-full gap-1 bg-blue-600 hover:bg-blue-700 text-white px-2"
                                disabled={cart.length === 0 || processing}
                                onClick={() => completeSale('CARD')}
                            >
                                <CreditCard className="w-5 h-5" />
                                Kart
                            </Button>
                            <Button
                                size="lg"
                                className="w-full gap-1 bg-orange-600 hover:bg-orange-700 text-white px-2"
                                disabled={cart.length === 0 || processing || !selectedCustomer}
                                onClick={() => completeSale('ON_CREDIT')}
                                title={!selectedCustomer ? "Önce müşteri seçiniz" : "Veresiye Satış"}
                            >
                                <Users className="w-5 h-5" />
                                Veresiye
                            </Button>
                        </div>
                    </div>
                </div>

            </div>
        </MainLayout>
    );
}
