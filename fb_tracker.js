const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

// 🎛️ COUPLING CONFIGURATION (ISOLATED FB PIPELINE)
const FB_DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1516345043365920881/4_SzkJFHkJKcEj4asD_09Xy9DERUVLKkkXtf1fRsWQpmQXMqgK_Mrh-8WXZrsnNoKr4L'; 
const DB_FILE = path.join(__dirname, 'seen_fb_ads.json');
const MAX_DB_SIZE = 2000;

// 🍪 INSERT YOUR COOKIES HERE FROM DEVELOPER TOOLS
const FB_COOKIES = [
    { name: 'c_user', value: 'YOUR_C_USER_VALUE_HERE', domain: '.facebook.com', path: '/' },
    { name: 'xs', value: 'YOUR_XS_VALUE_HERE', domain: '.facebook.com', path: '/' }
];

// 🎯 TARGETING EXPLICIT VEHICLE SECTOR LAYER WITH BUDGET LOGIC
const TARGET_URL = 'https://www.facebook.com/marketplace/1726010921001261/vehicles/?minPrice=500000&maxPrice=2000000&daysSinceListed=1&sortBy=creation_time_descend';

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
                location: newAd.location,
                modelYear: newAd.modelYear,
                capturedAt: new Date().toLocaleString()
            });
        }
    });
    if (ads.length > MAX_DB_SIZE) ads = ads.slice(ads.length - MAX_DB_SIZE);
    fs.writeFileSync(DB_FILE, JSON.stringify(ads, null, 2));
}

// 🚫 STRICT NON-CAR BLACKLIST FILTER
function isStrictlyCar(titleText) {
    if (!titleText) return false;
    const title = titleText.toLowerCase();
    
    const nonCarKeywords = [
        'bike', 'motorcycle', '70cc', '125cc', '150cc', 'honda 70', 'yamaha', 'suzuki gd',
        'rickshaw', 'rikshaw', 'chingchi', 'qingqi', 'loader', 'shehzore', 'truck', 'dumper', 
        'rim', 'tyre', 'tire', 'alloy rim', 'bumber', 'headlight', 'engine only', 'parts', 'accessories'
    ];

    return !nonCarKeywords.some(keyword => title.includes(keyword));
}

async function sendDiscordAlert(title, price, location, modelYear, link, imageSrc) {
    try {
        await axios.post(FB_DISCORD_WEBHOOK_URL, {
            username: "Facebook Marketplace Tracker",
            embeds: [{
                title: `🆕 [New FB Car Found] - ${title}`,
                url: link,
                color: 3860014, 
                fields: [
                    { name: "💰 Price", value: `**${price}**`, inline: true },
                    { name: "📅 Model Year", value: `\`${modelYear}\``, inline: true },
                    { name: "📍 Location", value: `\`${location}\``, inline: true },
                    { name: "🌐 Platform", value: "`Facebook Marketplace`", inline: true },
                    { name: "🔗 Direct Link", value: `👉 [Open Facebook Listing](${link})`, inline: false }
                ],
                thumbnail: { url: imageSrc || "https://upload.wikimedia.org/wikipedia/commons/c/cd/Facebook_Marketplace_Logo.svg" },
                footer: { text: "FB Pure Cars Filter • Karachi 5L-20L Strict" },
                timestamp: new Date()
            }]
        });
        console.log(`🚀 [Facebook] Alert with Model Year dispatched!`);
    } catch (err) {
        console.error('💥 FB Discord Webhook Failed:', err.message);
    }
}

