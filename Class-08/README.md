# GenAI Cohort - Class 08

# Advanced RAG: Production Architecture with Async Indexing (BullMQ + Redis), Qdrant, and Advanced Retrieval

## 1. Introduction

In Class 04 we built a simple RAG pipeline: load a PDF, embed it, store it in Qdrant, then query it. That version worked, but it was a script you ran by hand, and it did everything **synchronously** in a single process.

This class levels up to a **production-style Advanced RAG system**. It answers three real engineering questions:

1. **How do users upload documents?** -> a proper HTTP API (Express + file upload).
2. **How do we index large files without blocking the server?** -> a background **job queue** (BullMQ backed by Redis) with a separate **worker** process.
3. **How do we retrieve better, not just more?** -> **advanced retrieval techniques**: query rewriting, step-back prompting, HyDE, sub-query decomposition, and Reciprocal Rank Fusion.

By the end you will understand how to structure a scalable RAG backend and how modern retrieval squeezes far better results out of the same vector store.

---

## 2. From Simple RAG to Advanced RAG

### Simple RAG (Class 04)

```text
run script -> load PDF -> embed -> store
run script -> embed question -> search -> answer
```

Everything happens inline. If the PDF is huge, the whole program is stuck while it embeds. There is no API, no concurrency, no retry on failure.

### Advanced RAG (this class)

```text
                         API SERVER (index.js)                    WORKER (worker.js)
User --upload PDF-->  POST /index  --enqueue-->  [ Redis Queue ] --pull job--> indexPdf()
User --ask-->         POST /query  --enqueue-->  [ Redis Queue ] --pull job--> answerQuery()
User --poll-->        GET /query/:id  <--result-- (job return value stored in Redis)
```

The API server stays fast and responsive. Heavy work (parsing, embedding, searching, generating) is pushed to a **worker** that runs independently. This is the standard pattern for any long-running task in a web backend.

---

## 3. System Architecture Overview

The project has a clean separation of concerns. Each file in `src/` does one job:

| File | Responsibility |
| --- | --- |
| `config.js` | Central configuration loaded from `.env` (ports, models, chunking, retrieval knobs) |
| `index.js` | Express API server: upload endpoint, query endpoint, polling endpoint |
| `queue.js` | Defines the BullMQ queues and functions to enqueue jobs |
| `worker.js` | Background worker that consumes jobs and runs the pipelines |
| `indexer.js` | Indexing pipeline: read PDF -> chunk -> embed -> upsert to Qdrant |
| `openai.js` | Shared OpenAI client + embedding helpers |
| `qdrant.js` | Qdrant client + collection setup |
| `retriever.js` | Query pipelines: simple answer + advanced multi-query retrieval |

### High-level diagram

```text
        ┌─────────────────────────────┐
        │        Express API          │  index.js
        │  POST /index   POST /query  │
        │  GET  /query/:id            │
        └──────────────┬──────────────┘
                       │ enqueue jobs
                       v
        ┌─────────────────────────────┐
        │      Redis (BullMQ)         │  job queues: file-indexing, query
        └──────────────┬──────────────┘
                       │ pull jobs
                       v
        ┌─────────────────────────────┐
        │          Worker             │  worker.js
        │  indexPdf()  answerQuery()  │
        └───────┬─────────────┬───────┘
                │             │
        embeddings         search
                v             v
        ┌───────────┐   ┌───────────┐
        │  OpenAI   │   │  Qdrant   │
        └───────────┘   └───────────┘
```

---

## 4. Infrastructure Setup (Docker)

The system needs two services: **Qdrant** (vector database) and **Redis** (queue backing store). Both run in Docker via `docker-compose.yml`:

```yaml
services:
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333" # REST API
      - "6334:6334" # gRPC API
    volumes:
      - qdrant_data:/qdrant/storage

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  qdrant_data:
  redis_data:
```

### Key points

- **Qdrant** stores the vectors. Port `6333` is its REST API.
- **Redis** is the backing store for BullMQ. Every job goes into Redis; the worker pulls jobs from Redis.
- **Volumes** (`qdrant_data`, `redis_data`) persist data on disk so it survives container restarts.

Start both services:

```bash
npm run services:up      # docker compose up -d
```

---

## 5. Configuration (`src/config.js`)

All settings live in one place and come from `.env`. This is a best practice: no magic numbers scattered across the code.

