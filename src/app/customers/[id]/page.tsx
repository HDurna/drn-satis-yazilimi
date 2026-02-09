'use client';

import { useState, useEffect } from "react";
import MainLayout from "@/components/main-layout";
import { supabase, DatabaseCustomer } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Wallet, Calendar, Plus, ShoppingBag, CreditCard } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

// Transaction Tipi
type Transaction = {
    id: string;
    amount: number;
    payment_method: string;
    items: any; // JSONB
    created_at: string;
    notes?: string;
};

export default function CustomerDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [customer, setCustomer] = useState<DatabaseCustomer | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    // Payment Modal
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState("");
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            if (!params.id) return;
            setLoading(true);

            // 1. Müşteri Bilgisi
            const { data: custData } = await supabase
                .from('customers')
                .select('*')
                .eq('id', params.id)
                .single();

            if (custData) {
                setCustomer(custData);

                // 2. Hareketleri Çek (Transactions)
                const { data: transData } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('customer_id', params.id)
                    .order('created_at', { ascending: false });

                if (transData) setTransactions(transData);
            }
            setLoading(false);
        };
        fetchData();
    }, [params.id]);

    const handlePayment = async () => {
        if (!customer) return;
        const amount = parseFloat(paymentAmount);
        if (isNaN(amount) || amount <= 0) {
            alert("Geçerli bir tutar giriniz.");
            return;
        }

        setProcessing(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            alert("Oturum hatası.");
            setProcessing(false);
            return;
        }

        // 1. Transaction Kaydı (Ödeme/Tahsilat)
        // Tahsilat yaptığımız için 'PAYMENT' veya 'COLLECTION' diyebiliriz.
        // payment_method: 'CASH' (Varsayılan nakit tahsilat)
        // amount: Tahsilat olduğu için borç düşmeli -> Eksi bakiye etkisi yaratmalı ama işlem pozitiftir, trigger veya logic bunu yönetir.
        // !!! Trigger sadece ON_CREDIT (borçlanma) işlemlerinde bakiyeyi artırır.
        // Tahsilat için bakiyeyi MANUEL düşmeliyiz.

        const { error: transError } = await supabase.from('transactions').insert({
            user_id: user.id,
            customer_id: customer.id,
            amount: amount, // Tahsil edilen tutar
            payment_method: 'COLLECTION', // Tahsilat
            notes: 'Nakit Tahsilat',
            items: []
        });

        if (transError) {
            alert("Kayıt hatası: " + transError.message);
            setProcessing(false);
            return;
        }

        // 2. Müşteri Bakiyesini Düş
        const newBalance = customer.balance - amount;
        const { error } = await supabase
            .from('customers')
            .update({ balance: newBalance })
            .eq('id', customer.id);

        if (error) {
            alert("Bakiye güncelleme hatası: " + error.message);
        } else {
            alert("Tahsilat başarıyla kaydedildi.");
            setCustomer({ ...customer, balance: newBalance });
            // Listeyi yenilemek yerine manuel ekleyelim veya reload yapalım
            window.location.reload();
        }
        setProcessing(false);
    };

    if (loading) return <MainLayout><div className="flex justify-center pt-20"><Loader2 className="animate-spin" /></div></MainLayout>;
    if (!customer) return <MainLayout><div className="text-center pt-20">Müşteri bulunamadı.</div></MainLayout>;

    return (
        <MainLayout>
            <div className="flex flex-col gap-6 max-w-5xl mx-auto p-4">
                <Button variant="ghost" className="w-fit pl-0" onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Geri Dön
                </Button>

                {/* Başlık ve Bakiye Kartı */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-6 bg-white p-6 rounded-lg border shadow-sm">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">{customer.full_name}</h1>
                        <div className="flex flex-col gap-1 text-slate-500 mt-2">
                            <span className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> ID: #{customer.id}</span>
                            <span>{customer.phone || "Telefon yok"}</span>
                            <span>{customer.address || "Adres yok"}</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-3 min-w-[200px]">
                        <div className="text-right">
                            <div className="text-sm text-slate-500 font-medium uppercase tracking-wide">Güncel Bakiye</div>
                            <div className={`text-4xl font-bold ${customer.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {customer.balance.toFixed(2)} ₺
                            </div>
                            <div className="text-xs text-slate-400 mt-1 font-medium">
                                {customer.balance > 0 ? "ÖDEMESİ GEREKEN" : "ALACAKLI / NÖTR"}
                            </div>
                        </div>
                        <Button className="w-full bg-green-600 hover:bg-green-700 shadow-sm" onClick={() => setIsPaymentOpen(true)}>
                            <Wallet className="w-4 h-4 mr-2" />
                            Tahsilat Yap
                        </Button>
                    </div>
                </div>

                {/* Hareket Tablosu */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader className="bg-slate-50 border-b">
                        <CardTitle className="text-lg flex items-center gap-2 text-slate-700">
                            <ShoppingBag className="w-5 h-5" />
                            Hesap Hareketleri
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {transactions.length === 0 ? (
                            <div className="text-center text-slate-400 py-12">
                                Henüz işlem kaydı bulunmuyor.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                                        <tr>
                                            <th className="p-4 w-40">Tarih</th>
                                            <th className="p-4 w-32">İşlem Tipi</th>
                                            <th className="p-4">Detay / Ürünler</th>
                                            <th className="p-4 text-right w-32">Tutar</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {transactions.map((tx) => (
                                            <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4 text-slate-600 whitespace-nowrap">
                                                    <div className="font-medium">{new Date(tx.created_at).toLocaleDateString("tr-TR")}</div>
                                                    <div className="text-xs text-slate-400">{new Date(tx.created_at).toLocaleTimeString("tr-TR", { hour: '2-digit', minute: '2-digit' })}</div>
                                                </td>
                                                <td className="p-4">
                                                    {tx.payment_method === 'ON_CREDIT' ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                            Veresiye Satış
                                                        </span>
                                                    ) : tx.payment_method === 'COLLECTION' ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            Tahsilat
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                                            {tx.payment_method}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {tx.items && Array.isArray(tx.items) && tx.items.length > 0 ? (
                                                        <div className="space-y-1">
                                                            {tx.items.map((item: any, idx: number) => (
                                                                <div key={idx} className="flex justify-between text-xs max-w-md border-b border-dashed border-slate-200 last:border-0 pb-1 last:pb-0">
                                                                    <span className="text-slate-700 font-medium">{item.product?.name}</span>
                                                                    <span className="text-slate-500">
                                                                        {item.quantity} x {(item.unitPrice || item.product?.price)?.toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-400 italic">{tx.notes || '-'}</span>
                                                    )}
                                                </td>
                                                <td className={`p-4 text-right font-bold ${tx.payment_method === 'COLLECTION' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {tx.payment_method === 'COLLECTION' ? '-' : '+'}{tx.amount.toFixed(2)} ₺
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Tahsilat Modal */}
                <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Tahsilat Al</DialogTitle>
                        </DialogHeader>
                        <div className="py-4">
                            <div className="bg-slate-50 p-4 rounded mb-4 border border-slate-100">
                                <div className="text-sm text-slate-500">Müşteri</div>
                                <div className="font-bold text-slate-800">{customer.full_name}</div>
                                <div className="text-sm text-slate-500 mt-2">Güncel Borç</div>
                                <div className="text-xl font-bold text-red-600">{customer.balance.toFixed(2)} ₺</div>
                            </div>

                            <div className="grid gap-2">
                                <Label>Tahsil Edilen Tutar (₺)</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={paymentAmount}
                                    onChange={e => setPaymentAmount(e.target.value)}
                                    placeholder="0.00"
                                    autoFocus
                                    className="text-lg font-bold"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsPaymentOpen(false)}>İptal</Button>
                            <Button onClick={handlePayment} disabled={processing} className="bg-green-600 hover:bg-green-700 text-white">
                                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Tahsilat Kaydet
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

            </div>
        </MainLayout>
    );
}
