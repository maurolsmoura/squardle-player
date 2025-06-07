import { Controller, Post, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SquardleScraperService } from './squardle-scraper.service';
import { BoardStateResponse } from '../types/squardle.types';

/**
 * Controller responsible for handling Squardle game operations.
 * Provides endpoints to start new games and retrieve board state.
 */
@ApiTags('squardle')
@Controller('squardle')
export class SquardleController {
  private readonly logger = new Logger(SquardleController.name);

  constructor(
    private readonly squardleScraperService: SquardleScraperService,
  ) {}

  /**
   * Starts a new freeplay Squardle game.
   * @returns Success message indicating the game has been started
   */
  @Post('play')
  @ApiOperation({ summary: 'Start a new Squardle game' })
  @ApiResponse({
    status: 201,
    description: 'Game started successfully',
    example: {
      message: 'New Squardle game started successfully',
      timestamp: '2024-01-06T12:00:00.000Z',
    },
  })
  @ApiResponse({ status: 500, description: 'Failed to start game' })
  async startNewGame(): Promise<{ message: string; timestamp: string }> {
    this.logger.log('Starting new Squardle game');

    try {
      await this.squardleScraperService.startNewGame();

      const response = {
        message: 'New Squardle game started successfully',
        timestamp: new Date().toISOString(),
      };

      this.logger.log('New game started successfully');
      return response;
    } catch (error) {
      this.logger.error('Failed to start new game', error);
      throw error;
    }
  }

  /**
   * Retrieves the current board state from the active Squardle game.
   * @returns The board state response containing guesses remaining and 5x5 board state
   */
  @Get('board')
  @ApiOperation({ summary: 'Get current board state' })
  @ApiResponse({
    status: 200,
    description: 'Current board state with remaining guesses',
    example: {
      guessesRemaining: 6,
      boardState: [
        [
          { x: 0, y: 0, letter: 'S', hints: [{ letter: 'S', type: 'Green' }] },
          { x: 1, y: 0, letter: 'Q', hints: [] },
        ],
      ],
    },
  })
  @ApiResponse({ status: 500, description: 'Failed to get board state' })
  async getBoardState(): Promise<BoardStateResponse> {
    this.logger.log('Retrieving current board state');

    try {
      const boardState = await this.squardleScraperService.getBoardState();

      this.logger.log(
        `Retrieved board state with ${boardState.boardState.length}x${boardState.boardState[0]?.length} cells and ${boardState.guessesRemaining} guesses remaining`,
      );
      return boardState;
    } catch (error) {
      this.logger.error('Failed to retrieve board state', error);
      throw error;
    }
  }
}
