const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { URL } = require('url');

// Chalk v5 is ESM-only; use the Chalk class which works via require()
const { Chalk } = require('chalk');
const chalk = new Chalk();

// CLI ARG
const BASE_URL = process.argv[2];
if (!BASE_URL) {
  console.log('Usage: node clone.js https://example.com');
  process.exit(1);
}

const OUTPUT_DIR = path.join(__dirname, 'site');

// Save each crawl into its own subfolder: site/<hostname>/...
const SITE_DIR = (() => {
  try {
    const u = new URL(BASE_URL);
    return path.join(OUTPUT_DIR, u.hostname);
  } catch {
    // Fallback if BASE_URL is not a valid URL for some reason
    return OUTPUT_DIR;
  }
})();

const visited = new Set();
const downloadedAssets = new Set();

const MAX_DEPTH = 3;
const DELAY = 500;

// Delay helper
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Convert URL → local file path
function getFilePath(url) {
  const u = new URL(url);
  let filePath = u.pathname;

  if (filePath.endsWith('/')) filePath += 'index.html';
  if (!path.extname(filePath)) filePath += '/index.html';

  return path.join(SITE_DIR, filePath);
}

// Download asset
async function downloadFile(fileUrl) {
  if (downloadedAssets.has(fileUrl)) return;
  downloadedAssets.add(fileUrl);

  try {
    const filePath = getFilePath(fileUrl);
    await fs.ensureDir(path.dirname(filePath));

    const res = await axios({
      url: fileUrl,
      responseType: 'arraybuffer',
      timeout: 10000
    });

    await fs.writeFile(filePath, res.data);
    console.log(chalk.green('Asset:'), fileUrl);
  } catch (err) {
    console.log(chalk.red('Failed asset:'), fileUrl);
  }
}

// Rewrite URLs for offline use
function rewriteUrls(html, base) {
  return html.replaceAll(base, '.');
}

// Crawl page
async function crawl(browser, url, depth = 0) {
  if (visited.has(url) || depth > MAX_DEPTH) return;
  visited.add(url);

  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    let html = await page.content();
    html = rewriteUrls(html, BASE_URL);

    const filePath = getFilePath(url);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, html);

    console.log(chalk.blue('Page:'), url);

    // Extract assets
    const assets = await page.$$eval(
      'img, script[src], link[href]',
      els => els.map(el => el.src || el.href).filter(Boolean)
    );

    for (let asset of assets) {
      if (asset.startsWith(BASE_URL)) {
        await downloadFile(asset);
      }
    }

    // Extract links
    const links = await page.$$eval(
      'a',
      as => as.map(a => a.href).filter(Boolean)
    );

    await page.close();

    // Crawl links
    for (let link of links) {
      if (link.startsWith(BASE_URL)) {
        await sleep(DELAY);
        await crawl(browser, link, depth + 1);
      }
    }

  } catch (err) {
    console.log(chalk.red('Failed page:'), url);
    await page.close();
  }
}

// Run
(async () => {
  console.log(chalk.yellow('Starting crawl:'), BASE_URL);
  console.log(chalk.yellow('Output folder:'), SITE_DIR);

  const browser = await puppeteer.launch({
    headless: true
  });

  await crawl(browser, BASE_URL);

  await browser.close();

  console.log(chalk.green('\nDone! Files saved in /site folder'));
})();