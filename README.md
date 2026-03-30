# Website Crawler / Offline Cloner

A lightweight Node.js CLI tool that crawls a website and saves pages and same-site assets to a local directory for offline browsing.

## Features

- **Headless crawling with Puppeteer**
  - Renders pages in Chromium to capture JavaScript-generated content.
  - Waits for `networkidle2` to reduce the chance of saving incomplete pages.

- **Recursive link traversal (same origin / base URL)**
  - Extracts links from `<a>` elements and crawls them recursively.
  - Restricts navigation to URLs that start with the provided `BASE_URL` to avoid leaving the target site.

- **Depth limiting**
  - Stops crawling after `MAX_DEPTH` to prevent runaway recursion and excessively large downloads.

- **Request throttling**
  - Adds a configurable delay (`DELAY`) between requests to reduce load on the target server.

- **Deterministic output structure**
  - Writes output to `site/<hostname>/...` so multiple targets don’t overwrite each other.
  - Example: `https://www.example.com` → `site/www.example.com/`

- **HTML capture**
  - Saves the rendered HTML for each visited page.
  - Maps URLs to local files; paths ending in `/` or lacking an extension are saved as `index.html`.

- **Same-site asset downloading**
  - Collects and downloads common assets referenced by:
    - `img`
    - `script[src]`
    - `link[href]` (typically CSS)
  - Downloads only assets whose URLs start with `BASE_URL`.

- **De-duplication**
  - Uses a `visited` set to avoid crawling the same page more than once.
  - Uses a `downloadedAssets` set to avoid downloading the same asset repeatedly.

- **Readable console output**
  - Uses Chalk for clear, colorized status messages for pages, assets, and errors.

## How it works (high level)

1. Launch a headless Chromium instance via Puppeteer.
2. Navigate to the start URL.
3. Save the fully rendered HTML to disk.
4. Extract asset URLs from the page and download eligible assets.
5. Extract internal links and continue crawling until `MAX_DEPTH` is reached.

## Usage
