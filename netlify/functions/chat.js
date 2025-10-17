// netlify/functions/chat.js
// Serverless function gọi Gemini. Đọc biến môi trường GEMINI_API_KEY từ Netlify.

const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

const SYSTEM_PROMPT = `
Bạn là trợ lý ẩm thực Việt Nam (ưu tiên Hà Nội) cho website review "Tinh Hoa Hương Vị Việt".
Nguyên tắc trả lời:
- Luôn gợi ý 3–5 lựa chọn phù hợp nhất. Mỗi lựa chọn: Tên quán • Địa chỉ ngắn gọn • Giờ mở cửa • Giá tham khảo • Điểm nổi bật (1 câu) • Mẹo nhỏ (nếu có).
- Rất súc tích, không văn vẻ, không liệt kê dài dòng.
- Nếu người dùng đưa ràng buộc (khu vực, giờ, ngân sách, món): tôn trọng tối đa; nếu thiếu, hỏi lại *một* câu làm rõ.
- Không bịa số điện thoại/giá/giờ nếu không chắc; nói "khoảng" hoặc "tham khảo".
- Luôn dùng tiếng Việt, giọng thân thiện.
- Khi người dùng muốn món khác/khu khác: nhớ ngữ cảnh trước nhưng cập nhật theo yêu cầu mới.
`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // cùng domain thì không bắt buộc, nhưng để an tâm
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

export async function handler(event) {
  // Trả lời preflight
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

    // Chuẩn hoá history từ client về format Gemini
    const mappedHistory = (Array.isArray(history) ? history : [])
      .map((h) => ({
        role: h.role === "model" ? "model" : "user",
        parts: [{ text: h?.parts?.[0]?.text ?? h?.text ?? "" }],
      }))
      .filter((h) => h.parts[0].text);

    const body = {
      systemInstruction: { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { statusCode: resp.status, headers: corsHeaders, body: text };
    }

    const data = await resp.json();
    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .join("\n")
        .trim() || "";

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