```js
export const config = {
  port: Number(process.env.PORT) || 8000,
  redis: { host: ..., port: ... },
  qdrant: { url: ..., collection: "documents" },
  openai: {
    apiKey: ...,
    embeddingModel: "text-embedding-3-small",
    embeddingDimensions: 1536,
    chatModel: "gpt-4o-mini",
  },
  chunking: { chunkSize: 1000, chunkOverlap: 200 },
  retrieval: { topK: 4, rrfK: 60, finalK: 5 },
};

export const INDEXING_QUEUE = "file-indexing";
export const QUERY_QUEUE = "query";
```

### What the important knobs mean

- `embeddingDimensions: 1536` - **must match the embedding model**. `text-embedding-3-small` produces 1536-dimensional vectors. Qdrant's collection is created with exactly this size.
- `chunkSize: 1000`, `chunkOverlap: 200` - each chunk is ~1000 characters, and consecutive chunks overlap by 200 characters so context is not lost at chunk boundaries.
- `topK: 4` - how many candidates to pull from Qdrant per query variant.
- `rrfK: 60` - the constant used in Reciprocal Rank Fusion (explained in section 10).
- `finalK: 5` - how many chunks to keep after fusing all the variant results.

The `.env.example` file documents every variable so a new developer can copy it to `.env` and fill in their key.

---

## 6. The API Server (`src/index.js`)

This is an Express server with three routes plus a health check.

### 6.1 File upload with Multer

```js
const upload = multer({
  storage,                                  // save to /uploads with a unique name
  limits: { fileSize: 25 * 1024 * 1024 },   // 25 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") return cb(null, true);
    cb(new Error("Only PDF files are allowed"));
  },
});
```

**Multer** is middleware that handles `multipart/form-data` (file uploads). Here it:
- stores uploaded PDFs on disk with a unique name (`timestamp-uuid.pdf`),
- rejects files larger than 25 MB,
- rejects anything that is not a PDF.

### 6.2 `POST /index` - upload and enqueue

```js
app.post("/index", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No PDF file uploaded" });

  const job = await enqueueIndexingJob({
    filePath: req.file.path,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });

  return res.status(202).json({ message: "File queued for indexing", jobId: job.id, ... });
});
```

Notice the response code: **`202 Accepted`**, not `200 OK`. This means "I have accepted your request and will process it later." The server does **not** wait for indexing to finish. It just drops a job on the queue and immediately returns a `jobId`. This is the whole point of the async architecture.

### 6.3 `POST /query` - ask a question

```js
app.post("/query", async (req, res) => {
  const query = req.body?.query;
  if (typeof query !== "string" || query.trim().length === 0) {
    return res.status(400).json({ error: "Body must include a non-empty 'query' string" });
  }
  const job = await enqueueQueryJob({ query: query.trim() });
  return res.status(202).json({ message: "Query queued", jobId: job.id, poll: `/query/${job.id}` });
});
```

Same pattern: validate input, enqueue a job, return a `jobId` and a URL to poll for the result.

### 6.4 `GET /query/:id` - poll for the result

```js
app.get("/query/:id", async (req, res) => {
  const job = await queryQueue.getJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });

  const state = await job.getState();
  if (state === "completed") return res.json({ status: state, result: job.returnvalue });
  if (state === "failed")    return res.json({ status: state, error: job.failedReason });
  return res.json({ status: state }); // waiting | active | delayed | paused
});
```

Because the answer is computed asynchronously, the client **polls** this endpoint. It keeps checking until the job state becomes `completed`, then reads `result` (the value the worker returned).

### Request lifecycle

```text
POST /query {query}  -> 202 { jobId }
GET  /query/:id      -> { status: "waiting" }
GET  /query/:id      -> { status: "active" }
GET  /query/:id      -> { status: "completed", result: { answer, sources } }
```

---

## 7. The Job Queue (`src/queue.js`)

BullMQ is a job queue library that uses Redis. It lets us hand off work to be processed later, with retries and persistence.

