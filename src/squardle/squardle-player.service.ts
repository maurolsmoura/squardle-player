import { Injectable } from '@nestjs/common';
import { BoardState, Cell, HintType, Language } from 'src/types/squardle.types';
import { getWords, WordsType } from 'words';
import { orderBy, cloneDeep } from 'lodash';

const WORDS_TYPE = WordsType.Answers;
const GUESS_SEQUENCE = [0, 2, 4];
const MAX_SIMULATION_ITERATIONS = 6;

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
  includes: string[];
  excludes: string[];
  excludingPositions: LetterIndex[];
  matchingLetters: LetterIndex[];
}

interface WordFitCheckParams {
  word: string;
  direction: Direction;
  boardState: BoardState;
  allCandidateWords: string[];
}

interface WordInsertionParams {
  boardState: BoardState;
  word: string;
  direction: Direction;
}

interface WordFilterCreationParams {
  cells: Cell[];
  direction: Direction;
  boardState: BoardState;
}

interface BestWordDeterminationParams {
  candidateWordsHorizontal: string[];
  candidateWordsVertical: string[];
  boardState: BoardState;
}

interface WordScoreCalculationParams {
  candidateWords: string[];
  boardState?: BoardState;
  direction?: Direction;
}

interface SimulationParams {
  candidateWords: WordScoreResult[];
  boardState: BoardState;
  direction: Direction;
}

@Injectable()
export class SquardlePlayerService {
  playNextGuess(boardState: BoardState): WordScoreResult | null {
    if (this.isBoardInInitialState(boardState)) {
      return this.getInitialGuess(boardState);
    }

    if (this.isBoardFull(boardState.board)) {
      return null;
    }

    return this.calculateNextGuess(boardState);
  }

  private isBoardInInitialState(boardState: BoardState): boolean {
    return boardState.board.every((row) =>
      row.every((cell) => cell.hints.length === 0),
    );
  }

  private getInitialGuess(boardState: BoardState): WordScoreResult {
    const allWords = this.getAllWords(boardState.language);
    const wordScores = this.calculateWordsScores({ candidateWords: allWords });
    return wordScores[0];
  }

  private getAllWords(language: Language): string[] {
    return getWords({
      language,
      type: WORDS_TYPE,
    });
  }

  private calculateNextGuess(
    boardState: BoardState,
  ): WordScoreResultDirection | null {
    const candidateWords = this.getAllWords(boardState.language);
    const filteredCandidates = this.getFilteredCandidateWords({
      boardState,
      candidateWords,
    });

    if (!this.areCandidatesValid(filteredCandidates, boardState)) {
      return null;
    }

    return this.selectBestWordOverall({
      candidateWordsHorizontal: filteredCandidates.horizontal,
      candidateWordsVertical: filteredCandidates.vertical,
      boardState,
    });
  }

  private getFilteredCandidateWords(params: {
    boardState: BoardState;
    candidateWords: string[];
  }) {
    const { boardState, candidateWords } = params;
    const wordsFilters = this.createWordsFilters(boardState);

    const horizontalCandidates = this.applyWordsFilter({
      candidateWords,
      wordsFilter: wordsFilters.horizontal,
    });

    const verticalCandidates = this.applyWordsFilter({
      candidateWords,
      wordsFilter: wordsFilters.vertical,
    });

    return {
      horizontal: this.getDeepFilteredCandidates({
        candidates: horizontalCandidates,
        direction: Direction.Horizontal,
        boardState,
        allCandidateWords: candidateWords,
      }),
      vertical: this.getDeepFilteredCandidates({
        candidates: verticalCandidates,
        direction: Direction.Vertical,
        boardState,
        allCandidateWords: candidateWords,
      }),
    };
  }

  private getDeepFilteredCandidates(params: {
    candidates: string[];
    direction: Direction;
    boardState: BoardState;
    allCandidateWords: string[];
  }): string[] {
    const { candidates, direction, boardState, allCandidateWords } = params;

    return candidates.filter((word) =>
      this.checkIfWordFits({
        word,
        direction,
        boardState,
        allCandidateWords,
      }),
    );
  }

