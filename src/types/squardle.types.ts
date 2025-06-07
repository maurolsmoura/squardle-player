export type Cell = {
  x: number;
  y: number;
  letter: string | null;
  hints: Hint[];
};

export type Hint = {
  letter: string;
  type: HintType;
};

export type BoardState = {
  guessesRemaining: number;
  nextGuessIndex: number;
  language: Language;
  board: Cell[][];
};

export enum Language {
  EN = 'en', // English
  BR = 'pt-br', // Portuguese (Brazil)
  ES = 'es', // Spanish
  DE = 'de', // German
  SV = 'sv', // Swedish
}

export enum HintType {
  HorizontalSimple = 'HorizontalSimple',
  HorizontalDouble = 'HorizontalDouble',
  HorizontalTriple = 'HorizontalTriple',
  VerticalSimple = 'VerticalSimple',
  VerticalDouble = 'VerticalDouble',
  VerticalTriple = 'VerticalTriple',
  OrangeSimpleVerticalSimpleHorizontal = 'OrangeSimpleVerticalSimpleHorizontal',
  OrangeDoubleVerticalSimpleHorizontal = 'OrangeDoubleVerticalSimpleHorizontal',
  OrangeTripleVerticalSimpleHorizontal = 'OrangeTripleVerticalSimpleHorizontal',
  OrangeSimpleVerticalDoubleHorizontal = 'OrangeSimpleVerticalDoubleHorizontal',
  OrangeDoubleVerticalDoubleHorizontal = 'OrangeDoubleVerticalDoubleHorizontal',
  OrangeTripleVerticalDoubleHorizontal = 'OrangeTripleVerticalDoubleHorizontal',
  OrangeSimpleVerticalTripleHorizontal = 'OrangeSimpleVerticalTripleHorizontal',
  OrangeDoubleVerticalTripleHorizontal = 'OrangeDoubleVerticalTripleHorizontal',
  OrangeTripleVerticalTripleHorizontal = 'OrangeTripleVerticalTripleHorizontal',
  White = 'White',
  Black = 'Black',
  Green = 'Green',
}
