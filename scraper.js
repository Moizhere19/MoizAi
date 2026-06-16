const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

// 🎛️ CONFIGURATION APP LIFECYCLE
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1516120799038275665/bDyYMwOCs6kJQFlMysG-jCUTIYhahfXPTvozJC-jC1EhkLSCJzJ_VakPbuU8TIV_5M3W'; 
const DB_FILE = path.join(__dirname, 'seen_ads.json');
const MAX_DB_SIZE = 5000; 

// 🎯 STRICT INVESTMENT PARAMETERS (5 Lac to 20 Lac)
const MIN_PRICE = 500000;
const MAX_PRICE = 2000000;

const TARGETS = {
    pakwheels: 'https://www.pakwheels.com/used-cars/search/-/ct_karachi/pr_500000_to_2000000/srt_date-desc/',
    olx: 'https://www.olx.com.pk/karachi_g4060695/cars_c84?filter=price_between_500000_to_2000000&sort=date_desc'
};

function getSeenAds() {
    if (!fs.existsSync(DB_FILE)) return [];
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return []; }
}

function saveSeenAds(newAdsList) {
    let ads = getSeenAds();
    
    newAdsList.forEach(newAd => {
        const exists = ads.some(existingAd => existingAd.id === newAd.id);
        if (!exists) {
            ads.push({
                id: newAd.id,
                title: newAd.title,
                price: newAd.price,
                platform: newAd.platform,
                capturedAt: new Date().toLocaleString()
            });
        }
    });

    if (ads.length > MAX_DB_SIZE) {
        ads = ads.slice(ads.length - MAX_DB_SIZE);
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(ads, null, 2));
}

// 💰 MATHEMATICAL BUDGET GATEKEEPER
function isWithinBudget(priceStr) {
    if (!priceStr) return false;
    // Remove commas, spaces, and extra characters to parse pure integer numeric raw value
    let cleanStr = priceStr.replace(/[,Rs\s]/g, '').toLowerCase();
    let numericPrice = 0;

    if (cleanStr.includes('lac') || cleanStr.includes('lakh')) {
        let factor = parseFloat(cleanStr);
        if (!isNaN(factor)) numericPrice = factor * 100000;
    } else if (cleanStr.includes('crore')) {
        let factor = parseFloat(cleanStr);
        if (!isNaN(factor)) numericPrice = factor * 10000000;
    } else {
        numericPrice = parseInt(cleanStr, 10);
    }

    return (numericPrice >= MIN_PRICE && numericPrice <= MAX_PRICE);
}

// 👑 CLEAN PREMIUM DISCORD NOTIFIER
async function sendDiscordAlert(title, price, link, platform, specs = {}) {
    try {
        const isPakWheels = platform.toLowerCase().includes('pakwheels');
        const brandColor = isPakWheels ? 1240319 : 16738304; 
        const brandLogo = isPakWheels 
            ? "https://s3.ap-south-1.amazonaws.com/images.pakwheels.com/pw-logo.png" 
            : "https://images.olx.com.pk/site/pk/labels/olx-logo.png";

        const cleanTitle = title && title.trim().length > 3 ? title.trim() : "Unknown Car Node";
        const cleanPrice = price && price.trim().length > 0 ? price.trim() : "Check Listing Price";
        const location = specs.location ? `\`${specs.location}\`` : "`Karachi`";

        await axios.post(DISCORD_WEBHOOK_URL, {
            username: "Live Car Tracker",
            embeds: [{
                title: `🆕 [New Car Found] - ${cleanTitle}`,
                url: link,
                color: brandColor,
                fields: [
                    { name: "💰 Price", value: `**${cleanPrice}**`, inline: true },
                    { name: "📍 Platform", value: `\`${platform}\``, inline: true },
                    { name: "📍 Location", value: location, inline: true },
                    { 
                        name: "⚙️ Specifications Matrix", 
                        value: `\`\`\`py\n📅 Year:     ${specs.year || 'N/A'}\n🛡️ Mileage:  ${specs.mileage || 'N/A'}\n⛽ Fuel:     ${specs.fuel || 'N/A'}\n\`\`\``, 
                        inline: false 
                    },
                    {
                        name: "🔗 Direct Link",
                        value: `👉 [Click Here to View Car Listing](${link})`,
                        inline: false
                    }
                ],
                thumbnail: { url: brandLogo },
                footer: { text: "Market Tracker Engine • Range: 5L - 20L STRICT" },
                timestamp: new Date()
            }]
        });
        console.log(`🚀 [${platform}] Telemetry dispatched within 5L-20L budget limit.`);
    } catch (err) {
        console.error('💥 Discord Notification Pipeline Failed:', err.message);
    }
}

