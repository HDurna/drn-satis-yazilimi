import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// MODÜL TANIMLARI VE YOL EŞLEŞTİRMELERİ
const MODULE_PATHS: Record<string, string> = {
    '/pos': 'pos',
    '/inventory': 'inventory', // stock yerine inventory ID'si kullanılıyor modules.ts'de
    '/stock': 'inventory',
    '/stock-count': 'stockCount',
    '/reports': 'reports',
    '/users': 'users',
    '/expenses': 'expenses',
    '/loyalty': 'loyalty',
    '/labels': 'labelPrinting',
    '/warehouses': 'multiBranch',
    '/settings': 'settings'
};

const GRACE_PERIOD_DAYS = 3;

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({ name, value, ...options });
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    response.cookies.set({ name, value, ...options });
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({ name, value: '', ...options });
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    response.cookies.set({ name, value: '', ...options });
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user && request.nextUrl.pathname !== '/login' && request.nextUrl.pathname !== '/auth/callback') {
        // Login kontrolü (Sayfa tasarımı olmadığı için pas geçiyoruz şimdilik)
    }

    const path = request.nextUrl.pathname;

    // Hangi modüle girmeye çalışıyor?
    let targetModuleKey = null;
    // En uzun eşleşmeyi bul (örn: /settings/license, /settings'den önce gelmeli)
    // Ama burada basit prefix kontrolü var.
    for (const [prefix, key] of Object.entries(MODULE_PATHS)) {
        if (path.startsWith(prefix)) {
            targetModuleKey = key;
            break;
        }
    }

    // İstisnalar
    if (path === '/settings/license') return response;

    if (targetModuleKey && user) {
        //console.log(`[Middleware] Checking License for: ${targetModuleKey}`);

        const { data: moduleState } = await supabase
            .from('module_states')
            .select('*')
            .eq('module_key', targetModuleKey)
            .single();

        // Uyarı: Eğer modül veritabanında hiç yoksa, kapalı varsayıyoruz.
        // Ancak bazı temel modüller (settings) trigger ile eklenmemiş olabilir.
        if (targetModuleKey !== 'settings' && (!moduleState || !moduleState.is_enabled)) {
            console.log(`[Middleware] Access Denied: ${targetModuleKey}`);
            const url = request.nextUrl.clone();
            url.pathname = '/settings/license';
            url.searchParams.set('error', 'access_denied');
            url.searchParams.set('module', targetModuleKey);
            return NextResponse.redirect(url);
        }

        if (moduleState?.expires_at) {
            const expiresAt = new Date(moduleState.expires_at);
            const now = new Date();
            expiresAt.setDate(expiresAt.getDate() + GRACE_PERIOD_DAYS);

            if (now > expiresAt) {
                const url = request.nextUrl.clone();
                url.pathname = '/settings/license';
                url.searchParams.set('error', 'license_expired');
                url.searchParams.set('module', targetModuleKey);
                return NextResponse.redirect(url);
            }
        }
    }

    return response;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|assets).*)',
    ],
};
