import { Injectable } from '@nestjs/common';
import { BoardState, HintType } from 'src/types/squardle.types';
import { getWords } from 'words';
import { maxBy } from 'lodash';

const WORDS_TYPE = 'answers';

export interface BestWordResult {
  word: string;
  confidence: number;
}

interface WordsFilter {
  includes: string[]; // letters that must be in the word
  excludes: string[]; // letters that must not be in the word
  excludingPositions: { index: number; letter: string }[]; // letters that must not be in the word at a specific position
}

@Injectable()
export class SquardlePlayerService {
  determineNextGuess(boardState: BoardState): BestWordResult {
    const isInitialState = boardState.board.every((row) =>
      row.every((cell) => cell.hints.length === 0),
    );
    const totalWords = getWords({
      language: boardState.language,
      type: WORDS_TYPE,
    });
    if (isInitialState) {
      return this.determineBestWord({ candidateWords: totalWords });
    }
    const wordsFilters = this.createWordsFilters(boardState);
    const candidateWordsHorizontal = this.applyWordsFilter({
      totalWords,
      wordsFilter: wordsFilters.horizontal,
    });
    const candidateWordsVertical = this.applyWordsFilter({
      totalWords,
      wordsFilter: wordsFilters.vertical,
    });
    return this.determineBestWordOverall({
      candidateWordsHorizontal,
      candidateWordsVertical,
    });
  }

  private createWordsFilters(boardState: BoardState): {
    horizontal: WordsFilter;
    vertical: WordsFilter;
  } {
    const blackLetters = new Set(
      boardState.board.flatMap((row) =>
        row
          .filter((cell) =>
            cell.hints.some((hint) => hint.type === HintType.Black),
          )
          .map((cell) => cell.letter ?? ''),
      ),
    );
    const currentGuessIndex = boardState.nextGuessIndex;
    const currentGuessCells = {
      vertical: boardState.board[currentGuessIndex],
      horizontal: boardState.board.map((row) => row[currentGuessIndex]),
    };
  }

  private applyWordsFilter({
    totalWords,
    wordsFilter,
  }: {
    totalWords: string[];
    wordsFilter: WordsFilter;
  }): string[] {
    return totalWords.filter((word) => {
      return !wordsFilter.excludes.some((letter) => word.includes(letter));
    });
  }

  private determineBestWordOverall({
    candidateWordsHorizontal,
    candidateWordsVertical,
  }: {
    candidateWordsHorizontal: string[];
    candidateWordsVertical: string[];
  }): BestWordResult {
    const bestWordHorizontal = this.determineBestWord({
      candidateWords: candidateWordsHorizontal,
    });
    const bestWordVertical = this.determineBestWord({
      candidateWords: candidateWordsVertical,
    });
    return maxBy([bestWordHorizontal, bestWordVertical], 'confidence');
  }

  private determineBestWord({
    candidateWords,
  }: {
    candidateWords: string[];
  }): BestWordResult {
    const totalWords = candidateWords.length;
    const wordsLengths = new Set(candidateWords.map((word) => word.length));
    // If not all words are the same length, return the word with the most vowels
    if (wordsLengths.size > 1) {
      throw new Error('Words are not all the same length');
    }
    const wordLength = wordsLengths.values().next().value as number;
    const statistics = new Map<number, Map<string, number>>(
      Array(wordLength)
        .fill(0)
        .map((_, index) => [index, new Map<string, number>()]),
    );

    // Set up statistics for each position in the word
    for (const word of candidateWords) {
      const letters = word.split('');
      for (const [letterIndex, letter] of letters.entries()) {
        const existingLetterStatisticsCount =
          statistics.get(letterIndex)!.get(letter) ?? 0;
        statistics
          .get(letterIndex)!
          .set(letter, existingLetterStatisticsCount + 1);
      }
    }

    // Find the word with the highest score
    let bestWord = candidateWords[0];
    let bestScore = 0;
    for (const word of candidateWords) {
      const score = word.split('').reduce((acc, letter, index) => {
        return acc + (statistics.get(index)?.get(letter) ?? 0);
      }, 0);
      if (score > bestScore) {
        bestWord = word;
        bestScore = score;
      }
    }
    return {
      word: bestWord,
      confidence: bestScore / (totalWords * wordLength),
    };
  }
}