  private areCandidatesValid(
    filteredCandidates: { horizontal: string[]; vertical: string[] },
    boardState: BoardState,
  ): boolean {
    const { horizontal, vertical } = filteredCandidates;

    if (horizontal.length === 0) {
      this.logNoCandidatesFound('horizontal', boardState);
      return false;
    }

    if (vertical.length === 0) {
      this.logNoCandidatesFound('vertical', boardState);
      return false;
    }

    return true;
  }

  private logNoCandidatesFound(
    direction: string,
    boardState: BoardState,
  ): void {
    console.info(
      `No candidate words for ${direction} direction, index: ${boardState.nextGuessIndex} on following board state:`,
    );
    this.logBoardState(boardState);
  }

  private checkIfWordFits(params: WordFitCheckParams): boolean {
    const { word, direction, boardState, allCandidateWords } = params;
    const simulatedBoard = this.insertWordInBoard({
      boardState,
      word,
      direction,
    });

    if (this.isBoardFull(simulatedBoard)) {
      return true;
    }

    return this.canFillRemainingPositions({
      simulatedBoard,
      originalBoardState: boardState,
      direction,
      allCandidateWords,
    });
  }

  private canFillRemainingPositions(params: {
    simulatedBoard: BoardState['board'];
    originalBoardState: BoardState;
    direction: Direction;
    allCandidateWords: string[];
  }): boolean {
    const { simulatedBoard, originalBoardState, direction, allCandidateWords } =
      params;

    for (const index of GUESS_SEQUENCE) {
      if (
        !this.canFillPositionAtIndex({
          simulatedBoard,
          originalBoardState,
          direction,
          allCandidateWords,
          index,
        })
      ) {
        return false;
      }
    }

    return true;
  }

  private canFillPositionAtIndex(params: {
    simulatedBoard: BoardState['board'];
    originalBoardState: BoardState;
    direction: Direction;
    allCandidateWords: string[];
    index: number;
  }): boolean {
    const {
      simulatedBoard,
      originalBoardState,
      direction,
      allCandidateWords,
      index,
    } = params;

    const testBoardState = this.createTestBoardState({
      originalBoardState,
      simulatedBoard,
      index,
    });

    const wordsFilters = this.createWordsFilters(testBoardState);
    const oppositeDirection = this.getOppositeDirection(direction);
    const filterToCheck =
      oppositeDirection === Direction.Horizontal
        ? wordsFilters.horizontal
        : wordsFilters.vertical;

    const candidatesForOppositeDirection = this.applyWordsFilter({
      candidateWords: allCandidateWords,
      wordsFilter: filterToCheck,
    });

    return candidatesForOppositeDirection.length > 0;
  }

  private createTestBoardState(params: {
    originalBoardState: BoardState;
    simulatedBoard: BoardState['board'];
    index: number;
  }): BoardState {
    const { originalBoardState, simulatedBoard, index } = params;

    return {
      ...originalBoardState,
      board: simulatedBoard,
      nextGuessIndex: index,
      guessesRemaining: originalBoardState.guessesRemaining - 1,
    };
  }

  private getOppositeDirection(direction: Direction): Direction {
    return direction === Direction.Horizontal
      ? Direction.Vertical
      : Direction.Horizontal;
  }

  private getCurrentCells(boardState: BoardState) {
    const currentGuessIndex = boardState.nextGuessIndex;

    return {
      cells: {
        horizontal: this.getHorizontalCells(
          boardState.board,
          currentGuessIndex,
        ),
        vertical: this.getVerticalCells(boardState.board, currentGuessIndex),
      },
    };
  }

  private getHorizontalCells(
    board: BoardState['board'],
    guessIndex: number,
  ): Cell[] {
    return board
      .flatMap((row) => row.filter((cell) => cell.y === guessIndex))
      .sort((a, b) => a.x - b.x);
  }

  private getVerticalCells(
    board: BoardState['board'],
    guessIndex: number,
  ): Cell[] {
    return board
      .flatMap((row) => row.filter((cell) => cell.x === guessIndex))
      .sort((a, b) => a.y - b.y);
  }

