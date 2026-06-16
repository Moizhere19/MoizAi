const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1516120799038275665/bDyYMwOCs6kJQFlMysG-jCUTIYhahfXPTvozJC-jC1EhkLSCJzJ_VakPbuU8TIV_5M3W';
const DB_FILE = path.join(__dirname, 'seen_pw.json');

async function sendProfessionalAlert(title, price, link, platform) {
    const embed = {
        title: `Market Intelligence: ${platform} Listing`,
        url: link,
        color: 0x2C3E50,
        fields: [
            { name: "Asset Description", value: `**${title}**`, inline: false },
            { name: "Valuation", value: `${price}`, inline: true },
            { name: "Source", value: `${platform}`, inline: true },
            { name: "Reference", value: `[Access Verified Listing](${link})`, inline: false }
        ],
        footer: { text: `System Timestamp: ${new Date().toUTCString()} | Status: Validated` }
    };
    await axios.post(DISCORD_WEBHOOK, { embeds: [embed] }).catch(console.error);
}

async function runPW() {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (req) => { if (['image', 'stylesheet', 'font'].includes(req.resourceType())) req.abort(); else req.continue(); });

    try {
        await page.goto('https://www.pakwheels.com/used-cars/search/-/ct_karachi/pr_500000_2000000/srt_date-desc/', { waitUntil: 'domcontentloaded', timeout: 20000 });
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
                await sendProfessionalAlert(ad.title, ad.price, ad.link, 'PakWheels');
                seen.push(ad.id);
            }
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(seen.slice(-500)));
    } catch (e) { console.error("PW Error:", e.message); }
    await browser.close();
}

setInterval(runPW, 60000);
runPW();
