# 📘 Land Law Parser Documentation

## 1\. Tổng quan

Script `land_law_parser.py` là một công cụ được thiết kế chuyên biệt để xử lý văn bản quy phạm pháp luật Việt Nam (cụ thể là Luật Đất đai) từ định dạng PDF sang cấu trúc JSON.

**Mục tiêu:** Tạo ra bộ dữ liệu sạch, có cấu trúc phân cấp (Law \> Chapter \> Article \> Clause \> Point) kèm theo metadata phong phú (tọa độ, số trang, chú thích) để phục vụ cho các hệ thống RAG (Retrieval-Augmented Generation) và LLM.

[cite_start]**Đầu vào:** File PDF văn bản luật (Ví dụ: `133-vbhn-vpqh.pdf` [cite: 1]).
[cite_start]**Đầu ra:** File JSON chứa danh sách các "chunk" văn bản[cite: 2].

---

## 2\. Kiến trúc & Luồng xử lý (Workflow)

Quy trình xử lý được thực hiện tuần tự qua các bước sau trong hàm `process()`:

### Bước 1: Khởi tạo & Xây dựng bản đồ vị trí (Indexing Phase)

Trước khi xử lý nội dung, script quét qua toàn bộ file PDF một lần để xây dựng các chỉ mục quan trọng.

- **Tách nội dung & Footnote:** Sử dụng `fitz` (PyMuPDF) để đọc từng trang.
  - **Logic:** Dựa vào kích thước phông chữ (`FONT_SIZE_THRESHOLD = 12`). Text nhỏ hơn ngưỡng này được coi là footnote/metadata và được tách riêng ra khỏi nội dung chính.
- **Page Offset Map:** Xây dựng bản đồ ánh xạ vị trí ký tự (`start_index`, `end_index`) với số trang thực tế.
  - _Mục đích:_ Để sau này khi có một đoạn text bất kỳ, ta có thể tính toán chính xác nó nằm ở trang nào mà không cần search lại toàn bộ file (Khắc phục lỗi nhận diện sai trang ở các phiên bản trước).
- **Footnote Map:** Lưu trữ nội dung footnote theo từng trang để tra cứu sau này.

### Bước 2: Nhận diện Cấu trúc (Structure Identification)

Sử dụng Regular Expression (Regex) để quét toàn bộ văn bản (`full_text`) và xác định khung sườn của luật.

- **Pattern:** `(?m)^(Chương\s+[IVXLCDM]+|Mục\s+\d+|Điều\s+(\d+)\.)\s+(.*)`
- Hệ thống nhận diện được 3 cấp độ: **Chương**, **Mục**, và **Điều**.

### Bước 3: Xử lý chi tiết từng Điều (Article Processing)

Script duyệt qua từng kết quả regex tìm được:

1.  **Cập nhật Context:** Nếu gặp "Chương" hoặc "Mục", cập nhật biến trạng thái (`current_chapter`, `current_section`) để các Điều luật bên trong kế thừa metadata này.
2.  **Trích xuất Điều:** Nếu gặp "Điều":
    - Xác định phạm vi text của Điều (từ `start` của Điều này đến `start` của Điều tiếp theo).
    - Dùng hàm `_extract_article_info` để tách riêng: **Số hiệu**, **Tiêu đề**, và **Nội dung**.

### Bước 4: Chia nhỏ văn bản (Recursive Chunking)

Đây là trái tim của thuật toán, nằm trong hàm `recursive_split`.

- **Chiến lược:** Chia nhỏ dựa trên cấu trúc (Structure-based) thay vì chia theo số lượng ký tự cố định.
- **Logic Đệ quy:**
  - **Cấp 1 (Điều):** Nếu Điều luật ngắn hoặc ít khoản (\<= 5 khoản), giữ nguyên cả Điều thành 1 chunk. Nếu dài, tách xuống cấp Khoản.
  - **Cấp 2 (Khoản):** Nếu Khoản có nhiều điểm (a, b, c...) và quá dài, tiếp tục tách xuống cấp Điểm.
- **Kết quả:** Đảm bảo mỗi chunk đều mang ý nghĩa trọn vẹn và có context đầy đủ (Ví dụ: Một chunk cấp Điểm sẽ có nội dung: _"Điều 3 | Khoản 1 | Điểm a: ..."_).

