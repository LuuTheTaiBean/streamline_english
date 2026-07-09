import {NextResponse} from "next/server";

import {getOxfordPronunciationUrl} from "@/lib/oxfordPronunciation";

// 1. CẤU HÌNH BẮT BUỘC: Ép Next.js không bao giờ được cache API này ở tầng Server
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const {searchParams} = new URL(request.url);

  // Xử lý chuỗi đầu vào sạch sẽ: Bỏ khoảng trắng thừa, chuyển về chữ thường chuẩn từ điển
  const word = (searchParams.get("word") ?? "").trim().toLowerCase();
  const lang = searchParams.get("lang") === "us" ? "us" : "uk";

  // Kiểm tra nếu tham số rỗng
  if (!word) {
    return new NextResponse(
      JSON.stringify({error: "Từ khóa không hợp lệ hoặc bị trống."}),
      {
        status: 400,
        headers: {"Content-Type": "application/json"},
      },
    );
  }

  try {
    // 2. Gọi hàm bóc tách / lấy URL từ file core thư viện
    const result = await getOxfordPronunciationUrl(word, lang);

    if (!result || !result.audioUrl) {
      return new NextResponse(
        JSON.stringify({
          error: `Không tìm thấy phát âm cho từ '${word}' trên Oxford.`,
        }),
        {
          status: 404,
          headers: {"Content-Type": "application/json"},
        },
      );
    }

    // 3. Trả về dữ liệu kèm tổ hợp Header chặn Cache tuyệt đối ở mọi tầng mạng
    return new NextResponse(
      JSON.stringify({
        audioUrl: result.audioUrl,
        phonetics: result.phonetics,
        source: "https://www.oxfordlearnersdictionaries.com/",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          // Chặn cache ở trình duyệt, proxy, CDN và mạng trung gian
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (error) {
    return new NextResponse(
      JSON.stringify({
        error: "Không thể kết nối hoặc lấy dữ liệu phát âm từ Oxford.",
      }),
      {
        status: 502,
        headers: {"Content-Type": "application/json"},
      },
    );
  }
}