```js
export const connection = {
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null, // required by BullMQ
};

export const indexingQueue = new Queue(INDEXING_QUEUE, { connection });
export const queryQueue = new Queue(QUERY_QUEUE, { connection });

export async function enqueueIndexingJob(payload) {
  return indexingQueue.add("index-file", payload, {
    attempts: 3,                                    // retry up to 3 times
    backoff: { type: "exponential", delay: 2000 },  // wait longer between retries
    removeOnComplete: 100,
    removeOnFail: 500,
  });
}

export async function enqueueQueryJob(payload) {
  return queryQueue.add("run-query", payload, {
    attempts: 2,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { age: 3600, count: 1000 }, // keep results 1h so client can poll
    removeOnFail: { age: 3600, count: 1000 },
  });
}
```

### Why a queue at all?

- **Non-blocking:** the API returns instantly; the heavy work happens elsewhere.
- **Reliability:** if a job fails (network blip, OpenAI timeout), BullMQ **retries** it automatically with exponential backoff.
- **Scalability:** you can run multiple workers to process more jobs in parallel.
- **Persistence:** jobs live in Redis, so a server restart does not lose queued work.

---

## 8. The Worker (`src/worker.js`)

The worker is a **separate process** (`npm run worker`) that listens to both queues and executes the actual pipelines.

```js
const indexingWorker = new Worker(
  INDEXING_QUEUE,
  async (job) => {
    const result = await indexPdf({
      filePath: job.data.filePath,
      originalName: job.data.originalName,
    });
    return result;
  },
  { connection, concurrency: 2 }   // process 2 indexing jobs at once
);

const queryWorker = new Worker(
  QUERY_QUEUE,
  async (job) => {
    const result = await answerQuery(job.data.query);
    return result;
  },
  { connection, concurrency: 4 }   // process 4 query jobs at once
);
```

### Key points

- Two workers, one per queue. Each pulls jobs from Redis and runs the matching function.
- `concurrency` controls how many jobs run at the same time (indexing is heavier, so fewer at once).
- The **return value** of the worker function becomes `job.returnvalue`, which the `/query/:id` endpoint serves back to the client.
- Event listeners log when jobs `completed` or `failed`.

Because the worker is separate from the API, you run **two processes**:

```bash
npm start    # the API server (index.js)
npm run worker   # the worker (worker.js)
```

---

## 9. The Indexing Pipeline (`src/indexer.js`)

This runs inside the worker when an indexing job is picked up.

### 9.1 Read the PDF

```js
async function readPdfText(filePath) {
  const buffer = await fs.readFile(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}
```

### 9.2 Chunk the text (with overlap)

```js
export function chunkText(text, chunkSize = 1000, overlap = 200) {
  const clean = text.replace(/\s+/g, " ").trim();
  const chunks = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + chunkSize, clean.length);
    // Try to end on a space so we don't cut a word in half.
    if (end < clean.length) {
      const lastSpace = clean.lastIndexOf(" ", end);
      if (lastSpace > start) end = lastSpace;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = end - overlap; // step forward, keeping `overlap` chars of context
  }
  return chunks;
}
```

**Why overlap?** If a sentence is split exactly at a chunk boundary, its meaning could be lost. Overlapping the last 200 characters into the next chunk keeps the context continuous.

```text
Chunk 1: [.................1000 chars.................]
Chunk 2:                        [overlap 200][.......next 800.......]
```

### 9.3 Embed and upsert to Qdrant

```js
export async function indexPdf({ filePath, originalName }) {
  const collection = await ensureCollection();
  const text = await readPdfText(filePath);
  const chunks = chunkText(text);
  if (chunks.length === 0) return { chunks: 0, message: "No extractable text" };

  const vectors = await embedTexts(chunks);

  const points = chunks.map((chunk, i) => ({
    id: crypto.randomUUID(),
    vector: vectors[i],
    payload: { text: chunk, source: originalName, filePath, chunkIndex: i },
  }));

  await qdrant.upsert(collection, { wait: true, points });
  return { chunks: chunks.length, collection };
}
```

Each chunk becomes a **point** in Qdrant: a unique id, its vector, and a `payload` holding the original text and metadata (source file, chunk index). The payload is what we read back later to build the answer.

### Indexing flow

```text
PDF file -> readPdfText -> chunkText -> embedTexts (OpenAI) -> qdrant.upsert
```

---

## 10. Advanced Retrieval (`src/retriever.js`)

This is the heart of "Advanced" RAG. Simple RAG embeds the raw question and searches once. That is fragile: a poorly worded or narrow question retrieves poor chunks. This file implements several techniques to retrieve **much better** context.

