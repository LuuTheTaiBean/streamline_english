export type Lesson = {
  id: string;
  book: string;
  unit: string;
  title: string;
  description?: string;
  previewText?: string;
  audioUrl: string;
  lyricsUrl?: string;
  imageUrls: string[];
  questionUrl?: string;
  order: number;
  isPublished: boolean;
};

export type LessonProgress = {
  lessonId: string;
  learned: boolean;
  listenCount: number;
  dailyListen: Record<string, number>;
  lastListenedAt?: Date;
};
