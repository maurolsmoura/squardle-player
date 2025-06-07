import { Injectable } from '@nestjs/common';
import { BoardState, Cell, HintType } from 'src/types/squardle.types';
import { getWords } from 'words';

const WORDS_TYPE = 'answers';

export interface BestWordResult {
  word: string;
  confidence: number;
}

interface LetterIndex {
  index: number;
  letter: string;
}

interface WordsFilter {
  includes: string[]; // letters that must be in the word
  excludes: string[]; // letters that must not be in the word
  excludingPositions: LetterIndex[]; // letters that must not be in the word at a specific position
  matchingLetters: LetterIndex[]; // letters that must be in the word at a specific position
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
      boardState,
    });
  }

  private getCurrentIndexAndCells(boardState: BoardState): {
    index: number;
    cells: {
      vertical: Cell[];
      horizontal: Cell[];
    };
  } {
    const currentGuessIndex = boardState.nextGuessIndex;
    const currentGuessCells = {
      vertical: boardState.board
        .flatMap((row) => row.filter((cell) => cell.x === currentGuessIndex))
        .sort((a, b) => a.y - b.y),
      horizontal: boardState.board
        .flatMap((row) => row.filter((cell) => cell.y === currentGuessIndex))
        .sort((a, b) => a.x - b.x),
    };
    return {
      index: currentGuessIndex,
      cells: currentGuessCells,
    };
  }

  private createWordsFilters(boardState: BoardState): {
    horizontal: WordsFilter;
    vertical: WordsFilter;
  } {
    const { cells: currentGuessCells } =
      this.getCurrentIndexAndCells(boardState);

    return {
      horizontal: this.createWordFilter({
        cells: currentGuessCells.horizontal,
        direction: 'horizontal',
        boardState,
      }),
      vertical: this.createWordFilter({
        cells: currentGuessCells.vertical,
        direction: 'vertical',
        boardState,
      }),
    };
  }

  private createWordFilter({
    cells,
    direction,
    boardState,
  }: {
    cells: Cell[];
    direction: 'horizontal' | 'vertical';
    boardState: BoardState;
  }): WordsFilter {
    const includes: string[] = [];
    const excludes: string[] = [];
    const excludingPositions: { index: number; letter: string }[] = [];

    // Get all black letters from the entire board
    const blackLetters = boardState.board
      .flatMap((row) => row.flatMap((cell) => cell.hints))
      .filter((hint) => hint.type === HintType.Black)
      .map((hint) => hint.letter);

    // Add black letters to excludes
    excludes.push(...blackLetters);

    // Analyze each cell in the current word
    cells.forEach((cell, index) => {
      cell.hints.forEach((hint) => {
        const { letter, type } = hint;

        switch (type) {
          case HintType.Green:
            // Green letters are already in correct position, no filtering needed
            break;

          case HintType.HorizontalSimple:
          case HintType.HorizontalDouble:
          case HintType.HorizontalTriple:
            if (direction === 'horizontal') {
              // Letter must be in the word but not at this position
              includes.push(letter);
              excludingPositions.push({ index, letter });
            } else {
              // Letter must not be in vertical word
              excludes.push(letter);
            }
            break;

          case HintType.VerticalSimple:
          case HintType.VerticalDouble:
          case HintType.VerticalTriple:
            if (direction === 'vertical') {
              // Letter must be in the word but not at this position
              includes.push(letter);
              excludingPositions.push({ index, letter });
            } else {
              // Letter must not be in horizontal word
              excludes.push(letter);
            }
            break;

          case HintType.OrangeSimpleVerticalSimpleHorizontal:
          case HintType.OrangeDoubleVerticalSimpleHorizontal:
          case HintType.OrangeTripleVerticalSimpleHorizontal:
          case HintType.OrangeSimpleVerticalDoubleHorizontal:
          case HintType.OrangeDoubleVerticalDoubleHorizontal:
          case HintType.OrangeTripleVerticalDoubleHorizontal:
          case HintType.OrangeSimpleVerticalTripleHorizontal:
          case HintType.OrangeDoubleVerticalTripleHorizontal:
          case HintType.OrangeTripleVerticalTripleHorizontal:
            // Letter must be in the word but not at this position
            includes.push(letter);
            excludingPositions.push({ index, letter });
            break;

          case HintType.White:
            // Letter is not in this row/column
            excludes.push(letter);
            break;

          case HintType.Black:
            // Already handled above
            break;
        }
      });
    });

    return {
      includes: [...new Set(includes)], // Remove duplicates
      excludes: [...new Set(excludes)], // Remove duplicates
      excludingPositions,
      matchingLetters: cells
        .map((cell, index) => ({
          index,
          letter: cell.letter,
        }))
        .filter(({ letter }) => letter !== null) as LetterIndex[],
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
      // Check matching letters
      const hasMatchingLetters = wordsFilter.matchingLetters.every(
        ({ index, letter }) =>
          word[index].toUpperCase() === letter.toUpperCase(),
      );
      if (!hasMatchingLetters) return false;

      // Check if word contains all required letters
      const hasAllIncludes = wordsFilter.includes.every((letter) =>
        word.toUpperCase().includes(letter.toUpperCase()),
      );
      if (!hasAllIncludes) return false;

      // Check position exclusions
      const violatesPositionExclusions = wordsFilter.excludingPositions.some(
        ({ index, letter }) =>
          word[index].toUpperCase() === letter.toUpperCase(),
      );
      if (violatesPositionExclusions) return false;

      // Check if word doesn't contain excluded letters
      const hasNoExcludes = !wordsFilter.excludes.some((letter) =>
        word.toUpperCase().includes(letter.toUpperCase()),
      );
      if (!hasNoExcludes) return false;

      return true;
    });
  }

  private determineBestWordOverall({
    candidateWordsHorizontal,
    candidateWordsVertical,
    boardState,
  }: {
    candidateWordsHorizontal: string[];
    candidateWordsVertical: string[];
    boardState: BoardState;
  }): BestWordResult {
    const { cells: currentGuessCells } =
      this.getCurrentIndexAndCells(boardState);

    const missingLetters = {
      horizontal: currentGuessCells.horizontal.filter(
        (cell) => cell.letter === null,
      ).length,
      vertical: currentGuessCells.vertical.filter(
        (cell) => cell.letter === null,
      ).length,
    };

    // We'll prioritize the word with the most missing letters
    if (missingLetters.horizontal > missingLetters.vertical) {
      return this.determineBestWord({
        candidateWords: candidateWordsHorizontal,
      });
    } else if (missingLetters.horizontal < missingLetters.vertical) {
      return this.determineBestWord({
        candidateWords: candidateWordsVertical,
      });
    }

    // If the number of missing letters is the same, we need to determine the best word overall

    const bestWordHorizontal = this.determineBestWord({
      candidateWords: candidateWordsHorizontal,
    });
    const bestWordVertical = this.determineBestWord({
      candidateWords: candidateWordsVertical,
    });

    const candidates = [bestWordHorizontal, bestWordVertical].filter(
      (result): result is BestWordResult => result !== null,
    );

    if (candidates.length === 0) {
      return { word: '', confidence: 0 };
    }

    // Find the candidate with the highest confidence manually
    let bestResult = candidates[0];
    for (const candidate of candidates) {
      if (candidate.confidence > bestResult.confidence) {
        bestResult = candidate;
      }
    }

    return bestResult;
  }

  private determineBestWord({
    candidateWords,
  }: {
    candidateWords: string[];
  }): BestWordResult {
    if (!candidateWords || candidateWords.length === 0) {
      return { word: '', confidence: 0 };
    }

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
