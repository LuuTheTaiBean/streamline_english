const oxfordBase = "https://www.oxfordlearnersdictionaries.com";
const userAgent =
  "Mozilla/5.0 (compatible; StreamlineEnglish/1.0; +https://www.oxfordlearnersdictionaries.com)";

export function normalizeOxfordWord(raw: string) {
  const cleaned = raw
    .replace(/[.,!?;:'"()]/g, " ")
    .trim()
    .toLowerCase();

  return cleaned.split(/\s+/).filter(Boolean)[0] ?? "";
}

function extractAudioUrls(html: string) {
  const matches = html.matchAll(
    /(?:https:\/\/www\.oxfordlearnersdictionaries\.com)?(\/media\/english\/(?:uk_pron|us_pron)\/[^"'\\s]+\.mp3)/gi,
  );

  const urls = new Set<string>();

  for (const match of matches) {
    urls.add(`${oxfordBase}${match[1]}`);
  }

  return [...urls];
}

function extractPhonetics(html: string, lang: "uk" | "us") {
  const phonClass = lang === "uk" ? "phon" : "us";
  const regex = new RegExp(`<span class="${phonClass}">([^<]+)</span>`, "i");
  const match = html.match(regex);

  return match ? match[1].trim() : null;
}

function pickAudioUrl(urls: string[], lang: "uk" | "us") {
  const preferred = urls.find((url) =>
    lang === "uk" ? url.includes("/uk_pron/") : url.includes("/us_pron/"),
  );

  return preferred ?? urls[0] ?? null;
}

async function fetchDefinitionHtml(word: string) {
  const slug = encodeURIComponent(word);
  const definitionUrl = `${oxfordBase}/definition/english/${slug}`;

  const response = await fetch(definitionUrl, {
    headers: {"User-Agent": userAgent},
    next: {revalidate: 60 * 60 * 24},
  });

  if (response.ok) {
    return response.text();
  }

  const searchUrl = `${oxfordBase}/search/english/?q=${slug}`;
  const searchResponse = await fetch(searchUrl, {
    headers: {"User-Agent": userAgent},
    next: {revalidate: 60 * 60 * 24},
  });

  if (!searchResponse.ok) {
    return null;
  }

  const searchHtml = await searchResponse.text();
  const entryMatch = searchHtml.match(
    /href="(\/definition\/english\/[^"?#]+)"/i,
  );

  if (!entryMatch?.[1]) {
    return null;
  }

  const entryResponse = await fetch(`${oxfordBase}${entryMatch[1]}`, {
    headers: {"User-Agent": userAgent},
    next: {revalidate: 60 * 60 * 24},
  });

  if (!entryResponse.ok) {
    return null;
  }

  return entryResponse.text();
}

export async function getOxfordPronunciationUrl(
  rawWord: string,
  lang: "uk" | "us" = "uk",
) {
  const word = normalizeOxfordWord(rawWord);

  if (!word) {
    return null;
  }

  const html = await fetchDefinitionHtml(word);

  if (!html) {
    return null;
  }

  const urls = extractAudioUrls(html);
  const phonetics = extractPhonetics(html, lang);

  return {
    audioUrl: pickAudioUrl(urls, lang),
    phonetics,
  };
}
