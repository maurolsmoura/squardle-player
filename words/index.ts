import { Language } from 'src/types/squardle.types';
import { answersBr, wordsBr } from './pt-br';
import { answersEn, wordsEn } from './en';

export const getWords = ({
  language,
  type = 'answers',
}: {
  language: Language;
  type?: 'answers' | 'words';
}): string[] => {
  switch (language) {
    case Language.BR:
      return type === 'answers' ? answersBr : wordsBr;
    case Language.EN:
      return type === 'answers' ? answersEn : wordsEn;
    default:
      throw new Error(`Language ${language} not supported`);
  }
};
