import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

@Injectable()
export class SquardleInteractionService {
  private readonly logger = new Logger(SquardleInteractionService.name);

  /**
   * Types a word on the Squardle game page and presses enter to submit the guess.
   * @param page - The puppeteer page instance
   * @param word - The word to type and submit
   */
  async typeWordAndSubmit({
    page,
    word,
  }: {
    page: puppeteer.Page;
    word: string;
  }): Promise<void> {
    this.logger.log(`Typing word: ${word}`);

    try {
      // Clear any existing input first
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');

      // Type the word
      await page.keyboard.type(word.toUpperCase(), { delay: 100 });

      // Press Enter to submit
      await page.keyboard.press('Enter');

      // Wait a moment for the game to process the input
      await this.delay(4000);

      this.logger.log(`Successfully submitted word: ${word}`);
    } catch (error) {
      this.logger.error(`Failed to type word: ${word}`, error);
      throw error;
    }
  }

  /**
   * Utility method to create a delay using Promise.
   */
  private async delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
