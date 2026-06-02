"use client";

import {useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent} from "react";
import {
  FileQuestion,
  FolderClosed,
  ImageIcon,
  LogOut,
  Palette,
  Pause,
  Play,
  Repeat,
  Settings,
  X,
} from "lucide-react";

import {LessonNotebook} from "@/components/lesson/LessonNotebook";
import {LyricsWithVocabMarks} from "@/components/lesson/LyricsWithVocabMarks";
import {getLegacyLessons} from "@/lib/lessons";
import {logout} from "@/lib/auth";
import type {Lesson} from "@/types/lesson";

type LyricLine = {
  time: number;
  text: string;
};

function parseLyrics(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);

      if (!match) {
        return null;
      }

      return {
        time: Number(match[1]) * 60 + Number(match[2]),
        text: match[3].replace(/\\n/g, "\n").trim(),
      };
    })
    .filter((line): line is LyricLine => Boolean(line));
}

function formatLessonCode(lesson: Lesson) {
  const unitNumber = lesson.unit.padStart(2, "0");

  return `${unitNumber}: ${lesson.title}`;
}

export function LessonPlayer({lessonId}: {lessonId: string}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeLineRef = useRef<HTMLParagraphElement>(null);
  const stopAtRef = useRef<number | null>(null);
  /** When set, highlight follows this line only (click-to-play), not audio time. */
  const lockedLineIndexRef = useRef<number | null>(null);
  /** Giong lesson.html: 0 = khong lap, moi lan bam Repeat +1, toi da 5 roi ve 0. */
  const repeatTimesRef = useRef(0);
  const repeatRemainingRef = useRef(0);
  const fullLessonPlayRef = useRef(false);
  const lessonEndHandlingRef = useRef(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatTimes, setRepeatTimes] = useState(0);
  const [repeatRemaining, setRepeatRemaining] = useState(0);
  const [hideImage, setHideImage] = useState(false);
  const [hideText, setHideText] = useState(false);
  const [panel, setPanel] = useState<"settings" | "questions" | "notebook" | null>(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [theme, setTheme] = useState({
    background: "#f1f5f9",
    text: "#0f172a",
    fontSize: 16,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  function syncRepeatState(times: number, remaining: number) {
    repeatTimesRef.current = times;
    repeatRemainingRef.current = remaining;
    setRepeatTimes(times);
    setRepeatRemaining(remaining);
  }

  function resetRepeat() {
    syncRepeatState(0, 0);
  }

  const lesson = useMemo(
    () => lessons.find((item) => item.id === lessonId) ?? null,
    [lessonId, lessons],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadLessons() {
      try {
        const data = await getLegacyLessons();

        if (isMounted) {
          setLessons(data);
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load lesson data.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadLessons();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadLyrics() {
      setLyrics([]);
      setActiveIndex(null);
      lockedLineIndexRef.current = null;
      stopAtRef.current = null;
      resetRepeat();
      setCurrentImageIndex(0);

      if (!lesson?.lyricsUrl) {
        return;
      }

      const response = await fetch(lesson.lyricsUrl);
      const text = await response.text();

      if (isMounted) {
        setLyrics(parseLyrics(text));
      }
    }

    loadLyrics().catch((loadError) => {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load lyrics.",
      );
    });

    return () => {
      isMounted = false;
    };
  }, [lesson]);

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    activeLineRef.current?.scrollIntoView({
      block: "center",
      behavior: "smooth",
    });
  }, [activeIndex]);

  function handleTimeUpdate() {
    const audio = audioRef.current;

    if (!audio || lyrics.length === 0) {
      return;
    }

    const currentTime = audio.currentTime;
    const lockedIndex = lockedLineIndexRef.current;

    if (stopAtRef.current !== null && currentTime >= stopAtRef.current) {
      const lineIndex = lockedIndex ?? activeIndex ?? 0;
      const lineStart = lyrics[lineIndex]?.time ?? 0;
      audio.pause();
      // Stay inside the clicked line — do not land on the next line's timestamp.
      audio.currentTime = Math.max(lineStart, stopAtRef.current - 0.05);
      stopAtRef.current = null;
      setActiveIndex(lineIndex);
      return;
    }

    if (lockedIndex !== null) {
      return;
    }

    const nextIndex = lyrics.findIndex((line, index) => {
      const nextLine = lyrics[index + 1];
      return (
        currentTime >= line.time && (!nextLine || currentTime < nextLine.time)
      );
    });

    if (nextIndex >= 0 && nextIndex !== activeIndex) {
      setActiveIndex(nextIndex);
    }
  }

  function togglePlayPause() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (audio.paused) {
      stopAtRef.current = null;
      lockedLineIndexRef.current = null;
      fullLessonPlayRef.current = true;
      audio.play().catch((playError) => {
        setError(
          playError instanceof Error
            ? playError.message
            : "Could not play audio.",
        );
      });
    } else {
      audio.pause();
    }
  }

  function cycleImage() {
    if (!lesson || lesson.imageUrls.length <= 1) {
      setHideImage((value) => !value);
      return;
    }

    setCurrentImageIndex((index) => (index + 1) % lesson.imageUrls.length);
  }

  async function openQuestions() {
    setPanel("questions");

    if (!lesson?.questionUrl) {
      setQuestions([]);
      return;
    }

    const response = await fetch(lesson.questionUrl);
    const text = await response.text();
    setQuestions(text.split(/\r?\n/).filter((item) => item.trim()));
  }

  function playFromLine(index: number) {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    lockedLineIndexRef.current = index;
    fullLessonPlayRef.current = false;
    resetRepeat();
    audio.currentTime = lyrics[index].time;
    stopAtRef.current = lyrics[index + 1]?.time ?? audio.duration;
    audio.play().catch((playError) => {
      setError(
        playError instanceof Error
          ? playError.message
          : "Could not play audio.",
      );
    });
    setActiveIndex(index);
  }

  function handleAudioEnded() {
    if (lessonEndHandlingRef.current) {
      return;
    }

    const audio = audioRef.current;

    if (!audio) {
      setIsPlaying(false);
      return;
    }

    if (lockedLineIndexRef.current !== null || stopAtRef.current !== null) {
      setIsPlaying(false);
      lessonEndHandlingRef.current = false;
      return;
    }

    lessonEndHandlingRef.current = true;

    if (repeatRemainingRef.current > 0) {
      syncRepeatState(repeatTimesRef.current, repeatRemainingRef.current - 1);
      audio.currentTime = 0;
      setActiveIndex(null);
      audio
        .play()
        .catch((playError) => {
          setError(
            playError instanceof Error
              ? playError.message
              : "Could not play audio.",
          );
        })
        .finally(() => {
          lessonEndHandlingRef.current = false;
        });
      return;
    }

    resetRepeat();
    fullLessonPlayRef.current = false;
    setIsPlaying(false);
    lessonEndHandlingRef.current = false;
  }

  function cycleRepeatCount() {
    let next = repeatTimesRef.current + 1;

    if (next > 5) {
      next = 0;
    }

    syncRepeatState(next, next);
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Dang tai bai hoc...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Khong tim thay bai hoc.
      </div>
    );
  }

  const currentImage = lesson.imageUrls[currentImageIndex];

  return (
    <div className="relative flex h-full min-h-0 flex-col pb-16 lg:pb-0">
      <FloatingToolbar
        isPlaying={isPlaying}
        repeatTimes={repeatTimes}
        repeatRemaining={repeatRemaining}
        onPlayPause={togglePlayPause}
        onRepeat={cycleRepeatCount}
        onImage={cycleImage}
        onNotebook={() => setPanel("notebook")}
        onSettings={() => setPanel("settings")}
        onQuestions={openQuestions}
        onLogout={logout}
      />
      <section
        className="flex min-h-0 flex-1 flex-col gap-3"
        style={{backgroundColor: theme.background, color: theme.text}}
      >
        <button
          type="button"
          onClick={() => setHideText((value) => !value)}
          className="shrink-0 w-full rounded-lg border border-slate-200 bg-white px-5 py-3 text-center shadow-sm"
          title={hideText ? "Hien lyrics" : "An lyrics"}
        >
          <span className="text-2xl font-semibold text-slate-950 xl:text-3xl">
            {formatLessonCode(lesson)}
          </span>
        </button>

        <div className="grid min-h-0 flex-1 grid-rows-2 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.25fr)] xl:grid-rows-1">
          <div className="flex min-h-0 flex-col">
            <div className="flex h-full min-h-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              {currentImage && !hideImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentImage}
                  alt={lesson.title}
                  onClick={() => setHideImage(true)}
                  className="h-full w-full cursor-pointer object-contain bg-slate-50"
                  title="An hinh anh"
                />
              ) : hideImage && currentImage ? (
                <button
                  type="button"
                  onClick={() => setHideImage(false)}
                  className="flex h-full w-full items-center justify-center bg-slate-100 text-sm font-semibold text-slate-500"
                  title="Hien hinh anh"
                >
                  Ảnh đang ẩn. Bấm để hiện lại.
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setHideImage(false)}
                  className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-500"
                  title="Hien hinh anh"
                >
                  Chua co hinh anh
                </button>
              )}
            </div>

            <audio
              ref={audioRef}
              src={lesson.audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={handleAudioEnded}
              className="hidden"
            />
          </div>

          <div
            className="h-full min-h-0 overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
            style={{fontSize: theme.fontSize}}
          >
            {lyrics.length > 0 && !hideText ? (
              <LyricsWithVocabMarks
                lessonId={lessonId}
                lyrics={lyrics}
                activeIndex={activeIndex}
                activeLineRef={activeLineRef}
                fontSize={theme.fontSize}
                onLineClick={playFromLine}
              />
            ) : hideText && lyrics.length > 0 ? (
              <button
                type="button"
                onClick={() => setHideText(false)}
                className="flex h-full min-h-0 w-full items-center justify-center rounded-md bg-slate-50 text-sm font-semibold text-slate-500"
              >
                Lyrics đang ẩn. Bấm để hiện lại.
              </button>
            ) : (
              <p className="text-sm text-slate-500">Bai nay chua co lyrics.</p>
            )}
          </div>
        </div>
      </section>

      <SlidePanel
        title={panelTitle(panel)}
        isOpen={panel !== null}
        isResizable={panel === "notebook"}
        onClose={() => setPanel(null)}
      >
        {panel === "settings" ? (
          <div className="space-y-5">
            <label className="block text-sm font-semibold text-slate-700">
              Mau nen
              <input
                type="color"
                value={theme.background}
                onChange={(event) =>
                  setTheme((value) => ({
                    ...value,
                    background: event.target.value,
                  }))
                }
                className="mt-2 h-10 w-full"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Mau chu
              <input
                type="color"
                value={theme.text}
                onChange={(event) =>
                  setTheme((value) => ({...value, text: event.target.value}))
                }
                className="mt-2 h-10 w-full"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Co chu: {theme.fontSize}px
              <input
                type="range"
                min="14"
                max="28"
                value={theme.fontSize}
                onChange={(event) =>
                  setTheme((value) => ({
                    ...value,
                    fontSize: Number(event.target.value),
                  }))
                }
                className="mt-2 w-full"
              />
            </label>
            <button
              type="button"
              onClick={() => setHideText((value) => !value)}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              {hideText ? "Hien lyrics" : "An lyrics"}
            </button>
          </div>
        ) : null}

        {panel === "questions" ? (
          <div className="space-y-4">
            {questions.length > 0 ? (
              questions.map((question, index) => (
                <div
                  key={`${question}-${index}`}
                  className="rounded-md border border-slate-200 p-3"
                >
                  <p className="font-semibold text-slate-800">
                    {index + 1}. {question}
                  </p>
                  <textarea
                    className="mt-3 min-h-24 w-full rounded-md border border-slate-300 p-3 text-sm outline-none focus:border-emerald-500"
                    placeholder="Write your answer..."
                  />
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">
                Bai nay chua co file questions.
              </p>
            )}
          </div>
        ) : null}

        {panel === "notebook" ? (
          <LessonNotebook lessonId={lessonId} lessonTitle={lesson.title} />
        ) : null}

      </SlidePanel>
    </div>
  );
}

function panelTitle(panel: string | null) {
  switch (panel) {
    case "settings":
      return "Settings";
    case "questions":
      return "Questions";
    case "notebook":
      return "Notebook";
    default:
      return "";
  }
}

function FloatingToolbar({
  isPlaying,
  repeatTimes,
  repeatRemaining,
  onPlayPause,
  onRepeat,
  onImage,
  onNotebook,
  onSettings,
  onQuestions,
  onLogout,
}: {
  isPlaying: boolean;
  repeatTimes: number;
  repeatRemaining: number;
  onPlayPause: () => void;
  onRepeat: () => void;
  onImage: () => void;
  onNotebook: () => void;
  onSettings: () => void;
  onQuestions: () => void;
  onLogout: () => void;
}) {
  const actions = [
    {
      label: isPlaying ? "Pause" : "Play",
      icon: isPlaying ? Pause : Play,
      onClick: onPlayPause,
    },
    {
      label: repeatTimes > 0 ? `Repeat` : "Repeat",
      icon: Repeat,
      onClick: onRepeat,
      isActive: repeatTimes > 0,
      badge: repeatTimes > 0 ? repeatRemaining : null,
    },
    {label: "Image", icon: ImageIcon, onClick: onImage},
    {label: "Notebook", icon: FolderClosed, onClick: onNotebook},
    {label: "Settings", icon: Settings, onClick: onSettings},
    {label: "Questions", icon: FileQuestion, onClick: onQuestions},
    {label: "Logout", icon: LogOut, onClick: onLogout},
  ];

  return (
    <>
      <div className="fixed right-5 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2 lg:flex">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              title={action.label}
              className={`group relative flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition hover:bg-emerald-50 hover:text-emerald-700 ${
                "isActive" in action && action.isActive
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              <Icon size={18} />
              {"badge" in action &&
              action.badge !== null &&
              action.badge !== undefined ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                  {action.badge}
                </span>
              ) : null}
              <span className="pointer-events-none absolute right-12 whitespace-nowrap rounded-md bg-slate-950 px-2 py-1 text-xs font-semibold text-white opacity-0 shadow transition group-hover:opacity-100">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-2xl backdrop-blur lg:hidden">
        <div className="flex gap-2 overflow-x-auto">
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                title={action.label}
                className={`relative flex h-12 min-w-12 items-center justify-center rounded-full border transition ${
                  "isActive" in action && action.isActive
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <Icon size={19} />
                {"badge" in action &&
                action.badge !== null &&
                action.badge !== undefined ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                    {action.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function SlidePanel({
  title,
  isOpen,
  isResizable = false,
  onClose,
  children,
}: {
  title: string;
  isOpen: boolean;
  isResizable?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [width, setWidth] = useState(520);

  if (!isOpen) {
    return null;
  }

  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isResizable) {
      return;
    }

    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;

    function handleMove(moveEvent: PointerEvent) {
      const nextWidth = Math.min(
        Math.max(startWidth + startX - moveEvent.clientX, 360),
        Math.min(window.innerWidth - 24, 920),
      );
      setWidth(nextWidth);
    }

    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  return (
    <div
      className="fixed inset-y-0 right-0 z-40 w-full border-l border-slate-200 bg-white p-5 shadow-2xl"
      style={{maxWidth: isResizable ? "calc(100vw - 24px)" : 448, width: isResizable ? width : "100%"}}
    >
      {isResizable ? (
        <div
          role="separator"
          aria-label="Resize notebook"
          onPointerDown={startResize}
          className="absolute inset-y-0 left-0 w-2 cursor-col-resize bg-transparent hover:bg-emerald-200"
        />
      ) : null}
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Palette size={18} className="text-emerald-700" />
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
        >
          <X size={18} />
        </button>
      </div>
      <div className="max-h-[calc(100vh-6rem)] overflow-y-auto">{children}</div>
    </div>
  );
}