### Bước 5: Định vị & Gắn Metadata (Enrichment)

Với mỗi chunk được tạo ra, script thực hiện:

1.  **Tính toán Offset:** Xác định vị trí ký tự tuyệt đối của chunk trong file gốc.
2.  **Tìm trang & Tọa độ (`get_coordinates_by_offset`):**
    - Dùng `page_offset_map` (từ Bước 1) để biết chunk nằm trên những trang nào.
    - Chỉ thực hiện `search_for` (tìm kiếm tọa độ hình chữ nhật - bbox) trên đúng những trang đó.
3.  **Gắn Footnote:** Tra cứu `page_footnotes_map` để đính kèm footnote tương ứng của trang vào chunk.

---

## 3\. Các hàm quan trọng (Key Functions)

### `LandLawChunkerFinal` Class

- `get_page_content_and_footnotes(page)`:

  - Đọc blocks text từ trang PDF.
  - Phân loại text thành `clean_text` (nội dung luật) và `footnote_text` (ghi chú) dựa trên cỡ chữ.
  - _Lưu ý:_ Có logic loại bỏ số trang đơn lẻ để tránh nhiễu.

- `_extract_article_info(raw_text)`:

  - Nhiệm vụ: Tách một chuỗi thô _"Điều 1. Phạm vi điều chỉnh\\nLuật này quy định..."_ thành 3 phần riêng biệt.
  - **Logic thông minh:** Xử lý được trường hợp Tiêu đề điều bị ngắt xuống nhiều dòng (Word wrap) bằng cách kiểm tra ký tự viết hoa/thường ở đầu dòng tiếp theo.

- `recursive_split(article_dict, base_offset)`:

  - Thực hiện logic chia nhỏ (Chunking).
  - **Quan trọng:** Truyền tham số `base_offset` xuyên suốt quá trình đệ quy để luôn giữ được vị trí chính xác của đoạn text so với file gốc.

- `get_coordinates_by_offset(search_text, start_idx, end_idx)`:

  - Thay thế cho phương pháp Fuzzy Search toàn cục cũ.
  - Sử dụng `start_idx` và `end_index` để khoanh vùng chính xác số trang.
  - Giúp loại bỏ hoàn toàn lỗi "nhận diện sai trang" đối với các cụm từ ngắn lặp lại nhiều lần.

---

## 4\. Cấu trúc dữ liệu đầu ra (JSON Schema)

[cite_start]Mỗi phần tử trong file `land_law_chunks_final.json` đại diện cho một chunk và có cấu trúc như sau[cite: 2]:

```json
{
  "page_content": "Chuỗi văn bản nội dung đã được làm sạch và format lại",
  "metadata": {
    "law_id": "133/VBHN-VPQH",
    "chapter_id": "I",              // Số chương (La Mã)
    "chapter_title": "...",         // Tên chương
    "section_id": "1",              // Số mục (nếu có)
    "section_title": "...",
    "article_id": "3",              // Số hiệu điều
    "article_title": "...",
    "chunk_id": "law_133/VBHN-VPQH_art_3_clause_2", // ID định danh duy nhất
    "chunk_type": "clause",         // Loại chunk: full_article, clause, hay point
    "clause_id": "2",
    "point_id": null,
    "page_number": [2, 3],          // Danh sách các trang chứa chunk này
    "coordinates": [                // Tọa độ chính xác trên PDF (để highlight)
      { "page": 2, "rect": [x0, y0, x1, y1] }
    ],
    "chunk_footnotes": "..."        // Nội dung footnote tương ứng của trang
  }
}
```

## 5\. Điểm nổi bật & Cải tiến

1.  **Chính xác tuyệt đối về vị trí:** Sử dụng kỹ thuật **Offset Mapping** giúp định vị chính xác trang chứa nội dung, ngay cả khi nội dung đó bị tràn qua 2 trang (như Điều 3 Khoản 2).
2.  **Xử lý nhiễu (Noise Reduction):** Loại bỏ header, footer, số trang và tách riêng phần "Lời nói đầu/Căn cứ pháp lý" để không làm nhiễu nội dung điều luật.
3.  **Context-Aware Chunking:** Giữ nguyên các điều luật ngắn để AI có cái nhìn tổng quan, chỉ chia nhỏ khi nội dung quá dài hoặc phức tạp.
