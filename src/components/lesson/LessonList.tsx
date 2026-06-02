"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import { getLegacyLessons } from "@/lib/lessons";
import type { Lesson } from "@/types/lesson";

function formatBookName(book: string) {
  const bookNames: Record<string, string> = {
    book1: "Streamline English 1",
    book2: "Streamline English 2",
    book3: "Streamline English 3",
    book4: "Streamline English 4",
    book5: "Level 1",
    book6: "Level 2",
    book7: "Level 3",
    book8: "English 6",
    book9: "Streamline English 9",
    book10: "Streamline English 10",
  };

  return bookNames[book] ?? book;
}

export function LessonList() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [openBooks, setOpenBooks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;

    async function loadLessons() {
      try {
        const data = await getLegacyLessons();
        if (isMounted) {
          setLessons(data);
          const firstBook = data[0]?.book;
          setOpenBooks(firstBook ? { [firstBook]: true } : {});
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Could not load lessons.");
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

  const lessonsByBook = useMemo(() => {
    return lessons.reduce<Record<string, Lesson[]>>((groups, lesson) => {
      groups[lesson.book] = groups[lesson.book] ?? [];
      groups[lesson.book].push(lesson);
      return groups;
    }, {});
  }, [lessons]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Dang tai danh sach bai hoc...
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

  return (
    <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
      {Object.entries(lessonsByBook).map(([book, bookLessons]) => (
        <section
          key={book}
          className={`self-start rounded-lg border border-slate-200 bg-white shadow-sm ${
            openBooks[book] ? "lg:col-span-2 xl:col-span-4" : ""
          }`}
        >
          <button
            type="button"
            onClick={() => setOpenBooks((value) => ({ ...value, [book]: !value[book] }))}
            className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-slate-50"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                {formatBookName(book)}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">
                {bookLessons.length} bai hoc
              </h2>
            </div>
            <ChevronDown
              className={`h-5 w-5 text-slate-500 transition ${
                openBooks[book] ? "rotate-180" : ""
              }`}
            />
          </button>

          {openBooks[book] ? (
            <div className="grid gap-4 border-t border-slate-200 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {bookLessons.map((lesson) => (
                <LessonCard key={lesson.id} lesson={lesson} />
              ))}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function LessonCard({ lesson }: { lesson: Lesson }) {
  const [previewText, setPreviewText] = useState(lesson.previewText || "");

  useEffect(() => {
    let isMounted = true;

    async function loadPreview() {
      if (!lesson.lyricsUrl) {
        return;
      }

      const response = await fetch(lesson.lyricsUrl);

      if (!response.ok) {
        return;
      }

      const text = await response.text();
      const preview = text
        .split(/\r?\n/)
        .map((line) =>
          line
            .replace(/\[\d+:\d+(?:\.\d+)?\]/g, "")
            .replace(/\\n/g, " ")
            .trim(),
        )
        .filter(Boolean)
        .slice(0, 6)
        .join(" ");

      if (isMounted) {
        setPreviewText(preview);
      }
    }

    loadPreview();

    return () => {
      isMounted = false;
    };
  }, [lesson.lyricsUrl]);

  return (
    <Link
      href={`/lessons/${lesson.id}`}
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
    >
      <p className="text-sm font-semibold text-emerald-700">Unit {lesson.unit}</p>
      <h3 className="mt-2 text-lg font-semibold text-slate-950">{lesson.title}</h3>
      {previewText ? (
        <p
          className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600"
          dangerouslySetInnerHTML={{ __html: previewText }}
        />
      ) : (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
          {lesson.description || "No preview available."}
        </p>
      )}
    </Link>
  );
}
