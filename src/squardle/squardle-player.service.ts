import { Injectable } from '@nestjs/common';
import { BoardState, Cell, HintType } from 'src/types/squardle.types';
import { getWords } from 'words';
import { orderBy } from 'lodash';

enum WordsType {
  Answers = 'answers',
  All = 'all',
}

const WORDS_TYPE = WordsType.Answers;

export interface WordScoreResult {
  word: string;
  confidence: number;
}

export interface WordScoreResultDirection extends WordScoreResult {
  direction: Direction;
}

export enum Direction {
  Horizontal = 'horizontal',
  Vertical = 'vertical',
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
  playNextGuess(boardState: BoardState): WordScoreResult | null {
    const isInitialState = boardState.board.every((row) =>
      row.every((cell) => cell.hints.length === 0),
    );
    if (isInitialState) {
      const totalWords = getWords({
        language: boardState.language,
        type: WordsType.Answers,
      });
      const wordScores = this.determineWordsScores({
        candidateWords: totalWords,
      });
      return wordScores[0];
    }
    if (this.isBoardFull(boardState.board)) {
      return null;
    }
    return this.returnNextGuess({
      boardState,
    });
  }

  private returnNextGuess({
    boardState,
  }: {
    boardState: BoardState;
  }): WordScoreResultDirection | null {
    const candidateWords = getWords({
      language: boardState.language,
      type: WORDS_TYPE,
    });
    const wordsFilters = this.createWordsFilters(boardState);
    const candidateWordsHorizontal = this.applyWordsFilter({
      candidateWords,
      wordsFilter: wordsFilters.horizontal,
    });
    const candidateWordsVertical = this.applyWordsFilter({
      candidateWords,
      wordsFilter: wordsFilters.vertical,
    });
    if (
      candidateWordsHorizontal.length === 0 ||
      candidateWordsVertical.length === 0
    ) {
      // It means that any word will result in an invalid board.
      return null;
    }
    return this.determineBestWordOverall({
      candidateWordsHorizontal,
      candidateWordsVertical,
      boardState,
    });
  }

