export type Cell = {
  x: number;
  y: number;
  letter: string | null;
  hints: Hint[];
  isValid?: boolean; // Indicates if the cell is part of active gameplay (cross-shaped layout)
};

export type Hint = {
  letter: string;
  type: HintType;
};

export type BoardStateResponse = {
  guessesRemaining: number;
  boardState: Cell[][];
};

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
