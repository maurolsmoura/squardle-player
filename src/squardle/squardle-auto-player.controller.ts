import { Controller, Post, Logger, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SquardleScraperService } from './squardle-scraper.service';
import { SquardlePlayerService } from './squardle-player.service';
import { SquardleInteractionService } from './squardle-interaction.service';

@ApiTags('Squardle Auto Player')
@Controller('squardle/auto')
export class SquardleAutoPlayerController {
  private readonly logger = new Logger(SquardleAutoPlayerController.name);
  private isPlaying = false;

  constructor(
    private readonly scraperService: SquardleScraperService,
    private readonly playerService: SquardlePlayerService,
    private readonly interactionService: SquardleInteractionService,
  ) {}

  @Post('play')
  @ApiOperation({ summary: 'Start automated Squardle gameplay' })
  @ApiResponse({
    status: 200,
    description: 'Automated gameplay started successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Gameplay already in progress or game setup failed',
  })
  async playAutomatically(): Promise<{
    message: string;
    finalBoardState?: any;
    totalMoves?: number;
    success?: boolean;
  }> {
    if (this.isPlaying) {
      return {
        message: 'Automated gameplay is already in progress',
        success: false,
      };
    }

    this.isPlaying = true;
    this.logger.log('🎮 Starting automated Squardle gameplay');

    try {
      let moveCount = 0;
      const maxMoves = 20; // Safety limit to prevent infinite loops

      while (moveCount < maxMoves) {
        // Get current board state
        this.logger.log(`📊 Move ${moveCount + 1}: Getting board state`);
        const boardState = await this.scraperService.getBoardState();

        const isBoardFull = this.playerService.isBoardFull(boardState.board);

        if (isBoardFull) {
          this.logger.log('🎉 Game completed! Board is full');
          return {
            message: 'Game completed successfully - board is full!',
            finalBoardState: boardState,
            totalMoves: moveCount,
            success: true,
          };
        }

        // Check if we have remaining guesses
        if (boardState.guessesRemaining <= 0) {
          this.logger.log('❌ No more guesses remaining');
          return {
            message: 'Game over - no more guesses remaining',
            finalBoardState: boardState,
            totalMoves: moveCount,
            success: false,
          };
        }

        // Determine next guess using AI
        this.logger.log('🤖 Determining next guess using AI');
        const nextGuess = this.playerService.playNextGuess(boardState);

        if (!nextGuess) {
          this.logger.log('❌ AI could not determine a valid next guess');
          return {
            message: 'AI could not find a valid next guess',
            finalBoardState: boardState,
            totalMoves: moveCount,
            success: false,
          };
        }

        this.logger.debug(
          `🎯 AI suggests: "${nextGuess.word}" (confidence: ${(
            nextGuess.confidence * 100
          ).toFixed(0)}%)`,
        );

        // Submit the guess
        if (!this.scraperService.page) {
          throw new Error('No active browser page available');
        }

        await this.interactionService.typeWordAndSubmit({
          page: this.scraperService.page,
          word: nextGuess.word,
        });

        this.logger.log(`✅ Submitted guess: ${nextGuess.word}`);
        moveCount++;

        // Add a small delay between moves to avoid overwhelming the game
        await this.delay(1000);
      }

      // If we reach here, we hit the safety limit
      const finalBoardState = await this.scraperService.getBoardState();
      return {
        message: `Reached maximum move limit (${maxMoves})`,
        finalBoardState,
        totalMoves: moveCount,
        success: false,
      };
    } catch (error) {
      this.logger.error('❌ Error during automated gameplay', error);
      return {
        message: `Error during automated gameplay: ${this.getErrorMessage(error)}`,
        success: false,
      };
    } finally {
      this.isPlaying = false;
    }
  }

  @Get('status')
  @ApiOperation({ summary: 'Check if automated gameplay is running' })
  @ApiResponse({
    status: 200,
    description: 'Returns current status of automated gameplay',
  })
  getPlayingStatus(): { isPlaying: boolean; message: string } {
    return {
      isPlaying: this.isPlaying,
      message: this.isPlaying
        ? 'Automated gameplay is currently running'
        : 'No automated gameplay in progress',
    };
  }

  @Post('stop')
  @ApiOperation({ summary: 'Stop automated gameplay' })
  @ApiResponse({
    status: 200,
    description: 'Automated gameplay stopped',
  })
  stopPlaying(): { message: string; wasPlaying: boolean } {
    const wasPlaying = this.isPlaying;
    this.isPlaying = false;

    return {
      message: wasPlaying
        ? 'Automated gameplay stopped'
        : 'No automated gameplay was running',
      wasPlaying,
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
}
