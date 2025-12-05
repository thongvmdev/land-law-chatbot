# Tài liệu Dự án: Vietnam Land Law AI Agent 🇻🇳 ⚖️

## 1. Tổng quan & Yêu cầu Nghiệp vụ (Business Requirements)

### 🎯 Mục tiêu cốt lõi (Core Objective)

> **Mục đích:** Học qua thực hành (Learning by Building) để làm chủ quy trình Full-stack AI Engineering, hiểu sâu về AI Agent và tạo ra sản phẩm thực tế hỗ trợ công việc pháp lý.

Xây dựng một **Trợ lý AI Pháp lý chuyên sâu** (AI Legal Assistant) có khả năng giải đáp thắc mắc về **Luật Đất đai 2024** một cách chính xác, giúp người dùng (chuyên viên pháp lý, môi giới, người dân) tiết kiệm **90%** thời gian tra cứu và đối chiếu văn bản.

### 🔑 Yêu cầu chức năng chính (Key Functional Requirements)

- **Tra cứu lai (Hybrid Search - Semantic & Keyword):**

  - **Semantic Search (Vector):** Hiểu ý định câu hỏi tự nhiên (VD: _"Nhà nước lấy đất thì đền bù thế nào?"_ $\rightarrow$ tìm về "Bồi thường").
  - **Keyword Search (BM25):** Bắt chính xác các thuật ngữ pháp lý chuyên ngành hoặc từ lóng không thể thay thế (VD: _"Sổ đỏ"_, _"Đất 50 năm"_, _"Lấn chiếm"_).
  - **Cơ chế:** Hệ thống phải kết hợp kết quả từ cả hai phương pháp để đảm bảo độ bao phủ và chính xác cao nhất.

- **Tư vấn có căn cứ (Evidence-based Q&A):**

  - Câu trả lời **bắt buộc** phải trích dẫn nguồn cụ thể (Điều, Khoản, Chương).
  - **Chống ảo giác (Anti-Hallucination):** Tuyệt đối không bịa luật. Nếu không có thông tin trong tài liệu, trả lời là không tìm thấy.

- **Kiểm chứng minh bạch (Click-to-Source):**

  - Trích dẫn trong câu trả lời là **liên kết (clickable link)**.
  - Khi click vào: Mở PDF gốc dạng Pop-up $\rightarrow$ Cuộn đến đúng trang $\rightarrow$ **Highlight** đoạn văn bản tham chiếu.

- **Xử lý tình huống phức tạp (Complex Reasoning):**
  - Tổng hợp thông tin từ nhiều điều luật khác nhau để giải quyết các câu hỏi khó (VD: Kết hợp điều kiện cấp sổ đỏ và quy hoạch).

### ⚙️ Yêu cầu phi chức năng

- **Độ chính xác:** Dữ liệu cập nhật theo Văn bản hợp nhất số 133/VBHN-VPQH.
- **Trải nghiệm người dùng:** Phản hồi nhanh (Streaming), giao diện PDF mượt mà.
- **Khả năng mở rộng:** Sẵn sàng tích hợp thêm Luật Nhà ở, Luật Kinh doanh BĐS.

---

## 2. Tech Stack (Hệ sinh thái Node.js/TypeScript)

Lựa chọn công nghệ tối ưu cho xử lý văn bản tiếng Việt và Agentic Workflow.

| Hạng mục              | Công nghệ / Thư viện                 | Ghi chú                                                |
| :-------------------- | :----------------------------------- | :----------------------------------------------------- |
| **Core AI Framework** | **LangChain.js** & **LangGraph.js**  | Orchestration & Agent State Management.                |
| **LLM Provider**      | **Google Gemini 1.5 Pro**            | Context window lớn (1M tokens), chi phí hợp lý.        |
| **Embedding**         | **Google text-embedding-004**        | Hiệu năng tốt cho tiếng Việt đa ngôn ngữ.              |
| **Backend Runtime**   | **Node.js** (v20+) hoặc **Bun**      | Tốc độ cao, đồng bộ ngôn ngữ JS/TS.                    |
| **PDF Parsing**       | **pdfjs-dist**                       | Trích xuất text kèm tọa độ (matrix) phục vụ highlight. |
| **Vector Database**   | **Weaviate** hoặc **Qdrant**         | **Bắt buộc hỗ trợ Hybrid Search (Vector + BM25)**.     |
| **API Framework**     | **Hono** hoặc **Express**            | Nhẹ, nhanh để expose API.                              |
| **Frontend**          | **Next.js**, **React**, **Tailwind** | Framework hiện đại, tối ưu SEO và UX.                  |
| **PDF Viewer**        | **react-pdf**                        | Render PDF trực tiếp trên trình duyệt.                 |

---

## 3. Checklist Triển khai Chi tiết (Implementation Checklist)

### Giai đoạn 0: Khởi tạo & Thiết kế