### 10.1 Query Rewriting, Step-Back, and Sub-Queries

`queryRewriting()` asks the chat model (using **structured JSON output**) to transform the user's question into three helpful variants:

- **stepBack** - a broader, higher-level question. Answering the bigger question first surfaces useful background. (Step-back prompting.)
- **rewritten** - the same query with typos/grammar fixed and made explicit and self-contained.
- **subQueries** - the query decomposed into exactly 3 focused sub-questions.

```js
response_format: {
  type: "json_schema",
  json_schema: {
    name: "query_rewriting",
    strict: true,
    schema: { /* stepBack, rewritten, subQueries[] */ }
  }
}
```

Using `json_schema` with `strict: true` **forces** the model to return valid structured JSON, so the code can parse it reliably.

### 10.2 HyDE - Hypothetical Document Embeddings

```js
export async function hydeDocument(query) {
  // Ask the model to WRITE a short, plausible answer passage,
  // as if it were an excerpt from a real reference document.
}
```

The clever idea: instead of embedding the *question*, we ask the model to write a short *hypothetical answer*, then embed **that**. A hypothetical answer is written in the same style and vocabulary as the real documents, so its vector often lands **closer** to the real chunks in vector space than the bare question would.

```text
Question:            "what is sw prototyping"   (short, sparse)
HyDE answer:         "Software prototyping is an iterative process where..." (rich, doc-like)
                      ^ embedding this matches real document chunks better
```

### 10.3 Multi-Query Retrieval

`retrieveChunks()` ties it all together:

```js
const [{ stepBack, rewritten, subQueries }, hyde] = await Promise.all([
  queryRewriting(query),
  hydeDocument(query),
]);

const labelled = [
  { label: "rewritten", text: rewritten },
  { label: "stepBack",  text: stepBack },
  { label: "hyde",      text: hyde },
  ...subQueries.map((q, i) => ({ label: `subQuery${i + 1}`, text: q })),
];

const vectors = await embedTexts(labelled.map((q) => q.text));           // embed all variants
const resultsPerQuery = await Promise.all(vectors.map(searchByVector));  // search with each
```

So instead of one search, we run **six searches** (rewritten + stepBack + hyde + 3 sub-queries), each returning its own ranked list of chunks. Now we need to merge them intelligently.

### 10.4 Reciprocal Rank Fusion (RRF)

Different variants return different, overlapping lists. **RRF** fuses many ranked lists into one final ranking. Each chunk's fused score is:

```text
rrfScore(chunk) = sum over each list of   1 / (k + rank)
```

where `rank` is the chunk's 1-based position in that list and `k` (here 60) dampens the influence of lower ranks.

```js
function reciprocalRankFusion(rankedLists, k = 60) {
  const fused = new Map();
  for (const { label, hits } of rankedLists) {
    hits.forEach((h, index) => {
      const rank = index + 1;
      const contribution = 1 / (k + rank);
      // accumulate contribution per chunk id...
    });
  }
  return [...fused.values()].sort((a, b) => b.rrfScore - a.rrfScore);
}
```

**Why RRF works:** a chunk that ranks highly across **multiple** query variants is very likely relevant, so it bubbles to the top. A chunk that appears in only one list at a low rank contributes little. It is a simple, robust way to combine evidence from several searches without needing to normalize their raw similarity scores.

### Advanced retrieval flow

```text
                 user query
                     │
        ┌────────────┼─────────────┐
   queryRewriting                hydeDocument
   (stepBack, rewritten,         (hypothetical
    3 sub-queries)                 answer)
        └────────────┬─────────────┘
                6 query variants
                     │  embed each
                     v
            search Qdrant (per variant)
                     │  6 ranked lists
                     v
         Reciprocal Rank Fusion (RRF)
                     │
                     v
            top `finalK` chunks
```

### 10.5 The simple answer path (`answerQuery`)

The worker currently calls `answerQuery()`, a straightforward RAG path: embed the query, search Qdrant, build a context block from the retrieved chunks, and ask `gpt-4o-mini` to answer using **only** that context (with instructions to say "I don't know" if the answer is not present, reducing hallucination). The advanced `retrieveChunks()` pipeline is available in the same file to plug in when you want the multi-query + RRF power.

