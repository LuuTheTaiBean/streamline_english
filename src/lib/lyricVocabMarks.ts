import type {LyricVocabMark} from "@/types/lyricVocabMark";

const storagePrefix = "streamline-lyric-vocab-marks";

export function loadLyricVocabMarks(lessonId: string): LyricVocabMark[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(`${storagePrefix}:${lessonId}`);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as LyricVocabMark[];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLyricVocabMarks(lessonId: string, marks: LyricVocabMark[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    `${storagePrefix}:${lessonId}`,
    JSON.stringify(marks),
  );
}