- [ ] **0.1. Thiết kế Metadata Schema:**
  - Định nghĩa trường: `chapter_id`, `article_id`, `topic`, `law_name`.
  - Định nghĩa trường nguồn: `page_number`, `source_file_path`, `coordinates` (bounding box cho highlight).
  - Viết mô tả (Description) kỹ lưỡng để LLM hiểu ý nghĩa từng trường (phục vụ Self-Querying).
  - Xác định các giá trị `Enum` hợp lệ.

### Giai đoạn 1: Xử lý Dữ liệu (Data Engineering)

- [ ] **1.1. Script Parsing PDF (TS):**
  - Dùng `pdfjs-dist` đọc file.
  - Loại bỏ nhiễu (Header, Footer, số trang).
  - Trích xuất và lưu tọa độ văn bản.
- [ ] **1.2. Structural Chunking (Cha-Con):**
  - Cắt theo đơn vị **"Điều"** (Article).
  - Điều quá dài $\rightarrow$ cắt xuống **"Khoản"** (kèm Tiêu đề Điều).
- [ ] **1.3. Gán Metadata:** Tự động điền giá trị vào schema cho từng chunk.

### Giai đoạn 2: Indexing & Vector Database

- [ ] **2.1. Cấu hình DB:** Tạo Schema trong Weaviate/Qdrant.
  - **Quan trọng:** Kích hoạt tính năng **Hybrid Search** (Cấu hình trọng số Alpha cho Vector và Keyword, ví dụ `alpha=0.7` ưu tiên vector nhưng vẫn giữ 0.3 cho keyword).
- [ ] **2.2. Embedding:** Vector hóa các chunk con.
- [ ] **2.3. Ingestion:** Insert Vector + Metadata + Text gốc (Parent chunk) vào DB.

### Giai đoạn 3: Thiết kế Agentic Flow (LangGraph.js)

- [ ] **3.1. Định nghĩa State (GraphState):** `messages`, `documents`, `query` (rewrite), `retry_count`.
- [ ] **3.2. Xây dựng Nodes (Chuyên gia):**
  - `Retrieve`: Gọi Vector DB (Hybrid Search + Metadata Filter).
  - `Grade`: Đánh giá độ liên quan (Relevant check).
  - `Rewrite`: Viết lại câu hỏi nếu không tìm thấy dữ liệu.
  - `Generate`: Tổng hợp câu trả lời.
- [ ] **3.3. Thiết kế Edges:** Logic rẽ nhánh (Nếu Grade = Fail $\rightarrow$ Rewrite).
- [ ] **3.4. Memory:** Tích hợp `checkpointer` để nhớ ngữ cảnh hội thoại ngắn hạn.

### Giai đoạn 4: Cơ chế Tìm kiếm (Retrieval Strategy)

- [ ] **4.1. Self-Querying:** Cấu hình để LLM tự tạo bộ lọc metadata từ câu hỏi (VD: hỏi về "Thu hồi đất" tự lọc `chapter_id=6`).
- [ ] **4.2. Triển khai Hybrid Search:**
  - Cấu hình truy vấn song song: `Semantic Search` (Vector) + `Keyword Search` (BM25).
  - Hợp nhất kết quả (Fusion) để lấy ra danh sách tài liệu tốt nhất.
- [ ] **4.3. Re-ranking:** (Tùy chọn) Sắp xếp lại kết quả để tăng độ chính xác.

### Giai đoạn 5: Sinh câu trả lời (Generation)

- [ ] **5.1. System Prompt:** Định danh vai trò chuyên gia, ràng buộc chỉ trả lời từ context.
- [ ] **5.2. Cấu trúc dẫn nguồn:** Yêu cầu LLM trả về thẻ tag chuẩn (VD: `[[source_id: page_num]]`) để Frontend xử lý.
- [ ] **5.3. Context Injection:** Nạp toàn văn điều luật vào prompt.

### Giai đoạn 6: Frontend & UX Nâng cao

- [ ] **6.1. Tích hợp LangGraph SDK:** Kết nối API, xử lý Streaming tokens.
- [ ] **6.2. Xử lý Link dẫn chứng:** Parse output của LLM thành clickable link màu xanh.
- [ ] **6.3. PDF Viewer Pop-up:**
  - Tích hợp `react-pdf`.
  - Xử lý sự kiện Click $\rightarrow$ Mở Modal $\rightarrow$ Jump to Page.
  - Vẽ lớp phủ (Overlay) màu vàng đè lên tọa độ `coordinates` để highlight.

### Giai đoạn 7: Đánh giá & Tinh chỉnh

- [ ] **7.1. Golden Dataset:** Tạo 20 câu hỏi mẫu thực tế.
- [ ] **7.2. Kiểm thử:** Đánh giá độ chính xác của tìm kiếm (cả vector và keyword) và độ trung thực của câu trả lời.
