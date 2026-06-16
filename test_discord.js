const axios = require('axios');
const DISCORD_WEBHOOK_URL = 'YOUR_DISCORD_WEBHOOK_URL_HERE'; // Apna real URL yahan lagayein

async function testAlert() {
    try {
        await axios.post(DISCORD_WEBHOOK_URL, {
            username: "Tester Engine",
            embeds: [{
                title: "🚀 Test Alert: Discord Connection Success!",
                description: "Agar yeh message aaya hai, toh webhook perfectly kaam kar raha hai!",
                color: 65280,
                timestamp: new Date()
            }]
        });
        console.log("✅ Test alert sent! Discord check karo.");
    } catch (err) {
        console.error("❌ Webhook Failed. Error:", err.message);
    }
}
testAlert();