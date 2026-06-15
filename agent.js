const axios = require('axios');

async function run() {
    console.log("Agent started scanning...");
    
    // Test Webhook Notification
    try {
        await axios.post('YOUR_WEBHOOK_URL_HERE', {
            content: "🤖 Agent is alive and scanning the market!"
        });
        console.log("Test notification sent to Discord.");
    } catch (error) {
        console.error("Webhook Error:", error.message);
    }
}

run();
async function run() {
    console.log("Initializing Agent...");
    // Dynamic import to bypass ESM conflict
    const puppeteer = await import('puppeteer');
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