'use client';

import { useState, useEffect } from "react";
import MainLayout from "@/components/main-layout";
import { supabase, DatabaseAuditLog } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert, RotateCcw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<DatabaseAuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [restoring, setRestoring] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchLogs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error(error);
            // alert("Yetkiniz yok veya hata oluştu."); // Kullanıcıyı rahatsız etmemek için loga yaz
        } else if (data) {
            setLogs(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const handleRestore = async (log: DatabaseAuditLog) => {
        if (!confirm("Bu kaydı geri almak istediğinize emin misiniz?")) return;
        setRestoring(log.id.toString());

        if (log.action === 'SOFT_DELETE' && log.table_name === 'products') {
            // Restore Product
            const { error } = await supabase
                .from('products')
                .update({ deleted_at: null })
                .eq('id', log.record_id);

            if (error) {
                alert("Geri alma hatası: " + error.message);
            } else {
                // Log the restore action
                await supabase.from('audit_logs').insert({
                    user_id: (await supabase.auth.getUser()).data.user?.id,
                    action: 'RESTORE',
                    table_name: 'products',
                    record_id: log.record_id,
                    details: `Geri alındı: Referans Log #${log.id}`
                });
                alert("Ürün başarıyla geri yüklendi(Aktif).");
                fetchLogs();
            }
        } else {
            alert("Bu işlem türü için otomatik geri alma henüz desteklenmiyor.");
        }
        setRestoring(null);
    };

    const filteredLogs = logs.filter(log =>
        log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <MainLayout>
            <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 text-red-700">
                            <ShieldAlert className="w-8 h-8" />
                            Denetim Kayıtları
                        </h1>
                        <p className="text-muted-foreground">Kritik işlemleri izleme ve geri alma paneli (Sadece Admin).</p>
                    </div>
                    <Button variant="outline" onClick={fetchLogs} disabled={loading}>
                        <RotateCcw className="w-4 h-4 mr-2" /> Yenile
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Kayıt Ara..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b">
                                    <tr>
                                        <th className="p-4">Tarih</th>
                                        <th className="p-4">İşlem</th>
                                        <th className="p-4">Detay</th>
                                        <th className="p-4">Kullanıcı ID</th>
                                        <th className="p-4 text-right">Aksiyon</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="animate-spin w-6 h-6 mx-auto" /></td></tr>
                                    ) : filteredLogs.length === 0 ? (
                                        <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Kayıt Bulunamadı.</td></tr>
                                    ) : (
                                        filteredLogs.map((log) => (
                                            <tr key={log.id} className="border-b last:border-0 hover:bg-slate-50">
                                                <td className="p-4 text-muted-foreground whitespace-nowrap">
                                                    {new Date(log.created_at).toLocaleString('tr-TR')}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold 
                                                        ${log.action === 'SOFT_DELETE' ? 'bg-red-100 text-red-800' :
                                                            log.action === 'RESTORE' ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td className="p-4 max-w-xs truncate" title={log.details || ""}>{log.details}</td>
                                                <td className="p-4 font-mono text-xs text-muted-foreground">{log.user_id.split('-')[0]}...</td>
                                                <td className="p-4 text-right">
                                                    {log.action === 'SOFT_DELETE' && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleRestore(log)}
                                                            disabled={restoring === log.id.toString()}
                                                        >
                                                            {restoring === log.id.toString() ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                                                            Geri Al
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
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
