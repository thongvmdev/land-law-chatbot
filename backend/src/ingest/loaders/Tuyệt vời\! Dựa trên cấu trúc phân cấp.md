### 🛑 PHẦN 1: CHIẾN LƯỢC CHUNKING (LOGIC XỬ LÝ NÂNG CAO)

## Cấu trúc tổng thể

1.  **Chương (Chapter):** Là cấp lớn nhất.

    - [cite_start]Tài liệu có **16 Chương**[cite: 3326].
    - [cite_start]Ví dụ: _Chương I: Quy định chung_ [cite: 17-18][cite_start], _Chương XVI: Điều khoản thi hành_[cite: 3326].

2.  **Mục (Section):** Là cấp con của Chương (nhưng không bắt buộc).

    - [cite_start]**Có Mục:** _Chương II_ được chia thành _Mục 1_ [cite: 212][cite_start], _Mục 2_ [cite: 296][cite_start], _Mục 3_[cite: 337].
    - [cite_start]**Không có Mục:** _Chương I_ đi thẳng vào các Điều (Điều 1 đến Điều 11) mà không chia Mục [cite: 19-20].

3.  **Điều (Article):** Là đơn vị pháp lý cơ bản nhất, được đánh số liên tục toàn văn bản.

    - Tổng cộng có **260 Điều**.
    - Điều nằm trực tiếp trong Chương (nếu Chương không có Mục) hoặc nằm trong Mục.
    - [cite_start]Ví dụ: _Điều 79_ [cite: 1182] nằm trong Chương VI.

4.  **Khoản (Clause):** Các đoạn văn được đánh số (1, 2, 3...) trong một Điều.

    - [cite_start]Ví dụ: _Điều 176_ có 7 Khoản [cite: 2666-2678].

5.  **Điểm (Point):** Các ý nhỏ được đánh ký tự (a, b, c...) trong một Khoản.

    - [cite_start]Ví dụ: Tại _Khoản 3 Điều 176_ có 2 điểm là _a) Đất rừng phòng hộ_ và _b) Đất rừng sản xuất là rừng trồng_ [cite: 2670-2671].
    - [cite_start]Lưu ý: Không phải Khoản nào cũng có Điểm (ví dụ _Khoản 2 Điều 176_ chỉ là văn bản liền mạch [cite: 2668]).

## Các phần cần lưu ý

_Đây là các ứng viên sáng giá để kiểm tra logic cắt "Điều $\rightarrow$ Khoản" và kỹ thuật nối tiêu đề (Prepend)._

---

### 1. Tại sao cần GỘP? (Trường hợp Khoản ngắn)

[cite_start]**Ví dụ thực tế:** **Khoản 3 Điều 176** về hạn mức giao đất [cite: 2670-2671].

- **Nội dung gốc:**
  > 3. Hạn mức giao đất cho cá nhân không quá 30 ha đối với mỗi loại đất:
  >    a) Đất rừng phòng hộ;
  >    b) Đất rừng sản xuất là rừng trồng.

#### ❌ Nếu bạn Tách (Split) máy móc:

Bạn sẽ có 2 chunk con:

1.  _"Điểm a) Đất rừng phòng hộ"_
2.  _"Điểm b) Đất rừng sản xuất là rừng trồng"_

> **Hậu quả:** Chunk quá ngắn và **mất ngữ nghĩa**. Nếu người dùng hỏi _"Hạn mức giao đất rừng phòng hộ là bao nhiêu?"_, chunk 1 không hề chứa từ khóa "hạn mức" hay con số "30 ha". Vector Search sẽ bỏ qua nó vì không thấy liên quan.

#### ✅ Nếu bạn Gộp (Merge):

Bạn có 1 chunk duy nhất:

> _"Điều 176... Khoản 3. Hạn mức giao đất cho cá nhân không quá 30 ha đối với mỗi loại đất: a) Đất rừng phòng hộ; b) Đất rừng sản xuất là rừng trồng."_

> **Lợi ích:** Chunk chứa trọn vẹn thông tin: **Đối tượng** (Đất rừng phòng hộ) + **Quy định** (30 ha). AI tìm thấy ngay lập tức.

---

### 2. Tại sao cần TÁCH? (Trường hợp Khoản dài/Liệt kê)

[cite_start]**Ví dụ thực tế:** **Khoản 1 Điều 137** về Giấy tờ cấp Sổ đỏ [cite: 2119-2141].
Khoản này liệt kê tới **14 điểm** (từ a đến n), chứa rất nhiều loại giấy tờ khác nhau (Giấy tờ chế độ cũ, Sổ mục kê, Giấy tờ quân đội...).

#### ❌ Nếu bạn Gộp (Merge):

Bạn nhồi nhét cả 14 loại giấy tờ vào 1 chunk khổng lồ (~1000 tokens).

> **Hậu quả - "Pha loãng Vector" (Vector Dilution):**
> Người dùng hỏi: _"Bằng khoán điền thổ có được cấp sổ không?"_
> Vector của câu hỏi tập trung vào **"Bằng khoán điền thổ"**. Nhưng vector của chunk gộp lại là trung bình cộng của cả "Giấy tờ quân đội", "Sổ mục kê", "Di dân kinh tế mới"...
> $\rightarrow$ Độ tương đồng (Similarity Score) bị kéo thấp xuống, dẫn đến việc tìm kiếm kém chính xác.

