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


const axios = require('axios');

async function run() {
    console.log("🚀 Agent initiated...");
    const url = 'YOUR_WEBHOOK_URL_HERE'; // Apni URL yahan paste karo

    try {
        const response = await axios.post(url, {
            content: "✅ Agent is running successfully! If you see this, the Webhook is working."
        });
        console.log("Notification status:", response.status);
    } catch (error) {
        console.error("❌ WEBHOOK ERROR:", error.response ? error.response.data : error.message);
    }
}

run();