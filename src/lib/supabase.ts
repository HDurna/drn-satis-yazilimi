import { createBrowserClient } from '@supabase/ssr';

export const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Veritabanı Tipleri (Database Definitions)
// Gerçekte supabase gen types ile üretilmelidir. Burada manuel basitleştirilmiş tip tanımları yapıyoruz.

export type DatabaseProfile = {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    role: 'admin' | 'store_manager' | 'cashier';
    created_at: string;
};

export type DatabaseCategory = {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
};

export type DatabaseMovementType = {
    id: string;
    name: string;
    type: 'IN' | 'OUT';
    is_system: boolean;
    created_at: string;
};

export type DatabaseProduct = {
    id: number;
    barcode: string;
    name: string;
    description: string | null;
    current_stock: number;
    price: number;
    wholesale_price: number | null;
    cost_price: number;
    category_id: string | null;
    critical_stock: number;
    image_path: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
};

export type DatabaseStockMovement = {
    id: number;
    product_id: number;
    user_id: string;
    warehouse_id: string | null; // Added V3
    session_id: string | null;   // Added V3
    quantity: number;
    type: string;
    movement_type_id: string | null;
    document_ref: string | null;
    reason: string | null;
    created_at: string;
    deleted_at?: string | null;
};

export type DatabaseAuditLog = {
    user_id: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'SOFT_DELETE';
    table_name: string;
    record_id: string;
    details: string | null;
    created_at: string;
};

export type DatabaseWarehouse = {
    id: string;
    name: string;
    type: 'MAIN' | 'STORE' | 'DAMAGED';
    is_active: boolean;
    created_at: string;
}


export type DatabaseCustomer = {
    id: number;
    full_name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    balance: number;
    notes: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
};

export type DatabaseStockCount = {
    id: string;
    name: string;
    status: 'OPEN' | 'COMPLETED' | 'CANCELLED' | 'PENDING_APPROVAL';
    note: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at?: string;
};

// V2 NEW TABLES
export type DatabaseProductStock = {
    id: string;
    product_id: number;
    warehouse_id: string;
    quantity: number;
    shelf_location: string | null;
    last_counted_at: string | null;
    updated_at: string;
    warehouses?: DatabaseWarehouse; // Join
};

export type DatabaseRegister = {
    id: string;
    warehouse_id: string;
    name: string;
    code: string | null;
    is_active: boolean;
    created_at: string;
};

export type DatabaseRegisterSession = {
    id: string;
    register_id: string;
    user_id: string;
    opened_at: string;
    closed_at: string | null;
    opening_amount: number;
    closing_amount: number | null;
    actual_closing_amount: number | null;
    status: 'OPEN' | 'CLOSED';
    notes: string | null;
};

// EXPENSES
export type DatabaseExpenseCategory = {
    id: string;
    name: string;
    is_active: boolean;
};

export type DatabaseExpense = {
    id: string;
    user_id: string;
    warehouse_id: string | null;
    session_id: string | null;
    category_id: string | null;
    amount: number;
    description: string | null;
    created_at: string;
    expense_categories?: DatabaseExpenseCategory; // Join
};

// LOYALTY
export type DatabaseLoyaltyTransaction = {
    id: string;
    customer_id: number;
    points: number;
    type: 'EARN' | 'REDEEM' | 'ADJUSTMENT';
    created_at: string;
};

export type DatabaseStockCountItem = {
    id: string;
    count_id: string;
    product_id: number;
    expected_stock: number;
    counted_stock: number;
    defective_quantity?: number; // Added column
    created_at: string;
    products?: DatabaseProduct; // Join relation
};

// V5 LICENSE SYSTEM
export type DatabaseModuleState = {
    module_key: string;
    is_enabled: boolean;
    license_key: string | null;
    license_type: 'LIFETIME' | 'TRIAL' | 'SUBSCRIPTION';
    activated_at: string;
    expires_at: string | null;
};
