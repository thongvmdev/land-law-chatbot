# Land Law backend agent

This document describes the LangGraph-based land law assistant under `backend/src/`: how the graph is wired, how prompts are structured, how context is assembled and bounded, and which configuration knobs apply.

## Main graph

The workflow is implemented in `backend/src/graph/graph.ts` and compiled with a Postgres checkpointer (`PostgresSaver`) so conversations can be resumed.

**High-level flow**

1. **Contextualize** — Rewrite follow-ups into a standalone question when chat history exists.
2. **Check relevance** — Decide if the question is about Vietnamese Land Law 2024; if not, **reject** and end.
3. **Route** — Classify simple vs complex; complex questions go to **decompose**.
4. **Retrieve** — Hybrid search in Weaviate. Simple queries use one `Send`; complex queries fan out with parallel `Send` invocations per sub-query.
5. **Grade** — Filter and rank chunks by hybrid search score (no per-doc LLM grader in the hot path).
6. **Decide** — If no documents pass grading: **transform query** (with retry limit), then loop back through **check relevance**; if max retries: **no answer**; if documents exist: **generate**.
7. **Generate** — Single-pass answer or map-reduce synthesis depending on document size and token totals.

**State and input**

- Graph state is defined in `backend/src/graph/state.ts` (`AgentState`): messages, contextualized `question`, `queries`, flags (`isRelatedToLandLaw`, `isComplex`), merged `documents`, `answer`, and `loop_step` for transform retries.
- External input uses `InputStateAnnotation` (primarily `messages`).

**Node identifiers**

Constants live in `backend/src/constants.ts` as `GRAPH_NODES` (e.g. `contextualize_question`, `retrieve_documents`, …).

**Entry point**

- Factory: `buildLandLawGraph()` in `graph.ts`.
- Exported as `landLawGraph` from `backend/src/graph/index.ts` for LangServe / LangGraph (`backend/langgraph.json`, `backend/Dockerfile`).

## Prompt engineering

Prompts live in `backend/src/graph/prompts.ts` and use LangChain `ChatPromptTemplate`.

**Shared system context**

- A large Vietnamese system block (`CORE_SYSTEM_CONTEXT`) defines role, accuracy rules, legal terminology, answer structure, simple vs complex question guidance, document relevance criteria, query-optimization hints, a condensed outline of Luật Đất đai 2024, and disclaimers.
- That block is **prepended to task-specific prompts** (relevance check, routing, decomposition, grader text, query transform, generation, map/reduce, rejection) so providers that cache long stable prefixes can reuse work across steps in a session.

**Task-specific templates**

| Export | Role |
|--------|------|
| `CONTEXTUALIZE_QUESTION_PROMPT` | Standalone question from history + latest turn |
| `CHECK_LAND_LAW_RELEVANCE_PROMPT` | Structured relevance + reasoning |
| `ROUTE_QUERY_PROMPT` | Simple vs complex |
| `DECOMPOSE_QUERY_PROMPT` | 2–4 sub-queries |
| `GRADER_PROMPT` | LLM document relevance template (exported on `PROMPTS`; the live `gradeDocuments` node uses hybrid **scores** only, not this prompt) |
| `QUERY_TRANSFORM_PROMPT` | Rewrite query after empty retrieval |
| `GENERATION_PROMPT` | Final answer: documents + question + conversation history |
| `MAP_DOCUMENT_PROMPT` / `REDUCE_ANSWERS_PROMPT` | Map-reduce pipeline |
| `NO_ANSWER_PROMPT` / `REJECT_QUESTION_PROMPT` | User-facing fallbacks |

**Structured outputs**

Zod schemas in `backend/src/graph/configuration.ts` (e.g. `LandLawRelevanceSchema`, `RouteSchema`, `DecompositionSchema`, `PartialAnswerSchema`) pair with `model.withStructuredOutput(...)` in `backend/src/graph/nodes/index.ts` for predictable JSON fields from the query model.

**Collection export**

`PROMPTS` at the bottom of `prompts.ts` groups all templates for discovery.

## Context engineering

Context is built in layers: **conversation**, **retrieval**, and **generation window**.

**1. Standalone question (early in the graph)**

