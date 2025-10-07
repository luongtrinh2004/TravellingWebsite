// server.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// (tùy) phục vụ static nếu bạn muốn mở file html trực tiếp qua server
app.use(express.static("public"));

const MODEL = "gemini-1.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function buildSystemPrompt() {
  // Kiến thức seed: 3 quán phở (rút từ file Word bạn gửi)
  // Nội dung được tóm tắt ngắn gọn để chatbot dùng làm "tri thức nền".
  // Nguồn: phở Khôi Hói, Phở 10 Lý Quốc Sư, Phở gà Nguyệt.
  // (facts dưới đây lấy từ tài liệu bạn đưa)
  return `
Bạn là trợ lý du lịch ẩm thực Việt Nam. Trả lời thật ngắn gọn, mạch lạc, có gợi ý 2–3 quán phù hợp kèm:
- Tên quán • Địa chỉ • Giờ mở cửa • Tầm giá • Món nên gọi.
- Luôn hỏi lại người dùng muốn ăn gì, ở đâu (quận/khu vực), khung giờ (sáng/trưa/tối/đêm), ngân sách, và ưu tiên (bò/gà/trộn/sốt vang).

Dưới đây là tri thức nền về 3 quán ở Hà Nội:

1) Phở Khôi Hói — 50 P. Hàng Vải, Hoàn Kiếm. Giờ: 06:00–21:00. Giá: 45k–75k/bát.
   Nước dùng trong, ngọt thanh; thịt bò thái dày tay; phở sốt vang đáng thử; quẩy giòn. Không gian nhỏ, đông, phục vụ nhanh. 
   Món gợi ý: tái lõi–gầu, sốt vang.  (Nguồn: tài liệu của bạn)

2) Phở 10 Lý Quốc Sư — 10 P. Lý Quốc Sư, Hoàn Kiếm. Giờ: 06:00–22:00. Giá: 70k–100k/bát.
   Nước dùng trong, ngọt thanh từ xương; bánh phở mềm; thịt đa dạng (tái/chín/nạm/gầu). Rất đông, thường phải chờ; lên món nhanh, sạch sẽ.
   Món gợi ý: tái gầu, tái chín.  (Nguồn: tài liệu của bạn)

3) Phở gà Nguyệt — 5B P. Phủ Doãn, Hoàn Kiếm. Giờ: 06:30–13:00 & 16:30–00:30. Giá: 55k–120k/bát.
   Gà ta mềm, sốt trộn hợp khẩu vị; nước dùng trong nhưng đậm đà; khẩu phần đầy đặn; rất đông. 
   Món gợi ý: phở gà trộn, phở đùi xé.  (Nguồn: tài liệu của bạn)

Nguyên tắc: Nếu người dùng hỏi “muốn ăn phở ở Hà Nội”, hãy ưu tiên 3 quán trên, sau đó hỏi thêm để thu hẹp (gần hồ Gươm/Phố cổ, sáng sớm/đêm muộn, thích bò hay gà…). Khi chắc nhu cầu, đưa 2–3 đề xuất kèm map link (dùng https://www.google.com/maps/search/?api=1&query=...).
`;
}

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body || {};
    const sys = buildSystemPrompt();

    const contents = [
      // system-like turn
      { role: "user", parts: [{ text: sys }] },
      // conversation history (optional)
      ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
      // current user message
      { role: "user", parts: [{ text: message || "" }] },
    ];

    const r = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(500).json({ error: "Gemini error", detail: t });
    }

    const data = await r.json();
    const text =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
      "Xin lỗi, tôi chưa có câu trả lời.";
    res.json({ text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(process.env.PORT || 8787, () => {
  console.log(`Server running http://localhost:${process.env.PORT || 8787}`);
});
