const fetch = require('node-fetch');

// Configuration Supabase
const SUPABASE_URL = 'https://fxdkyfqklrxumqpxcatp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// Liste des cryptos à tracker
const CRYPTO_IDS = [
    'bitcoin', 'ethereum', 'binancecoin', 'solana', 'cardano',
    'avalanche-2', 'polkadot', 'chainlink', 'polygon', 'uniswap',
    'litecoin', 'stellar', 'algorand', 'cosmos', 'tezos',
    'filecoin', 'fantom', 'arbitrum', 'optimism', 'aptos'
];

async function updateCryptoPrices() {
    try {
        console.log('🚀 Début de la mise à jour des prix...');

        // Appel à l'API CoinGecko
        const response = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${CRYPTO_IDS.join(',')}&vs_currencies=usd&include_market_cap=true&include_total_supply=true`
        );

        if (!response.ok) {
            throw new Error(`Erreur API CoinGecko: ${response.status}`);
        }

        const data = await response.json();
        console.log(`✅ Données récupérées pour ${Object.keys(data).length} cryptos`);

        // Récupérer les infos détaillées (noms et symbols)
        const detailsResponse = await fetch(
            `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${CRYPTO_IDS.join(',')}&order=market_cap_desc`
        );

        const detailsData = await detailsResponse.json();

        // Préparer les données pour Supabase
        const updates = detailsData.map(coin => ({
            coin_id: coin.id,
            name: coin.name,
            symbol: coin.symbol.toUpperCase(),
            current_price: data[coin.id]?.usd || 0,
            market_cap: data[coin.id]?.usd_market_cap || 0,
            total_supply: data[coin.id]?.usd_total_supply || coin.total_supply || 0,
            updated_at: new Date().toISOString()
        }));

        // Mettre à jour Supabase
        for (const update of updates) {
            const supabaseResponse = await fetch(
                `${SUPABASE_URL}/rest/v1/crypto_prices?coin_id=eq.${update.coin_id}`,
                {
                    method: 'GET',
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const existing = await supabaseResponse.json();

            if (existing.length > 0) {
                // UPDATE
                await fetch(
                    `${SUPABASE_URL}/rest/v1/crypto_prices?coin_id=eq.${update.coin_id}`,
                    {
                        method: 'PATCH',
                        headers: {
                            'apikey': SUPABASE_KEY,
                            'Authorization': `Bearer ${SUPABASE_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal'
                        },
                        body: JSON.stringify(update)
                    }
                );
                console.log(`✅ Mis à jour: ${update.name} (${update.symbol})`);
            } else {
                // INSERT
                await fetch(
                    `${SUPABASE_URL}/rest/v1/crypto_prices`,
                    {
                        method: 'POST',
                        headers: {
                            'apikey': SUPABASE_KEY,
                            'Authorization': `Bearer ${SUPABASE_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=minimal'
                        },
                        body: JSON.stringify(update)
                    }
                );
                console.log(`✅ Ajouté: ${update.name} (${update.symbol})`);
            }
        }

        console.log('🎉 Mise à jour terminée avec succès !');
    } catch (error) {
        console.error('❌ Erreur:', error.message);
        process.exit(1);
    }
}

updateCryptoPrices();
