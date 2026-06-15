const puppeteer = require('puppeteer'); 
const axios = require('axios');

async function run() {
    console.log("Agent is running...");
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log("Browser launched successfully!");
    await browser.close();
    console.log("Agent finished successfully.");
}

run().catch(err => {
    console.error("Agent Error:", err);
    process.exit(1);
});