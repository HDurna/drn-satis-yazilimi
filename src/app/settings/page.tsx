'use client';

import { useState } from "react";
import MainLayout from "@/components/main-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Layers, ArrowRight, Tag } from "lucide-react";
import Link from "next/link";

export default function SettingsPage() {
    return (
        <MainLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold text-primary">Ayarlar</h1>
                    <p className="text-muted-foreground">Sistem yapılandırması ve tanımlamalar.</p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Kategoriler */}
                    <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <Layers className="w-5 h-5 text-blue-600" />
                                Kategoriler
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground mb-4">Ürün kategorilerini tanımlayın ve düzenleyin.</p>
                            <Link href="/settings/categories">
                                <Button variant="outline" className="w-full group-hover:bg-blue-50 group-hover:text-blue-700 group-hover:border-blue-200">
                                    Yönet <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>

                    {/* Hareket Tipleri */}
                    <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-xl font-bold flex items-center gap-2">
                                <Tag className="w-5 h-5 text-green-600" />
                                Hareket Tipleri
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground mb-4">Zayi, iade, promosyon gibi stok hareket nedenleri.</p>
                            <Link href="/settings/movement-types">
                                <Button variant="outline" className="w-full group-hover:bg-green-50 group-hover:text-green-700 group-hover:border-green-200">
                                    Yönet <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>

                    {/* Genel Ayarlar (Placeholder) */}
                    <Card className="opacity-50">
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Settings className="w-5 h-5" />
                                Genel Ayarlar
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground mb-4">Mağaza bilgileri ve genel yapılandırma (Yakında).</p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </MainLayout>
    );
}
