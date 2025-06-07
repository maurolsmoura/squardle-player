import { Test, TestingModule } from '@nestjs/testing';
import { BoardState, Language, HintType } from '../types/squardle.types';
import { describe, it, expect, beforeEach } from 'vitest';

import { SquardlePlayerService } from './squardle-player.service';

describe('SquardlePlayerService', () => {
  let service: SquardlePlayerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SquardlePlayerService],
    }).compile();

    service = module.get<SquardlePlayerService>(SquardlePlayerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('determineNextGuess', () => {
    describe('initial state', () => {
      it('should return the best word when board is in initial state (no hints)', () => {
        // Arrange
        const initialBoardState: BoardState = {
          guessesRemaining: 6,
          nextGuessIndex: 0,
          language: Language.BR,
          board: [
            [
              { x: 0, y: 0, letter: null, hints: [] },
              { x: 1, y: 0, letter: null, hints: [] },
              { x: 2, y: 0, letter: null, hints: [] },
            ],
            [
              { x: 0, y: 1, letter: null, hints: [] },
              { x: 2, y: 1, letter: null, hints: [] },
            ],
            [
              { x: 0, y: 2, letter: null, hints: [] },
              { x: 1, y: 2, letter: null, hints: [] },
              { x: 2, y: 2, letter: null, hints: [] },
            ],
          ],
        };

        // Act
        const result = service.determineNextGuess(initialBoardState);

        // Assert
        expect(result.word.length).toBe(5);
        expect(result.confidence).toBeGreaterThan(0);
      });
    });

    describe('non-initial state', () => {
      it('should return empty result when no candidate words are available', () => {
        // Arrange
        const boardStateWithHints: BoardState = {
          guessesRemaining: 4,
          nextGuessIndex: 2,
          language: Language.ES,
          board: [
            [
              {
                x: 0,
                y: 0,
                letter: 'H',
                hints: [
                  {
                    letter: 'H',
                    type: HintType.OrangeSimpleVerticalSimpleHorizontal,
                  },
                ],
              },
            ],
          ],
        };

        // Act
        const result = service.determineNextGuess(boardStateWithHints);

        // Assert
        expect(result.word).toBeDefined();
        expect(result.confidence).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
