'use client';

import { useState, useEffect } from "react";
import MainLayout from "@/components/main-layout";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tag, Search, Printer, X, AlignLeft, AlignCenter, AlignRight, Type, DollarSign, Calendar, MessageSquare, Briefcase, Minus, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// --- GOOGLE FONTS ---
const GOOGLE_FONTS_LINK = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Courier+Prime&family=Dancing+Script&family=Inter:wght@400;700;900&family=Montserrat:wght@400;700;900&family=Oswald:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Roboto:wght@400;700;900&display=swap";

const FONT_OPTIONS = [
    { id: 'Inter, sans-serif', name: 'Inter (Modern & Temiz)', category: 'Standart' },
    { id: 'Roboto, sans-serif', name: 'Roboto (Standart)', category: 'Standart' },
    { id: 'Montserrat, sans-serif', name: 'Montserrat (Geometrik)', category: 'Modern' },
    { id: 'Oswald, sans-serif', name: 'Oswald (Fiyat Odaklı)', category: 'Dikkat Çekici' },
    { id: 'Bebas Neue, sans-serif', name: 'Bebas Neue (Sadece Büyük)', category: 'Dikkat Çekici' },
    { id: 'Playfair Display, serif', name: 'Playfair (Butik & Şık)', category: 'Klasik' },
    { id: 'Courier Prime, monospace', name: 'Courier (Retro/Daktilo)', category: 'Retro' },
    { id: 'Dancing Script, cursive', name: 'Dancing Script (El Yazısı)', category: 'Artisan' },
];

// --- LABEL TEMPLATES ---
type LabelTemplate = {
    id: string; name: string; rows: number; cols: number;
    width: string; height: string; gapX: string; gapY: string;
    paddingTop: string; paddingLeft: string; description: string;
};

const LABEL_TEMPLATES: Record<string, LabelTemplate> = {
    // KULLANICININ FOTOĞRAFINDAKİ ÖZEL TW-2208
    'TW-2208': {
        id: 'TW-2208',
        name: 'Tanex TW-2208 (105 x 70 mm)',
        rows: 4,
        cols: 2,
        width: '105mm',
        height: '70mm',
        gapX: '0mm',
        gapY: '0mm',
        paddingTop: '8.5mm', // 297 - (70*4) = 17mm. 17/2 = 8.5mm. Tam ortalar.
        paddingLeft: '0mm',
        description: 'Özel Kutu (8 Adet)'
    },
    'TW-2020': { id: 'TW-2020', name: 'Tanex TW-2020 (105 x 74 mm)', rows: 4, cols: 2, width: '105mm', height: '74mm', gapX: '0mm', gapY: '0mm', paddingTop: '0mm', paddingLeft: '0mm', description: 'A4 Yarısı Yatay (8 Adet)' },
    'TW-2008': { id: 'TW-2008', name: 'Tanex TW-2008 (99.1 x 67.7 mm)', rows: 4, cols: 2, width: '99.1mm', height: '67.7mm', gapX: '2.5mm', gapY: '0mm', paddingTop: '13mm', paddingLeft: '4.5mm', description: 'Koli Etiketi (8 Adet)' },
    'TW-2021': { id: 'TW-2021', name: 'Tanex TW-2021 (70 x 42.3 mm)', rows: 7, cols: 3, width: '70mm', height: '42.3mm', gapX: '0mm', gapY: '0mm', paddingTop: '0mm', paddingLeft: '0mm', description: 'Standart Ürün (21 Adet)' },
    'TW-2039': { id: 'TW-2039', name: 'Tanex TW-2039 (52.5 x 29.7 mm)', rows: 10, cols: 4, width: '52.5mm', height: '29.7mm', gapX: '0mm', gapY: '0mm', paddingTop: '0mm', paddingLeft: '0mm', description: 'Minik Etiket (40 Adet)' },
};

