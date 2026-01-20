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

// Générer dates mensuelles depuis 2023 (moins de données = plus rapide)
function generateMonthlyDates() {
    const dates = [];
    const start = new Date('2023-01-01');
    const end = new Date();
    
    let current = new Date(start);
    while (current <= end) {
        dates.push(new Date(current));
        current.setMonth(current.getMonth() + 1);
    }
    
    return dates;
}

// Récupérer le prix d'UNE date spécifique
async function fetchPriceForDate(coinId, date, retryCount = 0) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const dateStr = `${day}-${month}-${year}`; // Format DD-MM-YYYY
    
    try {
        console.log(`      📡 Appel API pour ${dateStr}...`);
        
        const response = await fetch(
            `https://api.coingecko.com/api/v3/coins/${coinId}/history?date=${dateStr}&localization=false`
        );
        
        // Gestion des erreurs
        if (response.status === 429 || response.status === 401) {
            if (retryCount < 3) {
                console.log(`      ⚠️ Rate limit (${response.status}). Pause 60s et retry ${retryCount + 1}/3...`);
                await sleep(60000);
                return await fetchPriceForDate(coinId, date, retryCount + 1);
            } else {
                console.log(`      ❌ Échec après 3 tentatives`);
                return null;
            }
        }
        
        if (!response.ok) {
            console.log(`      ⚠️ HTTP ${response.status}`);
            return null;
        }
        
        const data = await response.json();
        const price = data.market_data?.current_price?.usd;
        
        if (price) {
            console.log(`      ✅ Prix: $${price.toFixed(2)}`);
            return price;
        } else {
            console.log(`      ⚠️ Prix non disponible dans la réponse`);
            return null;
        }
        
    } catch (error) {
        console.log(`      ❌ Erreur: ${error.message}`);
        return null;
    }
}

// Insérer un prix dans Supabase
async function insertPrice(token, date, price) {
    const recordDate = new Date(date.getFullYear(), date.getMonth(), 1)
        .toISOString().split('T')[0];
    
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
        
        if (response.ok || response.status === 409 || response.status === 201) {
            console.log(`      💾 Sauvegardé dans Supabase`);
            return true;
        } else {
            console.log(`      ⚠️ Supabase status: ${response.status}`);
            return false;
        }
        
    } catch (error) {
        console.log(`      ❌ Erreur Supabase: ${error.message}`);
        return false;
    }
}

// Traiter un token
async function processToken(token, dates) {
    console.log(`\n🚀 ${token.name} (${token.symbol})`);
    console.log(`   ${dates.length} mois à récupérer\n`);
    
    let successCount = 0;
    
    for (let i = 0; i < dates.length; i++) {
        const date = dates[i];
        const month = date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
        
        console.log(`   [${i + 1}/${dates.length}] ${month}`);
        
        // Récupérer le prix
        const price = await fetchPriceForDate(token.id, date);
        
        if (price) {
            // Sauvegarder
            const saved = await insertPrice(token, date, price);
            if (saved) successCount++;
        }
        
        // Pause entre chaque mois (important !)
        if (i < dates.length - 1) {
            console.log(`      ⏳ Pause 10s...\n`);
            await sleep(10000);
        }
    }
    
    console.log(`\n   ✅ ${token.name} terminé (${successCount}/${dates.length} réussis)\n`);
    console.log(`   ═══════════════════════════════════════\n`);
}

// Main
async function main() {
    console.log('\n╔═════════════════════════════════════════════╗');
    console.log('║  BACKFILL DOUX - 1 PRIX À LA FOIS           ║');
    console.log('║  10 tokens × ~25 mois depuis 2023           ║');
    console.log('║  Pause 10s entre chaque requête             ║');
    console.log('╚═════════════════════════════════════════════╝\n');
    
    const dates = generateMonthlyDates();
    console.log(`📅 Période: 2023 → Aujourd'hui (${dates.length} mois)\n`);
    
    const estimatedMinutes = Math.ceil((TOKENS.length * dates.length * 10) / 60);
    console.log(`⏱️  Temps estimé: ~${estimatedMinutes} minutes\n`);
    console.log(`════════════════════════════════════════════════\n`);
    
    for (let i = 0; i < TOKENS.length; i++) {
        await processToken(TOKENS[i], dates);
        
        // Pause entre chaque token
        if (i < TOKENS.length - 1) {
            console.log(`⏳ Pause 20s avant le prochain token...\n`);
            await sleep(20000);
        }
    }
    
    console.log('\n╔═════════════════════════════════════════════╗');
    console.log('║           🎉 BACKFILL TERMINÉ !             ║');
    console.log('╚═════════════════════════════════════════════╝\n');
    console.log('✅ Vérifie ta table crypto_history sur Supabase\n');
}

main();
