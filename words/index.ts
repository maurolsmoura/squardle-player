import { Language } from 'src/types/squardle.types';
import { answersBr, wordsBr } from './pt-br';
import { answersEn, wordsEn } from './en';
import { BadRequestException } from '@nestjs/common';

export enum WordsType {
  Answers = 'answers',
  All = 'all',
}

export const getWords = ({
  language,
  type = WordsType.Answers,
}: {
  language: Language;
  type?: WordsType;
}): string[] => {
  switch (language) {
    case Language.BR:
      return type === WordsType.Answers ? answersBr : wordsBr;
    case Language.EN:
      return type === WordsType.Answers ? answersEn : wordsEn;
    default:
      throw new BadRequestException(`Language ${language} not supported`);
  }
};