#### ✅ Nếu bạn Tách (Split) và Nối gốc:

Bạn tạo ra chunk riêng cho **Điểm b**:

> [cite_start]_"Điều 137... Khoản 1... được cấp Giấy chứng nhận...: Điểm b) Một trong các giấy tờ... gồm: Bằng khoán điền thổ; Văn tự đoạn mãi..."_ [cite: 2121-2122].

> **Lợi ích:** Chunk này **đặc thù hóa** cho từ khóa "Bằng khoán điền thổ". Vector của nó sẽ khớp cực mạnh với câu hỏi của người dùng.

---

### 3. Tại sao BẮT BUỘC phải "Nối gốc" (Prepend Context)?

[cite_start]**Ví dụ thực tế:** **Khoản 27 Điều 79** [cite: 1260-1261].

#### ❌ Nếu bạn Tách nhưng QUÊN nối gốc:

Nội dung chunk chỉ là:

> _"27. Thực hiện dự án đầu tư xây dựng khu đô thị có công năng phục vụ hỗn hợp..."_

> **Hậu quả - "Mất đầu mất đuôi":**
> AI đọc vào sẽ hiểu đây là một hành động: "Đi xây khu đô thị".
> Nhưng thực tế luật quy định đây là trường hợp **Nhà nước THU HỒI ĐẤT**. Nếu thiếu cụm từ "Thu hồi đất", AI sẽ tư vấn sai nghiêm trọng (ví dụ: tưởng đây là quy định về quy hoạch hoặc cấp phép đầu tư).

#### ✅ Khi áp dụng Nối gốc (Prepend):

Nội dung chunk trở thành:

> _"Điều 79. Thu hồi đất để phát triển kinh tế - xã hội... Nhà nước thu hồi đất trong trường hợp...: Khoản 27. Thực hiện dự án đầu tư xây dựng khu đô thị..."_

> **Lợi ích:** Chunk này khẳng định rõ ràng: Xây khu đô thị là một lý do để **Thu hồi đất**. AI sẽ trả lời chính xác về tính pháp lý.

---

### Tóm tắt chiến lược Adaptive

| Trường hợp           | Đặc điểm trong File PDF     | Hành động   | Tại sao?                                                             |
| :------------------- | :-------------------------- | :---------- | :------------------------------------------------------------------- |
| **Khoản 3 Điều 176** | Ngắn, ít điểm (a, b)        | **GỘP**     | Giữ liên kết giữa "Hạn mức 30ha" và "Rừng phòng hộ".                 |
| **Khoản 1 Điều 137** | Dài, nhiều điểm (a...n)     | **TÁCH**    | Giúp tìm kiếm chính xác từng loại giấy tờ cụ thể (tránh nhiễu).      |
| **Khoản 27 Điều 79** | Một mục trong danh sách dài | **NỐI GỐC** | Gắn "Thu hồi đất" vào "Khu đô thị" để đảm bảo đúng bản chất pháp lý. |

| Điều luật   | Chủ đề                       | Độ dài / Cấu trúc                                              | Ghi chú Test                                                   |
| :---------- | :--------------------------- | :------------------------------------------------------------- | :------------------------------------------------------------- |
| **Điều 3**  | Giải thích từ ngữ            | [cite_start]**49 Khoản** (Từ khoản 1 đến 49) [cite: 25-105]    | Kiểm tra khả năng xử lý số lượng chunk lớn trong 1 điều.       |
| **Điều 79** | Thu hồi đất phát triển KT-XH | [cite_start]**32 Khoản** (Từ khoản 1 đến 32) [cite: 1184-1266] | Kiểm tra logic tách danh sách liệt kê và nối lời dẫn cấp Điều. |
| **Điều 4**  | Người sử dụng đất            | [cite_start]7 Khoản (Có khoản chứa điểm a, b) [cite: 106-120]  | Kiểm tra hỗn hợp vừa liệt kê khoản, vừa lồng điểm.             |
| **Điều 9**  | Phân loại đất                | [cite_start]5 Khoản (Khoản 2 và 3 rất dài) [cite: 156-188]     | Kiểm tra phân loại nhóm đất.                                   |

### 2. Các Khoản chứa danh sách Điểm rất dài (Nested Points a, b, c...)

_Đây là các trường hợp bắt buộc phải dùng logic **"Đệ quy" (Recursive Stemming)** để cắt sâu xuống cấp Điểm, nếu không chunk sẽ quá lớn hoặc mất ngữ nghĩa._

