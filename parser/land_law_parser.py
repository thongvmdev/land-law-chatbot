import fitz  # PyMuPDF
import re
import json


class LandLawChunkerFinal:
    def __init__(self, pdf_path, max_pages=None):
        self.pdf_path = pdf_path
        self.max_pages = max_pages
        try:
            self.doc = fitz.open(pdf_path)
        except Exception as e:
            raise ValueError(f"Không thể mở file PDF: {e}")

        self.law_id = "133/VBHN-VPQH"
        self.chunks = []

        # State variables (Hierarchy)
        self.current_chapter = {"id": None, "title": None}
        self.current_section = {"id": None, "title": None}

        # [MỚI] Kho lưu trữ Footnote theo trang: { page_num: "nội dung footnote" }
        self.page_footnotes_map = {}

        # [MỚI] Bản đồ ánh xạ từ Index trong full_text sang Số trang
        # Format: [{"page": 1, "start": 0, "end": 1000}, ...]
        self.page_offset_map = []

    def get_page_content_and_footnotes(self, page):
        """
        Trả về 2 giá trị:
        1. clean_text: Nội dung chính (cỡ chữ to)
        2. footnote_text: Nội dung chú thích (cỡ chữ nhỏ)
        """

        blocks = page.get_text(
            "dict",
            flags=fitz.TEXT_PRESERVE_LIGATURES | fitz.TEXT_PRESERVE_WHITESPACE,
        )["blocks"]
        clean_text = ""
        footnote_text = ""

        # Ngưỡng cỡ chữ phân loại
        FONT_SIZE_THRESHOLD = 12

        for b in blocks:
            if "lines" in b:
                for l in b["lines"]:
                    line_clean = ""
                    line_note = ""
                    for s in l["spans"]:
                        text_segment = s["text"]
                        if s["size"] > FONT_SIZE_THRESHOLD:
                            line_clean += text_segment
                        else:
                            # Lọc rác: Bỏ qua số trang đơn lẻ nếu nó lẫn vào footnote
                            if not re.match(r"^\s*\d+\s*$", text_segment):
                                line_note += text_segment

                    if line_clean.strip():
                        clean_text += line_clean + "\n"
                    if line_note.strip():
                        footnote_text += line_note + " "  # Nối footnote thành dòng dài

        return clean_text, footnote_text.strip()

    def log_structure_hierarchy(self, matches):
        """
        In ra cấu trúc cây của văn bản luật dựa trên kết quả Regex.
        """
        print(f"\n🔍 Tìm thấy {len(matches)} điểm đánh dấu cấu trúc.")
        print("=" * 60)
        print(f"{'LOẠI':<10} | {'CHI TIẾT':<50}")
        print("=" * 60)

        count_chuong = 0
        count_muc = 0
        count_dieu = 0

        for m in matches:
            marker = m.group(1).strip()  # VD: Chương I, Mục 1, Điều 1.
            title = m.group(3).strip()  # VD: Phạm vi điều chỉnh

            if marker.startswith("Chương"):
                count_chuong += 1
                print(f"📘 {marker}: {title.upper()}")
            elif marker.startswith("Mục"):
                count_muc += 1
                print(f"  📂 {marker}: {title}")
            elif marker.startswith("Điều"):
                count_dieu += 1
                display_title = (title[:50] + "...") if len(title) > 50 else title
                print(f"    📄 {marker} {display_title}")

        print("=" * 60)
        print(
            f"📊 THỐNG KÊ: {count_chuong} Chương | {count_muc} Mục | {count_dieu} Điều"
        )
        print("=" * 60 + "\n")

    def clean_text_for_embedding(self, text):
        """
        Làm sạch text triệt để để lưu vào DB (dùng cho semantic search).
        """
        # 1. Xóa đánh dấu trang và header/footer cố định
        # Xóa dòng "--- PAGE 123 ---"
        text = re.sub(r"--- PAGE \d+ ---", "", text)
        # Xóa các số trang đơn lẻ ở đầu/cuối dòng (thường là số trang)
        text = re.sub(r"^\s*\d+\s*$", "", text, flags=re.MULTILINE)
        # Xóa số trang ở giữa dòng với format " - 123 - " hoặc " 123 "
        text = re.sub(r"\s+-\s*\d+\s+-\s*", " ", text)
        text = re.sub(r"\s+\d+\s+(?=\n|$)", " ", text)

        text = re.sub(r"CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", "", text)
        text = re.sub(r"Độc lập - Tự do - Hạnh phúc", "", text)

        # 4. Nối dòng (Text Reconstruction)
        # Thay thế xuống dòng đơn lẻ bằng khoảng trắng (để nối câu bị ngắt)
        # Giữ lại xuống dòng kép (để tách đoạn)
        text = re.sub(r"(?<!\n)\n(?!\n)", " ", text)

        # 5. Chuẩn hóa khoảng trắng (xóa tab, space thừa)
        text = re.sub(r"\s+", " ", text)

        return text.strip()

    def get_pages_from_offset(self, start_idx, end_idx):
        """
        Tìm xem đoạn text từ start_idx đến end_idx nằm trên những trang nào
        dựa vào self.page_offset_map.
        """
        pages = set()

        # Binary search hoặc duyệt tuần tự (duyệt tuần tự ok vì số trang ít)
        # Tối ưu: Chỉ duyệt các trang có range giao với [start_idx, end_idx]
        for p_map in self.page_offset_map:
            # Kiểm tra giao nhau (Intersection)
            if not (end_idx <= p_map["start"] or start_idx >= p_map["end"]):
                pages.add(p_map["page"])

        return sorted(list(pages))

    def get_coordinates_by_offset(self, search_text, start_idx, end_idx):
        """
        Chỉ tìm kiếm text trên các trang được xác định bởi offset.
        """
        if not search_text:
            return [], []

        # 1. Xác định trang chứa đoạn text này
        target_pages = self.get_pages_from_offset(start_idx, end_idx)

        if not target_pages:
            return [], []

        locations = []
        clean_search_key = re.sub(r"\s+", " ", search_text).strip()
        search_phrase = clean_search_key[:50]  # Lấy 50 chars đầu để search Rect

        # 2. Chỉ search trên các trang đích danh
        for page_num in target_pages:
            # Index mảng doc bắt đầu từ 0, page_num bắt đầu từ 1
            if page_num - 1 >= len(self.doc):
                continue

            page = self.doc[page_num - 1]
            quads = page.search_for(search_phrase)

            if quads:
                for q in quads:
                    locations.append(
                        {
                            "page": page_num,
                            "rect": [
                                round(q.x0, 2),
                                round(q.y0, 2),
                                round(q.x1, 2),
                                round(q.y1, 2),
                            ],
                        }
                    )

        return target_pages, locations

    # --- Hàm helper để lấy footnote từ danh sách trang ---
    def _lookup_footnotes(self, page_numbers):
        """
        Input: List các số trang [1, 2]
        Output: String gộp footnote (VD: "[Trang 1]: Note...\n[Trang 2]: Note...")
        """
        collected_notes = []
        for p in page_numbers:
            if p in self.page_footnotes_map:
                note_content = self.page_footnotes_map[p]
                if note_content:
                    collected_notes.append(f"[Trang {p}]: {note_content}")

        return "\n".join(collected_notes) if collected_notes else ""

    def recursive_split(self, article_dict, base_offset):
        """
        Chiến lược: Structure-Based Chunking (Ưu tiên cấu trúc)
        - Điều không có khoản (hoặc <= 5 khoản) -> Giữ nguyên 1 chunk.
        - Khoản không có điểm (hoặc <= 5 điểm) -> Giữ nguyên chunk cấp Khoản.
        - Chỉ chia nhỏ khi số lượng sub-items > 5.
        """
        full_text = article_dict["content"]
        article_title = article_dict["title"]  # VD: "Điều 79. Thu hồi đất..."
        article_id = article_dict["id"]

        # Regex tìm khoản: "1. ", "2. " ở đầu dòng hoặc sau dấu xuống dòng
        clause_pattern = r"(?m)(^|\n)(\d+)\.\s"
        matches = list(re.finditer(clause_pattern, full_text))

        # --- LOGIC 1: ĐIỀU KIỆN CẮT (ADAPTIVE) ---
        # Cắt nếu: Dài > 1500 ký tự HOẶC có > 5 khoản (giảm ngưỡng xuống 5 để an toàn hơn)
        should_split = len(matches) > 5

        if not should_split:
            # Case A: Giữ nguyên (Full Article Chunk)

            # 1. Tạo text sạch để lưu DB
            final_db_text = self.clean_text_for_embedding(
                f"{article_title} | {full_text}"
            )

            # Tính offset tuyệt đối của đoạn text này
            # Lưu ý: full_text ở đây là article body, nên tọa độ thực tế = base_offset
            # Tuy nhiên để search chính xác title + body thì hơi khó vì title đã bị tách.
            # Dùng 100 ký tự đầu của body để tìm trang.

            abs_start = base_offset
            abs_end = base_offset + len(full_text)

            pgs, coords = self.get_coordinates_by_offset(
                full_text[:100], abs_start, abs_end
            )

            footnotes_str = self._lookup_footnotes(pgs)  # Tra cứu footnote

            chunk_id = f"law_{self.law_id}_art_{article_id}"
            return [
                {
                    "page_content": final_db_text,
                    "metadata": {
                        **article_dict["metadata"],
                        "chunk_id": chunk_id,
                        "chunk_type": "full_article",
                        "clause_id": None,
                        "point_id": None,
                        "page_number": pgs,
                        "coordinates": coords,
                        "chunk_footnotes": footnotes_str,
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

            # Tính offset tuyệt đối trong file gốc
            # match.end() là vị trí sau "1. ", cần cộng với base_offset của Article
            abs_start = base_offset + start
            abs_end = base_offset + end

            # --- LOGIC 2: XỬ LÝ ĐIỂM (ADAPTIVE SUB-SPLITTING) ---
            # Thêm 'đ' vào regex cho tiếng Việt
            point_pattern = r"(?m)(^|\n|\s)([a-zđ])\)\s"
            point_matches = list(re.finditer(point_pattern, clause_content))

            # Điều kiện tách điểm: Có điểm VÀ (Nhiều điểm > 5 HOẶC Nội dung quá dài > 800)
            has_points = len(point_matches) > 0
            should_split_points = has_points and (len(point_matches) > 5)

            if not should_split_points:
                # TRƯỜNG HỢP GỘP (MERGE): Tạo Chunk cấp Khoản

                # Prepend context: Tiêu đề + Lời dẫn Điều
                # Lưu ý: article_preamble cần được clean nhẹ để nối chuỗi đẹp hơn
                clean_art_preamble = self.clean_text_for_embedding(article_preamble)

                full_chunk_text = f"{article_title} | {clean_art_preamble} | Khoản {clause_id}: {clause_content}"
                final_db_text = self.clean_text_for_embedding(full_chunk_text)

                # Tìm tọa độ dùng offset tuyệt đối
                pgs, coords = self.get_coordinates_by_offset(
                    clause_content[:100], abs_start, abs_end
                )
                footnotes_str = self._lookup_footnotes(pgs)

                chunk_id = f"law_{self.law_id}_art_{article_id}_clause_{clause_id}"
                results.append(
                    {
                        "page_content": final_db_text,
                        "metadata": {
                            **article_dict["metadata"],
                            "chunk_id": chunk_id,
                            "chunk_type": "clause",
                            "clause_id": clause_id,
                            "point_id": None,
                            "page_number": pgs,
                            "coordinates": coords,
                            "has_points": has_points,  # Flag đánh dấu
                            "chunk_footnotes": footnotes_str,
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

                    # Offset tuyệt đối của Point
                    # = Base Article + Rel Start Clause + Rel Start Point
                    p_abs_start = abs_start + p_start
                    p_abs_end = abs_start + p_end

                    # Tạo Chunk Điểm (Full Context)
                    # Prepend context: Tiêu đề + Lời dẫn Điều + Khoản số + Lời dẫn Khoản
                    full_chunk_text = f"{article_title} | {clean_art_preamble} | Khoản {clause_id}: {clean_clause_preamble} | Điểm {point_id}) {point_content}"
                    final_db_text = self.clean_text_for_embedding(full_chunk_text)

                    # Tìm tọa độ điểm
                    pgs, coords = self.get_coordinates_by_offset(
                        point_content[:100], p_abs_start, p_abs_end
                    )
                    footnotes_str = self._lookup_footnotes(pgs)

                    chunk_id = f"law_{self.law_id}_art_{article_id}_clause_{clause_id}_point_{point_id}"
                    results.append(
                        {
                            "page_content": final_db_text,
                            "metadata": {
                                **article_dict["metadata"],
                                "chunk_id": chunk_id,
                                "chunk_type": "point",
                                "clause_id": clause_id,
                                "point_id": point_id,
                                "page_number": pgs,
                                "coordinates": coords,
                                "chunk_footnotes": footnotes_str,
                            },
                        }
                    )

        return results

    def _extract_article_info(self, raw_article_text):
        """
        Hàm helper: Tách text thô của một Điều luật thành 3 phần:
        1. art_id: Số hiệu điều (VD: "7")
        2. title: Tên điều đã được nối dòng hoàn chỉnh.
        3. body: Nội dung chi tiết (bắt đầu từ Khoản 1 hoặc nội dung điều đơn).
        """
        # 1. Tách số hiệu điều
        first_line_match = re.search(r"Điều\s+(\d+)", raw_article_text)
        if not first_line_match:
            return None, None, None

        art_id = first_line_match.group(1)

        # 2. Chiến thuật tách Title thông minh
        # Ưu tiên: Tìm "Khoản 1." hoặc "1." làm mốc phân chia Title và Body
        clause_1_match = re.search(r"(\n|^)1\.\s", raw_article_text)

        full_art_title = ""
        content_body = ""
        # Offset tương đối nơi body bắt đầu (để cộng bù trừ nếu cần, ở đây chưa cần thiết lắm)
        body_start_rel_offset = 0

        if clause_1_match:
            # --- TRƯỜNG HỢP A: Điều luật CÓ chia khoản (Điều 7, Điều 3...) ---
            split_idx = clause_1_match.start()
            if clause_1_match.group(1) == "\n":
                split_idx += 1

            title_segment = raw_article_text[:split_idx].strip()
            # Nối các dòng title bị ngắt (word wrap) thành 1 dòng
            full_art_title = title_segment.replace("\n", " ")

            # Nội dung body giữ nguyên từ "1. ..."
            content_body = raw_article_text[split_idx:].strip()
            body_start_rel_offset = split_idx

        else:
            # --- TRƯỜNG HỢP B: Điều luật KHÔNG chia khoản (Điều 1, Điều 2...) ---
            lines = raw_article_text.split("\n")
            if not lines:
                return art_id, "", ""

            # Dòng đầu tiên chắc chắn là một phần của title
            title_parts = [lines[0].strip()]
            body_start_idx = 1

            # Check các dòng tiếp theo
            for k in range(1, len(lines)):
                line = lines[k].strip()
                if not line:
                    continue

                # Nếu dòng bắt đầu bằng chữ thường -> Là phần dư của title dòng trên
                if line[0].islower():
                    title_parts.append(line)
                    body_start_idx = k + 1
                else:
                    # Gặp chữ Hoa hoặc Số -> Bắt đầu nội dung Body -> Dừng
                    break

            full_art_title = " ".join(title_parts)
            content_body = "\n".join(lines[body_start_idx:]).strip()

            # Tính offset tương đối (tương đối)
            # Find location of content body in raw text to be precise
            idx = raw_article_text.find(content_body)
            if idx != -1:
                body_start_rel_offset = idx

        # Clean up lần cuối
        full_art_title = re.sub(r"\s+", " ", full_art_title).strip()

        # Fallback: Nếu body rỗng (lỗi format), lấy title làm body để không mất dữ liệu
        if not content_body:
            content_body = full_art_title

        return art_id, full_art_title, content_body, body_start_rel_offset

    def process(self):
        print(f"🚀 Bắt đầu xử lý file: {self.pdf_path}")

        # Determine actual pages to process
        total_pages = len(self.doc)
        pages_to_process = (
            min(self.max_pages, total_pages) if self.max_pages else total_pages
        )

        if self.max_pages:
            print(f"📋 Giới hạn xử lý: {pages_to_process}/{total_pages} trang")

        full_text = ""
        current_offset = 0
        self.page_offset_map = []  # Reset map
        print(f"📄 Đang đọc PDF: Tách nội dung chính và Footnote...")

        # 1. Duyệt qua từng trang để tách Content và Footnote ngay từ đầu
        for i, page in enumerate(self.doc):
            if i >= pages_to_process:
                break

            page_num = i + 1
            clean, note = self.get_page_content_and_footnotes(page)

            start_pos = current_offset
            # Lưu ý: clean string + "\n"
            text_len = len(clean) + 1
            end_pos = start_pos + text_len

            # Lưu map: Trang i+1 chứa text từ start_pos đến end_pos
            self.page_offset_map.append(
                {"page": i + 1, "start": start_pos, "end": end_pos}
            )

            full_text += clean + "\n"
            current_offset = end_pos

            # Lưu footnote vào map nếu có
            if note:
                self.page_footnotes_map[page_num] = note

        print(f"✓ Đã đọc xong {pages_to_process} trang. Đã lưu index Footnote.")

        # 2. Pattern bắt các tiêu đề cấu trúc (Hierarchy)
        # Regex này tìm dòng bắt đầu bằng Chương, Mục hoặc Điều
        hierarchy_pattern = (
            r"(?m)^(Chương\s+[IVXLCDM]+|Mục\s+\d+|Điều\s+(\d+)\.)\s+(.*)"
        )

        matches = list(re.finditer(hierarchy_pattern, full_text))
        self.log_structure_hierarchy(matches)
        print(f"⏳ Bắt đầu xử lý chi tiết...\n")

        for i, match in enumerate(matches):
            marker_type = match.group(1)  # Chương I, Mục 1, Điều 1.
            content_title = match.group(3).strip()

            # Progress indicator every 10 items or for articles
            if i % 10 == 0 or marker_type.startswith("Điều"):
                progress_pct = (i / len(matches)) * 100
                print(
                    f"📍 [{i+1}/{len(matches)} - {progress_pct:.1f}%] {marker_type} - {content_title[:60]}..."
                )

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
                end_idx = (
                    matches[i + 1].start() if i + 1 < len(matches) else len(full_text)
                )

                # Offset bắt đầu của Điều trong toàn bộ văn bản
                article_global_start = match.start()

                raw_article_text = full_text[article_global_start:end_idx].strip()
                art_id, full_art_title, content_body, body_rel_offset = (
                    self._extract_article_info(raw_article_text)
                )

                if not art_id:
                    continue  # Bỏ qua nếu không tìm thấy ID

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

                # Tinh chỉnh offset truyền vào recursive_split
                # recursive_split xử lý trên content_body, nên base_offset phải cộng thêm phần tiêu đề đã cắt
                final_body_offset = article_global_start + body_rel_offset

                # Gọi hàm cắt
                chunks = self.recursive_split(
                    {
                        "id": art_id,
                        "title": full_art_title,
                        "content": content_body,
                        "metadata": meta,
                    },
                    base_offset=final_body_offset,  # [FIX] Truyền offset chính xác
                )
                self.chunks.extend(chunks)
                print(
                    f"   ✓ Điều {art_id}: {len(chunks)} chunks | Tổng: {len(self.chunks)}"
                )

            # Checkpoint every 50 items
            if i > 0 and (i + 1) % 50 == 0:
                print(
                    f"\n🎯 Checkpoint: {i+1}/{len(matches)} ({(i+1)/len(matches)*100:.1f}%) - {len(self.chunks)} chunks tổng\n"
                )

        print(f"\n✅ Hoàn thành! Tổng cộng {len(self.chunks)} chunks được tạo ra.")
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

        # Page 218 is image, so fitz can not load content, temp handle this way
        # Remove the last item from final_data
        if final_data:
            final_data.pop()
            print(f"🗑️ Đã xóa item cuối cùng. Còn lại: {len(final_data)} chunks")

        # Load and concatenate content from law_content_page_128.json
        EXTERNAL_JSON_FILE = "law_content_page_128.json"
        try:
            with open(EXTERNAL_JSON_FILE, "r", encoding="utf-8") as f:
                external_data = json.load(f)

            if isinstance(external_data, list):
                final_data.extend(external_data)
                print(f"➕ Đã thêm {len(external_data)} chunks từ {EXTERNAL_JSON_FILE}")
                print(f"📊 Tổng cộng sau khi ghép: {len(final_data)} chunks")
            else:
                print(
                    f"⚠️ Cảnh báo: {EXTERNAL_JSON_FILE} không phải là array, bỏ qua việc ghép"
                )

        except FileNotFoundError:
            print(
                f"⚠️ Không tìm thấy file {EXTERNAL_JSON_FILE}, tiếp tục với dữ liệu hiện tại"
            )
        except json.JSONDecodeError as e:
            print(f"❌ Lỗi đọc JSON từ {EXTERNAL_JSON_FILE}: {e}")

        # Xuất kết quả
        OUTPUT_FILE = "land_law_chunks_final.json"
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(final_data, f, ensure_ascii=False, indent=2)

        print(f"💾 Dữ liệu đã được lưu vào: {OUTPUT_FILE}")

    except Exception as e:
        print(f"❌ Lỗi: {e}")
