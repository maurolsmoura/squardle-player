import puppeteer from 'puppeteer';

async function launchOrConnectBrowser() {
  const browserHost = process.env.BROWSER_HOST || 'http://localhost:9222';

  try {
    const browser = await puppeteer.connect({
      browserURL: browserHost,
    });
    console.log(`Connected to browser at ${browserHost}`);
    return browser;
  } catch {
    console.log(`No browser found at ${browserHost}, launching a new one...`);

    // Always launch in non-headless mode for development and debugging
    const browser = await puppeteer.launch({
      headless: false,
      args: [
        `--remote-debugging-port=9222`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    console.log(
      `Browser launched in non-headless mode with remote debugging on port 9222`,
    );
    return browser;
  }
}

async function main() {
  try {
    const browser = await launchOrConnectBrowser();
    console.log('Browser is ready!');

    // Keep the process alive so the browser stays open
    process.on('SIGINT', () => {
      console.log('Shutting down browser...');
      browser
        .close()
        .then(() => {
          process.exit(0);
        })
        .catch((err) => {
          console.error('Error closing browser:', err);
          process.exit(1);
        });
    });
  } catch (err) {
    console.error('Failed to launch or connect to browser:', err);
    process.exit(1);
  }
}

main();
