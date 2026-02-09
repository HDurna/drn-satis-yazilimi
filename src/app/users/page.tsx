'use client';

import { useState, useEffect, useActionState } from "react";
// @ts-ignore
import { useFormStatus } from "react-dom";
import MainLayout from "@/components/main-layout";
import { supabase, DatabaseProfile } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Users, Shield, Loader2, Plus, Edit, Trash2 } from "lucide-react";
import { createUser, updateUser, deleteUser } from "@/app/actions/user-actions";

const initialState: any = {
    message: "",
    error: "",
    success: false
}

function SubmitButton({ label = "Kaydet" }: { label?: string }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {label}
        </Button>
    );
}

export default function UsersPage() {
    const [profiles, setProfiles] = useState<DatabaseProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserRole, setCurrentUserRole] = useState<string>("");

    // Add State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [addState, addAction] = useActionState(createUser, initialState);

    // Edit State
    const [editingUser, setEditingUser] = useState<DatabaseProfile | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editState, editAction] = useActionState(updateUser, initialState);

    // Delete State
    const [deletingUser, setDeletingUser] = useState<DatabaseProfile | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [deleteState, deleteAction] = useActionState(deleteUser, initialState);

    const fetchProfiles = async () => {
        setLoading(true);
        const { data } = await supabase.from('profiles').select('*').order('created_at');
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const myself = data?.find(p => p.id === user.id);
            if (myself) setCurrentUserRole(myself.role);
        }

        if (data) setProfiles(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchProfiles();
    }, []);

    // Handle Action Responses
    useEffect(() => {
        if (addState?.success) {
            setIsAddOpen(false);
            fetchProfiles();
            alert(addState.message);
        } else if (addState?.error) alert("Hata: " + addState.error);
    }, [addState]);

    useEffect(() => {
        if (editState?.success) {
            setIsEditOpen(false);
            setEditingUser(null);
            fetchProfiles();
            alert(editState.message);
        } else if (editState?.error) alert("Hata: " + editState.error);
    }, [editState]);

    useEffect(() => {
        if (deleteState?.success) {
            setIsDeleteOpen(false);
            setDeletingUser(null);
            fetchProfiles();
            alert(deleteState.message);
        } else if (deleteState?.error) alert("Hata: " + deleteState.error);
    }, [deleteState]);

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-primary">Kullanıcılar</h1>
                        <p className="text-muted-foreground">Sistemdeki yetkili personeller.</p>
                    </div>

                    {/* ADD DIALOG */}
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <Plus className="w-4 h-4" /> Personel Ekle
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Yeni Personel Ekle</DialogTitle>
                            </DialogHeader>
                            <form action={addAction} className="space-y-4 py-4">
                                <div className="grid gap-2">
                                    <Label>Ad Soyad</Label>
                                    <Input name="fullName" required placeholder="Ad Soyad" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>E-posta</Label>
                                    <Input name="email" type="email" required placeholder="email@ornek.com" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Şifre</Label>
                                    <Input name="password" type="text" required placeholder="******" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Yetki</Label>
                                    <Select name="role" defaultValue="cashier">
                                        <SelectTrigger><SelectValue placeholder="Rol Seçin" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="admin">Yönetici</SelectItem>
                                            <SelectItem value="store_manager">Müdür</SelectItem>
                                            <SelectItem value="cashier">Kasiyer</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <DialogFooter><SubmitButton label="Ekle" /></DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* USER LIST */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-primary" />
                            Personel Listesi
                        </CardTitle>
                        <CardDescription>Toplam {profiles.length} kullanıcı.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? <Loader2 className="animate-spin" /> : (
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-slate-50">
                                    <tr>
                                        <th className="px-6 py-3">Ad Soyad</th>
                                        <th className="px-6 py-3">Rol</th>
                                        <th className="px-6 py-3 text-right">İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {profiles.map((profile) => (
                                        <tr key={profile.id} className="bg-white border-b hover:bg-slate-50">
                                            <td className="px-6 py-4 font-medium">{profile.full_name}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${profile.role === 'admin' ? 'bg-red-100 text-red-800' :
                                                    profile.role === 'store_manager' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-green-100 text-green-800'
                                                    }`}>
                                                    {profile.role.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                <Button variant="ghost" size="icon"
                                                    disabled={currentUserRole === 'store_manager' && profile.role === 'admin'}
                                                    onClick={() => {
                                                        setEditingUser(profile);
                                                        setIsEditOpen(true);
                                                    }}>
                                                    <Edit className="w-4 h-4 text-blue-600" />
                                                </Button>
                                                <Button variant="ghost" size="icon"
                                                    disabled={currentUserRole === 'store_manager' && profile.role === 'admin'}
                                                    onClick={() => {
                                                        setDeletingUser(profile);
                                                        setIsDeleteOpen(true);
                                                    }}>
                                                    <Trash2 className="w-4 h-4 text-red-600" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </CardContent>
                </Card>

                {/* EDIT DIALOG */}
                {editingUser && (
                    <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Kullanıcı Düzenle</DialogTitle>
                                <DialogDescription>Kullanıcı e-posta veya yetkisini değiştirin.</DialogDescription>
                            </DialogHeader>
                            <form action={editAction} className="space-y-4">
                                <input type="hidden" name="userId" value={editingUser.id} />
                                <div className="grid gap-2">
                                    <Label>Ad Soyad</Label>
                                    <Input name="fullName" defaultValue={editingUser.full_name || ""} required />
                                </div>
                                <div className="grid gap-2">
                                    <Label>E-posta (Değiştirmek için yazın)</Label>
                                    <Input name="email" type="email" placeholder="Yeni e-posta (opsiyonel)" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Şifre (Değiştirmek için yazın)</Label>
                                    <Input name="password" type="text" placeholder="Yeni şifre (opsiyonel)" />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Yetki</Label>
                                    <Select name="role" defaultValue={editingUser.role}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="admin">Yönetici</SelectItem>
                                            <SelectItem value="store_manager">Müdür</SelectItem>
                                            <SelectItem value="cashier">Kasiyer</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <DialogFooter><SubmitButton label="Güncelle" /></DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}

                {/* DELETE DIALOG */}
                {deletingUser && (
                    <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Kullanıcıyı Sil</DialogTitle>
                                <DialogDescription>
                                    <b>{deletingUser.full_name}</b> kullanıcısını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                                </DialogDescription>
                            </DialogHeader>
                            <form action={deleteAction}>
                                <input type="hidden" name="userId" value={deletingUser.id} />
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>İptal</Button>
                                    <SubmitButton label="Evet, Sil" />
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>
        </MainLayout>
    );
}
