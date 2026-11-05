// Génère les icônes PNG à partir de public/icon.svg (utilise Playwright/Chromium).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '../public/icon.svg'), 'utf8');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['apple-touch-icon.png', 180, 0]]) {
    await page.setViewportSize({ width: size, height: size });
    const bg = name.startsWith('apple') ? '#2457c5' : 'transparent';
    await page.setContent(`<html><body style="margin:0;background:${bg}"><div style="width:${size}px;height:${size}px;padding:${pad}px;box-sizing:border-box">${svg.replace('<svg ', `<svg width="${size - 2 * pad}" height="${size - 2 * pad}" `)}</div></body></html>`);
    await page.screenshot({ path: path.join(__dirname, '../public', name), omitBackground: bg === 'transparent' });
  }
  await browser.close();
})();
