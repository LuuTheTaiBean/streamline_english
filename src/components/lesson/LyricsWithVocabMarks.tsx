"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {GripVertical, Loader2, Save, Trash2, Volume2, X} from "lucide-react";

import {loadLyricVocabMarks, saveLyricVocabMarks} from "@/lib/lyricVocabMarks";
import type {LyricVocabMark} from "@/types/lyricVocabMark";

type LyricLine = {
  time: number;
  text: string;
};

type NotePanelState = {
  x: number;
  y: number;
  word: string;
  note: string;
  lineIndex: number;
  start: number;
  end: number;
  markId?: string;
  mode: "draft" | "hover";
  phonetics?: string;
};

function stripHtml(html: string) {
  // Loại bỏ HTML để tính toán vị trí marks
  if (typeof document === "undefined") {
    return html.replace(/<[^>]*>/g, "");
  }

  const element = document.createElement("div");
  element.innerHTML = html;
  return element.textContent ?? "";
}

function getSelectionInLine(lineElement: HTMLElement) {
  const selection = window.getSelection();

  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);

  if (!lineElement.contains(range.commonAncestorContainer)) {
    return null;
  }

  const prefix = range.cloneRange();
  prefix.selectNodeContents(lineElement);
  prefix.setEnd(range.startContainer, range.startOffset);

  const start = prefix.toString().length;
  const selectedText = range.toString();
  const word = selectedText.trim();

  if (!word) {
    return null;
  }

  const leadingSpaces = selectedText.length - selectedText.trimStart().length;

  return {
    start: start + leadingSpaces,
    end: start + leadingSpaces + word.length,
    word,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getBoldPrefix(originalHtml: string) {
  const match = originalHtml.trimStart().match(/^<b>(.*?)<\/b>/i);
  return match?.[1] ?? "";
}

function renderTextFragment(
  text: string,
  absoluteStart: number,
  boldPrefix: string,
  keyPrefix: string,
) {
  if (!boldPrefix) {
    return text;
  }

  const absoluteEnd = absoluteStart + text.length;
  const boldEnd = boldPrefix.length;

  if (absoluteEnd <= 0 || absoluteStart >= boldEnd) {
    return text;
  }

  const parts: ReactNode[] = [];
  const localBoldStart = Math.max(0 - absoluteStart, 0);
  const localBoldEnd = Math.min(boldEnd - absoluteStart, text.length);

  if (localBoldStart > 0) {
    parts.push(text.slice(0, localBoldStart));
  }

  parts.push(
    <b key={`${keyPrefix}-bold`}>{text.slice(localBoldStart, localBoldEnd)}</b>,
  );

  if (localBoldEnd < text.length) {
    parts.push(text.slice(localBoldEnd));
  }

  return parts;
}

function renderMarkedLine(
  plainText: string,
  originalHtml: string,
  lineIndex: number,
  marks: LyricVocabMark[],
  onMarkEnter: (mark: LyricVocabMark, element: HTMLElement) => void,
  onMarkLeave: () => void,
) {
  const lineMarks = marks
    .filter((mark) => mark.lineIndex === lineIndex)
    .sort((a, b) => a.start - b.start);

  if (lineMarks.length === 0) {
    // Render HTML gốc khi không có marks
    return <span dangerouslySetInnerHTML={{__html: originalHtml}} />;
  }

  // Khi có marks, render plain text để tránh bị lệch do HTML tags
  const boldPrefix = getBoldPrefix(originalHtml);
  const parts: ReactNode[] = [];
  let cursor = 0;

  lineMarks.forEach((mark) => {
    if (mark.start > cursor) {
      parts.push(
        renderTextFragment(
          plainText.slice(cursor, mark.start),
          cursor,
          boldPrefix,
          `text-${cursor}`,
        ),
      );
    }

    parts.push(
      <mark
        key={mark.id}
        data-vocab-mark="true"
        className="cursor-help rounded-sm bg-amber-200/90 px-0.5 text-inherit underline decoration-amber-500/70 decoration-2 underline-offset-2"
        onMouseEnter={(event) => onMarkEnter(mark, event.currentTarget)}
        onMouseLeave={onMarkLeave}
      >
        {renderTextFragment(
          plainText.slice(mark.start, mark.end),
          mark.start,
          boldPrefix,
          `mark-${mark.id}`,
        )}
      </mark>,
    );

    cursor = Math.max(cursor, mark.end);
  });

  if (cursor < plainText.length) {
    parts.push(
      renderTextFragment(
        plainText.slice(cursor),
        cursor,
        boldPrefix,
        `text-${cursor}`,
      ),
    );
  }

  return parts;
}

function FloatingVocabPanel({
  panel,
  onNoteChange,
  onSave,
  onClose,
  onDelete,
  onPlayAudio,
  isAudioLoading,
  audioError,
  onDragStart,
  onPanelEnter,
  onPanelLeave,
}: {
  panel: NotePanelState;
  onNoteChange: (note: string) => void;
  onSave?: () => void;
  onClose: () => void;
  onDelete?: () => void;
  onPlayAudio?: () => void;
  isAudioLoading?: boolean;
  audioError?: string;
  onDragStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPanelEnter?: () => void;
  onPanelLeave?: () => void;
}) {
  const isDraft = panel.mode === "draft";

  return (
    <div
      className="fixed z-50 w-72 rounded-lg border border-slate-200 bg-white shadow-xl"
      style={{left: panel.x, top: panel.y}}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onMouseEnter={onPanelEnter}
      onMouseLeave={onPanelLeave}
    >
      <div
        className={`flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 ${
          isDraft ? "cursor-grab active:cursor-grabbing" : ""
        }`}
        onPointerDown={isDraft ? onDragStart : undefined}
      >
        <div className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-slate-800">
          {isDraft ? (
            <GripVertical size={14} className="shrink-0 text-slate-400" />
          ) : null}
          <span className="truncate text-amber-800">{panel.word}</span>
        </div>
        {isDraft ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            title="Dong"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>
      <div className="space-y-2 p-3">
        {!isDraft && panel.phonetics ? (
          <p className="text-sm font-semibold text-slate-600">
            {`/${panel.phonetics.replace(/^\/+|\/+$/g, "")}/`}
          </p>
        ) : null}
        {isDraft ? (
          <textarea
            value={panel.note}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder="Ghi nghia, ghi chu..."
            className="min-h-24 w-full resize-y rounded-md border border-slate-300 p-2 text-sm outline-none focus:border-emerald-500"
            autoFocus
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {panel.note || "(Chua co ghi chu)"}
          </p>
        )}
        {isDraft ? (
          <button
            type="button"
            onClick={onSave}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Save size={14} />
            Luu tu vung
          </button>
        ) : null}
        {!isDraft && (onPlayAudio || onDelete) ? (
          <div className="flex gap-2">
            {onPlayAudio ? (
              <button
                type="button"
                onClick={onPlayAudio}
                disabled={isAudioLoading}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                title="Nghe phat am (Oxford)"
              >
                {isAudioLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Volume2 size={14} />
                )}
                Nghe
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                title="Xoa highlight"
              >
                <Trash2 size={14} />
                Xoa
              </button>
            ) : null}
          </div>
        ) : null}
        {audioError ? (
          <p className="text-xs text-red-600">{audioError}</p>
        ) : null}
        {!isDraft ? (
          <a
            href={`https://www.oxfordlearnersdictionaries.com/definition/english/${encodeURIComponent(panel.word.toLowerCase())}`}
            target="_blank"
            rel="noreferrer"
            className="block text-center text-xs text-slate-500 underline-offset-2 hover:text-emerald-700 hover:underline"
          >
            Mo tren Oxford Learner&apos;s Dictionaries
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function LyricsWithVocabMarks({
  lessonId,
  lyrics,
  activeIndex,
  activeLineRef,
  fontSize,
  onLineClick,
}: {
  lessonId: string;
  lyrics: LyricLine[];
  activeIndex: number | null;
  activeLineRef: React.RefObject<HTMLParagraphElement | null>;
  fontSize: number;
  onLineClick: (index: number) => void;
}) {
  const lyricsRef = useRef<HTMLDivElement>(null);
  const [marks, setMarks] = useState<LyricVocabMark[]>([]);
  const [draftPanel, setDraftPanel] = useState<NotePanelState | null>(null);
  const [hoverPanel, setHoverPanel] = useState<NotePanelState | null>(null);
  const dragOffsetRef = useRef({x: 0, y: 0});
  const hideHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pronunciationAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState("");

  const plainLines = useMemo(
    () => lyrics.map((line) => stripHtml(line.text)),
    [lyrics],
  );

  const persistMarks = useCallback(
    (nextMarks: LyricVocabMark[]) => {
      setMarks(nextMarks);
      saveLyricVocabMarks(lessonId, nextMarks);
    },
    [lessonId],
  );

  useEffect(() => {
    const nextMarks = loadLyricVocabMarks(lessonId);

    queueMicrotask(() => {
      setMarks(nextMarks);
      setDraftPanel(null);
      setHoverPanel(null);
    });
  }, [lessonId]);

  const openDraftAtSelection = useCallback(() => {
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed) {
      return;
    }

    const anchorNode = selection.anchorNode;

    if (!anchorNode) {
      return;
    }

    const lineElement = (
      anchorNode.nodeType === Node.TEXT_NODE
        ? anchorNode.parentElement
        : (anchorNode as HTMLElement)
    )?.closest<HTMLElement>("[data-lyric-line]");

    if (!lineElement || !lyricsRef.current?.contains(lineElement)) {
      return;
    }

    const lineIndex = Number(lineElement.dataset.lineIndex);

    if (Number.isNaN(lineIndex)) {
      return;
    }

    const selected = getSelectionInLine(lineElement);

    if (!selected) {
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const panelWidth = 288;
    const panelHeight = 200;

    setHoverPanel(null);
    setDraftPanel({
      mode: "draft",
      lineIndex,
      start: selected.start,
      end: selected.end,
      word: selected.word,
      note: "",
      x: clamp(rect.right + 12, 12, window.innerWidth - panelWidth - 12),
      y: clamp(rect.top, 12, window.innerHeight - panelHeight - 12),
    });

    selection.removeAllRanges();
  }, []);

  function handleLyricsMouseUp() {
    window.setTimeout(() => {
      if (draftPanel) {
        return;
      }

      openDraftAtSelection();
    }, 0);
  }

  function handleLineClick(
    index: number,
    event: ReactMouseEvent<HTMLDivElement>,
  ) {
    const selectionText = window.getSelection()?.toString().trim();

    if (selectionText) {
      return;
    }

    if ((event.target as HTMLElement).closest("[data-vocab-mark]")) {
      return;
    }

    setDraftPanel(null);
    onLineClick(index);
  }

  function handleSaveDraft() {
    if (!draftPanel) {
      return;
    }

    const mark: LyricVocabMark = {
      id:
        draftPanel.markId ??
        (typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `mark-${Date.now()}`),
      lineIndex: draftPanel.lineIndex,
      start: draftPanel.start,
      end: draftPanel.end,
      word: draftPanel.word,
      note: draftPanel.note.trim(),
    };

    const withoutDuplicate = marks.filter(
      (item) =>
        !(
          item.lineIndex === mark.lineIndex &&
          item.start === mark.start &&
          item.end === mark.end
        ),
    );

    persistMarks([...withoutDuplicate, mark]);
    setDraftPanel(null);
  }

  function clearHideHoverTimeout() {
    if (hideHoverTimeoutRef.current) {
      clearTimeout(hideHoverTimeoutRef.current);
      hideHoverTimeoutRef.current = null;
    }
  }

  async function handlePlayPronunciation(word: string) {
    setAudioError("");
    setIsAudioLoading(true);

    try {
      const response = await fetch(
        `/api/oxford-pronunciation?word=${encodeURIComponent(word)}&lang=uk`,
      );
      const data = (await response.json()) as {
        audioUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.audioUrl) {
        setAudioError(data.error ?? "Khong tim thay phat am.");
        return;
      }

      if (pronunciationAudioRef.current) {
        pronunciationAudioRef.current.pause();
      }

      const audio = new Audio(data.audioUrl);
      pronunciationAudioRef.current = audio;

      await audio.play();
    } catch {
      setAudioError("Khong the phat am. Thu lai sau.");
    } finally {
      setIsAudioLoading(false);
    }
  }

  function handleDeleteMark(markId: string) {
    setMarks((current) => {
      const next = current.filter((mark) => mark.id !== markId);
      saveLyricVocabMarks(lessonId, next);
      return next;
    });
    setHoverPanel(null);
  }

  async function handleMarkEnter(mark: LyricVocabMark, element: HTMLElement) {
    if (draftPanel) {
      return;
    }

    clearHideHoverTimeout();

    const rect = element.getBoundingClientRect();
    const panelWidth = 288;
    const panelHeight = 160;

    setAudioError("");
    setHoverPanel({
      mode: "hover",
      markId: mark.id,
      lineIndex: mark.lineIndex,
      start: mark.start,
      end: mark.end,
      word: mark.word,
      note: mark.note,
      x: clamp(rect.right + 12, 12, window.innerWidth - panelWidth - 12),
      y: clamp(rect.top, 12, window.innerHeight - panelHeight - 12),
    });

    // Fetch phonetics from Oxford
    try {
      const response = await fetch(
        `/api/oxford-pronunciation?word=${encodeURIComponent(mark.word)}&lang=uk`,
      );
      const data = (await response.json()) as {
        audioUrl?: string;
        phonetics?: string;
        error?: string;
      };

      if (data.phonetics) {
        setHoverPanel((current) =>
          current ? {...current, phonetics: data.phonetics} : current,
        );
      }
    } catch {
      // Silent fail - phonetics is optional
    }
  }

  function handleMarkLeave() {
    clearHideHoverTimeout();
    hideHoverTimeoutRef.current = setTimeout(() => {
      setHoverPanel(null);
    }, 180);
  }

  function handleHoverPanelEnter() {
    clearHideHoverTimeout();
  }

  function handleHoverPanelLeave() {
    setHoverPanel(null);
  }

  function handleDragStart(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draftPanel) {
      return;
    }

    event.preventDefault();
    dragOffsetRef.current = {
      x: event.clientX - draftPanel.x,
      y: event.clientY - draftPanel.y,
    };

    const handleMove = (moveEvent: PointerEvent) => {
      const panelWidth = 288;
      const panelHeight = 200;

      setDraftPanel((current) =>
        current
          ? {
              ...current,
              x: clamp(
                moveEvent.clientX - dragOffsetRef.current.x,
                12,
                window.innerWidth - panelWidth - 12,
              ),
              y: clamp(
                moveEvent.clientY - dragOffsetRef.current.y,
                12,
                window.innerHeight - panelHeight - 12,
              ),
            }
          : current,
      );
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  return (
    <>
      <div
        ref={lyricsRef}
        className="space-y-0 select-text"
        onMouseUp={handleLyricsMouseUp}
      >
        {/* eslint-disable-next-line react-hooks/refs */}
        {lyrics.map((line, index) => (
          <div
            key={`${line.time}-${index}`}
            data-lyric-line
            data-line-index={index}
            ref={
              activeIndex !== null && index === activeIndex
                ? activeLineRef
                : null
            }
            onClick={(event) => handleLineClick(index, event)}
            className={`mb-1 cursor-pointer whitespace-pre-line rounded-md text-base leading-6 transition ${
              activeIndex !== null && index === activeIndex
                ? "bg-emerald-100 font-semibold text-emerald-950"
                : "text-slate-700 hover:bg-slate-100"
            }`}
            style={{fontSize}}
          >
            {renderMarkedLine(
              plainLines[index] ?? "",
              lyrics[index].text,
              index,
              marks,
              handleMarkEnter,
              handleMarkLeave,
            )}
          </div>
        ))}
      </div>

      {draftPanel ? (
        <FloatingVocabPanel
          panel={draftPanel}
          onNoteChange={(note) =>
            setDraftPanel((current) => (current ? {...current, note} : current))
          }
          onSave={handleSaveDraft}
          onClose={() => setDraftPanel(null)}
          onDragStart={handleDragStart}
        />
      ) : null}

      {hoverPanel && !draftPanel ? (
        <FloatingVocabPanel
          panel={hoverPanel}
          onNoteChange={() => undefined}
          onClose={() => setHoverPanel(null)}
          onPlayAudio={() => handlePlayPronunciation(hoverPanel.word)}
          isAudioLoading={isAudioLoading}
          audioError={audioError}
          onDelete={
            hoverPanel.markId
              ? () => handleDeleteMark(hoverPanel.markId!)
              : undefined
          }
          onDragStart={() => undefined}
          onPanelEnter={handleHoverPanelEnter}
          onPanelLeave={handleHoverPanelLeave}
        />
      ) : null}
    </>
  );
}
