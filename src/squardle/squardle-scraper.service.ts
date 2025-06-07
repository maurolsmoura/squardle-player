import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { Cell, BoardState, Language } from '../types/squardle.types';

/**
 * Service responsible for scraping the Squardle game board state using Puppeteer.
 * Connects to an existing browser instance and navigates the game.
 */
@Injectable()
export class SquardleScraperService implements OnModuleInit {
  private readonly logger = new Logger(SquardleScraperService.name);

  private readonly SQUARDLE_URL = 'https://fubargames.se/squardle/index.html';
  private readonly BROWSER_ENDPOINT =
    process.env.BROWSER_HOST || 'http://localhost:9222';
  private readonly NAVIGATION_TIMEOUT = 30000;
  private readonly WAIT_FOR_ELEMENT_TIMEOUT = 10000;

  private browser: puppeteer.Browser | null = null;
  private page: puppeteer.Page | null = null;

  /**
   * Called when the module is initialized. Connects to browser on startup.
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Connecting to browser on startup...');

    try {
      await this.connectToBrowser();
      this.logger.log(
        '✅ Browser connection established successfully on startup',
      );
    } catch (error) {
      this.logger.error('❌ Failed to connect to browser on startup');
      this.logger.error(`Make sure to run 'npm run browser-start' first`);
      this.logger.error(`Browser endpoint: ${this.BROWSER_ENDPOINT}`);
      this.logger.error('Error:', this.getErrorMessage(error));

      // Fail the application startup
      throw new Error(
        `Browser connection failed: ${this.getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Connects to the existing browser instance started with the browser:start script.
   */
  private async connectToBrowser(): Promise<void> {
    this.logger.log('Connecting to existing browser instance');

    try {
      this.browser = await puppeteer.connect({
        browserURL: this.BROWSER_ENDPOINT,
      });

      const pages = await this.browser.pages();
      this.page = pages.length > 0 ? pages[0] : await this.browser.newPage();

      await this.page.setViewport({ width: 1280, height: 1080 });

      this.logger.log('Connected to browser successfully');
    } catch (error) {
      throw new Error(
        `Failed to connect to browser. Make sure to run 'npm run browser:start' first. Error: ${this.getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Navigates to the Squardle homepage and executes togglePage('game') function.
   */
  private async navigateToGame(): Promise<void> {
    if (!this.page) throw new Error('No active page');

    this.logger.log('Navigating to Squardle homepage');

    await this.page.goto(this.SQUARDLE_URL, {
      waitUntil: 'networkidle2',
      timeout: this.NAVIGATION_TIMEOUT,
    });

    this.logger.log('Executing togglePage("game") function');

    // Wait for the page to load completely
    await this.delay(2000);

    // Execute the togglePage('game') function directly
    await this.page.evaluate(() => {
      // Check if togglePage function exists and call it
      interface SquardleWindow extends Window {
        togglePage?: (page: string) => void;
      }

      const squardleWindow = window as SquardleWindow;

      if (typeof squardleWindow.togglePage === 'function') {
        squardleWindow.togglePage('game');
      } else {
        throw new Error('togglePage function not found on the page');
      }
    });

    this.logger.log('Successfully executed togglePage("game")');
  }

  /**
   * Waits for the game selection screen and executes startGame(false) function.
   */
  private async startFreeplayGame(): Promise<void> {
    if (!this.page) throw new Error('No active page');

    this.logger.log(
      'Executing startGame(false) function for FREEPLAY SQUARDLE',
    );

    // Wait a moment for the page to transition
    await this.delay(2000);

    // Execute the startGame(false) function directly
    await this.page.evaluate(() => {
      // Check if startGame function exists and call it
      interface SquardleWindow extends Window {
        startGame?: (param: boolean) => void;
      }

      const squardleWindow = window as SquardleWindow;

      if (typeof squardleWindow.startGame === 'function') {
        squardleWindow.startGame(false);
      } else {
        throw new Error('startGame function not found on the page');
      }
    });

    this.logger.log('Successfully executed startGame(false)');
  }

  /**
   * Waits for the game board to load completely.
   */
  private async waitForBoardToLoad(): Promise<void> {
    if (!this.page) throw new Error('No active page');

    this.logger.log('Waiting for game board to load');

    // Wait for the board elements to be present
    await this.page.waitForSelector('#squaresDiv', {
      timeout: this.WAIT_FOR_ELEMENT_TIMEOUT,
    });
    await this.page.waitForSelector('#lettersDiv', {
      timeout: this.WAIT_FOR_ELEMENT_TIMEOUT,
    });

    // Give it a moment for dynamic content to load
    await this.delay(2000);

    this.logger.log('Game board loaded');
  }

  /**
   * Extracts the next guess index (column) from the columnMarker element.
   */
  private async extractNextGuessIndex(page: puppeteer.Page): Promise<number> {
    const nextGuessIndex = await page.evaluate(() => {
      const columnMarkerElement = document.getElementById('columnMarker');
      if (!columnMarkerElement) return 0;

      // Get the left position of the column marker
      const markerStyle = window.getComputedStyle(columnMarkerElement);
      const markerLeft = parseInt(markerStyle.left, 10);

      // Get board positioning from squaresDiv
      const boardElement = document.getElementById('squaresDiv');
      if (!boardElement) return 0;

      const boardStyle = window.getComputedStyle(boardElement);
      const boardLeft = parseInt(boardStyle.left, 10);

      // Get column width from the first table cell
      const firstCell = document.getElementById('0_0');
      if (!firstCell) return 0;

      const cellStyle = window.getComputedStyle(firstCell);
      const columnWidth = parseInt(cellStyle.width, 10);

      // Calculate which column the marker is over
      // Marker position relative to board start
      const relativePosition = markerLeft - boardLeft;

      // Calculate column index (marker points to center of column)
      const columnIndex = Math.round(relativePosition / columnWidth);

      // Ensure the index is within valid range (0-4)
      return Math.max(0, Math.min(4, columnIndex));
    });

    return nextGuessIndex;
  }

  /**
   * Extracts the remaining guesses count from the page.
   */
  private async extractRemainingGuesses(page: puppeteer.Page): Promise<number> {
    const guessesRemaining = await page.evaluate(() => {
      const remainingElement = document.getElementById('remainingNumberCss');
      return remainingElement?.textContent?.trim()
        ? parseInt(remainingElement.textContent.trim(), 10)
        : 0;
    });

    return guessesRemaining;
  }

  /**
   * Extracts the current language from the topBar logo image.
   */
  private async extractLanguage(page: puppeteer.Page): Promise<Language> {
    const language = await page.evaluate(() => {
      // First try to find the topBar element
      const topBarElement = document.getElementById('topBar');
      if (!topBarElement) {
        return 'en'; // Default to English if topBar not found
      }

      // Look for all img elements within topBar
      const imgElements = topBarElement.querySelectorAll('img');

      for (const imgElement of imgElements) {
        const imgSrc = imgElement.src;

        // Check if this is the logo image (contains 'squardle_logo_color')
        if (imgSrc && imgSrc.includes('squardle_logo_color')) {
          console.log('imgSrc', imgSrc);
          if (imgSrc.includes('squardle_logo_color_br.png')) {
            return 'pt-br'; // Portuguese (Brazil)
          } else if (imgSrc.includes('squardle_logo_color_es.png')) {
            return 'es'; // Spanish
          } else if (imgSrc.includes('squardle_logo_color_de.png')) {
            return 'de'; // German
          } else if (imgSrc.includes('squardle_logo_color_sv.png')) {
            return 'sv'; // Swedish
          } else {
            return 'en'; // English (squardle_logo_color.png or default)
          }
        }
      }

      // Fallback: try the direct logo element approach
      const logoElement = document.getElementById('logo') as HTMLImageElement;
      if (logoElement && logoElement.src) {
        const logoSrc = logoElement.src;

        if (logoSrc.includes('squardle_logo_color_br.png')) {
          return 'pt-br';
        } else if (logoSrc.includes('squardle_logo_color_es.png')) {
          return 'es';
        } else if (logoSrc.includes('squardle_logo_color_de.png')) {
          return 'de';
        } else if (logoSrc.includes('squardle_logo_color_sv.png')) {
          return 'sv';
        } else {
          return 'en';
        }
      }

      return 'en'; // Default to English
    });

    return language as Language;
  }

  /**
   * Extracts the 5x5 board state from the loaded game page.
   */
  private async extractBoardState(page: puppeteer.Page): Promise<{
    guessesRemaining: number;
    nextGuessIndex: number;
    language: Language;
    boardState: any[][];
  }> {
    this.logger.log('Extracting board state from page');

    // Extract all data separately for clean separation of concerns
    const guessesRemaining = await this.extractRemainingGuesses(page);
    const nextGuessIndex = await this.extractNextGuessIndex(page);
    const language = await this.extractLanguage(page);

    const boardState = await page.evaluate(() => {
      const board: any[][] = [];

      // Define which cells are valid (cross-shaped layout)
      const isValidCell = (x: number, y: number): boolean => {
        return !(
          (x === 1 && y === 1) ||
          (x === 1 && y === 3) ||
          (x === 3 && y === 1) ||
          (x === 3 && y === 3)
        );
      };

      // Helper function to determine hint type from background image
      const getHintTypeFromImage = (imageSrc: string): string => {
        if (imageSrc.includes('greener.png')) {
          return 'Green'; // Green = correct letter in correct position
        } else if (imageSrc.includes('yellower01.png')) {
          return 'HorizontalSimple'; // Yellow with 1 arrow = letter is in correct row
        } else if (imageSrc.includes('yellower02.png')) {
          return 'HorizontalDouble'; // Yellow with 2 arrows
        } else if (imageSrc.includes('yellower03.png')) {
          return 'HorizontalTriple'; // Yellow with 3 arrows
        } else if (imageSrc.includes('redder10.png')) {
          return 'VerticalSimple'; // Red with 1 arrow = letter is in correct column
        } else if (imageSrc.includes('redder20.png')) {
          return 'VerticalDouble'; // Red with 2 arrows
        } else if (imageSrc.includes('redder30.png')) {
          return 'VerticalTriple'; // Red with 3 arrows
        } else if (imageSrc.includes('oranger11.png')) {
          return 'OrangeSimpleVerticalSimpleHorizontal'; // 1 vertical, 1 horizontal
        } else if (imageSrc.includes('oranger12.png')) {
          return 'OrangeSimpleVerticalDoubleHorizontal'; // 1 vertical, 2 horizontal
        } else if (imageSrc.includes('oranger13.png')) {
          return 'OrangeSimpleVerticalTripleHorizontal'; // 1 vertical, 3 horizontal
        } else if (imageSrc.includes('oranger21.png')) {
          return 'OrangeDoubleVerticalSimpleHorizontal'; // 2 vertical, 1 horizontal
        } else if (imageSrc.includes('oranger22.png')) {
          return 'OrangeDoubleVerticalDoubleHorizontal'; // 2 vertical, 2 horizontal
        } else if (imageSrc.includes('oranger23.png')) {
          return 'OrangeDoubleVerticalTripleHorizontal'; // 2 vertical, 3 horizontal
        } else if (imageSrc.includes('oranger31.png')) {
          return 'OrangeTripleVerticalSimpleHorizontal'; // 3 vertical, 1 horizontal
        } else if (imageSrc.includes('oranger32.png')) {
          return 'OrangeTripleVerticalDoubleHorizontal'; // 3 vertical, 2 horizontal
        } else if (imageSrc.includes('oranger33.png')) {
          return 'OrangeTripleVerticalTripleHorizontal'; // 3 vertical, 3 horizontal
        } else if (imageSrc.includes('blacker.png')) {
          return 'Black';
        } else if (imageSrc.includes('whiter.png')) {
          return 'White';
        }
        return 'White'; // Default
      };

      // Extract board state
      for (let y = 0; y < 5; y++) {
        const row: any[] = [];
        for (let x = 0; x < 5; x++) {
          // Check if this is a valid gameplay cell
          if (!isValidCell(x, y)) {
            continue;
          }

          // Get the letter from the mid element
          const letterElement = document.getElementById(`mid_${x}_${y}`);
          const letter = letterElement?.textContent?.trim() || null;

          // Collect hints from small squares (multiple guesses)
          const hints: any[] = [];

          // Look for small squares for this position - check range 0-9 to handle gaps
          for (let guessIndex = 0; guessIndex < 10; guessIndex++) {
            const smallSquareElement = document.getElementById(
              `small_${x}_${y}_${guessIndex}`,
            );

            if (!smallSquareElement) continue; // Skip missing indices

            const smallLetterElement = document.getElementById(
              `small_css_${x}_${y}_${guessIndex}`,
            );
            const hintLetter = smallLetterElement?.textContent?.trim();

            if (
              hintLetter &&
              smallSquareElement.style.visibility !== 'hidden' &&
              smallSquareElement.style.opacity !== '0'
            ) {
              // Check if hint letter matches the placed letter (always Green)
              if (letter && hintLetter.toUpperCase() === letter.toUpperCase()) {
                hints.push({
                  letter: hintLetter,
                  type: 'Green',
                });
              } else {
                // Get the background image from the img element inside the small square
                const imgElement = smallSquareElement.querySelector(
                  'img',
                ) as HTMLImageElement;
                let hintType = 'White';

                if (imgElement && imgElement.src) {
                  hintType = getHintTypeFromImage(imgElement.src);
                }

                hints.push({
                  letter: hintLetter,
                  type: hintType,
                });
              }
            }
          }

          row.push({
            x,
            y,
            letter,
            hints,
          });
        }
        board.push(row);
      }

      return board;
    });

    this.logger.log(
      `Extracted board with ${boardState.length}x${boardState[0]?.length} cells, ${guessesRemaining} guesses remaining, next guess at column ${nextGuessIndex}`,
    );

    return {
      guessesRemaining,
      nextGuessIndex,
      language,
      boardState,
    };
  }

  /**
   * Utility method to create a delay using Promise.
   */
  private async delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  /**
   * Safely extracts error message from unknown error type.
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * Starts a new freeplay Squardle game by navigating to the site and setting up the game.
   */
  async startNewGame(): Promise<void> {
    this.logger.log('Starting new Squardle game');

    try {
      await this.connectToBrowser();
      await this.navigateToGame();
      await this.startFreeplayGame();
      await this.waitForBoardToLoad();

      this.logger.log('New game started successfully');
    } catch (error) {
      this.logger.error(
        'Failed to start new game',
        this.getErrorMessage(error),
      );
      throw error;
    }
  }

  /**
   * Extracts the current board state from the loaded game page.
   * @returns Promise resolving to a BoardStateResponse containing guessesRemaining and 5x5 Cell matrix representing the game board
   */
  async getBoardState(): Promise<BoardState> {
    this.logger.log('Starting board state extraction');

    try {
      // Auto-reconnect if no active page connection
      if (!this.page || !this.browser) {
        this.logger.log('No active browser connection, reconnecting...');
        await this.connectToBrowser();
      }

      if (!this.page) {
        throw new Error('No active page found. Please start a new game first.');
      }

      const result = await this.extractBoardState(this.page);

      this.logger.log('Successfully extracted board state');
      return {
        guessesRemaining: result.guessesRemaining,
        nextGuessIndex: result.nextGuessIndex,
        language: result.language,
        board: result.boardState as Cell[][],
      };
    } catch (error) {
      this.logger.error(
        'Failed to extract board state',
        this.getErrorMessage(error),
      );
      throw error;
    }
  }
}
