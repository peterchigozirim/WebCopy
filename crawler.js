const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { URL } = require('url');

const BASE_URL = 'https://www.estaportestates.com';
const OUTPUT_DIR = path.join(__dirname, 'site');

const visited = new Set();

function getFilePath(url) {
  const u = new URL(url);
  let filePath = u.pathname;

  if (filePath.endsWith('/')) filePath += 'index.html';
  if (!path.extname(filePath)) filePath += '/index.html';

  return path.join(OUTPUT_DIR, filePath);
}

async function downloadFile(fileUrl) {
  try {
    const filePath = getFilePath(fileUrl);
    await fs.ensureDir(path.dirname(filePath));

    const response = await axios({
      url: fileUrl,
      responseType: 'arraybuffer'
    });

    await fs.writeFile(filePath, response.data);
    console.log('Downloaded:', fileUrl);
  } catch (err) {
    console.log('Failed:', fileUrl);
  }
}

async function processPage(page, url, browser) {
  if (visited.has(url)) return;
  visited.add(url);

  await page.goto(url, { waitUntil: 'networkidle2' });

  const html = await page.content();
  const filePath = getFilePath(url);

  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, html);

  console.log('Saved page:', url);

  // Extract assets
  const assets = await page.$$eval(
    'img, script[src], link[href]',
    elements =>
      elements.map(el => el.src || el.href).filter(Boolean)
  );

  // Download assets
  for (let asset of assets) {
    if (asset.startsWith(BASE_URL)) {
      await downloadFile(asset);
    }
  }

  // Extract links
  const links = await page.$$eval('a', as =>
    as.map(a => a.href).filter(h => h.startsWith(location.origin))
  );

  await page.close();

  for (let link of links) {
    await processPage(await browser.newPage(), link, browser);
  }
}

(async () => {
  const browser = await puppeteer.launch();

  const page = await browser.newPage();
  await processPage(page, BASE_URL, browser);

  await browser.close();
})();