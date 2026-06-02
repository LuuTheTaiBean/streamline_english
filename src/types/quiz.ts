export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
};

export type Quiz = {
  id: string;
  title: string;
  timeLimit: number;
  createdBy: string;
  isPublished: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export type QuizAnswer = {
  questionId: string;
  selectedAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
};

export type QuizResult = {
  id: string;
  quizId: string;
  studentId: string;
  score: number;
  total: number;
  answers: QuizAnswer[];
  timeTaken: number;
  startedAt?: Date;
  submittedAt?: Date;
};
