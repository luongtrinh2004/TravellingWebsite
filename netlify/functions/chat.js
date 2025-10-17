// netlify/functions/chat.js
// Serverless function gọi Gemini v1, có CORS + OPTIONS.

const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash-latest"; // alias ổn định
const API_VERSION = "v1";

const SYSTEM_PROMPT = `
Bạn là trợ lý ẩm thực Việt Nam (ưu tiên Hà Nội) cho website review "Tinh Hoa Hương Vị Việt".
- Gợi ý 3–5 quán phù hợp. Mỗi quán: Tên • Địa chỉ ngắn • Giờ mở cửa • Giá tham khảo • Điểm nổi bật (1 câu) • Mẹo nhỏ.
- Ngắn gọn, không văn vẻ. Tôn trọng ràng buộc (khu vực/giờ/ngân sách/món).
- Không bịa số liệu; dùng "khoảng/tham khảo" khi cần. Trả lời tiếng Việt, thân thiện.
`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "ok" };
  }
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: "Method Not Allowed",
    };
  }

  try {
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: "Missing GEMINI_API_KEY",
      };
    }

    const {
      message,
      history = [],
      temperature = 0.7,
    } = JSON.parse(event.body || "{}");
    if (!message || typeof message !== "string") {
      return { statusCode: 400, headers: corsHeaders, body: "Missing message" };
    }

    // Chuẩn hoá history cho Gemini v1
    const mappedHistory = (Array.isArray(history) ? history : [])
      .map((h) => ({
        role: h.role === "model" ? "model" : "user",
        parts: [{ text: h?.parts?.[0]?.text ?? h?.text ?? "" }],
      }))
      .filter((h) => h.parts[0].text);

    const payload = {
      // ✅ v1 dùng snake_case: system_instruction
      system_instruction: { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        ...mappedHistory,
        { role: "user", parts: [{ text: message }] },
      ],
      generationConfig: {
        temperature,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 1024,
      },
    };

    const url = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${MODEL}:generateContent?key=${API_KEY}`;
    let resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Fallback nhẹ nếu alias không khả dụng với key cũ
    if (!resp.ok && resp.status === 404) {
      const legacy = "gemini-1.5-flash";
      const legacyUrl = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${legacy}:generateContent?key=${API_KEY}`;
      resp = await fetch(legacyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    const textBody = await resp.text();
    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: textBody, // trả nguyên lỗi từ Google để dễ debug
      };
    }

    // resp ok → parse JSON
    const data = JSON.parse(textBody);
    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .join("\n")
        .trim() || "Mình chưa có dữ liệu phù hợp.";

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ reply }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: String(err?.message || err),
    };
  }
}
