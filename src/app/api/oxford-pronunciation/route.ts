import {NextResponse} from "next/server";

import {getOxfordPronunciationUrl} from "@/lib/oxfordPronunciation";

export async function GET(request: Request) {
  const {searchParams} = new URL(request.url);
  const word = searchParams.get("word") ?? "";
  const lang = searchParams.get("lang") === "us" ? "us" : "uk";

  try {
    const result = await getOxfordPronunciationUrl(word, lang);

    if (!result) {
      return NextResponse.json(
        {error: "Khong tim thay phat am tren Oxford."},
        {status: 404},
      );
    }

    return NextResponse.json({
      audioUrl: result.audioUrl,
      phonetics: result.phonetics,
      source: "https://www.oxfordlearnersdictionaries.com/",
    });
  } catch {
    return NextResponse.json(
      {error: "Khong the lay phat am tu Oxford."},
      {status: 502},
    );
  }
}