| Vị trí (Điều - Khoản) | Chủ đề                       | Cấu trúc Điểm                         | Nguồn             | Ghi chú Test                                                                                                |
| :-------------------- | :--------------------------- | :------------------------------------ | :---------------- | :---------------------------------------------------------------------------------------------------------- |
| **Điều 28, Khoản 1**  | Người nhận quyền sử dụng đất | [cite_start]**15 Điểm** (từ a đến o)  | [cite: 400-427]   | Danh sách rất dài các đối tượng nhận quyền.                                                                 |
| **Điều 124, Khoản 3** | Giao đất không đấu giá       | [cite_start]**16 Điểm** (từ a đến p)  | [cite: 1933-1951] | Các trường hợp ngoại lệ không đấu giá. Cần test kỹ lời dẫn.                                                 |
| **Điều 137, Khoản 1** | Cấp sổ đỏ (đất có giấy tờ)   | [cite_start]**14 Điểm** (từ a đến n)  | [cite: 2119-2141] | Các loại giấy tờ cũ. Test xem hệ thống có nhận diện được các loại giấy tờ lạ (Bằng khoán, văn tự...) không. |
| **Điều 157, Khoản 1** | Miễn, giảm tiền sử dụng đất  | [cite_start]**13 Điểm** (từ a đến m)  | [cite: 2430-2454] | Danh sách ưu đãi tài chính.                                                                                 |
| **Điều 79, Khoản 21** | Thu hồi đất làm nhà ở        | [cite_start]Một đoạn văn dài, nhiều ý | [cite: 1245-1248] | Kiểm tra xem script có cắt nhầm khi câu văn dài nhưng không xuống dòng không.                               |

### 3. Các trường hợp đặc biệt khác (Edge Cases)

- [cite_start]**Điều 217 (Đất do Nhà nước quản lý):** Khoản 1 liệt kê từ a đến k [cite: 3051-3061]. Đây là danh sách định nghĩa quan trọng.
- [cite_start]**Điều 148 (Cấp sổ cho nhà ở):** Khoản 1 liệt kê giấy tờ nhà ở từ a đến g [cite: 2313-2322]. Lưu ý có các Nghị quyết số đan xen trong văn bản.
- [cite_start]**Điều 223 (Thủ tục hành chính):** Khoản 1 liệt kê từ a đến k [cite: 3129-3137].

## Triển khai

#### 1\. Quy trình Làm sạch (Cleaning Strategy)

Trước khi cắt, văn bản thô phải được làm sạch để tránh nhiễu vector:

- **Header/Footer:** Xóa các dòng `--- PAGE X ---`, `CỘNG HÒA XÃ HỘI...`.
- **Ghi chú cuối trang (Footnotes):**
  - _Nhận diện:_ Các dòng bắt đầu bằng số nhỏ (VD: `1`, `2`) hoặc ký tự đặc biệt ở cuối trang, thường giải thích nguồn gốc sửa đổi luật.
  - _Hành động:_ Tách riêng ra khỏi nội dung chính của Điều luật.
  - _Lưu trữ:_ Nếu quan trọng, lưu vào trường metadata `footnotes` hoặc `amendment_history`. Nếu không, xóa bỏ để tránh làm loãng ngữ nghĩa.
