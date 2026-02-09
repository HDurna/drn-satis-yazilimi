import { z } from "zod";

// Enumlar
export const UserRoleEnum = z.enum(['admin', 'store_manager', 'cashier']);
export const MovementTypeEnum = z.enum(['PURCHASE', 'SALE', 'RETURN', 'WASTAGE', 'PROMOTION', 'CORRECTION']);

// Ürün Şeması
export const ProductSchema = z.object({
    barcode: z.string().optional(),
    name: z.string().min(2, "Ürün adı en az 2 karakter olmalı"),
    description: z.string().optional(),
    price: z.number().min(0, "Satış fiyatı 0'dan küçük olamaz"),
    cost_price: z.number().min(0, "Maliyet fiyatı 0'dan küçük olamaz"),
    image_path: z.string().optional(),
});

export type ProductFormValues = z.infer<typeof ProductSchema>;

// Stok Hareketi Şeması
export const StockMovementSchema = z.object({
    product_id: z.number(),
    quantity: z.number().int("Miktar tam sayı olmalı").refine(val => val !== 0, "Miktar 0 olamaz"),
    type: MovementTypeEnum,
    document_ref: z.string().optional(),
    reason: z.string().optional(),
});

// Zayi/Fire Bildirim Şeması (Özel kurallar içerebilir)
export const WastageSchema = StockMovementSchema.extend({
    type: z.literal('WASTAGE'),
    reason: z.string().min(5, "Zayi nedeni en az 5 karakter açıklanmalı"),
    quantity: z.number().int().negative("Zayi miktarı negatif olmalıdır"),
});

export type StockMovementFormValues = z.infer<typeof StockMovementSchema>;
