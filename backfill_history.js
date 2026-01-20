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
    { id: 'uniswap', symbol: 'UNI', name: 'Uniswap' }
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Générer les dates mensuelles depuis 2022
function generateMonthlyDates() {
    const dates = [];
    const start = new Date('2022-01-01');
    const end = new Date();
    
    let current = new Date(start);
    
    while (current <= end) {
        dates.push(new Date(current));
        current.setMonth(current.getMonth() + 1);
    }
    
    return dates;
}

async function fetchHistoricalPrice(coinId, date) {
    const dateStr = date.toISOString().split('T')[0];
    const formattedDate = dateStr.split('-').reverse().join('-'); // DD-MM-YYYY
    
    try {
        const response = await fetch(
            `https://api.coingecko.com/api/v3/coins/${coinId}/history?date=${formattedDate}`
        );
        
        if (!response.ok) {
            if (response.status === 429 || response.status === 401) {
                console.log('   ⚠️ Rate limit atteint, pause 60s...');
                await sleep(60000);
                return await fetchHistoricalPrice(coinId, date);
            }
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        return data.market_data?.current_price?.usd || null;
        
    } catch (error) {
        console.error(`   ❌ Erreur fetch: ${error.message}`);
        return null;
    }
}

async function backfillToken(token) {
    console.log(`\n🚀 Traitement de ${token.name} (${token.symbol})...`);
    
    const monthlyDates = generateMonthlyDates();
    console.log(`   📅 ${monthlyDates.length} mois à récupérer`);
    
    let successCount = 0;
    
    for (let i = 0; i < monthlyDates.length; i++) {
        const date = monthlyDates[i];
        const recordDate = new Date(date.getFullYear(), date.getMonth(), 1)
            .toISOString().split('T')[0];
        
        console.log(`   ${i + 1}/${monthlyDates.length} - ${recordDate}...`);
        
        const price = await fetchHistoricalPrice(token.id, date);
        
        if (price) {
            // Insérer dans Supabase
            try {
                const response = await fetch(
                    `${SUPABASE_URL}/rest/v1/crypto_history`,
                    {
                        method: 'POST',
                        headers: {
                            'apikey': SUPABASE_KEY,
                            'Authorization': `Bearer ${SUPABASE_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'resolution=ignore-duplicates'
                        },
                        body: JSON.stringify({
                            coin_id: token.id,
                            symbol: token.symbol,
                            name: token.name,
                            price: price,
                            record_date: recordDate
                        })
                    }
                );
                
                if (response.ok || response.status === 409) {
                    console.log(`      ✅ $${price.toFixed(2)} inséré`);
                    successCount++;
                } else {
                    console.log(`      ⚠️ Erreur Supabase: ${response.status}`);
                }
                
            } catch (error) {
                console.error(`      ❌ Erreur insertion: ${error.message}`);
            }
        } else {
            console.log(`      ⚠️ Prix non disponible`);
        }
        
        // Pause entre chaque mois
        await sleep(2000);
    }
    
    console.log(`   ✅ ${token.name} terminé (${successCount}/${monthlyDates.length} mois)`);
}

async function main() {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║   BACKFILL HISTORIQUE 2022-2026            ║');
    console.log('║   (10 tokens, approche douce)              ║');
    console.log('╚════════════════════════════════════════════╝');
    
    for (let i = 0; i < TOKENS.length; i++) {
        const token = TOKENS[i];
        await backfillToken(token);
        
        if (i < TOKENS.length - 1) {
            console.log(`\n⏳ Pause 30s avant token suivant (${i + 1}/${TOKENS.length})...\n`);
            await sleep(30000);
        }
    }
    
    console.log('\n\n🎉 BACKFILL TERMINÉ !');
}

main();