- **Source Tags:** Xóa các thẻ \`\` trong văn bản (nếu file gốc có).

#### 2\. Logic Phân cấp (Hierarchy State Machine)

Script chạy tuần tự (Stateful parsing):

- Gặp `Chương X`: $\rightarrow$ Set `current_chapter_id = X`, `current_chapter_title = ...`. **QUAN TRỌNG:** Reset `section` về `null` (để xử lý trường hợp chương mới không có mục).
- Gặp `Mục Y`: $\rightarrow$ Set `current_section_id = Y`, `current_section_title = ...`.
- Gặp `Điều Z`: $\rightarrow$ Bắt đầu logic cắt Chunk cho Điều Z.

#### 3\. Logic Cắt Chunk (Recursive Contextual Splitting)

Chúng ta áp dụng logic **"Recursive Stemming"** (Nối gốc đệ quy) để xử lý mọi trường hợp lời dẫn.

- **Bước 1: Xác định cấu trúc Điều luật**

  - Nếu độ dài \< 2000 ký tự và không có danh sách liệt kê dài $\rightarrow$ **Giữ nguyên (Full Article Chunk)**.
  - Nếu độ dài \> 2000 ký tự HOẶC chứa danh sách dài (VD: Điều 79) $\rightarrow$ **Cắt nhỏ (Clause/Point Chunk)**.

- **Bước 2: Xử lý Cắt nhỏ (Cho trường hợp Điều dài)**

  - **Tách Lời dẫn cấp Điều (Article Preamble):**
    - Kiểm tra có lời dẫn điều hay không
    - Nội dung từ sau `Tiêu đề Điều` đến trước `Khoản 1` (hoặc dấu hiệu liệt kê đầu tiên).
    - _Ví dụ:_ "Nhà nước thu hồi đất trong trường hợp thật cần thiết... sau đây:"
  - **Cắt từng Khoản (Clause):**
    - Duyệt qua từng Khoản (1, 2, 3...).
    - Kiểm tra trong Khoản có **Lời dẫn cấp Khoản (Clause Preamble)** không? (VD: "1. ...gồm các giấy tờ sau: a)... b)...").
    - **Nếu KHÔNG có điểm a, b, c:**
      - `Chunk Content = [Tiêu đề Điều] + [Lời dẫn Điều] + [Nội dung Khoản]`.
    - **Nếu CÓ điểm a, b, c (Cắt sâu hơn):**
      - Tách `Lời dẫn Khoản` (từ đầu Khoản đến trước điểm a).
      - Tạo chunk cho từng điểm:
      - `Chunk Content = [Tiêu đề Điều] + [Lời dẫn Điều] + [Lời dẫn Khoản] + [Nội dung Điểm a]`.

- Xử lý trường hợp ghép trang (một điều/khoản nằm giữa 2 trang).

---

### 📋 PHẦN 2: METADATA SCHEMA (CẤU TRÚC DỮ LIỆU)

Bảng cấu trúc dữ liệu cập nhật đầy đủ các trường cần thiết:

| Field Name      | Type      | Nullable | Mô tả / Mục đích                                       |
| :-------------- | :-------- | :------- | :----------------------------------------------------- |
| **Hierarchy**   |           |          |                                                        |
| `law_id`        | String    | No       | ID văn bản (VD: `133/VBHN-VPQH`).                      |
| `chapter_id`    | Integer   | No       | Số thứ tự Chương (VD: `6`).                            |
| `chapter_title` | String    | No       | Tên Chương.                                            |
| `section_id`    | Integer   | **Yes**  | Số thứ tự Mục. **Để `null` nếu chương không có mục.**  |
| `section_title` | String    | **Yes**  | Tên Mục.                                               |
| `article_id`    | String    | No       | Số hiệu Điều (VD: `79`).                               |
| `clause_id`     | String    | **Yes**  | Số hiệu Khoản (VD: `1`). Chỉ có khi cắt nhỏ.           |
| `point_id`      | String    | **Yes**  | Số hiệu Điểm (VD: `a`). Chỉ có khi cắt sâu xuống điểm. |
| **Content**     |           |          |                                                        |
| `article_title` | String    | No       | Tiêu đề Điều.                                          |
| `topic`         | String    | No       | Chủ đề chính (VD: `thu_hoi_dat`). Dùng để filter.      |
| `chunk_type`    | String    | No       | Giá trị: `full_article`, `clause`, hoặc `point`.       |
| **Source**      |           |          |                                                        |
| `page_number`   | List[Int] | No       | Danh sách trang PDF (VD: `[61, 62]`).                  |
| `file_path`     | String    | No       | Đường dẫn file gốc.                                    |
| `coordinates`   | JSON      | No       | Tọa độ `[x, y, w, h]` để vẽ highlight.                 |
| `footnotes`     | String    | **Yes**  | Nội dung ghi chú cuối trang liên quan (nếu có).        |

---

### 💾 PHẦN 3: DATA SAMPLE (MẪU DỮ LIỆU JSON)

#### Mẫu 1: Điều luật Siêu dài + Có Lời dẫn cấp Điều (VD: Điều 79, Khoản 27)

_Ngữ cảnh: Điều 79, Chương VI (không có Mục)._

```json
{
  "id": "law_133_art_79_clause_27",
  "text": "Điều 79. Thu hồi đất để phát triển kinh tế - xã hội vì lợi ích quốc gia, công cộng. Nhà nước thu hồi đất trong trường hợp thật cần thiết để thực hiện dự án phát triển kinh tế - xã hội vì lợi ích quốc gia, công cộng nhằm phát huy nguồn lực đất đai... trong trường hợp sau đây: Khoản 27. Thực hiện dự án đầu tư xây dựng khu đô thị có công năng phục vụ hỗn hợp...",
  "metadata": {
    "law_id": "133/VBHN-VPQH",
    "chapter_id": 6,
    "chapter_title": "THU HỒI ĐẤT, TRƯNG DỤNG ĐẤT",
    "section_id": null,
    "section_title": "",
    "article_id": "79",
    "article_title": "Thu hồi đất để phát triển kinh tế - xã hội...",
    "clause_id": "27",
    "point_id": null,
    "chunk_type": "clause",
    "topic": "thu_hoi_dat",
    "page_number": [62],
    "file_path": "/data/133.pdf",
    "coordinates": [{ "page": 62, "rect": [50, 400, 500, 150] }],
    "footnotes": ""
  }
}
```

#### Mẫu 2: Điều luật Phức tạp + Có Lời dẫn cấp Khoản (VD: Điều 137, Khoản 1, Điểm a)

_Ngữ cảnh: Cắt sâu xuống tận điểm a để đảm bảo chính xác._

```json
{
  "id": "law_133_art_137_clause_1_point_a",
  "text": "Điều 137. Cấp Giấy chứng nhận quyền sử dụng đất... Khoản 1. Hộ gia đình, cá nhân đang sử dụng đất ổn định mà có một trong các loại giấy tờ được lập trước ngày 15 tháng 10 năm 1993 sau đây thì được cấp Giấy chứng nhận...: a) Những giấy tờ về quyền được sử dụng đất do cơ quan có thẩm quyền cấp trong quá trình thực hiện chính sách đất đai...",
  "metadata": {
    "law_id": "133/VBHN-VPQH",
    "chapter_id": 10,
    "chapter_title": "ĐĂNG KÝ ĐẤT ĐAI...",
    "section_id": 3,
    "section_title": "CẤP GIẤY CHỨNG NHẬN...",
    "article_id": "137",
    "article_title": "Cấp Giấy chứng nhận... có giấy tờ...",
    "clause_id": "1",
    "point_id": "a",
    "chunk_type": "point",
    "topic": "cap_so_do",
    "page_number": [113],
    "file_path": "/data/133.pdf",
    "coordinates": [{ "page": 113, "rect": [50, 100, 500, 50] }]
  }
}
```

# Code sample

```python
import fitz  # PyMuPDF
import re
import json


