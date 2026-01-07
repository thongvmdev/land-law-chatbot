# Agentic Workflow

### Benefit of metadata

1.  **Câu hỏi có số điều cụ thể (Direct Lookup):**

    - **Logic:** Agent/LLM trích xuất số điều -> Tạo bộ lọc (Filter) -> Gọi Vector DB.
    - **Thực tế:** **Vẫn PHẢI vào Vector DB**, nhưng là truy vấn có điều kiện (Filtered Query).
      - Tại sao? Vì bạn cần lấy nội dung text (`page_content`) để LLM đọc và trả lời. Vector DB lúc này đóng vai trò như một DB thông thường (NoSQL), tìm kiếm chính xác theo `article_id`. Đây là cách nhanh nhất và chính xác nhất.
    - _Không phải là "ko vào vector DB" mà là "vào vector DB nhưng không cần tính toán vector (similarity search) nặng nề"._

2.  **Câu hỏi ngữ nghĩa (Semantic Search):**
    - **Logic:** Agent/LLM phân tích câu hỏi -> (Tùy chọn: Tự sinh metadata filter bổ trợ như `topic`, `chapter`) -> Tạo Vector Embeddings cho câu hỏi -> Gọi Vector DB (Hybrid Search hoặc Vector Search). > Check this
    - **Output:** Vector DB trả về danh sách các chunk phù hợp nhất + Metadata của chúng.
    - **LLM Synthesis:** LLM dùng nội dung chunk để trả lời, và dùng Metadata để **trích dẫn nguồn** (Điều X, Khoản Y).

**Mô hình tư duy đúng:**

- **Metadata** = Bản đồ & Mục lục (Giúp định vị nhanh, lọc nhiễu).
- **Vector** = Nội dung chi tiết (Giúp hiểu ý nghĩa).
- **Vector DB** = Kho chứa cả hai thứ trên.

**1224**: All free tasks at work. Continues spend time for Legal Proj.

[x] Revise ref flow
[x] Define for land-law
[x] Implement graph

[x] Test common

- using local ollama/server with model @cf/qwen/qwen3-embedding-0.6b first (cloudflare later) >>>> DONE
- Check config LangSmith >>>>> DONE
- MessageType >>>>> Done
- Wrong filterd relavance docs >>>>> Done
- Test with searchKwArgs/filters metadatas & LangSmith >>>>>> Done
  > Check filter interface, check wheter filter meatadata worked

[x] Test each Nodes & View LangSmith Tracing

- **Hybrid & BM25 > Research more about this.**
  [x] What is BM25 / search by keyword
  [x] How Hybrid work in vector DB & Suitable for LAW Agent.

- [x] Think more about agent graph

- [x] How Graph work, test case
  > Simple query
  > Complex query

[x] Update logic > just nessesary docs artt
[x] Optimize flow handle docs: grade / reduce

- **[x] Messages state did not store**

  > Research best practice to manage messsage history & context window
  > Define which nodes need history message

- ## **[] Consider to add node: reflecttion & grade each doc (`using LLM`) to solve problem limit tokens > In One `chat`** --> No need.

[x] Config embedding (query user) with clouldflare > Done
[x] Consider add main structure of land-legal docs as prompt template (research prompt catch)
[x] Init simple UI chat with exting template: research `ass-ui or copilotkie`
[x] Large valid docs > LLM limit issue > Should summarize if large here. > Real ctx window: > 100k
[x] Research > integrate checkpointer first then CICD

- **[] Self-host langgraph platform on VPS**

  [x] langgraphcli:up > docker by defalut > check this case
  [x] Docker: weaviate, Postgre Index and Postgre Checkpointer, FrontEnd
  [] Check (Local & Prod):

  - Ingest
  - Retrivel
    [] Ollama Clouds

- [] Evals
  - Grade using LLM to analyze
  - Consider add: grade with filter specific id from DB
  - Consider add tools: practice & improve accuracy result

**What are**
[] Reasoning Model
[] Function Calling / Tool Use Model
[] Ctx Engineering: Shor term & Long term Memories & `Messages histories mgmt > Critical, when integrate with FE`
[] Learning Skills with Deepagents > ref youtube Channel & X
[] Blog: https://blog.langchain.com/how-agents-can-use-filesystems-for-context-engineering/
[] Deep Agent on LC Udemy Course

===

- More detail steps > if free at office day > baby step to implement. > `avoid force fast`
