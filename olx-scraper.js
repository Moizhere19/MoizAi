const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1516120799038275665/bDyYMwOCs6kJQFlMysG-jCUTIYhahfXPTvozJC-jC1EhkLSCJzJ_VakPbuU8TIV_5M3W';
const DB_FILE = path.join(__dirname, 'seen_olx.json');

async function runOLX() {
    console.log("🚀 Turbo Mode: Fetching Live OLX Data...");
    // ⚡ Fast browser settings
    const browser = await puppeteer.launch({ 
        headless: 'new', 
        args: ['--no-sandbox', '--disable-dev-shm-usage'] 
    });
    
    const page = await browser.newPage();
    // ⚡ Request blocking to make it faster (don't load images/css)
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'stylesheet', 'font'].includes(req.resourceType())) req.abort();
        else req.continue();
    });

    try {
        // ⚡ Fast navigation
        await page.goto('https://www.olx.com.pk/karachi_g4060695/cars_c84?filter=price_between_500000_to_2000000&sort=date_desc', { 
            waitUntil: 'domcontentloaded', 
            timeout: 20000 
        });

        const olxAds = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('li[data-aut-id="itemBox"]')).map(el => ({
                id: el.querySelector('a')?.getAttribute('href'),
                title: el.querySelector('span[data-aut-id="itemTitle"]')?.innerText.trim(),
                price: el.querySelector('span[data-aut-id="itemPrice"]')?.innerText.trim(),
                link: 'https://www.olx.com.pk' + el.querySelector('a')?.getAttribute('href')
            })).filter(i => i.title);
        });

        let seen = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE)) : [];
        for (const ad of olxAds) {
            if (!seen.includes(ad.id)) {
                await axios.post(DISCORD_WEBHOOK, { embeds: [{ title: `⚡ LIVE OLX: ${ad.title}`, description: `Price: ${ad.price}\n[Link](${ad.link})`, color: 16738304 }] });
                seen.push(ad.id);
            }
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(seen.slice(-500)));
    } catch (e) { console.error("Turbo OLX Error:", e.message); }
    
    await browser.close();
}

// ⚡ Scan every 60 seconds (1 minute) instead of 5 minutes
setInterval(runOLX, 60000); 
runOLX();