class LandLawChunkerFinal:
    def __init__(self, pdf_path):
        self.pdf_path = pdf_path
        try:
            self.doc = fitz.open(pdf_path)
        except Exception as e:
            raise ValueError(f"Không thể mở file PDF: {e}")

        self.law_id = "133/VBHN-VPQH"
        self.chunks = []

        # State variables (Hierarchy)
        self.current_chapter = {"id": None, "title": None}
        self.current_section = {"id": None, "title": None}

    def clean_text_for_embedding(self, text):
        """
        Làm sạch text triệt để để lưu vào DB (dùng cho semantic search).
        """
        # 1. Xóa đánh dấu trang và header/footer cố định
        # Xóa dòng "--- PAGE 123 ---"
        text = re.sub(r"--- PAGE \d+ ---", "", text)
        text = re.sub(r"CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", "", text)
        text = re.sub(r"Độc lập - Tự do - Hạnh phúc", "", text)

        # 2. Xóa Footnote/Source Tags (FIXED)
        # File của bạn chứa các tag như , ...
        # Regex: \[ (dấu ngoặc vuông mở), source:, \s* (khoảng trắng tùy ý), \d+ (số), \] (dấu ngoặc vuông đóng)
        text = re.sub(r"\[source:\s*\d+\]", "", text)

        # 3. Nối dòng (Text Reconstruction)
        # Thay thế xuống dòng đơn lẻ bằng khoảng trắng (để nối câu bị ngắt)
        # Giữ lại xuống dòng kép (để tách đoạn)
        text = re.sub(r"(?<!\n)\n(?!\n)", " ", text)

        # 4. Chuẩn hóa khoảng trắng (xóa tab, space thừa)
        text = re.sub(r"\s+", " ", text)

        return text.strip()

    def get_coordinates_fuzzy(self, search_text):
        """
        Tìm tọa độ text trong PDF gốc bằng Fuzzy Search.
        Chiến lược: Chỉ tìm kiếm một đoạn ngắn đặc trưng (Signature Phrase) ở đầu chunk.
        """
        if not search_text:
            return [], []

        # Lấy 60 ký tự đầu tiên của nội dung thực (Bỏ qua phần Tiêu đề Điều/Khoản đã được nối vào)
        # Vì Tiêu đề Điều lặp lại ở mọi chunk con, tìm theo tiêu đề sẽ ra sai vị trí.

        # Làm sạch sơ bộ search_text để tăng khả năng match (chỉ bỏ xuống dòng thừa)
        clean_search_key = re.sub(r"\s+", " ", search_text).strip()
        search_phrase = clean_search_key[:50]  # Lấy 50 ký tự đầu làm key

        locations = []
        pages_found = set()

        # Quét toàn bộ document (Có thể tối ưu bằng cách giới hạn range nếu biết trước)
        for i, page in enumerate(self.doc):
            # search_for trả về list các Rect (x0, y0, x1, y1)
            quads = page.search_for(search_phrase)

            if quads:
                pages_found.add(i + 1)
                for q in quads:
                    locations.append(
                        {
                            "page": i + 1,
                            # Làm tròn 2 số lẻ để giảm dung lượng JSON output
                            "rect": [
                                round(q.x0, 2),
                                round(q.y0, 2),
                                round(q.x1, 2),
                                round(q.y1, 2),
                            ],
                        }
                    )
                # Nếu tìm thấy rồi thì break để tiết kiệm thời gian (Giả định text là unique trong ngữ cảnh cục bộ)
                # break

        return list(pages_found), locations

    def recursive_split(self, article_dict):
        """
        Chiến lược: Recursive Stemming + Adaptive Chunking
        Input: Article Object (Title, Content)
        Output: List of Chunks
        """
        full_text = article_dict["content"]
        article_title = article_dict["title"]  # VD: "Điều 79. Thu hồi đất..."
        article_id = article_dict["id"]

        # Regex tìm khoản: "1. ", "2. " ở đầu dòng hoặc sau dấu xuống dòng
        clause_pattern = r"(?m)(^|\n)(\d+)\.\s"
        matches = list(re.finditer(clause_pattern, full_text))

        # --- LOGIC 1: ĐIỀU KIỆN CẮT (ADAPTIVE) ---
        # Cắt nếu: Dài > 1500 ký tự HOẶC có > 5 khoản (giảm ngưỡng xuống 5 để an toàn hơn)
        should_split = len(full_text) > 1500 or len(matches) > 5

        if not should_split:
            # Case A: Giữ nguyên (Full Article Chunk)

            # 1. Tạo text sạch để lưu DB
            final_db_text = self.clean_text_for_embedding(
                f"{article_title} {full_text}"
            )

            # 2. Tìm tọa độ (Dùng text gốc chưa clean quá nhiều để dễ match)
            # Lấy 100 ký tự đầu của nội dung Điều làm key tìm kiếm
            search_key = full_text[:100]
            pgs, coords = self.get_coordinates_fuzzy(search_key)

            return [
                {
                    "id": f"law_{self.law_id}_art_{article_id}",
                    "text": final_db_text,
                    "metadata": {
                        **article_dict["metadata"],
                        "chunk_type": "full_article",
                        "clause_id": None,
                        "point_id": None,
                        "page_number": pgs,
                        "coordinates": coords,
                    },
                }
            ]

        # Case B: Cắt nhỏ (Recursive Logic)
        results = []

        # 1. Tách Preamble (Lời dẫn) cấp Điều
        if matches:
            first_match_start = matches[0].start()
            article_preamble = full_text[:first_match_start].strip()
        else:
            article_preamble = ""

        # Duyệt qua từng khoản
        for i, match in enumerate(matches):
            clause_id = match.group(2)
            start = match.end()
            # Điểm cuối là điểm đầu của khoản tiếp theo, hoặc hết văn bản
            end = matches[i + 1].start() if i + 1 < len(matches) else len(full_text)
            clause_content = full_text[start:end].strip()

            # --- LOGIC 2: XỬ LÝ ĐIỂM (ADAPTIVE SUB-SPLITTING) ---
            # Thêm 'đ' vào regex cho tiếng Việt
            point_pattern = r"(?m)(^|\n|\s)([a-zđ])\)\s"
            point_matches = list(re.finditer(point_pattern, clause_content))

            # Điều kiện tách điểm: Có điểm VÀ (Nhiều điểm > 5 HOẶC Nội dung quá dài > 800)
            has_points = len(point_matches) > 0
            should_split_points = has_points and (
                len(point_matches) > 5 or len(clause_content) > 800
            )

            if not should_split_points:
                # TRƯỜNG HỢP GỘP (MERGE): Tạo Chunk cấp Khoản

                # Prepend context: Tiêu đề + Lời dẫn Điều
                # Lưu ý: article_preamble cần được clean nhẹ để nối chuỗi đẹp hơn
                clean_art_preamble = self.clean_text_for_embedding(article_preamble)

                full_chunk_text = f"{article_title} {clean_art_preamble} Khoản {clause_id}. {clause_content}"
                final_db_text = self.clean_text_for_embedding(full_chunk_text)

                # Tìm tọa độ: Dùng nội dung gốc của khoản để tìm
                pgs, coords = self.get_coordinates_fuzzy(clause_content[:100])

                results.append(
                    {
                        "id": f"law_{self.law_id}_art_{article_id}_clause_{clause_id}",
                        "text": final_db_text,
                        "metadata": {
                            **article_dict["metadata"],
                            "chunk_type": "clause",
                            "clause_id": clause_id,
                            "point_id": None,
                            "page_number": pgs,
                            "coordinates": coords,
                            "has_points": has_points,  # Flag đánh dấu
                        },
                    }
                )
            else:
                # TRƯỜNG HỢP TÁCH (SPLIT): Cắt sâu xuống cấp Điểm

                # Tách Preamble cấp Khoản
                clause_preamble = clause_content[: point_matches[0].start()].strip()
                clean_clause_preamble = self.clean_text_for_embedding(clause_preamble)
                clean_art_preamble = self.clean_text_for_embedding(article_preamble)

                for j, p_match in enumerate(point_matches):
                    point_id = p_match.group(2)
                    p_start = p_match.end()
                    p_end = (
                        point_matches[j + 1].start()
                        if j + 1 < len(point_matches)
                        else len(clause_content)
                    )
                    point_content = clause_content[p_start:p_end].strip()

                    # Tạo Chunk Điểm (Full Context)
                    # Prepend context: Tiêu đề + Lời dẫn Điều + Khoản số + Lời dẫn Khoản
                    full_chunk_text = f"{article_title} {clean_art_preamble} Khoản {clause_id}. {clean_clause_preamble} Điểm {point_id}) {point_content}"
                    final_db_text = self.clean_text_for_embedding(full_chunk_text)

                    # Tìm tọa độ điểm
                    pgs, coords = self.get_coordinates_fuzzy(point_content[:100])

                    results.append(
                        {
                            "id": f"law_{self.law_id}_art_{article_id}_clause_{clause_id}_point_{point_id}",
                            "text": final_db_text,
                            "metadata": {
                                **article_dict["metadata"],
                                "chunk_type": "point",
                                "clause_id": clause_id,
                                "point_id": point_id,
                                "page_number": pgs,
                                "coordinates": coords,
                            },
                        }
                    )

        return results

    def process(self):
        print(f"🚀 Bắt đầu xử lý file: {self.pdf_path}")

        full_text = ""
        # 1. Gộp trang để xử lý nội dung liền mạch
        for page in self.doc:
            full_text += page.get_text() + "\n"

        # 2. Pattern bắt các tiêu đề cấu trúc (Hierarchy)
        # Regex này tìm dòng bắt đầu bằng Chương, Mục hoặc Điều
        hierarchy_pattern = (
            r"(?m)^(Chương\s+[IVXLCDM]+|Mục\s+\d+|Điều\s+(\d+)\.)\s+(.*)"
        )

        matches = list(re.finditer(hierarchy_pattern, full_text))
        print(f"🔍 Tìm thấy {len(matches)} điểm đánh dấu cấu trúc.")

        for i, match in enumerate(matches):
            marker_type = match.group(1)  # Chương I, Mục 1, Điều 1.
            content_title = match.group(3).strip()

            start_idx = match.end()
            # Nội dung kết thúc tại điểm bắt đầu của match tiếp theo, hoặc hết văn bản
            end_idx = matches[i + 1].start() if i + 1 < len(matches) else len(full_text)
            content_body = full_text[start_idx:end_idx].strip()

            # --- CẬP NHẬT TRẠNG THÁI (State Machine) ---
            if marker_type.startswith("Chương"):
                parts = marker_type.split()
                c_id = parts[1] if len(parts) > 1 else "Unknown"
                self.current_chapter = {"id": c_id, "title": content_title}
                self.current_section = {
                    "id": None,
                    "title": None,
                }  # RESET SECTION QUAN TRỌNG

            elif marker_type.startswith("Mục"):
                parts = marker_type.split()
                s_id = parts[1] if len(parts) > 1 else "Unknown"
                self.current_section = {"id": s_id, "title": content_title}

            elif marker_type.startswith("Điều"):
                art_id = match.group(2)  # Capture số điều (group 2 trong regex)
                full_art_title = f"{marker_type} {content_title}"

                # Metadata cho Điều
                meta = {
                    "law_id": self.law_id,
                    "chapter_id": self.current_chapter["id"],
                    "chapter_title": self.current_chapter["title"],
                    "section_id": self.current_section["id"],
                    "section_title": self.current_section["title"],
                    "article_id": art_id,
                    "article_title": full_art_title,
                    "topic": "legal_document",  # Placeholder
                    "source_file": self.pdf_path.split("/")[-1],
                    "footnotes": "",  # Placeholder cho tương lai
                }

                # Gọi hàm cắt
                chunks = self.recursive_split(
                    {
                        "id": art_id,
                        "title": full_art_title,
                        "content": content_body,
                        "metadata": meta,
                    }
                )
                self.chunks.extend(chunks)

        print(f"✅ Hoàn thành! Tổng cộng {len(self.chunks)} chunks được tạo ra.")
        return self.chunks