async function checkFBMarketplace() {
    console.log(`[${new Date().toLocaleTimeString()}] Scanning Target Vehicles Sector (Model Year Extraction Active)...`);
    
    const browser = await puppeteer.launch({ 
        headless: true, 
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--window-size=1280,800'
        ]
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    await page.setCookie(...FB_COOKIES);

    try {
        const seenAds = getSeenAds();
        const seenIds = seenAds.map(ad => ad.id);
        let newAdsToSave = [];

        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 45000 });
        await new Promise(r => setTimeout(r, 6000)); 

        const fbAds = await page.evaluate(() => {
            let results = [];
            const links = document.querySelectorAll('a[href*="/marketplace/item/"]');
            
            links.forEach(link => {
                const href = link.getAttribute('href');
                if (!href) return;
                
                const cleanHref = href.split('?')[0];
                const idMatch = cleanHref.match(/\/item\/(\d+)/);
                if (!idMatch) return;
                const id = idMatch[1];

                const textSpans = link.querySelectorAll('span[style*="-webkit-line-clamp"]');
                
                let priceStr = "";
                let titleStr = "";
                let locationStr = "";

                if (textSpans && textSpans.length >= 2) {
                    priceStr = textSpans[0] ? textSpans[0].innerText.trim() : "";
                    titleStr = textSpans[1] ? textSpans[1].innerText.trim() : "";
                    locationStr = textSpans[2] ? textSpans[2].innerText.trim() : "Karachi";
                } else {
                    const rawText = link.innerText || "";
                    const lines = rawText.split('\n').map(t => t.trim()).filter(t => t.length > 0);
                    if (lines.length >= 3) {
                        priceStr = lines[0];
                        titleStr = lines[1];
                        locationStr = lines[2];
                    } else if (lines.length === 2) {
                        priceStr = lines[0];
                        titleStr = lines[1];
                        locationStr = "Karachi";
                    }
                }

                if (titleStr.startsWith('PKR') || titleStr.startsWith('रू')) {
                    let temp = priceStr;
                    priceStr = titleStr;
                    titleStr = temp;
                }

                // 📅 MODEL YEAR EXTRACTION VIA REGEX ROUTE
                // Scans the title block for digits between 2000 and 2026
                const combinedText = (titleStr + " " + link.innerText).toLowerCase();
                const yearMatch = combinedText.match(/\b(200[0-9]|201[0-9]|202[0-6])\b/);
                const extractedYear = yearMatch ? yearMatch[0] : "N/A";

                const imgNode = link.querySelector('img');
                const imgUrl = imgNode ? imgNode.getAttribute('src') : null;

                if (priceStr && titleStr && titleStr.length > 3) {
                    results.push({
                        id: id,
                        title: titleStr,
                        price: priceStr,
                        location: locationStr || "Karachi",
                        modelYear: extractedYear,
                        link: 'https://www.facebook.com' + cleanHref,
                        image: imgUrl
                    });
                }
            });
            return results;
        });

        console.log(`📊 FB Marketplace: Extracted ${fbAds.length} raw cards.`);

        for (const ad of fbAds) {
            const locLower = ad.location.toLowerCase();
            const isKarachi = locLower.includes('karachi') || locLower.includes('sindh') || locLower === 'karachi';

            if (!seenIds.includes(ad.id) && isKarachi && isStrictlyCar(ad.title)) {
                await sendDiscordAlert(ad.title, ad.price, ad.location, ad.modelYear, ad.link, ad.image);
                newAdsToSave.push({ id: ad.id, title: ad.title, price: ad.price, location: ad.location, modelYear: ad.modelYear });
            }
        }

        if (newAdsToSave.length > 0) {
            saveSeenAds(newAdsToSave);
        }

    } catch (error) {
        console.error('💥 FB Core Processor Loop Error:', error.message);
    } finally {
        await browser.close();
        console.log(`[${new Date().toLocaleTimeString()}] FB Precision Sweep complete.`);
    }
}

async function startStream() {
    console.log("⚓ Isolated FB Marketplace Scraper Active (Model Year Tuning).");
    while (true) {
        try {
            await checkFBMarketplace();
        } catch (e) {
            console.error("⚠️ FB System Loop crash:", e.message);
        }
        const cooldownMinutes = 5; 
        console.log(`⏳ Cooldown active. Next FB sweep in ${cooldownMinutes} minutes...`);
        await new Promise(r => setTimeout(r, cooldownMinutes * 60 * 1000));
    }
}

startStream();