"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
  CheckCircle2,
  XCircle,
} from "lucide-react";

import {LessonNotebook} from "@/components/lesson/LessonNotebook";
import {LyricsWithVocabMarks} from "@/components/lesson/LyricsWithVocabMarks";
import {getLegacyLessons} from "@/lib/lessons";
import {logout} from "@/lib/auth";
import {loadDividerPct, saveDividerPct} from "@/lib/lessonLayout";
import type {Lesson} from "@/types/lesson";

// Import kết nối Firebase từ file của bạn
import {db, auth} from "@/lib/firebase";
import {doc, getDoc, setDoc, deleteDoc} from "firebase/firestore";
import {onAuthStateChanged} from "firebase/auth";

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
  const [panel, setPanel] = useState<
    "settings" | "questions" | "notebook" | null
  >(null);
  const [questions, setQuestions] = useState<string[]>([]);
  const [theme, setTheme] = useState({
    background: "#f1f5f9",
    text: "#0f172a",
    fontSize: 16,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [dividerPct, setDividerPct] = useState(loadDividerPct);
  const [xl, setXl] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dividerPctRef = useRef(dividerPct);

  // Lưu thông tin userId hiện tại từ Firebase Auth
  const [userId, setUserId] = useState<string | null>(null);

  // Trạng thái lưu câu trả lời và kết quả check đúng/sai của chế độ Dictation
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [checkedLines, setCheckedLines] = useState<
    Record<number, "correct" | "incorrect">
  >({});

  // 1. Lắng nghe trạng thái đăng nhập của User
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Tải dữ liệu cũ từ Firebase Firestore khi thay đổi Bài học hoặc User thay đổi
  useEffect(() => {
    async function loadDictationFromFirebase() {
      if (!userId || !lessonId) {
        setUserAnswers({});
        setCheckedLines({});
        return;
      }

      try {
        const docRef = doc(db, "users", userId, "dictation", lessonId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserAnswers(data.userAnswers || {});
          setCheckedLines(data.checkedLines || {});
        } else {
          setUserAnswers({});
          setCheckedLines({});
        }
      } catch (err) {
        console.error("Lỗi khi lấy dữ liệu từ Firebase:", err);
      }
    }

    loadDictationFromFirebase();
  }, [lessonId, userId]);

  // 3. Hàm lưu câu trả lời lên Firebase (Bao gồm chữ đã gõ và trạng thái check đúng/sai)
  const saveToFirebase = async (
    answers: Record<number, string>,
    checked: Record<number, "correct" | "incorrect">,
  ) => {
    if (!userId) return; // Nếu chưa đăng nhập thì không lưu được trên Cloud
    try {
      const docRef = doc(db, "users", userId, "dictation", lessonId);
      await setDoc(
        docRef,
        {
          userAnswers: answers,
          checkedLines: checked,
          updatedAt: new Date(),
        },
        {merge: true},
      );
    } catch (err) {
      console.error("Lỗi khi lưu dữ liệu lên Firebase:", err);
    }
  };

  // Hàm xóa toàn bộ dữ liệu của bài học hiện tại trên Firebase
  const handleClearAll = async () => {
    if (!userId) return;
    if (confirm("Bạn có chắc chắn muốn xóa toàn bộ nội dung đã gõ không?")) {
      setUserAnswers({});
      setCheckedLines({});
      try {
        const docRef = doc(db, "users", userId, "dictation", lessonId);
        await deleteDoc(docRef);
      } catch (err) {
        console.error("Lỗi khi xóa dữ liệu trên Firebase:", err);
      }
    }
  };

  useEffect(() => {
    dividerPctRef.current = dividerPct;
  }, [dividerPct]);

  // Detect xl breakpoint (>= 1280px)
  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1280px)");

    function handleChange(event: MediaQueryListEvent | MediaQueryList) {
      setXl(event.matches);
    }

    handleChange(mediaQuery);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  function handleDividerResize(clientX: number) {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.min(Math.max((x / rect.width) * 100, 20), 80);

    setDividerPct(pct);
    dividerPctRef.current = pct;
  }

  function handleDividerUp() {
    saveDividerPct(dividerPctRef.current);
  }

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

  // Tối ưu hoá việc làm sạch text để so sánh chính xác hơn
  function cleanText(text: string) {
    return text
      .trim()
      .toLowerCase()
      .replace(/[’‘`]/g, "'")
      .replace(/[.,\/#!$%\^&\*;:{}=\-_~()?]/g, "")
      .replace(/\s+/g, " ");
  }

  // Hàm xử lý kiểm tra đáp án nghe-chép chính xác theo từng từ
  function checkAnswer(index: number) {
    const userAnswer = userAnswers[index] || "";
    if (!userAnswer.trim()) return;

    const correctText = lyrics[index].text;
    const isCorrect = cleanText(userAnswer) === cleanText(correctText);

    const nextChecked = {
      ...checkedLines,
      [index]: isCorrect ? ("correct" as const) : ("incorrect" as const),
    };

    setCheckedLines(nextChecked);
    saveToFirebase(userAnswers, nextChecked);
  }

  // So sánh từng từ để highlight lỗi sai chính xác
  function renderHighlightedError(correctText: string, userAnswer: string) {
    const correctWords = correctText.split(/\s+/);
    const userWords = cleanText(userAnswer).split(/\s+/);

    return correctWords.map((word, idx) => {
      const cleanedCorrect = cleanText(word);
      const isWordMatch = userWords.includes(cleanedCorrect);

      if (isWordMatch) {
        return (
          <span key={idx} className="mr-1 text-slate-700">
            {word}
          </span>
        );
      } else {
        return (
          <span
            key={idx}
            className="bg-red-100 border border-red-200 text-red-700 font-semibold px-1 rounded mr-1 shadow-sm line-through decoration-red-500 decoration-2 animate-fadeIn"
          >
            {word}
          </span>
        );
      }
    });
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

    // Nếu bấm vào câu đang active và audio đang phát thì tạm dừng
    if (activeIndex === index && isPlaying) {
      audio.pause();
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
        className="flex flex-1 flex-col gap-3 overflow-y-auto"
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

        <div
          ref={containerRef}
          className="flex flex-col gap-3 xl:min-h-0 xl:flex-1 xl:flex-row xl:gap-0"
        >
          <div
            className="flex flex-col xl:min-h-0"
            style={{
              flex: xl ? `0 0 ${dividerPct}%` : undefined,
              minWidth: xl ? 200 : undefined,
            }}
          >
            <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm max-xl:min-h-[60vh] xl:h-full xl:min-h-0">
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

          <ResizableDivider
            onResize={handleDividerResize}
            onUp={handleDividerUp}
          />

          <div
            className="flex flex-col xl:min-h-0"
            style={{
              flex: xl ? `1 1 ${100 - dividerPct}%` : undefined,
              minWidth: xl ? 200 : undefined,
            }}
          >
            <div
              className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm xl:h-full xl:min-h-0 xl:overflow-y-auto"
              style={{fontSize: theme.fontSize}}
            >
              {lyrics.length > 0 ? (
                !hideText ? (
                  /* HIỂN THỊ LYRICS BÌNH THƯỜNG */
                  <LyricsWithVocabMarks
                    lessonId={lessonId}
                    lyrics={lyrics}
                    activeIndex={activeIndex}
                    activeLineRef={activeLineRef}
                    fontSize={theme.fontSize}
                    onLineClick={playFromLine}
                  />
                ) : (
                  /* GIAO DIỆN DICTATION KHI ẨN CHỮ */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2 mb-2">
                      <p className="text-xs text-slate-400 font-medium">
                        Chế độ kiểm tra chính tả: Bấm nút đầu câu để nghe, gõ
                        chữ rồi nhấn Enter.{" "}
                        {!userId && (
                          <span className="text-amber-500 font-bold ml-1">
                            (Chưa đăng nhập - Dữ liệu sẽ không lưu lên đám mây)
                          </span>
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={handleClearAll}
                        className="flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition shadow-sm"
                        title="Xóa toàn bộ nội dung đã gõ"
                      >
                        <X size={12} />
                        <span>Xóa toàn bộ</span>
                      </button>
                    </div>

                    {lyrics.map((line, index) => {
                      const isCurrentActive = activeIndex === index;
                      const status = checkedLines[index];

                      // Thiết lập các nhóm màu bao khối bên ngoài dựa trên kết quả check đáp án
                      let containerClasses = "";
                      if (status === "correct") {
                        // Trúng nhóm này khi câu trả lời hoàn toàn chính xác
                        containerClasses =
                          "border-green-400 bg-green-50/70 shadow-sm";
                      } else if (status === "incorrect") {
                        // Trúng nhóm này khi câu trả lời bị sai
                        containerClasses =
                          "border-red-400 bg-red-50/70 shadow-sm";
                      } else if (isCurrentActive) {
                        // Khi đang chọn/nghe dòng này nhưng chưa check kết quả
                        containerClasses =
                          "bg-slate-50 border-emerald-300 shadow-sm";
                      } else {
                        // Trạng thái bình thường
                        containerClasses =
                          "border-slate-200/60 bg-white hover:bg-slate-50/50";
                      }

                      return (
                        <div
                          key={index}
                          ref={isCurrentActive ? (activeLineRef as any) : null}
                          className={`flex flex-col gap-1.5 p-2 rounded-md transition-all duration-200 border ${containerClasses}`}
                        >
                          <div className="flex items-center gap-3">
                            {/* LUÔN LUÔN HIỂN THỊ ICON PLAY/PAUSE */}
                            <button
                              type="button"
                              onClick={() => playFromLine(index)}
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition ${
                                isCurrentActive && isPlaying
                                  ? "bg-emerald-600 text-white shadow-md animate-pulse"
                                  : "bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600"
                              }`}
                              title={
                                isCurrentActive && isPlaying
                                  ? "Tạm dừng"
                                  : "Nghe câu này"
                              }
                            >
                              {/* Chỉ phụ thuộc vào trạng thái chạy/dừng của audio */}
                              {isCurrentActive && isPlaying ? (
                                <Pause size={12} />
                              ) : (
                                <Play size={12} className="ml-0.5" />
                              )}
                            </button>

                            {/* Ô nhập input */}
                            <div className="relative flex-1">
                              <input
                                type="text"
                                value={userAnswers[index] || ""}
                                onChange={(e) => {
                                  const nextAnswers = {
                                    ...userAnswers,
                                    [index]: e.target.value,
                                  };
                                  setUserAnswers(nextAnswers);

                                  // Nếu người dùng thay đổi chữ, reset trạng thái checked cũ để họ kiểm tra lại
                                  const nextChecked = {...checkedLines};
                                  if (status) {
                                    delete nextChecked[index];
                                    setCheckedLines(nextChecked);
                                  }

                                  // Lưu real-time ký tự gõ lên Firebase
                                  saveToFirebase(nextAnswers, nextChecked);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    checkAnswer(index);
                                  }
                                }}
                                onFocus={() => setActiveIndex(index)}
                                placeholder={`Nghe và nhập câu số ${index + 1}...`}
                                // Thay đổi class border linh hoạt theo status đúng/sai
                                className={`w-full rounded border bg-white text-slate-800 px-3 py-1 text-sm outline-none transition pr-8 font-medium ${
                                  status === "correct"
                                    ? "border-green-400 focus:border-green-500 bg-white"
                                    : status === "incorrect"
                                      ? "border-red-400 focus:border-red-500 bg-white"
                                      : "border-slate-200 focus:border-slate-400"
                                }`}
                              />
                            </div>
                          </div>

                          {/* Hiển thị chi tiết lỗi sai nếu kiểm tra kết quả bị "incorrect" */}
                          {status === "incorrect" && (
                            <div className="pl-10 pr-2 text-xs transition-all duration-200">
                              <div className="text-slate-500 font-medium leading-relaxed">
                                <span className="font-bold text-red-600 mr-2">
                                  Lỗi sai:
                                </span>
                                {renderHighlightedError(
                                  line.text,
                                  userAnswers[index] || "",
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <p className="text-sm text-slate-500">
                  Bai nay chua co lyrics.
                </p>
              )}
            </div>
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

function ResizableDivider({
  onResize,
  onUp,
}: {
  onResize: (clientX: number) => void;
  onUp?: () => void;
}) {
  const isDraggingRef = useRef(false);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    isDraggingRef.current = true;
    onResize(event.clientX);

    function handleMove(moveEvent: PointerEvent) {
      if (!isDraggingRef.current) return;
      onResize(moveEvent.clientX);
    }

    function handleUp() {
      isDraggingRef.current = false;
      onUp?.();
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  return (
    <div
      role="separator"
      aria-label="Resize panels"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          onResize(-10);
        } else if (event.key === "ArrowRight") {
          onResize(10);
        }
      }}
      className="hidden w-2 shrink-0 cursor-col-resize items-center justify-center bg-transparent transition-colors hover:bg-emerald-100 active:bg-emerald-200 xl:flex"
    >
      <div className="flex flex-col gap-px">
        <span className="block h-0.5 w-0.5 rounded-full bg-slate-400" />
        <span className="block h-0.5 w-0.5 rounded-full bg-slate-400" />
        <span className="block h-0.5 w-0.5 rounded-full bg-slate-400" />
      </div>
    </div>
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
      style={{
        maxWidth: isResizable ? "calc(100vw - 24px)" : 448,
        width: isResizable ? width : "100%",
      }}
    >
      {isResizable ? (
        <div
          role="separator"
          aria-label="Resize notebook"
          onPointerDown={startResize}
          className="absolute inset-y-0 left-0 w-2 cursor-col-resize bg-transparent hover:bg-emerald-200"
        />
      ) : null}
      <div className="mb-5 flex items-center justify-between gap-0">
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
