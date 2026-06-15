const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Tell puppeteer-extra to use puppeteer-core as the underlying driver
const puppeteer = puppeteerExtra.use(StealthPlugin());
puppeteer.vanillaLauncher = require('puppeteer-core'); 

// --- CONFIGURATION ---
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1516120799038275665/bDyYMwOCs6kJQFlMysG-jCUTIYhahfXPTvozJC-jC1EhkLSCJzJ_VakPbuU8TIV_5M3W'; 
const DB_FILE = path.join(__dirname, 'seen_ads.json'); 
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 

const MIN_PRICE = 500000;  
const MAX_PRICE = 2000000; // 20 Lakh Budget

const TARGETS = {
    pakwheels: 'https://www.pakwheels.com/used-cars/search/-/ct_karachi/pr_500000_2000000/srt_date-desc/',
    olx: 'https://www.olx.com.pk/karachi_g4060695/cars_c84?filter=price_between_500000_to_2000000&sort=date_desc'
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

// AI AGENT ENGINE 
async function analyzeDealWithAI(title, price, specs) {
    if (!GEMINI_API_KEY) {
        return { score: "N/A (No Key)", flaws: "Skipped", pitch: "Salam, gari available hai? Final price kya hogi?" };
    }
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const prompt = `You are an expert car flipper and car market analyst in Karachi, Pakistan. Analyze this car ad and reply strictly in valid JSON format.
        Car Title: ${title}
        Price: ${price}
        Details/Specs: ${specs}

        Analyze hidden flaws (look for mentions of touchups, engine sounds, documentation issues, or aggressive urgent sales). Rate the deal from 1 to 10 for flipping potential (Flipping Score). Provide a high-converting, professional negotiation text in Roman Urdu/English that a buyer can send to the seller to lock down the deal quickly.

        Return ONLY a JSON object with this exact structure (do not include markdown block quotes or backticks, just raw JSON):
        {
          "flaws": "Short list of identified issues or concerns",
          "score": "A number from 1-10 with a short reason",
          "pitch": "The Roman Urdu text pitch to send to the seller"
        }`;

        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        });

        let rawText = response.data.candidates[0].content.parts[0].text;
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(rawText);
    } catch (err) {
        return { score: "Error", flaws: "Failed to extract", pitch: "Salam, gari available hai? Final price kya hogi?" };
    }
}

async function sendDiscordAlert(carData, aiAnalysis) {
    let colors = { 'PakWheels': 1240319, 'OLX': 1999204 };
    let adId = carData.id;
    if (carData.platform === 'PakWheels' && adId.includes('-')) {
        adId = adId.split('-').pop();
    }
    const appLink = getAppRedirectLinks(carData.link, carData.platform, adId);
    const cleanTitle = carData.title.replace(/\s+/g, ' ').trim();

    try {
        await axios.post(DISCORD_WEBHOOK_URL, {
            username: "Karachi Market Intelligence Agent",
            avatar_url: "https://i.imgur.com/w8N4G8W.png",
            embeds: [{
                title: `🤖 AI DETECTED (${carData.platform}): ${cleanTitle}`,
                url: carData.link, 
                color: colors[carData.platform] || 8421504,
                description: `> 📱 **[Redirect to Native Mobile App](${appLink})** for instant call/chat.`,
                fields: [
                    { name: "💰 Financials", value: `\`\`\`💵 Price: ${carData.price}\`\`\``, inline: false },
                    { name: "📋 Vehicle Specs", value: `• **Year:** ${carData.year}\n• **Mileage:** ${carData.mileage}\n• **Source:** ${carData.platform}`, inline: true },
                    { name: "🎯 Flipping ROI Score", value: `⭐ **\`${aiAnalysis.score}\`**`, inline: true },
                    { name: "🔍 AI Risk Analysis & Flaws", value: `\`\`\`txt\n${aiAnalysis.flaws}\n\`\`\``, inline: false },
                    { name: "💬 Instant Negotiation Pitch (Copy-Paste)", value: `\`\`\`txt\n${aiAnalysis.pitch}\n\`\`\``, inline: false }
                ],
                footer: { text: "Automated Arbitrage Agent Engine | Budget: 5L - 20L" },
                timestamp: new Date()
            }]
        });
        console.log(`💼 AI Routed ${cleanTitle} to Discord.`);
    } catch (err) { 
        console.error('Dispatch Failed', err.message); 
    }
}