async function checkMarketplace() {
    console.log(`[${new Date().toLocaleTimeString()}] Scanning Live Karachi Feed (5L - 20L | 24Hr Strictly)...`);
    
    const browser = await puppeteer.launch({ 
        headless: true, 
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
        ]
    });
    
    const page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    try {
        const seenAds = getSeenAds();
        const seenIds = seenAds.map(ad => ad.id);
        let newAdsToSave = [];

        // --- PAKWHEELS ENGINE ---
        console.log("Processing PakWheels Feed...");
        await page.goto(TARGETS.pakwheels, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        const pwAds = await page.evaluate(() => {
            const listings = document.querySelectorAll('.classified-listing'); 
            let results = [];
            listings.forEach(el => {
                const linkEl = el.querySelector('a.car-name');
                const priceEl = el.querySelector('.price-details');
                
                const timeEl = el.querySelector('.pull-left.g-font-13') || el.querySelector('.time-text') || el.querySelector('div[class*="dated"]');
                const timeText = timeEl ? timeEl.innerText.toLowerCase() : "";

                let isOlderThan24h = false;
                if (timeText.includes('day') && !timeText.includes('1 day')) isOlderThan24h = true;
                if (timeText.includes('week') || timeText.includes('month') || timeText.includes('year')) isOlderThan24h = true;

                if (linkEl && priceEl && !isOlderThan24h) {
                    const infoItems = el.querySelectorAll('.search-vehicle-info-v2 li');
                    let year = infoItems[0] ? infoItems[0].innerText.trim() : null;
                    let mileage = infoItems[1] ? infoItems[1].innerText.trim() : null;
                    let fuel = infoItems[2] ? infoItems[2].innerText.trim() : null;

                    results.push({
                        id: linkEl.getAttribute('href'),
                        title: linkEl.innerText.trim(),
                        price: priceEl.innerText.trim(),
                        link: 'https://www.pakwheels.com' + linkEl.getAttribute('href'),
                        specs: { year, mileage, fuel, location: "Karachi" }
                    });
                }
            });
            return results;
        });

        console.log(`📊 PakWheels: Parsed ${pwAds.length} fresh ads.`);
        for (const ad of pwAds) {
            if (!seenIds.includes(ad.id) && isWithinBudget(ad.price)) {
                await sendDiscordAlert(ad.title, ad.price, ad.link, 'PakWheels', ad.specs);
                newAdsToSave.push({ id: ad.id, title: ad.title, price: ad.price, platform: 'PakWheels' });
            }
        }

        // --- DEEP SPEC SELECTOR FOR OLX ---
        console.log("Processing OLX Feed...");
        await page.goto(TARGETS.olx, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 4000));

        const olxAds = await page.evaluate(() => {
            let results = [];
            const items = document.querySelectorAll('li[article="listing"]') || document.querySelectorAll('article') || document.querySelectorAll('li');
            
            items.forEach(el => {
                const linkEl = el.querySelector('a');
                if (!linkEl) return;
                
                const href = linkEl.getAttribute('href');
                if (href && href.includes('/item/')) {
                    const priceNode = el.querySelector('span[data-aut-id="itemPrice"]') || el.querySelector('div[aria-label="Price"]') || el.querySelector('span');
                    const titleNode = el.querySelector('span[data-aut-id="itemTitle"]') || el.querySelector('div[aria-label="Title"]') || el.querySelectorAll('span')[1];
                    const detailsNode = el.querySelector('span[data-aut-id="itemSubTitle"]') || el.querySelector('div[aria-label="Subtitle"]');
                    const locationNode = el.querySelector('span[data-aut-id="itemDetailsLocation"]') || el.querySelector('div[aria-label="Location"]');
                    
                    const textContent = el.innerText || "";
                    const lowerText = textContent.toLowerCase();

                    let isOlderThan24h = false;
                    if (lowerText.includes('day') && !lowerText.includes('1 day') && !lowerText.includes('yesterday')) isOlderThan24h = true;
                    if (lowerText.includes('week') || lowerText.includes('month')) isOlderThan24h = true;

                    if (!isOlderThan24h && priceNode && titleNode) {
                        const priceStr = priceNode.innerText.trim();
                        const titleStr = titleNode.innerText.trim();
                        
                        const yearMatch = textContent.match(/\b(200[0-9]|201[0-9]|202[0-6])\b/);
                        const kmMatch = textContent.match(/\b\d[\d,]*\s*(?:km|km)\b/i);
                        
                        let fuelType = null;
                        if (lowerText.includes('petrol')) fuelType = 'Petrol';
                        else if (lowerText.includes('cng')) fuelType = 'CNG';
                        else if (lowerText.includes('diesel')) fuelType = 'Diesel';
                        else if (lowerText.includes('hybrid')) fuelType = 'Hybrid';

                        let locLine = locationNode ? locationNode.innerText.trim() : "Karachi";
                        if (locLine.includes('•')) locLine = locLine.split('•')[0].trim();

                        if (!titleStr.includes('Rs') && titleStr.length > 2) {
                            results.push({
                                id: href.split('-iid-').pop() || href.split('/').pop(),
                                title: titleStr,
                                price: priceStr,
                                link: href.startsWith('http') ? href : 'https://www.olx.com.pk' + href,
                                specs: {
                                    year: yearMatch ? yearMatch[0] : (detailsNode && detailsNode.innerText.includes('-') ? detailsNode.innerText.split('-')[0].trim() : null),
                                    mileage: kmMatch ? kmMatch[0] : (detailsNode && detailsNode.innerText.includes('km') ? detailsNode.innerText.match(/\b\d[\d,]*\s*km\b/i)?.[0] : null),
                                    fuel: fuelType,
                                    location: locLine
                                }
                            });
                        }
                    }
                }
            });
            return results;
        });

        console.log(`📊 OLX: Parsed ${olxAds.length} high-fidelity rich items.`);
        for (const ad of olxAds) {
            if (!seenIds.includes(ad.id) && isWithinBudget(ad.price)) {
                await sendDiscordAlert(ad.title, ad.price, ad.link, 'OLX', ad.specs);
                newAdsToSave.push({ id: ad.id, title: ad.title, price: ad.price, platform: 'OLX' });
            }
        }

        if (newAdsToSave.length > 0) {
            saveSeenAds(newAdsToSave);
        }

    } catch (error) {
        console.error('💥 Feed processor encountered an error:', error.message);
    } finally {
        await browser.close();
        console.log(`[${new Date().toLocaleTimeString()}] Sweep completed. Engine cooled down.`);
    }
}

async function runLiveStream() {
    console.log("⚡ Live Precision Engine Active.");
    while (true) {
        try {
            await checkMarketplace();
        } catch (loopError) {
            console.error("⚠️ Loop execution failure:", loopError.message);
        }
        const cooldownMinutes = 3;
        console.log(`⏳ Cooldown active. Next sweep in ${cooldownMinutes} minutes...`);
        await new Promise(resolve => setTimeout(resolve, cooldownMinutes * 60 * 1000));
    }
}

runLiveStream();