export default function LabelPrintingPage() {
    const [products, setProducts] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('TW-2208'); // Default to user's requested template
    const [quantity, setQuantity] = useState(8);
    const [activeTab, setActiveTab] = useState("design");

    // DESIGN STATE
    const [design, setDesign] = useState({
        storeName: "DRN Satış Yazılımı",
        customNote: "",
        fontFamily: 'Inter, sans-serif',
        fontSizeName: 16,
        fontSizePrice: 32,
        textAlign: 'center' as 'left' | 'center' | 'right',
        priceColor: 'black' as 'black' | 'red',
        layoutStyle: 'MODERN' as 'SIMPLE' | 'MODERN' | 'DISCOUNT',
        discountPrice: "",
        showBarcode: true, showStoreName: true, showOrigin: true, showDate: false, showBorder: true, boldName: true
    });

    useEffect(() => {
        const searchProducts = async () => {
            if (searchTerm.length < 2) return;
            const { data } = await supabase.from('products').select('*').ilike('name', `%${searchTerm}%`).limit(10);
            if (data) setProducts(data);
        };
        const timer = setTimeout(searchProducts, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Update Default Quantity based on Template
    useEffect(() => {
        const tmpl = LABEL_TEMPLATES[selectedTemplate];
        setQuantity(tmpl.rows * tmpl.cols);
    }, [selectedTemplate]);

    useEffect(() => {
        if (selectedProduct) setDesign(d => ({ ...d, discountPrice: "" }));
    }, [selectedProduct]);

    const handlePrint = () => window.print();

    // RENDER HELPERS
    const renderLabels = () => {
        if (!selectedProduct) return null;
        const config = LABEL_TEMPLATES[selectedTemplate];

        return (
            <div
                className="grid-container"
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${config.cols}, ${config.width})`,
                    columnGap: config.gapX,
                    rowGap: config.gapY,
                    // Use template's specific padding or fallback to 0
                    paddingTop: config.paddingTop,
                    paddingLeft: config.paddingLeft,
                    width: '210mm',
                    justifyContent: config.paddingLeft === '0mm' ? 'center' : 'start'
                }}
            >
                {Array.from({ length: quantity }).map((_, i) => (
                    <div key={i} className="overflow-hidden">
                        {renderLabelItem(config.width, config.height)}
                    </div>
                ))}
            </div>
        );
    };

    const renderLabelItem = (w: string, h: string) => {
        const isDiscount = design.layoutStyle === 'DISCOUNT' && design.discountPrice;
        const price = isDiscount ? parseFloat(design.discountPrice) : selectedProduct.price;
        const oldPrice = selectedProduct.price;
        const today = new Date().toLocaleDateString('tr-TR');

        return (
            <div
                style={{
                    width: w,
                    height: h,
                    fontFamily: design.fontFamily,
                    textAlign: design.textAlign
                }}
                className={`bg-white text-black box-border relative flex flex-col justify-between overflow-hidden p-3
                    ${design.showBorder ? 'border border-slate-300' : ''}
                `}
            >
                {/* HEADER */}
                <div className="flex-1 relative">
                    {design.showDate && <div className="absolute top-0 right-0 text-[7px] text-slate-400 bg-slate-50 px-1 rounded font-sans">{today}</div>}

                    {design.showStoreName && (
                        <div className={`text-[8px] font-bold text-slate-500 uppercase mb-1 tracking-wider font-sans ${design.textAlign === 'center' ? 'mx-auto' : ''}`}>
                            {design.storeName}
                        </div>
                    )}

                    <h2
                        style={{
                            fontSize: `${design.fontSizeName}px`,
                            fontWeight: design.boldName ? 'bold' : 'normal',
                            lineHeight: '1.2'
                        }}
                        className="leading-tight mb-2 line-clamp-2 break-words"
                    >
                        {selectedProduct.name}
                    </h2>

                    {design.customNote && (
                        <div className="bg-slate-100 inline-block px-2 py-0.5 rounded text-[8px] font-medium text-slate-600 mb-1 font-sans">
                            {design.customNote}
                        </div>
                    )}

                    {design.showBarcode && (
                        <div className={`text-[10px] text-slate-600 mt-1 font-mono tracking-wider ${design.textAlign === 'center' ? 'mx-auto' : ''}`}>
                            {selectedProduct.barcode}
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="mt-2 border-t pt-2 border-black/10 flex flex-col justify-end">
                    {design.showOrigin && <div className="text-[7px] text-slate-400 mb-0.5 font-sans">Yerli Üretim</div>}

                    <div className={`flex items-baseline ${design.textAlign === 'center' ? 'justify-center' : design.textAlign === 'right' ? 'justify-end' : 'justify-start'}`}>
                        {isDiscount && (
                            <span className="text-slate-400 line-through mr-2 text-sm font-bold relative top-[-4px] font-sans">
                                {oldPrice.toFixed(2)} ₺
                            </span>
                        )}
                        <div
                            style={{
                                fontSize: `${design.fontSizePrice}px`,
                                color: design.priceColor
                            }}
                            className="font-black leading-none"
                        >
                            {Math.floor(price)}
                            <span style={{ fontSize: `${design.fontSizePrice * 0.5}px` }} className="align-top ml-0.5 font-bold">
                                .{(price % 1).toFixed(2).split('.')[1]} ₺
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <MainLayout>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link href={GOOGLE_FONTS_LINK} rel="stylesheet" />

            {/* CSS STYLES - Removed fixed paddings, relying on template config */}
            <style jsx global>{`
                @media print {
                    @page { 
                        size: A4; 
                        margin: 0; 
                    }
                    body { visibility: hidden; margin: 0; padding: 0; background: white; }
                    nav, header, footer, aside, .print\\:hidden { display: none !important; }
                    
                    #print-area { 
                        visibility: visible; 
                        position: absolute; 
                        left: 0; 
                        top: 0; 
                        width: 210mm; 
                        min-height: 297mm; 
                        z-index: 9999; 
                        /* Padding is now handled by inline styles from template config */
                    }
                    #print-area * { visibility: visible; }
                }
            `}</style>

            <div className="flex flex-col gap-6 max-w-[1600px] mx-auto p-4">
                <div className="print:hidden flex flex-col gap-4">
                    <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Tag className="w-6 h-6 text-indigo-600" /> Etiket Stüdyosu v5.2</h1>
                            <p className="text-xs text-slate-400">Özel TW-2208 (105x70) Desteği Eklendi.</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setSelectedProduct(null)}><X className="w-4 h-4 mr-2" /> Temizle</Button>
                            <Button onClick={handlePrint} disabled={!selectedProduct} className="bg-indigo-600 hover:bg-indigo-700 shadow"><Printer className="w-4 h-4 mr-2" /> Yazdır</Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* LEFT CONTROLS */}
                        <div className="lg:col-span-4 flex flex-col gap-4 bg-white p-4 rounded-xl border shadow-sm h-[calc(100vh-200px)] overflow-y-auto">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 mb-4">
                                    <TabsTrigger value="settings">1. Ürün & Kağıt</TabsTrigger>
                                    <TabsTrigger value="design">2. Tasarım & Font</TabsTrigger>
                                </TabsList>
                                <TabsContent value="settings" className="space-y-6">
                                    {/* Product & Template Selectors */}
                                    <div className="space-y-3">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">Ürün Seçimi</Label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                            <Input className="pl-9" placeholder="Ürün Ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                            {products.length > 0 && searchTerm.length >= 2 && (
                                                <div className="absolute z-50 w-full bg-white border rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto">
                                                    {products.map(p => (
                                                        <div key={p.id} className="p-3 hover:bg-indigo-50 cursor-pointer border-b text-sm flex justify-between" onClick={() => { setSelectedProduct(p); setSearchTerm(""); setProducts([]); }}><span className="font-medium">{p.name}</span><span className="font-bold text-indigo-600">{p.price} ₺</span></div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        {selectedProduct && <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-sm flex justify-between items-center shadow-sm"><div><div className="font-bold text-indigo-900">{selectedProduct.name}</div><div className="text-xs text-indigo-600">{selectedProduct.barcode}</div></div><div className="text-lg font-bold text-indigo-700">{selectedProduct.price} ₺</div></div>}
                                    </div>
                                    <div className="space-y-3 pt-4 border-t">
                                        <Label className="text-xs font-bold text-slate-500 uppercase">Kağıt Şablonu</Label>
                                        <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>{Object.values(LABEL_TEMPLATES).map(t => <SelectItem key={t.id} value={t.id}><span className="font-medium">{t.name}</span> <span className="text-xs text-slate-400 ml-2">- {t.description}</span></SelectItem>)}</SelectContent>
                                        </Select>
                                        <div className="flex justify-between text-xs text-slate-500 mt-1"><span>{LABEL_TEMPLATES[selectedTemplate].width} x {LABEL_TEMPLATES[selectedTemplate].height}</span><span>Kapasite: {LABEL_TEMPLATES[selectedTemplate].rows * LABEL_TEMPLATES[selectedTemplate].cols} Adet</span></div>
                                    </div>
                                    <div className="space-y-3 pt-4 border-t"><div className="flex justify-between"><Label className="text-xs font-bold text-slate-500 uppercase">Basılacak Adet</Label> <span className="font-mono bg-slate-100 px-2 rounded font-bold text-sm">{quantity}</span></div><Slider value={[quantity]} onValueChange={(val) => setQuantity(val[0])} min={1} max={48} step={1} /></div>
                                </TabsContent>

                                <TabsContent value="design" className="space-y-6">
                                    <div className="space-y-5 bg-indigo-50/50 p-4 rounded-lg border border-indigo-100">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center"><Label className="text-xs font-bold text-indigo-900 flex items-center gap-1"><Type className="w-3 h-3" /> Ürün Boyutu</Label> <span className="text-xs bg-white px-2 py-0.5 rounded border">{design.fontSizeName}px</span></div>
                                            <div className="flex gap-3 items-center"><Button size="icon" variant="outline" className="h-6 w-6" onClick={() => setDesign({ ...design, fontSizeName: Math.max(8, design.fontSizeName - 1) })}> <Minus className="w-3 h-3" /> </Button><Slider value={[design.fontSizeName]} onValueChange={v => setDesign({ ...design, fontSizeName: v[0] })} min={8} max={50} step={1} className="flex-1" /><Button size="icon" variant="outline" className="h-6 w-6" onClick={() => setDesign({ ...design, fontSizeName: Math.min(50, design.fontSizeName + 1) })}> <Plus className="w-3 h-3" /> </Button></div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center"><Label className="text-xs font-bold text-indigo-900 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Fiyat Boyutu</Label> <span className="text-xs bg-white px-2 py-0.5 rounded border">{design.fontSizePrice}px</span></div>
                                            <div className="flex gap-3 items-center"><Button size="icon" variant="outline" className="h-6 w-6" onClick={() => setDesign({ ...design, fontSizePrice: Math.max(10, design.fontSizePrice - 2) })}> <Minus className="w-3 h-3" /> </Button><Slider value={[design.fontSizePrice]} onValueChange={v => setDesign({ ...design, fontSizePrice: v[0] })} min={10} max={100} step={1} className="flex-1" /><Button size="icon" variant="outline" className="h-6 w-6" onClick={() => setDesign({ ...design, fontSizePrice: Math.min(100, design.fontSizePrice + 2) })}> <Plus className="w-3 h-3" /> </Button></div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="space-y-2"><Label className="text-xs font-semibold text-slate-500">Google Font</Label><Select value={design.fontFamily} onValueChange={(v: any) => setDesign({ ...design, fontFamily: v })}><SelectTrigger className="h-10"><SelectValue /></SelectTrigger><SelectContent>{FONT_OPTIONS.map(font => (<SelectItem key={font.id} value={font.id} style={{ fontFamily: font.id }}><span className="text-sm font-medium">{font.name}</span></SelectItem>))}</SelectContent></Select></div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold text-slate-500">Hizalama</Label>
                                            <div className="flex bg-slate-100 p-1 rounded-md">{(['left', 'center', 'right'] as const).map(align => (<Button key={align} variant="ghost" size="sm" className={`flex-1 ${design.textAlign === align ? 'bg-white shadow-sm' : ''}`} onClick={() => setDesign({ ...design, textAlign: align })}>{align === 'left' && <AlignLeft className="w-4 h-4" />}{align === 'center' && <AlignCenter className="w-4 h-4" />}{align === 'right' && <AlignRight className="w-4 h-4" />}</Button>))}</div>
                                        </div>
                                    </div>
                                    <div className="space-y-3 pt-4 border-t"><Label className="text-xs font-semibold text-slate-500 flex items-center gap-1"><MessageSquare className="w-4 h-4" /> Özel Metinler</Label><div className="grid gap-2"><Input placeholder="Özel Not" value={design.customNote} onChange={e => setDesign({ ...design, customNote: e.target.value })} className="h-8 text-xs" /><Input placeholder="Mağaza Adı" value={design.storeName} onChange={e => setDesign({ ...design, storeName: e.target.value })} className="h-8 text-xs" /></div></div>
                                    <div className="space-y-2 pt-4 border-t"><Label className="text-xs font-bold text-slate-700 flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-600" /> İndirim / Kampanya</Label><div className="flex gap-2"><Button variant="outline" size="sm" className={`flex-1 text-xs ${design.layoutStyle === 'MODERN' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : ''}`} onClick={() => setDesign({ ...design, layoutStyle: 'MODERN', discountPrice: "" })}>Standart</Button><Button variant="outline" size="sm" className={`flex-1 text-xs ${design.layoutStyle === 'DISCOUNT' ? 'border-red-600 bg-red-50 text-red-700' : ''}`} onClick={() => setDesign({ ...design, layoutStyle: 'DISCOUNT' })}>İndirimli</Button></div>{design.layoutStyle === 'DISCOUNT' && <Input type="number" placeholder="Yeni Fiyat" value={design.discountPrice} onChange={e => setDesign({ ...design, discountPrice: e.target.value })} className="border-red-200 text-red-600 font-bold" />}</div>
                                    <div className="space-y-2 pt-4 border-t bg-slate-50 p-3 rounded-lg border">{[{ label: 'Etiket Çerçevesi', key: 'showBorder' }, { label: 'Barkod', key: 'showBarcode' }, { label: 'Tarih Damgası', key: 'showDate', icon: Calendar }, { label: 'Mağaza Adı', key: 'showStoreName' }, { label: 'Yerli Üretim', key: 'showOrigin', icon: Briefcase }, { label: 'Kalın Yazı', key: 'boldName', icon: Type }].map((item: any) => (<div key={item.key} className="flex justify-between items-center py-0.5"><Label className="text-xs cursor-pointer flex items-center gap-2 text-slate-600 font-medium">{item.icon && <item.icon className="w-3 h-3 text-slate-400" />} {item.label}</Label><Switch checked={(design as any)[item.key]} onCheckedChange={c => setDesign({ ...design, [item.key]: c })} className="scale-75 origin-right" /></div>))}</div>
                                </TabsContent>
                            </Tabs>
                        </div>

                        <div className="lg:col-span-8 bg-slate-200/50 rounded-xl border flex flex-col items-center justify-start p-8 overflow-auto h-[calc(100vh-200px)] relative">
                            {!selectedProduct && <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"><div className="bg-white/80 backdrop-blur px-8 py-4 rounded-full shadow-lg text-slate-500 font-medium border animate-pulse">Ön izleme için ürün seçimi yapınız</div></div>}
                            <div className="bg-white shadow-2xl transition-transform duration-300 origin-top" style={{ width: '210mm', minHeight: '297mm', transform: 'scale(0.85)', marginBottom: '20px' }}>{renderLabels()}</div>
                        </div>
                    </div>
                </div>

                <div id="print-area" className="hidden print:block bg-white m-0 p-0">{renderLabels()}</div>
            </div>
        </MainLayout>
    );
}
