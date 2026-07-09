const oxfordBase = "https://www.oxfordlearnersdictionaries.com";
const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export function normalizeOxfordWord(raw: string) {
  const cleaned = raw
    .replace(/[.,!?;:'"()]/g, " ")
    .trim()
    .toLowerCase();

  return cleaned.split(/\s+/).filter(Boolean)[0] ?? "";
}

function extractAudioUrls(html: string) {
  // SỬA ĐỔI QUAN TRỌNG: Chỉ tìm thuộc tính data-src-mp3="..." chính quy của nút phát âm
  const matches = html.matchAll(/data-src-mp3=["']([^"']+\.mp3)["']/gi);
  const urls = new Set<string>();

  for (const match of matches) {
    let path = match[1];
    // Nếu là đường dẫn tương đối, nối thêm domain gốc vào
    if (!path.startsWith("http")) {
      path = `${oxfordBase}${path.startsWith("/") ? "" : "/"}${path}`;
    }
    urls.add(path);
  }

  return [...urls];
}

function extractPhonetics(html: string, lang: "uk" | "us") {
  const phonClass = lang === "uk" ? "phon" : "us";

  // SỬA ĐỔI QUAN TRỌNG: Giới hạn khu vực quét nằm trong class phons_br (UK) hoặc phons_n_am (US)
  const wrapperClass = lang === "uk" ? "phons_br" : "phons_n_am";
  const regex = new RegExp(
    `class=["']${wrapperClass}["'][^>]*>.*?<span class=["']${phonClass}["'][^>]*>([^<]+)</span>`,
    "i",
  );
  const match = html.match(regex);

  if (match) return match[1].trim();

  // Phương án dự phòng nếu cấu trúc trang tối giản
  const fallbackRegex = new RegExp(
    `<span class=["']${phonClass}["'][^>]*>([^<]+)</span>`,
    "i",
  );
  const fallbackMatch = html.match(fallbackRegex);
  return fallbackMatch ? fallbackMatch[1].trim() : null;
}

function pickAudioUrl(urls: string[], lang: "uk" | "us") {
  // Lọc chính xác tệp âm thanh theo vùng ngôn ngữ
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
    cache: "no-store", // Ép không lưu cache fetch tĩnh
  });

  if (response.ok) {
    return response.text();
  }

  const searchUrl = `${oxfordBase}/search/english/?q=${slug}`;
  const searchResponse = await fetch(searchUrl, {
    headers: {"User-Agent": userAgent},
    cache: "no-store",
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
    cache: "no-store",
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
