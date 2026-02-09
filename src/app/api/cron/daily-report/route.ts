import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase Service Role (to access data without auth in cron)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Must be added to Env

export async function GET(request: Request) {
    // 1. Authorization check (Cron secret)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // return new NextResponse('Unauthorized', { status: 401 });
        // Temporarily allowing for manual testing via browser if secret is not set
        if (process.env.CRON_SECRET) return new NextResponse('Unauthorized', { status: 401 });
    }

    if (!supabaseServiceKey) return NextResponse.json({ error: "Service Key Missing" }, { status: 500 });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Fetch Today's Data
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: movements, error } = await supabase
        .from('stock_movements')
        .select('quantity, reason, product_id, products(name, price)')
        .eq('type', 'SALE')
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!movements) return NextResponse.json({ message: "No Sales Today" });

    // 3. Calculate Stats
    let totalSales = 0;
    const productStats: Record<string, number> = {};

    movements.forEach(m => {
        // Approximate calculation - assumes current price. 
        // For exact reporting, we should store `price_at_sale` in movement or separate sales table.
        // For this MVP, we use reason or fetching current price.
        // Let's rely on products.price for now (approximation).
        const qty = Math.abs(m.quantity);
        const price = (m.products as any)?.price || 0;
        totalSales += qty * price;

        const pName = (m.products as any)?.name || 'Unknown';
        productStats[pName] = (productStats[pName] || 0) + qty;
    });

    // 4. Send Notification (Telegram / Email)
    // Placeholder logic for Telegram
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;

    const reportMessage = `
📢 *GÜN SONU RAPORU* (${today.toLocaleDateString('tr-TR')})

💰 *Toplam Ciro:* ${totalSales.toFixed(2)} ₺

📦 *Satılan Ürünler:*
${Object.entries(productStats).map(([name, qty]) => `- ${name}: ${qty} adet`).join('\n')}

_Otomatik Rapor_
    `;

    if (telegramToken && telegramChatId) {
        // Send to Telegram
        await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: telegramChatId,
                text: reportMessage,
                parse_mode: 'Markdown'
            })
        });
    }

    // Also Log to System (Optional)
    console.log(reportMessage);

    return NextResponse.json({ success: true, totalSales, message: "Report generated" });
}
