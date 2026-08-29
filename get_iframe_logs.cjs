const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  await page.goto('http://localhost:3000', {waitUntil: 'networkidle2'});
  
  const html = await page.evaluate(() => document.body.innerHTML);
  console.log('BODY HTML LENGTH:', html.length);
  if (html.length < 2000) {
     console.log('BODY HTML:', html);
  }
  
  await browser.close();
})();
