const fetch = require('node-fetch');

const SUPABASE_URL = 'https://fxdkyfqklrxumqpxcatp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const TOKENS = [
    { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
    { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
    { id: 'binancecoin', symbol: 'BNB', name: 'BNB' },
    { id: 'solana', symbol: 'SOL', name: 'Solana' },
    { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
    { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche' },
    { id: 'polkadot', symbol: 'DOT', name: 'Polkadot' },
    { id: 'chainlink', symbol: 'LINK', name: 'Chainlink' },
    { id: 'polygon', symbol: 'MATIC', name: 'Polygon' },
    { id: 'uniswap', symbol: 'UNI', name: 'Uniswap' },
    { id: 'litecoin', symbol: 'LTC', name: 'Litecoin' },
    { id: 'stellar', symbol: 'XLM', name: 'Stellar' },
    { id: 'algorand', symbol: 'ALGO', name: 'Algorand' },
    { id: 'cosmos', symbol: 'ATOM', name: 'Cosmos' },
    { id: 'tezos', symbol: 'XTZ', name: 'Tezos' },
    { id: 'filecoin', symbol: 'FIL', name: 'Filecoin' },
    { id: 'fantom', symbol: 'FTM', name: 'Fantom' },
    { id: 'arbitrum', symbol: 'ARB', name: 'Arbitrum' },
    { id: 'optimism', symbol: 'OP', name: 'Optimism' },
    { id: 'aptos', symbol: 'APT', name: 'Aptos' }
];

const START_DATE = new Date('2021-01-01');
const END_DATE = new Date();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function generateMonthlyDates(start, end) {
    const dates = [];
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    
    while (current <= end) {
        dates.push(new Date(current));
        current.setMonth(current.getMonth() + 1);
    }
    
    return dates;
}

function findClosestToFirstOfMonth(prices, targetDate) {
    const firstOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1).getTime();
    
    let closest = prices[0];
    let minDiff = Math.abs(prices[0][0] - firstOfMonth);
    
    for (const point of prices) {
        const diff = Math.abs(point[0] - firstOfMonth);
        if (diff < minDiff) {
            minDiff = diff;
            closest = point;
        }
    }
    
    return closest;
}

async function backfillToken(token) {
    console.log(`\n🚀 Traitement de ${token.name} (${token.symbol})...`);
    
    try {
        const from = Math.floor(START_DATE.getTime() / 1000);
        const to = Math.floor(END_DATE.getTime() / 1000);
        
        const response = await fetch(
            `https://api.coingecko.com/api/v3/coins/${token.id}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`
        );
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        const prices = data.prices;
        
        console.log(`   ✅ ${prices.length} points récupérés`);
        
        const monthlyDates = generateMonthlyDates(START_DATE, END_DATE);
        console.log(`   📅 ${monthlyDates.length} mois à traiter`);
        
        const monthlyData = [];
        
        for (const monthDate of monthlyDates) {
            const closestPoint = findClosestToFirstOfMonth(prices, monthDate);
            const price = closestPoint[1];
            const recordDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
                .toISOString().split('T')[0];
            
            monthlyData.push({
                coin_id: token.id,
                symbol: token.symbol,
                name: token.name,
                price: price,
                record_date: recordDate
            });
        }
        
        console.log(`   💾 Insertion de ${monthlyData.length} enregistrements...`);
        
        for (const record of monthlyData) {
            await fetch(
                `${SUPABASE_URL}/rest/v1/crypto_history`,
                {
                    method: 'POST',
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=ignore-duplicates'
                    },
                    body: JSON.stringify(record)
                }
            );
        }
        
        console.log(`   ✅ ${token.name} terminé !`);
        
    } catch (error) {
        console.error(`   ❌ Erreur pour ${token.name}:`, error.message);
    }
}

async function main() {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   BACKFILL HISTORIQUE 2021-2026            ║');
    console.log('╚════════════════════════════════════════════╝');
    
    let completed = 0;
    
    for (const token of TOKENS) {
        await backfillToken(token);
        completed++;
        
        if (completed < TOKENS.length) {
            console.log(`\n⏳ Pause 20s (${completed}/${TOKENS.length})...`);
            await sleep(20000);
        }
    }
    
    console.log('\n\n🎉 BACKFILL TERMINÉ !');
}

main();
