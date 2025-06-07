import { Injectable } from '@nestjs/common';
import { BoardState } from 'src/types/squardle.types';
import { getWords } from 'words';

@Injectable()
export class SquardlePlayerService {
  determineNextGuess(boardState: BoardState): string {
    const isInitialState = boardState.board.every((row) =>
      row.every((cell) => cell.hints.length === 0),
    );
    if (isInitialState) {
      return 'areio';
    }
    const words = getWords({ language: boardState.language, type: 'words' });
    // return any random word from the list
    return words?.[Math.floor(Math.random() * words.length)] ?? '';
  }
}