```js
messages: [
  { role: "system", content: "Answer using ONLY the provided context. If not present, say you don't know." },
  { role: "user",   content: `Context:\n${context}\n\nQuestion: ${query}` },
]
```

---

## 11. Conceptual Extensions (from `Docs/`)

The class also discussed ideas that go **beyond** classic vector RAG. Two images capture them.

### 11.1 The Persistent Wiki idea (`Docs/llmWiki.png`)

Standard RAG rediscovers knowledge on every question. It retrieves raw chunks and pieces them together each time, so nothing accumulates.

The alternative idea: the LLM **incrementally builds and maintains a persistent wiki** — a structured, interlinked set of markdown files that sits between you and the raw sources. When a new source is added, the model reads it, extracts the key information, and **integrates it into the existing wiki** (updating entity pages, revising summaries, flagging contradictions). The knowledge is compiled once and kept current, rather than re-derived on every query.

Key difference: the wiki is a **persistent, compounding artifact**. Cross-references and contradictions are already resolved, and the wiki grows richer with every source added and every question asked. (Content summarized from the class notes image.)

### 11.2 Vectorless RAG with PageIndex (`Docs/vectorlessRAG.png`)

Another approach avoids vector similarity entirely:

1. Generate a **"Table-of-Contents" tree-structure index** of the document.
2. Perform **agentic, reasoning-based retrieval through tree search** — the LLM reasons its way down the tree to the relevant node.

```text
Document -> Tree (ToC index) -> LLM reasoning walks the tree (guided by the query) -> Answer
```

Instead of "find the nearest vectors," the model **reasons** about which section is most likely to contain the answer, much like a human flipping to the right chapter. This is useful for well-structured documents where the hierarchy itself carries meaning.

---

## 12. How to Run the Whole Project

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in your OpenAI key
#    cp .env.example .env   (then set OPENAI_API_KEY)

# 3. Start Qdrant + Redis
npm run services:up

# 4. Start the API server (terminal 1)
npm start

# 5. Start the worker (terminal 2)
npm run worker
```

Then use the API:

```bash
# Upload a PDF for indexing
curl -F "file=@software.pdf" http://localhost:8000/index

# Ask a question
curl -X POST http://localhost:8000/query \
  -H "Content-Type: application/json" \
  -d '{"query":"What is software prototyping?"}'
# -> { "jobId": "42", "poll": "/query/42" }

# Poll for the answer
curl http://localhost:8000/query/42
```

---

## 13. Key Takeaways

1. Production RAG separates the **fast API** from the **slow work** using a job queue.
2. BullMQ + Redis give you async processing, automatic retries, and persistence.
3. The worker is a separate process, so the API stays responsive and the system scales.
4. `202 Accepted` + a `jobId` + a poll endpoint is the standard pattern for async APIs.
5. Chunk overlap preserves context across chunk boundaries.
6. Advanced retrieval beats simple retrieval by searching with **many query variants** (rewritten, step-back, HyDE, sub-queries) instead of one.
7. HyDE embeds a hypothetical answer, which sits closer to real documents than the bare question.
8. Reciprocal Rank Fusion merges multiple ranked lists so chunks that rank well across variants win.
9. Beyond vector RAG, ideas like a persistent LLM-maintained wiki and tree-based "vectorless" retrieval offer different tradeoffs.

---

## 14. Practice Questions

1. Why does the `/index` endpoint return `202` instead of `200`?
2. What roles do Redis and Qdrant each play in this system?
3. Why do we run the worker as a separate process from the API server?
4. What problem does chunk overlap solve?
5. What is HyDE, and why can embedding a hypothetical answer beat embedding the question?
6. Explain step-back prompting and sub-query decomposition.
7. How does Reciprocal Rank Fusion combine several ranked lists, and why is a chunk that appears in multiple lists ranked higher?
8. Why must `embeddingDimensions` match the embedding model?
9. How does the persistent-wiki idea differ from classic RAG?
10. What is "vectorless RAG with PageIndex" and when might it be useful?

---

## 15. One-Line Summary

Class 08 builds a production-grade Advanced RAG backend: an Express API accepts PDF uploads and questions, hands the heavy work to a BullMQ/Redis-backed worker, stores and searches embeddings in Qdrant, and boosts answer quality with multi-query retrieval (rewriting, step-back, HyDE, sub-queries) fused together by Reciprocal Rank Fusion.
