const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

// --- CONFIGURATION ---
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1516120799038275665/bDyYMwOCs6kJQFlMysG-jCUTIYhahfXPTvozJC-jC1EhkLSCJzJ_VakPbuU8TIV_5M3W'; 
const DB_FILE = path.join(__dirname, 'seen_ads.json'); 

const MIN_PRICE = 500000;  
const MAX_PRICE = 2000000; // 20 Lakh Budget

const TARGETS = {
    pakwheels: 'https://www.pakwheels.com/used-cars/search/-/ct_karachi/pr_500000_2000000/srt_date-desc/',
    olx: 'https://www.olx.com.pk/karachi_g4060695/cars_c84?filter=price_between_500000_to_2000000&sort=date_desc',
    garipk: 'https://www.gari.pk/used-cars/karachi/',
    trovit: 'https://cars.trovit.com.pk/index.php/cod.search_cars/type.1/city.Karachi/price_min.500000/price_max.2000000/order_by.date'
};

function getSeenAds() {
    if (!fs.existsSync(DB_FILE)) return [];
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveSeenAd(id) {
    const ads = getSeenAds();
    ads.push(id);
    fs.writeFileSync(DB_FILE, JSON.stringify(ads, null, 2));
}

function parsePrice(priceStr) {
    if (!priceStr) return 0;
    let cleanStr = priceStr.toLowerCase().replace(/,/g, '').trim();
    if (cleanStr.includes('lakh') || cleanStr.includes('lac')) {
        let num = parseFloat(cleanStr.match(/[\d\.]+/));
        return num ? num * 100000 : 0;
    }
    let digits = cleanStr.match(/\d+/g);
    return digits ? parseInt(digits.join(''), 10) : 0;
}

function getAppRedirectLinks(webLink, platform, adId) {
    if (platform === 'PakWheels') return `pakwheels://classified/details?id=${adId}`;
    if (platform === 'OLX') return `olxpk://item/${adId}`;
    return webLink;
}

async function sendDiscordAlert(carData) {
    let colors = { 'PakWheels': 1240319, 'OLX': 1999204, 'Gari.pk': 14169620, 'Trovit': 15105570 };
    let adId = carData.id;
    if (carData.platform === 'PakWheels' && adId.includes('-')) {
        adId = adId.split('-').pop();
    }
    const appLink = getAppRedirectLinks(carData.link, carData.platform, adId);
    const cleanTitle = carData.title.replace(/\s+/g, ' ').trim();

    try {
        await axios.post(DISCORD_WEBHOOK_URL, {
            username: "Karachi Market Intelligence Engine",
            avatar_url: "https://i.imgur.com/w8N4G8W.png",
            embeds: [{
                title: `📈 NEW MARKET ENTRY: ${cleanTitle}`,
                url: carData.link, 
                color: colors[carData.platform] || 8421504,
                description: `> ⚡ **Action Required:** Open this listing directly inside the official mobile application for instant contact.\n> 📱 **[Redirect to Native Mobile App](${appLink})**`,
                fields: [
                    { name: "💰 Financials", value: `\`\`\`💵 Price: ${carData.price}\`\`\``, inline: false },
                    { name: "📋 Vehicle Specifications", value: `• **Model Year:** ${carData.year}\n• **Kilometers:** ${carData.mileage}\n• **Sourcing Platform:** ${carData.platform}`, inline: true },
                    { name: "📍 Location & Status", value: `• **Region:** Karachi, Pakistan\n• **Status:** Active Listing\n• **Data Feed:** Live Scan`, inline: true },
                    { name: "🔍 Additional Metadata / Description Extraction", value: `\`\`\`txt\n${carData.specs || 'No further description provided by seller.'}\n\`\`\``, inline: false }
                ],
                footer: { text: "Automated Arbitrage Router | Target Bracket: PKR 500,000 - 2,000,000" },
                timestamp: new Date()
            }]
        });
        console.log(`💼 routed ${cleanTitle} to Discord.`);
    } catch (err) { console.error('Dispatch Failed'); }
}

async function run() {
    console.log(`Scanning Marketplaces...`);
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    try {
        const seenAds = getSeenAds();

        // --- PAKWHEELS ---
        await page.goto(TARGETS.pakwheels, { waitUntil: 'domcontentloaded' });
        const pwAds = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.classified-listing')).map(el => {
                const linkEl = el.querySelector('a.car-name');
                const priceEl = el.querySelector('.price-details');
                const specsList = el.querySelector('.search-vehicle-info-v2, .search-vehicle-info');
                return { id: linkEl?.getAttribute('href'), title: linkEl?.innerText.trim() || "", price: priceEl?.innerText.trim() || "0", rawSpecs: specsList?.innerText.replace(/\s+/g, ' ').trim() || "" };
            }).filter(ad => ad.id);
        });
        for (let ad of pwAds) {
            const numericPrice = parsePrice(ad.price);
            if (numericPrice >= MIN_PRICE && numericPrice <= MAX_PRICE && !seenAds.includes(ad.id)) {
                await sendDiscordAlert({ id: ad.id, title: ad.title, price: ad.price, link: 'https://www.pakwheels.com' + ad.id, platform: 'PakWheels', year: ad.rawSpecs.match(/\b(20\d{2})\b/)?.[0] || "N/A", mileage: ad.rawSpecs.match(/[\d,]+\s*km/i)?.[0] || "N/A", specs: ad.rawSpecs });
                saveSeenAd(ad.id);
            }
        }

        // --- OLX ---
        await page.goto(TARGETS.olx, { waitUntil: 'domcontentloaded' });
        const olxAds = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('article[data-aut-id="item"]')).map(el => {
                const linkEl = el.querySelector('a');
                const priceEl = el.querySelector('[data-aut-id="itemPrice"]');
                const titleEl = el.querySelector('[data-aut-id="itemTitle"]');
                const subtitleEl = el.querySelector('[data-aut-id="itemSubTitle"]') || el.querySelector('div._1075545d');
                const locationEl = el.querySelector('[data-aut-id="itemLocation"]');
                return { id: linkEl?.getAttribute('href').split('-').pop(), title: titleEl?.innerText.trim() || "", price: priceEl?.innerText.trim() || "0", sub: subtitleEl?.innerText.trim() || "", loc: locationEl?.innerText.trim() || "Karachi", link: linkEl ? 'https://www.olx.com.pk' + linkEl.getAttribute('href') : "" };
            }).filter(ad => ad.id);
        });
        for (let ad of olxAds) {
            if ((ad.title + " " + ad.loc).toLowerCase().includes('karachi')) {
                const numericPrice = parsePrice(ad.price);
                if (numericPrice >= MIN_PRICE && numericPrice <= MAX_PRICE && !seenAds.includes(ad.id)) {
                    await sendDiscordAlert({ id: ad.id, title: ad.title, price: ad.price, link: ad.link, platform: 'OLX', year: ad.sub.match(/\b(20\d{2})\b/)?.[0] || "N/A", mileage: ad.sub.match(/[\d,]+\s*km/i)?.[0] || "N/A", specs: `Location: ${ad.loc} | ${ad.sub}` });
                    saveSeenAd(ad.id);
                }
            }
        }
    } catch (e) { console.error(e); }
    finally { await browser.close(); }
}

run();