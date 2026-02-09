import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "DRN Satış Yazılımı",
    description: "Yerel Mağaza Yönetim Sistemi",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="tr">
            <body className={inter.className} suppressHydrationWarning={true}>{children}</body>
        </html>
    );
}