async function run() {
    console.log(`Scanning Marketplaces...`);
    const browser = await puppeteer.launch({ 
        headless: "new", 
        executablePath: '/usr/bin/google-chrome', 
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage', 
            '--disable-gpu',
            '--window-size=1920,1080'
        ] 
    });
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
        const seenAds = getSeenAds();

        // === 1. PAKWHEELS SCRAPER ===
        try {
            console.log("Crawling Pakwheels feeds...");
            await page.goto(TARGETS.pakwheels, { waitUntil: 'networkidle2', timeout: 60000 });
            const pwAds = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('.classified-listing')).map(el => {
                    const linkEl = el.querySelector('a.car-name');
                    const priceEl = el.querySelector('.price-details');
                    const specsList = el.querySelector('.search-vehicle-info-v2, .search-vehicle-info');
                    return { id: linkEl?.getAttribute('href'), title: linkEl?.innerText.trim() || "", price: priceEl?.innerText.trim() || "0", rawSpecs: specsList?.innerText.replace(/\s+/g, ' ').trim() || "" };
                }).filter(ad => ad.id);
            });
            console.log(`Found ${pwAds.length} candidate listings on Pakwheels.`);
            for (let ad of pwAds) {
                const numericPrice = parsePrice(ad.price);
                if (numericPrice >= MIN_PRICE && numericPrice <= MAX_PRICE && !seenAds.includes(ad.id)) {
                    const aiAnalysis = await analyzeDealWithAI(ad.title, ad.price, ad.rawSpecs);
                    await sendDiscordAlert({ id: ad.id, title: ad.title, price: ad.price, link: 'https://www.pakwheels.com' + ad.id, platform: 'PakWheels', year: ad.rawSpecs.match(/\b(20\d{2})\b/)?.[0] || "N/A", mileage: ad.rawSpecs.match(/[\d,]+\s*km/i)?.[0] || "N/A", specs: ad.rawSpecs }, aiAnalysis);
                    saveSeenAd(ad.id);
                }
            }
        } catch (err) { console.error("Pakwheels scraper segment failed:", err.message); }

        // === 2. EXTENDED OLX MULTI-SELECTOR SCRAPER ===
        try {
            console.log("Crawling OLX feeds with Multi-Selector Engine...");
            await page.goto(TARGETS.olx, { waitUntil: 'networkidle2', timeout: 60000 });
            
            await new Promise(r => setTimeout(r, 5000));

            const olxAds = await page.evaluate(() => {
                const items = document.querySelectorAll('article[data-aut-id="item"], li[data-aut-id="item"], div[data-aut-id="item"], ._4146a894');
                return Array.from(items).map(el => {
                    const linkEl = el.querySelector('a');
                    const priceEl = el.querySelector('[data-aut-id="itemPrice"]') || el.querySelector('span._95eae7db') || el.querySelector('span');
                    const titleEl = el.querySelector('[data-aut-id="itemTitle"]') || el.querySelector('h2') || el.querySelector('div._2a0c7c8f');
                    const subtitleEl = el.querySelector('[data-aut-id="itemSubTitle"]') || el.querySelector('div._1075545d') || el.querySelector('span._2e82aab6');
                    const locationEl = el.querySelector('[data-aut-id="itemLocation"]') || el.querySelector('span._2e82aab6');

                    let rawHref = linkEl?.getAttribute('href') || "";
                    let cleanId = rawHref.split('-').pop() || Math.random().toString();
                    if(cleanId.includes('/')) cleanId = cleanId.split('/').pop();

                    return { 
                        id: cleanId, 
                        title: titleEl?.innerText.trim() || "", 
                        price: priceEl?.innerText.trim() || "0", 
                        sub: subtitleEl?.innerText.trim() || "", 
                        loc: locationEl?.innerText.trim() || "Karachi", 
                        link: linkEl ? (linkEl.getAttribute('href').startsWith('http') ? linkEl.getAttribute('href') : 'https://www.olx.com.pk' + linkEl.getAttribute('href')) : "" 
                    };
                }).filter(ad => ad.link && ad.title);
            });

            console.log(`Found ${olxAds.length} candidate listings on OLX.`);
            
            for (let ad of olxAds) {
                if ((ad.title + " " + ad.loc).toLowerCase().includes('karachi')) {
                    const numericPrice = parsePrice(ad.price);
                    if (numericPrice >= MIN_PRICE && numericPrice <= MAX_PRICE && !seenAds.includes(ad.id)) {
                        const fullSpecs = `Location: ${ad.loc} | Details: ${ad.sub}`;
                        const aiAnalysis = await analyzeDealWithAI(ad.title, ad.price, fullSpecs);
                        await sendDiscordAlert({ id: ad.id, title: ad.title, price: ad.price, link: ad.link, platform: 'OLX', year: ad.sub.match(/\b(20\d{2})\b/)?.[0] || "N/A", mileage: ad.sub.match(/[\d,]+\s*km/i)?.[0] || "N/A", specs: fullSpecs }, aiAnalysis);
                        saveSeenAd(ad.id);
                    }
                }
            }
        } catch (err) { console.error("OLX scraper segment failed:", err.message); }

    } catch (e) { console.error(e); }
    finally { await browser.close(); }
}

run();