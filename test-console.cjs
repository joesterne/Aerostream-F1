const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'warning' || msg.type() === 'error') {
      console.log(`[${msg.type()}] ${msg.text()}`);
    }
  });

  await page.goto('http://localhost:3000');
  await new Promise(r => setTimeout(r, 5000));
  await browser.close();
})();
