const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1516120799038275665/bDyYMwOCs6kJQFlMysG-jCUTIYhahfXPTvozJC-jC1EhkLSCJzJ_VakPbuU8TIV_5M3W';
const DB_FILE = path.join(__dirname, 'seen_pw.json');

async function runPW() {
    console.log("🚗 Starting PakWheels Scraper...");
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    try {
        await page.goto('https://www.pakwheels.com/used-cars/search/-/ct_karachi/pr_500000_2000000/srt_date-desc/', { waitUntil: 'domcontentloaded', timeout: 45000 });
        const pwAds = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.classified-listing')).map(el => ({
                id: el.querySelector('a.car-name')?.getAttribute('href'),
                title: el.querySelector('a.car-name')?.innerText.trim(),
                price: el.querySelector('.price-details')?.innerText.trim(),
                link: 'https://www.pakwheels.com' + el.querySelector('a.car-name')?.getAttribute('href')
            })).filter(i => i.id);
        });

        let seen = fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE)) : [];
        for (const ad of pwAds) {
            if (!seen.includes(ad.id)) {
                await axios.post(DISCORD_WEBHOOK, { embeds: [{ title: `🚗 PakWheels: ${ad.title}`, description: `Price: ${ad.price}\n[Link](${ad.link})`, color: 1240319 }] });
                seen.push(ad.id);
            }
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(seen.slice(-500)));
    } catch (e) { console.error("PW Error:", e.message); }
    await browser.close();
}

setInterval(runPW, 300000); // 5 mins
runPW();
