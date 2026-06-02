import { collection, getDocs, query, where } from "firebase/firestore";

import { sampleLessons } from "@/data/sampleLessons";
import { db } from "@/lib/firebase";
import type { Lesson } from "@/types/lesson";

type LegacyLesson = {
  id: string;
  book: string;
  unit: string;
  lyrics?: string;
  images?: string[];
  image?: string;
  audio?: string;
  questions?: string;
};

const assetBasePath = "/streamline-assets";

function toAssetUrl(path?: string) {
  if (!path) {
    return "";
  }

  const cleanPath = path.replace(/^\.\//, "");

  return `${assetBasePath}/${cleanPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;
}

function parseUnitLabel(unit: string) {
  const [unitNumber, ...titleParts] = unit.split(":");
  const title = titleParts.join(":").trim();

  return {
    unit: unitNumber.trim().replace(/^\+/, ""),
    title: title || unit.trim(),
  };
}

export async function getLegacyLessons() {
  const response = await fetch(`${assetBasePath}/data.json`);

  if (!response.ok) {
    return sampleLessons;
  }

  const data = (await response.json()) as LegacyLesson[];

  return data.map((item, index) => {
    const unitData = parseUnitLabel(item.unit);
    const imagePaths = item.images ?? (item.image ? [item.image] : []);

    return {
      id: item.id,
      book: item.book,
      unit: unitData.unit,
      title: unitData.title,
      audioUrl: toAssetUrl(item.audio),
      lyricsUrl: toAssetUrl(item.lyrics),
      imageUrls: imagePaths.map(toAssetUrl),
      questionUrl: toAssetUrl(item.questions),
      order: index + 1,
      isPublished: true,
    } satisfies Lesson;
  });
}

export async function getPublishedLessons() {
  const lessonsQuery = query(
    collection(db, "lessons"),
    where("isPublished", "==", true),
  );

  const snapshot = await getDocs(lessonsQuery);

  if (snapshot.empty) {
    return sampleLessons;
  }

  return snapshot.docs
    .map(
      (lessonDoc) =>
        ({
          id: lessonDoc.id,
          ...lessonDoc.data(),
        }) as Lesson,
    )
    .sort((a, b) => a.order - b.order);
}
