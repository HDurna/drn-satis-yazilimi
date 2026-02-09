'use client';

import { usePathname } from "next/navigation";
import NextLink from "next/link";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    ShoppingCart,
    Package,
    Users,
    Settings,
    LogOut,
    Shield,
    TrendingUp,
    ShieldAlert,
    ClipboardList,
    ArrowRightLeft,
    Warehouse,
    ChevronDown,
    ChevronRight,
    Search
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MODULES, AppModule } from "@/lib/modules";

export default function MainLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [userRole, setUserRole] = useState<string>("loading...");
    const [openGroups, setOpenGroups] = useState<string[]>(['depo']); // Default open
    const [enabledModules, setEnabledModules] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    // Toggle group logic
    const toggleGroup = (group: string) => {
        setOpenGroups(prev =>
            prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
        );
    };

    useEffect(() => {
        const fetchUserAndModules = async () => {
            // 1. Fetch User Role
            const cachedRole = sessionStorage.getItem("user_role");
            if (cachedRole) {
                setUserRole(cachedRole);
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setUserRole("Giriş Yapılmadı");
                sessionStorage.removeItem("user_role");
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            const role = profile?.role || "Bilinmiyor";
            setUserRole(role);
            sessionStorage.setItem("user_role", role);

            // 2. Fetch Module States
            const { data: modules } = await supabase
                .from('module_states')
                .select('module_key, is_enabled');

            if (modules) {
                // Sadece veritabanında açık olanlar + Varsayılan olarak açık olması gerekenler (örn: dashboard)
                const activeKeys = modules.filter(m => m.is_enabled).map(m => m.module_key);
                // Eğer veritabanında kayıt yoksa (ilk kurulum), hepsini açık varsayalım ya da varsayılanları
                if (activeKeys.length > 0) {
                    setEnabledModules(activeKeys);
                } else {
                    // Fallback: DB boşsa varsayılan modül config'indeki isEnabled flag'ini kullan
                    setEnabledModules(Object.values(MODULES).filter(m => m.isEnabled).map(m => m.id));
                }
            }
            setLoading(false);
        };
        fetchUserAndModules();
    }, []);

    // Navigation Structure (Dynamic)
    const navigation = (Object.values(MODULES) as AppModule[])
        // Filter by Enabled Modules (DB State has priority)
        .filter(m => enabledModules.includes(m.id))
        // Filter by Role
        .filter(m => (!m.roleAccess || m.roleAccess.length === 0) || (userRole !== 'loading...' && m.roleAccess.includes(userRole as any)))
        .map(m => ({
            href: m.path || '#',
            label: m.name,
            icon: m.icon,
            group: m.id,
            children: m.subItems?.map(sub => ({
                href: sub.path,
                label: sub.name,
            }))
        }));

    // 3. Current Module Check Logic
    const currentModule = (Object.values(MODULES) as AppModule[]).find(m =>
        // Tam eşleşme veya alt yol eşleşmesi (örn: /settings/license)
        pathname === m.path || (m.path && m.path !== '/' && pathname.startsWith(m.path))
    );

    // İstisna Sayfalar (Her zaman erişilebilir)
    const alwaysAllowedPaths = ['/', '/settings/license'];
    const isAlwaysAllowed = alwaysAllowedPaths.includes(pathname);

    // Erişim İzni Kontrolü
    const hasAccess = (() => {
        if (loading) return true; // Yüklenirken engelleme
        if (isAlwaysAllowed) return true;
        if (!currentModule) return true; // Modül sisteminde tanımlı değilse (örn: 404) serbest bırak

        // 1. Yazılım Lisans Kontrolü
        const isModuleEnabled = enabledModules.includes(currentModule.id);
        if (!isModuleEnabled) return false;

        // 2. Kullanıcı Rolü Kontrolü
        if (currentModule.roleAccess && currentModule.roleAccess.length > 0) {
            if (userRole === 'loading...') return true;
            if (!currentModule.roleAccess.includes(userRole as any)) return false;
        }

        return true;
    })();

    if (!hasAccess && !loading) {
        return (
            <div className="flex h-screen w-full bg-slate-50 items-center justify-center p-4">
                <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 text-center space-y-6 border border-slate-100">
                    <div className="mx-auto w-20 h-20 bg-red-50 rounded-full flex items-center justify-center">
                        <ShieldAlert className="w-10 h-10 text-red-500" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Erişim Engellendi</h2>
                        <p className="text-slate-500 mt-2">
                            Bu modüle ({currentModule?.name}) erişmek için geçerli bir lisansınız bulunmuyor veya bu modül pasif durumda.
                        </p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg text-sm text-left border">
                        <div className="font-semibold mb-1">Ne yapabilirsiniz?</div>
                        <ul className="list-disc list-inside space-y-1 text-slate-600">
                            <li>Yöneticinizden yetki isteyin.</li>
                            <li>Modül Mağazası'ndan lisans anahtarı girin.</li>
                        </ul>
                    </div>
                    <div className="flex gap-3">
                        <NextLink href="/" className="flex-1">
                            <button className="w-full py-2.5 rounded-lg border hover:bg-slate-50 font-medium transition-colors">
                                Ana Sayfa
                            </button>
                        </NextLink>
                        <NextLink href="/settings/license" className="flex-1">
                            <button className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors">
                                Modülü Aktifleştir
                            </button>
                        </NextLink>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full bg-slate-50">
            {/* Sidebar - Dark Navy Style */}
            <aside className="w-64 bg-primary text-primary-foreground flex flex-col hidden md:flex shadow-xl">
                <div className="p-6 border-b border-primary-foreground/10 flex items-center gap-2">
                    <div className="bg-white p-1.5 rounded-full">
                        <Shield className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">DRN Satış Yazılımı</h1>
                        <p className="text-xs text-primary-foreground/60">POS v1.1</p>
                    </div>
                </div>

                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                    {navigation.map((item, index) => {
                        if (item.children) {
                            // Render Group (Accordion)
                            const isOpen = openGroups.includes(item.group!);
                            const isActiveGroup = item.children.some(child => pathname.startsWith(child.href));

                            return (
                                <Collapsible
                                    key={index}
                                    open={isOpen}
                                    onOpenChange={() => toggleGroup(item.group!)}
                                    className="space-y-1"
                                >
                                    <CollapsibleTrigger asChild>
                                        <button className={cn(
                                            "flex items-center justify-between w-full px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                                            isActiveGroup ? "bg-white/10 text-white" : "text-primary-foreground/80 hover:bg-white/5 hover:text-white"
                                        )}>
                                            <div className="flex items-center gap-3">
                                                <item.icon className="w-5 h-5" />
                                                {item.label}
                                            </div>
                                            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                        </button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="space-y-1 px-2 border-l border-white/10 ml-4">
                                        {item.children.map(child => {
                                            const isChildActive = pathname === child.href;
                                            return (
                                                <NextLink
                                                    key={child.href}
                                                    href={child.href}
                                                    className={cn(
                                                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                                                        isChildActive
                                                            ? "bg-white text-primary shadow-sm font-bold"
                                                            : "text-primary-foreground/70 hover:text-white"
                                                    )}
                                                >
                                                    {/* <child.icon className="w-4 h-4 opacity-70" /> */}
                                                    {child.label}
                                                </NextLink>
                                            )
                                        })}
                                    </CollapsibleContent>
                                </Collapsible>
                            );
                        }

                        // Regular Link
                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                            <NextLink
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-white text-primary shadow-md font-bold"
                                        : "text-primary-foreground/80 hover:bg-white/10 hover:text-white"
                                )}
                            >
                                <Icon className="w-5 h-5" />
                                {item.label}
                            </NextLink>
                        );
                    })}

                    {/* Denetim Kayıtları - Sadece Admin ve Yüklendiğinde */}
                    {enabledModules.length > 0 && (userRole === 'admin' || userRole === 'store_manager') && (
                        <NextLink
                            href="/reports/audit"
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200",
                                pathname === "/reports/audit"
                                    ? "bg-white text-primary shadow-md font-bold"
                                    : "text-primary-foreground/80 hover:bg-white/10 hover:text-white"
                            )}
                        >
                            <ShieldAlert className="w-5 h-5" />
                            Denetim Kayıtları
                        </NextLink>
                    )}
                </nav>

                <div className="p-4 border-t border-primary-foreground/10 bg-primary-foreground/5">
                    {/* Display user role */}
                    <div className="mb-4">
                        <div className="text-xs text-primary-foreground/60 uppercase font-bold mb-1">Yetki Durumu</div>
                        <div className="text-sm font-medium text-yellow-300 bg-primary-foreground/10 p-2 rounded text-center uppercase tracking-wider shadow-inner">
                            {userRole === 'admin' ? 'YÖNETİCİ' :
                                userRole === 'store_manager' ? 'MÜDÜR' :
                                    userRole === 'cashier' ? 'KASİYER' : userRole}
                        </div>
                    </div>
                    <button className="flex items-center gap-3 px-3 py-3 w-full text-sm font-medium text-red-200 hover:bg-red-900/20 hover:text-red-100 rounded-md transition-colors">
                        <LogOut className="w-5 h-5" />
                        Çıkış Yap
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">

                {/* Mobile Header */}
                <header className="md:hidden h-16 bg-primary text-primary-foreground flex items-center px-4 shadow sticky top-0 z-50">
                    <Shield className="w-6 h-6 mr-2" />
                    <span className="font-bold text-lg">DRN Satış Yazılımı</span>
                </header>

                {/* Scrollable Area */}
                <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