  private getCurrentCells(boardState: BoardState): {
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
      cells: currentGuessCells,
    };
  }

  private createWordsFilters(boardState: BoardState): {
    horizontal: WordsFilter;
    vertical: WordsFilter;
  } {
    const { cells: currentGuessCells } = this.getCurrentCells(boardState);

    return {
      horizontal: this.createWordFilter({
        cells: currentGuessCells.horizontal,
        direction: Direction.Horizontal,
        boardState,
      }),
      vertical: this.createWordFilter({
        cells: currentGuessCells.vertical,
        direction: Direction.Vertical,
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
    direction: Direction;
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
            if (direction === Direction.Horizontal) {
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
            if (direction === Direction.Vertical) {
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
    candidateWords,
    wordsFilter,
  }: {
    candidateWords: string[];
    wordsFilter: WordsFilter;
  }): string[] {
    const words = [...candidateWords];
    return words.filter((word) => {
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
  }): WordScoreResultDirection | null {
    const { cells: currentGuessCells } = this.getCurrentCells(boardState);

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
      const bestHorizontalWord = this.determineBestWord({
        candidateWords: candidateWordsHorizontal,
        boardState,
        direction: Direction.Horizontal,
      });
      if (bestHorizontalWord !== null) {
        return {
          ...bestHorizontalWord,
          direction: Direction.Horizontal,
        };
      }
    }
    if (missingLetters.horizontal < missingLetters.vertical) {
      const bestVerticalWord = this.determineBestWord({
        candidateWords: candidateWordsVertical,
        boardState,
        direction: Direction.Vertical,
      });
      if (bestVerticalWord !== null) {
        return {
          ...bestVerticalWord,
          direction: Direction.Vertical,
        };
      }
    }

    // If the number of missing letters is the same, we return the best word overall
    const bestWordHorizontal = this.determineBestWord({
      candidateWords: candidateWordsHorizontal,
      boardState,
      direction: Direction.Horizontal,
    });
    const bestWordVertical = this.determineBestWord({
      candidateWords: candidateWordsVertical,
      boardState,
      direction: Direction.Vertical,
    });
    if (bestWordHorizontal === null && bestWordVertical === null) {
      return null;
    }
    const bestResultDirection =
      (bestWordHorizontal?.confidence ?? 0) >
      (bestWordVertical?.confidence ?? 0)
        ? Direction.Horizontal
        : Direction.Vertical;
    const bestResult =
      bestResultDirection === Direction.Horizontal
        ? bestWordHorizontal
        : bestWordVertical;
    return {
      ...bestResult!,
      direction: bestResultDirection,
    };
  }

  private flipDirection(direction: Direction): Direction {
    return direction === Direction.Horizontal
      ? Direction.Vertical
      : Direction.Horizontal;
  }

  private determineBestWord({
    candidateWords,
    boardState,
    direction,
  }: {
    candidateWords: string[];
    boardState: BoardState;
    direction: Direction;
  }): WordScoreResult | null {
    const bestWordScore = this.determineWordsScores({ candidateWords });
    if (bestWordScore.length === 0) {
      return null;
    }
    if (bestWordScore[0].confidence === 1) {
      // It means we are 100% sure about the word. No need to simulate more
      return bestWordScore[0];
    }
    // We will run a simulation to determine if the word is valid. We'll limit to 10 iterations
    let simulatedBoard: BoardState['board'] = boardState.board;
    let currentGuessIndex = boardState.nextGuessIndex;
    const maxIterations = 10;
    for (const { word, confidence } of bestWordScore) {
      let simulationWord = {
        word,
        confidence,
        direction,
      };
      // restart the simulation
      simulatedBoard = boardState.board;
      currentGuessIndex = boardState.nextGuessIndex;
      let isValid = true;
      for (let i = 0; i < maxIterations; i++) {
        simulatedBoard = this.insertWordInBoard({
          boardState: {
            language: boardState.language,
            guessesRemaining: boardState.guessesRemaining,
            nextGuessIndex: currentGuessIndex,
            board: simulatedBoard,
          },
          word: simulationWord.word,
          direction: simulationWord.direction,
        });
        if (this.isBoardFull(simulatedBoard)) {
          // No need to simulate more. This word is valid.
          return { word, confidence };
        }
        currentGuessIndex = this.getNextIndex(currentGuessIndex);
        const newBoardState = {
          language: boardState.language,
          guessesRemaining: boardState.guessesRemaining - i - 1,
          nextGuessIndex: currentGuessIndex,
          board: simulatedBoard,
        };
        const nextGuess = this.returnNextGuess({
          boardState: newBoardState,
        });
        if (nextGuess === null) {
          // go to next word
          isValid = false;
          break;
        }
        simulationWord = nextGuess;
      }
      if (isValid) {
        return { word, confidence };
      }
    }
    return null;
  }

  private insertWordInBoard({
    boardState,
    word,
    direction,
  }: {
    boardState: BoardState;
    word: string;
    direction: Direction;
  }): BoardState['board'] {
    const currentGuessIndex = boardState.nextGuessIndex;
    if (![0, 2, 4].includes(currentGuessIndex)) {
      throw new Error(
        `Invalid current guess index when trying to insert word: ${currentGuessIndex}`,
      );
    }

    const newBoard = [...boardState.board];
    if (direction === Direction.Horizontal) {
      for (let i = 0; i < word.length; i++) {
        boardState.board[currentGuessIndex][i].letter = word[i].toUpperCase();
      }
    } else {
      for (let i = 0; i < word.length; i++) {
        boardState.board[i][currentGuessIndex].letter = word[i].toUpperCase();
      }
    }
    return newBoard;
  }

  private isBoardFull(board: BoardState['board']): boolean {
    return board.every((row) => row.every((cell) => cell.letter !== null));
  }

  private determineWordsScores({
    candidateWords,
  }: {
    candidateWords: string[];
  }): WordScoreResult[] {
    if (!candidateWords || candidateWords.length === 0) {
      return [];
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
    const wordsScores = candidateWords.map((word) => {
      const score = word.split('').reduce((acc, letter, index) => {
        return acc + (statistics.get(index)?.get(letter) ?? 0);
      }, 0);
      return {
        word,
        confidence: score / (totalWords * wordLength),
      };
    });
    return orderBy(wordsScores, (word) => word.confidence, 'desc');
  }

  private getNextIndex(currentGuessIndex: number): number {
    const guessSequence = [0, 2, 4];
    const currentSequenceIndex = guessSequence.indexOf(currentGuessIndex);
    if (currentSequenceIndex === -1) {
      throw new Error(`Invalid current guess index: ${currentGuessIndex}`);
    }
    const nextSequenceIndex = (currentSequenceIndex + 1) % guessSequence.length;
    return guessSequence[nextSequenceIndex];
  }
}
