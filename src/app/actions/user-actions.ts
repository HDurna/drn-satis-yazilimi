'use server'

import { createClient } from '@supabase/supabase-js'

const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseServiceKey) {
        throw new Error('Sistem Hatası: SUPABASE_SERVICE_ROLE_KEY bulunamadı.')
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
}

export async function createUser(prevState: any, formData: FormData) {
    try {
        const supabase = getSupabaseAdmin();
        const email = formData.get('email') as string
        const password = formData.get('password') as string
        const fullName = formData.get('fullName') as string
        const role = formData.get('role') as string

        if (!email || !password || !fullName) return { error: 'Lütfen tüm alanları doldurun.' }
        if (password.length < 6) return { error: 'Şifre en az 6 karakter olmalıdır.' }

        const { data: userData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName }
        })

        if (authError) return { error: authError.message }

        if (userData.user && role) {
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ role: role })
                .eq('id', userData.user.id)

            if (profileError) return { error: 'Profil rolü güncellenemedi: ' + profileError.message }
        }

        return { success: true, message: 'Personel başarıyla oluşturuldu.' }
    } catch (e: any) {
        return { error: e.message }
    }
}

export async function deleteUser(prevState: any, formData: FormData) {
    try {
        const supabase = getSupabaseAdmin();
        const userId = formData.get('userId') as string;

        if (!userId) return { error: 'Kullanıcı ID bulunamadı.' };

        // 1. Auth'dan sil (Profiller tablosu CASCADE ile silinebilir veya trigger ile, ama manual silebiliriz)
        // Not: Mevcut FOREIGN KEY relation varsa (Stock Movements gibi) silmek hata verebilir.
        // Bu yüzden soft-delete önerilir ama basitlik için hard-delete deniyoruz.

        const { error } = await supabase.auth.admin.deleteUser(userId);
        if (error) return { error: "Silme Hatası: " + error.message };

        return { success: true, message: 'Kullanıcı silindi.' };
    } catch (e: any) {
        return { error: e.message }
    }
}

export async function updateUser(prevState: any, formData: FormData) {
    try {
        const supabase = getSupabaseAdmin();
        const userId = formData.get('userId') as string;
        const email = formData.get('email') as string;
        const fullName = formData.get('fullName') as string;
        const password = formData.get('password') as string;
        const role = formData.get('role') as string;

        if (!userId) return { error: 'Kullanıcı ID yok.' };

        // 1. Auth Update (Email, Password, Metadata)
        const updateData: any = { user_metadata: { full_name: fullName } };
        if (email) updateData.email = email;
        if (password && password.length >= 6) updateData.password = password;

        const { error: authError } = await supabase.auth.admin.updateUserById(userId, updateData);
        if (authError) return { error: "Auth Güncelleme Hatası: " + authError.message };

        // 2. Profile Update (Role, FullName sync)
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ role: role, full_name: fullName })
            .eq('id', userId);

        if (profileError) return { error: "Profil Güncelleme Hatası: " + profileError.message };

        return { success: true, message: 'Kullanıcı güncellendi.' };

    } catch (e: any) {
        return { error: e.message }
    }
}
