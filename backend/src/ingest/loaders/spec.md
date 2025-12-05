Đây là bản **Checklist Final** tổng hợp toàn diện cho dự án **Vietnam Land Law AI Agent** của bạn. Bản này đã được điều chỉnh kỹ lưỡng để phù hợp với Tech Stack **LangGraph.js (Node.js/TypeScript)** và các yêu cầu chức năng cao cấp (Highlight nguồn, Agentic Workflow).

---

### 🎯 PHẦN 1: TỔNG QUAN & MỤC TIÊU (Overview)

- **Mục tiêu học tập (Learning by Building):** Làm chủ quy trình AI Engineering từ A-Z (Data Engineering, RAG, Agentic Design, Full-stack integration).
- **Mục tiêu sản phẩm (Product Goal):** Xây dựng trợ lý pháp lý ảo giúp tra cứu Luật Đất đai 2024 chính xác, có dẫn chứng, giúp tiết kiệm thời gian cho người làm công tác pháp lý (như vợ bạn).
- **Yêu cầu nghiệp vụ cốt lõi:**
  - Tra cứu theo ngữ nghĩa (hỏi tự nhiên).
  - Câu trả lời bắt buộc có trích dẫn (Điều, Khoản).
  - Tính năng "Click-to-Source": Bấm vào dẫn chứng $\rightarrow$ Mở PDF $\rightarrow$ Highlight đoạn văn bản gốc.

---

### 🛠️ PHẦN 2: TECH STACK (Node.js/TypeScript Ecosystem)

- **Runtime:** Node.js (v20+) hoặc Bun.
- **Language:** TypeScript (Strict typing cho Graph State).
- **Orchestration:** `LangChain.js` & `LangGraph.js`.
- **LLM & Embedding:** Google Gemini 1.5 Pro (via `@langchain/google-genai`) & `text-embedding-004`.
- **Vector Database:** Weaviate (Self-hosted/Cloud) hoặc Qdrant (Hỗ trợ tốt JS Client & Metadata Filtering).
- **PDF Parsing:** `pdfjs-dist` (Để trích xuất text + tọa độ `transform matrix` cho highlight).
- **Backend API:** Hono hoặc Express.
- **Frontend:** Next.js + React PDF (`react-pdf`) + Shadcn/UI.

---

### 📋 PHẦN 3: CÁC BƯỚC THỰC HIỆN CHI TIẾT

#### 0. Thiết kế Metadata Schema (Bước nền tảng)

- [ ] **Định nghĩa trường dữ liệu:**
  - `law_id`: (VD: 133/VBHN-VPQH)
  - `chapter_id`: (Số nguyên, dùng để filter phạm vi)
  - `article_id`: (Quan trọng nhất để trích dẫn, VD: "79")
  - `article_title`: (Tiêu đề điều luật)
  - `page_number`: (Số trang trong PDF, VD: 59)
  - `coordinates`: (JSON lưu tọa độ bounding box của text để vẽ highlight)
- [ ] **Viết mô tả (Description):** Soạn văn bản mô tả ý nghĩa các trường để cung cấp cho LLM sau này (phục vụ Self-Querying).

#### 1. Xử lý Dữ liệu (Data Engineering)

- [ ] **Xây dựng Script Parsing (TS):**
  - Sử dụng `pdfjs-dist` để đọc file.
  - Loại bỏ Header/Footer/Số trang gây nhiễu.
  - Trích xuất tọa độ (`x`, `y`, `width`, `height`) của từng dòng text.
- [ ] **Structural Chunking (Chiến lược Cha-Con):**
  - **Logic:** Cắt theo đơn vị **"Điều"**. Nếu Điều quá dài $\rightarrow$ cắt xuống **"Khoản"** nhưng nối kèm Tiêu đề Điều vào đầu chunk.
  - **Mapping:** Đảm bảo mỗi chunk con (Child) đều link ngược lại được chunk cha (Parent - Toàn văn điều luật).
- [ ] **Gán Metadata:** Tự động điền giá trị vào schema đã định nghĩa ở Bước 0 cho từng chunk.

#### 2. Indexing & Vector Database

- [ ] **Cấu hình DB:** Tạo Schema/Collection trong Weaviate/Qdrant với chế độ Hybrid Search (Vector + BM25).
- [ ] **Embedding:** Chuyển đổi text chunk con thành vector (sử dụng model `text-embedding-004`).
- [ ] **Ingestion:** Insert vector + metadata + text gốc vào DB.

#### 3. Thiết kế Agentic Flow (LangGraph.js)

- [ ] **Định nghĩa State (GraphState):**
  - `messages`: Lịch sử chat.
  - `documents`: Các văn bản tìm được.
  - `query`: Câu hỏi hiện tại (có thể bị rewrite).
- [ ] **Xây dựng Nodes (Các hàm xử lý):**
  - `Retrieve`: Gọi Vector DB (Hybrid Search + Metadata Filter).
  - `Grade`: Dùng LLM chấm điểm xem document có liên quan câu hỏi không.
  - `Rewrite`: Nếu document không tốt, dùng LLM viết lại câu hỏi tối ưu hơn.
  - `Generate`: Dùng LLM tổng hợp câu trả lời từ document đã lọc.
- [ ] **Thiết kế Edges (Luồng đi):** Logic rẽ nhánh (Conditional Edges) giữa các node.
- [ ] **Memory (Checkpointer):** Cấu hình `MemorySaver` để lưu hội thoại ngắn hạn.

#### 4. Frontend & UX Tương tác

- [ ] **UI Chat:** Giao diện chat cơ bản.
- [ ] **Kết nối API:** Sử dụng `@langchain/langgraph-sdk` để stream phản hồi (token-by-token).
- [ ] **Xử lý Trích dẫn (Citation Rendering):**
  - Prompt LLM trả về format chuẩn: `...theo quy định `.
  - Frontend regex để biến `` thành link màu xanh.
- [ ] **PDF Viewer & Highlight:**
  - Tích hợp `react-pdf`.
  - Sự kiện `onClick` vào link dẫn chứng:
    1.  Gọi API lấy metadata của Điều đó (file path, page number, coordinates).
    2.  Mở Modal PDF.
    3.  Cuộn tới trang (`pageIndex`).
    4.  Vẽ một lớp `<div>` (absolute position) màu vàng đè lên tọa độ `coordinates` đã lấy được.

#### 5. Đánh giá & Tối ưu (Evaluation)

- [ ] **Golden Dataset:** Chuẩn bị 20 câu hỏi thực tế về đất đai (Tranh chấp, Sổ đỏ, Bồi thường).
- [ ] **Test độ chính xác:** Kiểm tra xem Agent có tìm đúng "Điều 79" khi hỏi về "Thu hồi đất dự án" không.
- [ ] **Test Hallucination:** Đảm bảo Agent không bịa ra các mức phạt hoặc thời hạn không có trong luật.

---

**Bước tiếp theo gợi ý:** Bạn nên bắt đầu ngay với **Bước 0 và Bước 1** (Parsing & Chunking) vì đây là khâu khó nhất đối với dữ liệu phi cấu trúc như file PDF luật Việt Nam. Dữ liệu đầu vào sạch thì Agent mới thông minh được.
