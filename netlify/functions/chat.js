// netlify/functions/chat.js
// Chat function dùng Gemini API v1. Tự động dò model hợp lệ qua ListModels.
// Có CORS + OPTIONS, và trả lỗi gốc từ Google để dễ debug.

const API_VERSION = "v1";

/** Prompt hệ thống (nhét vào "turn" đầu tiên) */
const SYSTEM_PROMPT = `
Bạn là trợ lý ẩm thực Việt Nam (ưu tiên Hà Nội) cho website review "Tinh Hoa Hương Vị Việt".
- Gợi ý 3–5 quán phù hợp. Mỗi quán: Tên • Địa chỉ ngắn • Giờ mở cửa • Giá tham khảo • Điểm nổi bật (1 câu) • Mẹo nhỏ.
- Ngắn gọn, không văn vẻ. Tôn trọng ràng buộc (khu vực/giờ/ngân sách/món).
- Không bịa số liệu; dùng "khoảng/tham khảo" khi cần. Trả lời tiếng Việt, thân thiện.
`.trim();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

// Cache model đã chọn giữa các invocations (ấm máy/lambda warm)
let SELECTED_MODEL = null;

/** Dò danh sách model hợp lệ cho key hiện tại rồi chọn model tốt nhất */
async function pickModel(API_KEY) {
  // Nếu env có GEMINI_MODEL thì ưu tiên, nhưng vẫn verify qua ListModels.
  const preferred = (process.env.GEMINI_MODEL || "").trim();

  const listUrl = `https://generativelanguage.googleapis.com/${API_VERSION}/models?key=${API_KEY}`;
  const r = await fetch(listUrl);
  if (!r.ok)
    throw new Error(`ListModels failed: ${r.status} ${await r.text()}`);
  const data = await r.json();

  const models = Array.isArray(data.models) ? data.models : [];
  const canGen = (m) =>
    Array.isArray(m.supportedGenerationMethods) &&
    m.supportedGenerationMethods.includes("generateContent");

  // 1) Nếu preferred có trong danh sách và support generateContent -> dùng ngay
  if (preferred) {
    const exact = models.find(
      (m) => m.name === `models/${preferred}` && canGen(m)
    );
    if (exact) return preferred;
  }

  // 2) Ưu tiên các model có chữ "flash" hợp lệ
  const flash = models
    .filter((m) => /flash/i.test(m.name) && canGen(m))
    .map((m) => m.name.replace(/^models\//, ""));
  if (flash.length) return flash[0];

  // 3) Sau đó tới "pro"
  const pro = models
    .filter((m) => /pro/i.test(m.name) && canGen(m))
    .map((m) => m.name.replace(/^models\//, ""));
  if (pro.length) return pro[0];

  // 4) Cuối cùng: bất kỳ model nào hỗ trợ generateContent
  const any = models.filter(canGen).map((m) => m.name.replace(/^models\//, ""));

  if (any.length) return any[0];

  throw new Error(
    "No available Gemini model supports generateContent for this API key."
  );
}

/** Chuẩn hoá history client -> format v1 */
function normalizeHistory(history) {
  const arr = Array.isArray(history) ? history : [];
  return arr
    .map((h) => ({
      role: h.role === "model" ? "model" : "user",
      parts: [{ text: h?.parts?.[0]?.text ?? h?.text ?? "" }],
    }))
    .filter((h) => h.parts[0].text);
}

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

    // Chọn model (có cache)
    if (!SELECTED_MODEL) {
      SELECTED_MODEL = await pickModel(API_KEY);
    }

    const contents = [
      { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
      { role: "model", parts: [{ text: "Đã nhận hướng dẫn." }] },
      ...normalizeHistory(history),
      { role: "user", parts: [{ text: message }] },
    ];

    const payload = {
      contents,
      generationConfig: {
        temperature,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 1024,
      },
    };

    const url = `https://generativelanguage.googleapis.com/${API_VERSION}/models/${SELECTED_MODEL}:generateContent?key=${API_KEY}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const raw = await resp.text();
    if (!resp.ok) {
      // Nếu model vừa chọn đột nhiên 404 (ít khi), flush cache & báo lỗi gốc
      if (resp.status === 404) SELECTED_MODEL = null;
      return {
        statusCode: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: raw,
      };
    }

    const data = JSON.parse(raw);
    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .join("\n")
        .trim() || "Mình chưa có dữ liệu phù hợp.";
    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ reply, model: SELECTED_MODEL }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: String(err?.message || err),
    };
  }
}
