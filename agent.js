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