# ==========================================
# TEST RUNNER (Để bạn chạy thử)
# ==========================================
if __name__ == "__main__":
    # Thay tên file PDF của bạn vào đây
    PDF_FILE = "133-vbhn-vpqh.pdf"

    try:
        parser = LandLawChunkerFinal(PDF_FILE)
        final_data = parser.process()

        # Xuất kết quả
        OUTPUT_FILE = "land_law_chunks_final.json"
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(final_data, f, ensure_ascii=False, indent=2)

        print(f"💾 Dữ liệu đã được lưu vào: {OUTPUT_FILE}")

    except Exception as e:
        print(f"❌ Lỗi: {e}")

```

# Checklist kiểm tra

Chào bạn, đây là bộ **Test Cases chuyên biệt** để kiểm tra logic của script Chunking (Data Ingestion). Mục tiêu là đảm bảo dữ liệu đầu ra (JSON) sạch, đúng cấu trúc và đầy đủ ngữ nghĩa trước khi nạp vào Vector DB.

Bạn hãy sử dụng bộ test này để `print()` hoặc `assert` kết quả từ script Python của mình.

### 📋 TỔNG QUAN CHIẾN LƯỢC TEST

Chúng ta sẽ kiểm tra 5 kịch bản (scenarios) đại diện cho các cấu trúc văn bản khó nhất trong file PDF Luật Đất đai:

1.  **Simple Article:** Điều luật ngắn, chuẩn.
2.  **Long List Article:** Điều luật liệt kê dài (có Lời dẫn cấp Điều).
3.  **Nested Article:** Điều luật lồng ghép (có Lời dẫn cấp Khoản).
4.  **Page Break:** Điều luật bị ngắt trang.
5.  **Metadata Hierarchy:** Kiểm tra cấu trúc Chương/Mục.

---

### 🧪 TEST CASE 1: ĐIỀU LUẬT CHUẨN (STANDARD)

_Kiểm tra xem các điều luật ngắn có bị cắt vụn không cần thiết hay không._

- [cite\_start]**Input Target:** **Điều 15** (Trách nhiệm của Nhà nước đối với người sử dụng đất) [cite: 244-250].
- **Kỳ vọng (Expected Result):**
  - **Số lượng Chunk:** 1 chunk duy nhất.
  - **Nội dung:** Phải chứa toàn bộ nội dung từ Khoản 1 đến Khoản 5.
  - **Metadata:** `chunk_type` = "full_article".

### 🧪 TEST CASE 2: ĐIỀU LUẬT LIỆT KÊ DÀI (PREAMBLE CẤP ĐIỀU)

_Kiểm tra kỹ thuật "Prepend" (Nối đầu) cho các điều luật có danh sách dài._

- [cite\_start]**Input Target:** **Điều 79** (Thu hồi đất...) - Cụ thể là **Khoản 27** [cite: 1184][cite\_start],[cite: 1260].
- **Kỳ vọng (Expected Result):**
  - **Số lượng Chunk:** Điều 79 phải được tách thành ít nhất 32 chunks (tương ứng 32 khoản).
  - **Nội dung Chunk 27:** BẮT BUỘC phải bắt đầu bằng chuỗi:
    > _"Điều 79. Thu hồi đất để phát triển kinh tế - xã hội... Nhà nước thu hồi đất trong trường hợp thật cần thiết... trong trường hợp sau đây: Khoản 27. Thực hiện dự án đầu tư xây dựng khu đô thị..."_
  - **Lỗi cần tránh:** Chunk chỉ bắt đầu bằng _"27. Thực hiện dự án..."_ (Mất ngữ cảnh thu hồi đất).

### 🧪 TEST CASE 3: ĐIỀU LUẬT LỒNG GHÉP (PREAMBLE CẤP KHOẢN)

_Kiểm tra logic đệ quy (Recursive) khi cắt sâu xuống cấp Điểm (a, b, c)._

- [cite\_start]**Input Target:** **Điều 137** (Cấp Giấy chứng nhận...) -\> **Khoản 1** -\> **Điểm a** [cite: 2119-2120].
- **Kỳ vọng (Expected Result):**
  - **Nội dung Chunk:** Phải là sự kết hợp của 3 phần:
    1.  **Tiêu đề:** _"Điều 137. Cấp Giấy chứng nhận..."_
    2.  **Lời dẫn Khoản 1:** _"Khoản 1. Hộ gia đình... có một trong các loại giấy tờ... sau đây thì được cấp Giấy chứng nhận...:"_
    3.  **Nội dung Điểm a:** _"a) Những giấy tờ về quyền được sử dụng đất do cơ quan có thẩm quyền cấp..."_
  - **Metadata:** `clause_id`="1", `point_id`="a".

### 🧪 TEST CASE 4: XỬ LÝ NGẮT TRANG (PAGE BREAK & CLEANING)

_Kiểm tra việc nối dòng và xóa Header/Footer._

- **Input Target:** **Điều 79** (Chuyển tiếp từ trang 60 sang trang 61).
- [cite\_start]**Vị trí:** Khoản 14 (Xây dựng cơ sở văn hóa...) nằm ở cuối trang 60 [cite: 1222][cite\_start], tiếp nối sang đầu trang 61 [cite: 1229-1230].
- **Kỳ vọng (Expected Result):**
  - **Text sạch:** Trong nội dung chunk của Khoản 14, **KHÔNG** được xuất hiện các chuỗi:
    - `--- PAGE 60 ---`
    - `--- PAGE 61 ---`
    - `60` (Số trang đơn lẻ)
  - **Liền mạch:** Câu văn không bị ngắt quãng. Ví dụ: _"cơ sở sáng tác văn học, cơ sở sáng tác nghệ thuật..."_ phải liền mạch, không bị chèn ký tự lạ.

### 🧪 TEST CASE 5: PHÂN CẤP METADATA (HIERARCHY)

_Kiểm tra logic State Machine nhận diện Chương/Mục._

- **Case 5.1 (Có Mục):**
  - **Target:** **Điều 96** (Bồi thường về đất nông nghiệp...).
  - [cite\_start]**Kỳ vọng Metadata:** `chapter_id`=7, `section_id`=2 (Vì Điều 96 nằm trong Mục 2 Chương VII) [cite: 1584-1585][cite\_start],[cite: 1613].
- **Case 5.2 (Không có Mục):**
  - **Target:** **Điều 79** (Thu hồi đất...).
  - [cite\_start]**Kỳ vọng Metadata:** `chapter_id`=6, `section_id`=`null` (Vì Chương VI không chia Mục) [cite: 1164-1166].

---

### 💻 MÃ KIỂM TRA NHANH (PYTHON ASSERTION)

Bạn có thể dùng đoạn code nhỏ này để validate nhanh output JSON của mình:

```python
def test_chunking_logic(chunks):
    # Map chunks by ID for easy lookup
    chunk_map = {c['metadata']['article_id']: c for c in chunks}

    # Test 1: Standard Article 15
    art_15 = [c for c in chunks if c['metadata']['article_id'] == '15'][0]
    assert "Trách nhiệm của Nhà nước" in art_15['text']
    assert art_15['metadata']['chunk_type'] == 'full_article'
    print("✅ Test 1 Passed: Article 15 chunked correctly.")

    # Test 2: Article 79 Preamble Check
    # Tìm chunk của Khoản 27
    art_79_27 = [c for c in chunks if c['metadata']['article_id'] == '79' and c['metadata'].get('clause_id') == '27'][0]
    expected_preamble = "Nhà nước thu hồi đất trong trường hợp thật cần thiết"
    assert expected_preamble in art_79_27['text'], "Missing Article 79 Preamble!"
    assert "khu đô thị" in art_79_27['text']
    print("✅ Test 2 Passed: Article 79.27 has correct context.")

    # Test 5: Hierarchy Check
    art_96 = [c for c in chunks if c['metadata']['article_id'] == '96'][0]
    art_79 = [c for c in chunks if c['metadata']['article_id'] == '79'][0]

    assert art_96['metadata']['section_id'] is not None, "Article 96 MUST have section_id"
    assert art_79['metadata']['section_id'] is None, "Article 79 MUST NOT have section_id"
    print("✅ Test 5 Passed: Hierarchy Metadata is correct.")

# Run test
# test_chunking_logic(your_final_json_data)
```