- `contextualizeQuestion` (`nodes/index.ts`) runs only when there is prior history (`messages.length > 1`).
- It passes **prior** messages (excluding the current user turn) through `formatConversationHistory` with `maxHistoryTokens`, then asks the query model to emit one self-contained question stored in `state.question`.
- First turn skips the LLM and uses the raw latest human message as `question`.

**2. Retrieval context**

- After routing, one or more queries hit Weaviate **hybrid** search (`retrieveDocuments`): vector + BM25 blend controlled by `searchKwargs.alpha` and related fields from base config.
- Parallel branches merge documents via `reduceDocs` in `backend/src/utils.ts` (deduplication / union behavior — see reducer on `documents` in `state.ts`).
- `gradeDocuments` keeps chunks whose metadata `score` meets `scoreThreshold`, always sorted by score; missing scores are kept as a fallback. (`minDocuments` exists on the agent config schema for future or alternate grading paths but is not read in the current `gradeDocuments` implementation.)

**3. Prompt-side legal context**

- `formatDocs` / `formatDoc` in `utils.ts` wrap chunk text with chapter/section headers from metadata and enclose all chunks in `<documents>…</documents>` for the generation prompts.

**4. History in the answer step**

- `formatConversationHistory` (`utils.ts`) walks **backwards** in human/AI pairs, filling a token budget (`maxHistoryTokens`, approximate tokens via character length). Turns that do not fit are collapsed into a short “old topics” line list instead of full text.

**5. Map-reduce when context would overflow**

- `generate` chooses **standard** vs **map-reduce** using document count, total estimated document tokens, and “any large document” vs count (`mapReduceDocThreshold`, `maxContextTokens`, `largeDocTokenThreshold` — see `nodes/index.ts`).
- Map phase runs per document; reduce phase uses `REDUCE_ANSWERS_PROMPT` with the same bounded `history` pattern as standard generation.

**6. Retry loop**

- Empty post-grade documents increment the transform path; `transformQuery` resets decomposition flags and increases `loop_step` until `maxRetries`, then `no_answer`.

## Config

Configuration splits into **base** (retrieval / embeddings) and **land-law agent** (models, thresholds, budgets).

### Base configuration (`backend/src/configuration.ts`)

- `BaseConfigurationSchema`: `embeddingModel`, `embeddingQueryUserModel`, `retrieverProvider` (Weaviate), `searchKwargs` (e.g. `limit`, `alpha` for hybrid weighting, `fusionType`, metadata flags), `k`, `searchType`.
- `getBaseConfiguration(config)` reads `RunnableConfig.configurable`, applies backwards-compat tweaks (`k` → `searchKwargs`), and normalizes snake_case keys where needed.

### Land law agent configuration (`backend/src/graph/configuration.ts`)

- Extends base schema with `LandLawAgentConfigurationSchema`:
  - **Models**: `queryModel`, `responseModel` (provider/model id strings for `loadChatModel` in `utils.ts`).
  - **Sampling**: `queryTemperature`, `responseTemperature`.
  - **Retrieval / grading**: `scoreThreshold`, `minDocuments` (schema only today), `maxSubQueries`, `docsPerSubQuery`.
  - **Retry**: `maxRetries` for query transform loop.
  - **Context / map-reduce**: `maxContextTokens`, `largeDocTokenThreshold`, `mapReduceDocThreshold`, `maxHistoryTokens`.

- `getLandLawAgentConfiguration(config)` reads `config.configurable`, converts keys from snake_case to camelCase, then `parse`s with Zod defaults.

### LangGraph graph context

- `buildLandLawGraph` passes `context: LandLawAgentConfigurationSchema` to `StateGraph`, so the same Zod shape can be supplied as graph-level configurable defaults alongside per-invocation overrides.

### Environment

- Graph compilation uses `DATABASE_URI` for the Postgres saver (`graph.ts`). Weaviate and model keys are typically env-driven from `utils.ts` / deployment; see `backend/docker-compose.yml` for local wiring.

---

**Primary source files**

| Concern | Path |
|---------|------|
| Graph topology | `backend/src/graph/graph.ts` |
| Nodes | `backend/src/graph/nodes/index.ts` |
| State | `backend/src/graph/state.ts` |
| Prompts | `backend/src/graph/prompts.ts` |
| Agent + structured-output schemas | `backend/src/graph/configuration.ts` |
| Base retrieval config | `backend/src/configuration.ts` |
| History, doc formatting, token estimates | `backend/src/utils.ts` |