  private createWordsFilters(boardState: BoardState) {
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

  private createWordFilter(params: WordFilterCreationParams): WordsFilter {
    const { cells, direction, boardState } = params;
    const blackLetters = this.extractBlackLetters(boardState);

    const filterComponents = this.extractFilterComponents({ cells, direction });

    return {
      includes: this.removeDuplicates(filterComponents.includes),
      excludes: this.removeDuplicates([
        ...blackLetters,
        ...filterComponents.excludes,
      ]),
      excludingPositions: filterComponents.excludingPositions,
      matchingLetters: this.extractMatchingLetters(cells),
    };
  }

  private extractBlackLetters(boardState: BoardState): string[] {
    return boardState.board
      .flatMap((row) => row.flatMap((cell) => cell.hints))
      .filter((hint) => hint.type === HintType.Black)
      .map((hint) => hint.letter);
  }

  private extractFilterComponents(params: {
    cells: Cell[];
    direction: Direction;
  }) {
    const { cells, direction } = params;
    const includes: string[] = [];
    const excludes: string[] = [];
    const excludingPositions: LetterIndex[] = [];

    cells.forEach((cell, index) => {
      cell.hints.forEach((hint) => {
        this.processHintForFilter({
          hint,
          direction,
          index,
          includes,
          excludes,
          excludingPositions,
        });
      });
    });

    return { includes, excludes, excludingPositions };
  }

  private processHintForFilter(params: {
    hint: { letter: string; type: HintType };
    direction: Direction;
    index: number;
    includes: string[];
    excludes: string[];
    excludingPositions: LetterIndex[];
  }): void {
    const { hint, direction, index, includes, excludes, excludingPositions } =
      params;
    const { letter, type } = hint;

    switch (type) {
      case HintType.Green:
        break;

      case HintType.HorizontalSimple:
      case HintType.HorizontalDouble:
      case HintType.HorizontalTriple:
        this.processHorizontalHint({
          letter,
          index,
          direction,
          includes,
          excludes,
          excludingPositions,
        });
        break;

      case HintType.VerticalSimple:
      case HintType.VerticalDouble:
      case HintType.VerticalTriple:
        this.processVerticalHint({
          letter,
          index,
          direction,
          includes,
          excludes,
          excludingPositions,
        });
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
        this.processOrangeHint({ letter, index, includes, excludingPositions });
        break;

      case HintType.White:
        excludes.push(letter);
        break;

      case HintType.Black:
        break;
    }
  }

  private processHorizontalHint(params: {
    letter: string;
    index: number;
    direction: Direction;
    includes: string[];
    excludes: string[];
    excludingPositions: LetterIndex[];
  }): void {
    const { letter, index, direction, includes, excludes, excludingPositions } =
      params;

    if (direction === Direction.Horizontal) {
      includes.push(letter);
      excludingPositions.push({ index, letter });
    } else {
      excludes.push(letter);
    }
  }

  private processVerticalHint(params: {
    letter: string;
    index: number;
    direction: Direction;
    includes: string[];
    excludes: string[];
    excludingPositions: LetterIndex[];
  }): void {
    const { letter, index, direction, includes, excludes, excludingPositions } =
      params;

    if (direction === Direction.Vertical) {
      includes.push(letter);
      excludingPositions.push({ index, letter });
    } else {
      excludes.push(letter);
    }
  }

  private processOrangeHint(params: {
    letter: string;
    index: number;
    includes: string[];
    excludingPositions: LetterIndex[];
  }): void {
    const { letter, index, includes, excludingPositions } = params;
    includes.push(letter);
    excludingPositions.push({ index, letter });
  }

  private extractMatchingLetters(cells: Cell[]): LetterIndex[] {
    return cells
      .map((cell, index) => ({ index, letter: cell.letter }))
      .filter(({ letter }) => letter !== null) as LetterIndex[];
  }

  private removeDuplicates<T>(array: T[]): T[] {
    return [...new Set(array)];
  }

  private applyWordsFilter(params: {
    candidateWords: string[];
    wordsFilter: WordsFilter;
  }): string[] {
    const { candidateWords, wordsFilter } = params;

    return candidateWords.filter((word) =>
      this.isWordValidForFilter({ word, wordsFilter }),
    );
  }

  private isWordValidForFilter(params: {
    word: string;
    wordsFilter: WordsFilter;
  }): boolean {
    const { word, wordsFilter } = params;

    return (
      this.hasMatchingLetters({ word, wordsFilter }) &&
      this.hasAllRequiredLetters({ word, wordsFilter }) &&
      this.respectsPositionExclusions({ word, wordsFilter }) &&
      this.hasNoExcludedLetters({ word, wordsFilter })
    );
  }

  private hasMatchingLetters(params: {
    word: string;
    wordsFilter: WordsFilter;
  }): boolean {
    const { word, wordsFilter } = params;

    return wordsFilter.matchingLetters.every(
      ({ index, letter }) => word[index].toUpperCase() === letter.toUpperCase(),
    );
  }

  private hasAllRequiredLetters(params: {
    word: string;
    wordsFilter: WordsFilter;
  }): boolean {
    const { word, wordsFilter } = params;

    return wordsFilter.includes.every((letter) =>
      word.toUpperCase().includes(letter.toUpperCase()),
    );
  }

  private respectsPositionExclusions(params: {
    word: string;
    wordsFilter: WordsFilter;
  }): boolean {
    const { word, wordsFilter } = params;

    return !wordsFilter.excludingPositions.some(
      ({ index, letter }) => word[index].toUpperCase() === letter.toUpperCase(),
    );
  }

  private hasNoExcludedLetters(params: {
    word: string;
    wordsFilter: WordsFilter;
  }): boolean {
    const { word, wordsFilter } = params;

    return !wordsFilter.excludes.some((letter) =>
      word.toUpperCase().includes(letter.toUpperCase()),
    );
  }

  private selectBestWordOverall(
    params: BestWordDeterminationParams,
  ): WordScoreResultDirection | null {
    const { candidateWordsHorizontal, candidateWordsVertical, boardState } =
      params;
    const missingLettersCount = this.getMissingLettersCount(boardState);

    const prioritizedResult = this.getPrioritizedResult({
      candidateWordsHorizontal,
      candidateWordsVertical,
      boardState,
      missingLettersCount,
    });

    if (prioritizedResult) {
      return prioritizedResult;
    }

    return this.getBestWordFromBothDirections({
      candidateWordsHorizontal,
      candidateWordsVertical,
      boardState,
    });
  }

  private getMissingLettersCount(boardState: BoardState) {
    const { cells: currentGuessCells } = this.getCurrentCells(boardState);

    return {
      horizontal: this.countMissingLetters(currentGuessCells.horizontal),
      vertical: this.countMissingLetters(currentGuessCells.vertical),
    };
  }

  private countMissingLetters(cells: Cell[]): number {
    return cells.filter((cell) => cell.letter === null).length;
  }

  private getPrioritizedResult(params: {
    candidateWordsHorizontal: string[];
    candidateWordsVertical: string[];
    boardState: BoardState;
    missingLettersCount: { horizontal: number; vertical: number };
  }): WordScoreResultDirection | null {
    const {
      candidateWordsHorizontal,
      candidateWordsVertical,
      boardState,
      missingLettersCount,
    } = params;

    if (missingLettersCount.horizontal > missingLettersCount.vertical) {
      return this.getBestWordForDirection({
        candidateWords: candidateWordsHorizontal,
        boardState,
        direction: Direction.Horizontal,
      });
    }

    if (missingLettersCount.horizontal < missingLettersCount.vertical) {
      return this.getBestWordForDirection({
        candidateWords: candidateWordsVertical,
        boardState,
        direction: Direction.Vertical,
      });
    }

    return null;
  }

  private getBestWordForDirection(params: {
    candidateWords: string[];
    boardState: BoardState;
    direction: Direction;
  }): WordScoreResultDirection | null {
    const { candidateWords, boardState, direction } = params;

    const bestWord = this.findBestWord({
      candidateWords,
      boardState,
      direction,
    });

    return bestWord ? { ...bestWord, direction } : null;
  }

  private getBestWordFromBothDirections(params: {
    candidateWordsHorizontal: string[];
    candidateWordsVertical: string[];
    boardState: BoardState;
  }): WordScoreResultDirection | null {
    const { candidateWordsHorizontal, candidateWordsVertical, boardState } =
      params;

    const bestHorizontalWord = this.findBestWord({
      candidateWords: candidateWordsHorizontal,
      boardState,
      direction: Direction.Horizontal,
    });

    const bestVerticalWord = this.findBestWord({
      candidateWords: candidateWordsVertical,
      boardState,
      direction: Direction.Vertical,
    });

    if (!bestHorizontalWord && !bestVerticalWord) {
      return null;
    }

    const bestDirection = this.selectBetterDirection(
      bestHorizontalWord,
      bestVerticalWord,
    );
    const bestResult =
      bestDirection === Direction.Horizontal
        ? bestHorizontalWord
        : bestVerticalWord;

    return { ...bestResult!, direction: bestDirection };
  }

  private selectBetterDirection(
    horizontalWord: WordScoreResult | null,
    verticalWord: WordScoreResult | null,
  ): Direction {
    const horizontalConfidence = horizontalWord?.confidence ?? 0;
    const verticalConfidence = verticalWord?.confidence ?? 0;

    return horizontalConfidence > verticalConfidence
      ? Direction.Horizontal
      : Direction.Vertical;
  }

  private findBestWord(
    params: WordScoreCalculationParams,
  ): WordScoreResult | null {
    const { candidateWords, boardState, direction } = params;
    const bestWordScores = this.calculateWordsScores({ candidateWords });

    if (bestWordScores.length === 0) {
      return null;
    }

    if (this.isPerfectConfidence(bestWordScores[0])) {
      return bestWordScores[0];
    }

    return boardState && direction
      ? this.findBestWordThroughSimulation({
          candidateWords: bestWordScores,
          boardState,
          direction,
        })
      : bestWordScores[0];
  }

  private isPerfectConfidence(wordScore: WordScoreResult): boolean {
    return wordScore.confidence === 1;
  }

  private findBestWordThroughSimulation(
    params: SimulationParams,
  ): WordScoreResult | null {
    const { candidateWords, boardState, direction } = params;

    for (const wordScore of candidateWords) {
      if (
        this.isWordValidThroughSimulation({ wordScore, boardState, direction })
      ) {
        return wordScore;
      }
    }

    return null;
  }

  private isWordValidThroughSimulation(params: {
    wordScore: WordScoreResult;
    boardState: BoardState;
    direction: Direction;
  }): boolean {
    const { wordScore, boardState, direction } = params;

    let simulatedBoard = cloneDeep(boardState.board);
    let currentGuessIndex = boardState.nextGuessIndex;
    let simulationWord = { ...wordScore, direction };

    console.log(
      `Starting simulation for word: ${wordScore.word} on index ${currentGuessIndex} ${direction}`,
    );

    for (
      let iteration = 0;
      iteration < MAX_SIMULATION_ITERATIONS;
      iteration++
    ) {
      simulatedBoard = this.insertWordInBoard({
        boardState: {
          ...boardState,
          board: simulatedBoard,
          nextGuessIndex: currentGuessIndex,
        },
        word: simulationWord.word,
        direction: simulationWord.direction,
      });

      if (this.isBoardFull(simulatedBoard)) {
        return true;
      }

      const nextSimulationStep = this.getNextSimulationStep({
        boardState,
        simulatedBoard,
        currentGuessIndex,
        iteration,
      });

      if (!nextSimulationStep) {
        this.logInvalidSimulation(
          wordScore.word,
          boardState.nextGuessIndex,
          direction,
        );
        return false;
      }

      currentGuessIndex = nextSimulationStep.nextGuessIndex;
      simulationWord = nextSimulationStep.nextGuess;

      console.info(
        `nextGuess: ${simulationWord.word} confidence: ${simulationWord.confidence}`,
      );
    }

    return true;
  }

  private getNextSimulationStep(params: {
    boardState: BoardState;
    simulatedBoard: BoardState['board'];
    currentGuessIndex: number;
    iteration: number;
  }) {
    const { boardState, simulatedBoard, currentGuessIndex, iteration } = params;

    const nextGuessIndex = this.getNextIndex(currentGuessIndex);
    const nextBoardState = this.createTestBoardState({
      originalBoardState: boardState,
      simulatedBoard,
      index: nextGuessIndex,
    });

    nextBoardState.guessesRemaining =
      boardState.guessesRemaining - iteration - 1;

    const nextGuess = this.calculateNextGuess(nextBoardState);

    return nextGuess ? { nextGuessIndex, nextGuess } : null;
  }

  private logInvalidSimulation(
    word: string,
    guessIndex: number,
    direction: Direction,
  ): void {
    console.info(
      `Found invalid board. Stopping simulation for word: ${word} on index ${guessIndex} ${direction}`,
    );
  }

  private insertWordInBoard(params: WordInsertionParams): BoardState['board'] {
    const { boardState, word, direction } = params;

    this.logBoardState(boardState);

    const newBoard = cloneDeep(boardState.board);

    if (direction === Direction.Horizontal) {
      this.insertHorizontalWord({
        board: newBoard,
        word,
        guessIndex: boardState.nextGuessIndex,
      });
    } else {
      this.insertVerticalWord({
        board: newBoard,
        word,
        guessIndex: boardState.nextGuessIndex,
      });
    }

    this.logBoardState({ ...boardState, board: newBoard });

    return newBoard;
  }

  private insertHorizontalWord(params: {
    board: BoardState['board'];
    word: string;
    guessIndex: number;
  }): void {
    const { board, word, guessIndex } = params;

    for (let i = 0; i < word.length; i++) {
      const currentLetter = board[guessIndex][i].letter;
      const newLetter = word[i].toUpperCase();

      this.validateLetterInsertion({
        currentLetter,
        newLetter,
        word,
        direction: Direction.Horizontal,
        guessIndex,
      });

      if (currentLetter === null) {
        board[guessIndex][i].letter = newLetter;
      }
    }
  }

  private insertVerticalWord(params: {
    board: BoardState['board'];
    word: string;
    guessIndex: number;
  }): void {
    const { board, word, guessIndex } = params;

    for (let i = 0; i < word.length; i++) {
      const currentLetter = board[i][guessIndex].letter;
      const newLetter = word[i].toUpperCase();

      this.validateLetterInsertion({
        currentLetter,
        newLetter,
        word,
        direction: Direction.Vertical,
        guessIndex,
      });

      if (currentLetter === null) {
        board[i][guessIndex].letter = newLetter;
      }
    }
  }

  private validateLetterInsertion(params: {
    currentLetter: string | null;
    newLetter: string;
    word: string;
    direction: Direction;
    guessIndex: number;
  }): void {
    const { currentLetter, newLetter, word, direction, guessIndex } = params;

    if (currentLetter !== null && currentLetter !== newLetter) {
      throw new Error(
        `Conflict letter when trying to insert word: ${word} in direction: ${direction} on index: ${guessIndex}`,
      );
    }
  }

  isBoardFull(board: BoardState['board']): boolean {
    return board
      .flat()
      .filter((cell) => !this.isBlockedPosition(cell))
      .every((cell) => cell.letter !== null);
  }

  private isBlockedPosition(cell: { x: number; y: number }): boolean {
    const { x, y } = cell;
    return (
      (x === 1 && y === 1) ||
      (x === 1 && y === 3) ||
      (x === 3 && y === 1) ||
      (x === 3 && y === 3)
    );
  }

  private calculateWordsScores(
    params: WordScoreCalculationParams,
  ): WordScoreResult[] {
    const { candidateWords } = params;

    if (!candidateWords || candidateWords.length === 0) {
      return [];
    }

    this.validateWordLengths(candidateWords);

    const wordLength = candidateWords[0].length;
    const statistics = this.buildLetterStatistics({
      candidateWords,
      wordLength,
    });

    return this.computeWordScores({ candidateWords, statistics, wordLength });
  }

  private validateWordLengths(candidateWords: string[]): void {
    const uniqueLengths = new Set(candidateWords.map((word) => word.length));

    if (uniqueLengths.size > 1) {
      throw new Error('Words are not all the same length');
    }
  }

  private buildLetterStatistics(params: {
    candidateWords: string[];
    wordLength: number;
  }) {
    const { candidateWords, wordLength } = params;
    const statistics = this.initializeStatistics(wordLength);

    this.populateStatistics({ candidateWords, statistics });

    return statistics;
  }

  private initializeStatistics(
    wordLength: number,
  ): Map<number, Map<string, number>> {
    return new Map(
      Array(wordLength)
        .fill(0)
        .map((_, index) => [index, new Map<string, number>()]),
    );
  }

  private populateStatistics(params: {
    candidateWords: string[];
    statistics: Map<number, Map<string, number>>;
  }): void {
    const { candidateWords, statistics } = params;

    for (const word of candidateWords) {
      this.updateWordStatistics({ word, statistics });
    }
  }

  private updateWordStatistics(params: {
    word: string;
    statistics: Map<number, Map<string, number>>;
  }): void {
    const { word, statistics } = params;

    word.split('').forEach((letter, index) => {
      const letterMap = statistics.get(index)!;
      const currentCount = letterMap.get(letter) ?? 0;
      letterMap.set(letter, currentCount + 1);
    });
  }

  private computeWordScores(params: {
    candidateWords: string[];
    statistics: Map<number, Map<string, number>>;
    wordLength: number;
  }): WordScoreResult[] {
    const { candidateWords, statistics, wordLength } = params;
    const totalWords = candidateWords.length;

    const wordScores = candidateWords.map((word) => ({
      word,
      confidence: this.calculateWordConfidence({
        word,
        statistics,
        totalWords,
        wordLength,
      }),
    }));

    return orderBy(wordScores, 'confidence', 'desc');
  }

  private calculateWordConfidence(params: {
    word: string;
    statistics: Map<number, Map<string, number>>;
    totalWords: number;
    wordLength: number;
  }): number {
    const { word, statistics, totalWords, wordLength } = params;

    const score = word.split('').reduce((totalScore, letter, index) => {
      const letterScore = statistics.get(index)?.get(letter) ?? 0;
      return totalScore + letterScore;
    }, 0);

    return score / (totalWords * wordLength);
  }

  private getNextIndex(currentGuessIndex: number): number {
    const currentSequenceIndex = GUESS_SEQUENCE.indexOf(currentGuessIndex);

    if (currentSequenceIndex === -1) {
      throw new Error(`Invalid current guess index: ${currentGuessIndex}`);
    }

    const nextSequenceIndex =
      (currentSequenceIndex + 1) % GUESS_SEQUENCE.length;
    return GUESS_SEQUENCE[nextSequenceIndex];
  }

  private logBoardState(boardState: BoardState) {
    console.info('\n📋 Board State:');
    console.info('┌─────┬─────┬─────┬─────┬─────┐');

    for (let y = 0; y < boardState.board.length; y++) {
      const row = boardState.board[y];
      let rowDisplay = '│';

      for (let x = 0; x < row.length; x++) {
        const cell = row[x];
        let cellContent: string;

        // Check if this is a blocked position
        const isBlockedPosition =
          (x === 1 && y === 1) ||
          (x === 1 && y === 3) ||
          (x === 3 && y === 1) ||
          (x === 3 && y === 3);

        if (isBlockedPosition) {
          cellContent = '     '; // Empty space for blocked cells
        } else if (cell.letter !== null) {
          cellContent = `  ${cell.letter}  `; // Centered letter with equal padding
        } else {
          cellContent = ' ___ '; // Empty cell with underscores
        }

        rowDisplay += cellContent + '│';
      }

      console.info(rowDisplay);

      // Add separator line between rows (except after last row)
      if (y < boardState.board.length - 1) {
        console.info('├─────┼─────┼─────┼─────┼─────┤');
      }
    }

    console.info('└─────┴─────┴─────┴─────┴─────┘');
  }
}
