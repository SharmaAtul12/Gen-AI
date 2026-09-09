# GenAI Cohort - Class 04

# Retrieval-Augmented Generation (RAG) with LangChain, OpenAI Embeddings, and Qdrant

## 1. Introduction

In the previous classes we learned how to talk to LLMs directly and how to prompt them well. But every LLM has two big limitations:

1. It only knows what it was trained on. It has **no knowledge of your private documents** (a company PDF, an internal wiki, your notes).
2. It has a limited context window, so you cannot just paste a 500-page book into every prompt.

This class solves both problems using a technique called **RAG - Retrieval-Augmented Generation**.

> RAG means: before answering, first *retrieve* the most relevant pieces of your own documents, then *give* those pieces to the LLM so it can generate an accurate, grounded answer.

In this class we build a working RAG system that can answer questions about a PDF (`software.pdf`) and even tell you which page the answer came from.

By the end you will understand:

- What embeddings and vector databases are
- How to split and index a PDF into a vector store (Qdrant)
- How to retrieve relevant chunks for a user question
- How to feed those chunks to an LLM to produce a grounded answer

---

## 2. The Core Problem RAG Solves

Imagine you ask a plain LLM:

> "What is software prototyping according to my software.pdf?"

The model has never seen your PDF, so it will either guess or hallucinate.

RAG fixes this by adding a retrieval step **before** the model answers:

```text
Question -> find relevant pages in YOUR documents -> give those pages + question to LLM -> grounded answer
```

The model no longer relies on memory. It answers based on the actual content you retrieved.

---

## 3. Key Concepts (The Building Blocks)

Before reading the code, you need four ideas.

### 3.1 Embeddings

An **embedding** is a list of numbers (a vector) that represents the *meaning* of a piece of text. Texts with similar meaning get similar vectors.

```text
"software prototyping"      -> [0.12, -0.87, 0.33, ...]
"building a quick model"    -> [0.14, -0.85, 0.31, ...]   (close = similar meaning)
"banana bread recipe"       -> [0.91,  0.02, -0.44, ...]  (far = different meaning)
```

We use OpenAI's `text-embedding-3-small` model to create these vectors.

### 3.2 Vector Database (Qdrant)

A **vector database** stores embeddings and lets you search by *similarity* instead of exact keywords. Ask it "what is closest in meaning to this question?" and it returns the nearest vectors fast.

In this class the vector database is **Qdrant**, running locally in Docker.

### 3.3 Chunking

A PDF is too big to embed as one piece. We split it into smaller **chunks** (here, one document per page). Each chunk gets its own embedding, so retrieval can return just the relevant pages.

### 3.4 Similarity Search / Retrieval

When a user asks a question, we embed the question and ask Qdrant for the **top-k** most similar chunks. Those chunks become the context for the LLM.

### The two phases of RAG

```text
PHASE 1 - INDEXING (done once, ahead of time)
PDF -> load -> chunk -> embed -> store in Qdrant

PHASE 2 - QUERYING (done every time a user asks something)
Question -> embed -> search Qdrant -> get top chunks -> send to LLM -> answer
```

`indexing.js` handles Phase 1. `query.js` handles Phase 2.

---

## 4. Project Setup

### 4.1 Dependencies (`package.json`)

```json
{
  "type": "module",
  "dependencies": {
    "@langchain/community": "^1.1.29",
    "@langchain/core": "^1.2.2",
    "@langchain/openai": "^1.5.4",
    "@langchain/qdrant": "^1.0.3",
    "@langchain/textsplitters": "^1.0.1",
    "langchain": "^1.5.3",
    "openai": "^6.45.0",
    "pdf-parse": "^2.4.5",
    "dotenv": "^17.4.2"
  }
}
```

Key packages:

- `langchain` and `@langchain/*` - the framework that glues loaders, embeddings, and vector stores together.
- `@langchain/openai` - OpenAI embeddings integration.
- `@langchain/qdrant` - Qdrant vector store integration.
- `@langchain/community` - community loaders, including the PDF loader.
- `pdf-parse` - the underlying library that reads PDF text.
- `openai` - used directly to call the chat model when generating the final answer.
- `dotenv` - loads the OpenAI API key from `.env`.

Install:

```bash
npm install
```

### 4.2 Environment variables (`.env`)

```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
```

### 4.3 Running Qdrant with Docker (`docker-compose.yml`)

```yaml
services:
  qdrant:
    image: qdrant/qdrant
    ports:
      - 6333:6333
```

This tells Docker to download and run the official Qdrant image, exposing it on port `6333`. That is why the code connects to `http://localhost:6333`.

Start it:

```bash
docker compose up -d
```

Now a Qdrant vector database is running locally, ready to store and search embeddings.

---

## 5. Phase 1 - Indexing the PDF (`RAG/indexing.js`)

This script reads the PDF, turns each page into an embedding, and stores everything in Qdrant.

```js
import 'dotenv/config';
import {PDFLoader} from '@langchain/community/document_loaders/fs/pdf';
import {OpenAIEmbeddings} from '@langchain/openai'
import {QdrantVectorStore} from '@langchain/qdrant'

async function indexPDF(filePath) {

  // Load the PDF content as documents using LangChain
  const loader = new PDFLoader(filePath);

  // Parse the PDF -> array of Document objects (one per page by default)
  const document = await loader.load();

  // Embedding model that converts text into vector embeddings
  const embeddingModel = new OpenAIEmbeddings({
    model: 'text-embedding-3-small',
    apiKey: process.env.OPENAI_API_KEY
  });

  // Connect to the vector store where embeddings will be stored
  const vectorStore = await QdrantVectorStore.fromExistingCollection(
    embeddingModel,
    {
      url: 'http://localhost:6333',
      collectionName: 'software-docs'
    }
  );

  // Generate embeddings for each document and store them in Qdrant
  await vectorStore.addDocuments(document)

  console.log(`All the documents are Indexed ...................`)
}

indexPDF('./software.pdf')
```

### Step-by-step explanation

1. **Load the PDF** - `new PDFLoader(filePath)` creates a loader for the file. `await loader.load()` reads the PDF and returns an array of `Document` objects, **one per page by default**. Each document carries the page text plus metadata (source file, page number).
2. **Create the embedding model** - `OpenAIEmbeddings` with `text-embedding-3-small`. This is what converts each page's text into a vector.
3. **Connect to Qdrant** - `QdrantVectorStore.fromExistingCollection(...)` connects to the local Qdrant server and points at a collection named `software-docs` (a collection is like a table for vectors).
4. **Store the documents** - `vectorStore.addDocuments(document)` embeds every page and saves the vectors (plus text and metadata) into Qdrant.
5. **Confirmation** - prints `All the documents are Indexed ...................`.

### Indexing flow diagram

```text
software.pdf
   |
   v
PDFLoader.load()          -> [page1 doc, page2 doc, ... pageN doc]
   |
   v
OpenAIEmbeddings          -> each page becomes a vector
   |
   v
QdrantVectorStore.addDocuments()
   |
   v
Qdrant collection "software-docs"  (vectors + text + metadata stored)
```

### Run it

```bash
node indexing.js
```

You only need to run this once per document (or whenever the PDF changes).

---

## 6. Phase 2 - Querying the PDF (`RAG/query.js`)

This script takes a user question, finds the most relevant pages in Qdrant, and asks the LLM to answer using only those pages.

```js
import 'dotenv/config';
import {OpenAIEmbeddings} from '@langchain/openai'
import {QdrantVectorStore} from '@langchain/qdrant'
import {OpenAI} from 'openai'

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function query(userQuery) {

  // 1. Same embedding model used during indexing (this is important!)
  const embeddingModel = new OpenAIEmbeddings({
    model: 'text-embedding-3-small',
    apiKey: process.env.OPENAI_API_KEY
  });

  // Connect to the same Qdrant collection
  const vectorStore = await QdrantVectorStore.fromExistingCollection(
    embeddingModel,
    {
      url: 'http://localhost:6333',
      collectionName: 'software-docs'
    }
  );

  // 2. Create a retriever -> similarity search, top 5 most relevant docs
  const vectorRetreiver = await vectorStore.asRetriever({k: 5})

  // 3. Embed the query and retrieve the most similar documents
  const results = await vectorRetreiver.invoke(userQuery)

  // 4. Feed those chunks + user query to the LLM to generate a response
  const SYSTEM_PROMPT = `
    You are an expert in answering user queries based on the provided context. Use the context to answer the question.
    If the answer is not in the context, say "I don't know ... this is not mentioned in the PDF". Do not make up an answer.

    Always provide the answer in a concise manner, and tell the user which page number the answer is found in the PDF with the PDF name.

    User Documents :
    ${results.map(res => JSON.stringify({
        pageContent: res.pageContent,
        pageNumber: res.metadata.loc.pageNumber,
        pdfName: res.metadata.source
    })).join('\n\n')}

    User Query : ${userQuery}
  `;

  const llmResponse = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userQuery }
    ]
  });

  console.log("LLM Response : ", llmResponse.choices[0].message.content)
}

query('What is software prototyping ?');
```

### Step-by-step explanation

1. **Same embedding model** - we must embed the question with the **exact same model** used during indexing. If the models differ, the vectors are not comparable and search results are meaningless. This is a critical RAG rule.
2. **Connect to the same collection** - `software-docs`, so we search the vectors we stored earlier.
3. **Create a retriever** - `asRetriever({k: 5})` builds a retriever that returns the top 5 most similar chunks.
4. **Retrieve** - `vectorRetreiver.invoke(userQuery)` embeds the question and runs a similarity search in Qdrant. `results` is an array of the 5 closest page chunks, each with `pageContent` and `metadata` (page number, source file).
5. **Build the system prompt** - we inject the retrieved chunks into the prompt as "User Documents". Each chunk includes its text, page number, and PDF name. The prompt also instructs the model to:
   - answer only from the provided context,
   - say "I don't know" if the answer is not there (this reduces hallucination),
   - cite the page number and PDF name.
6. **Call the LLM** - `client.chat.completions.create` with `gpt-4o`, passing the system prompt (context) and the user message (the question).
7. **Print the answer** - `llmResponse.choices[0].message.content`.

### Querying flow diagram

```text
"What is software prototyping?"
   |
   v
OpenAIEmbeddings  -> question vector
   |
   v
Qdrant similarity search (top k = 5)
   |
   v
5 most relevant page chunks (text + page number + pdf name)
   |
   v
Build SYSTEM_PROMPT (context + question + rules)
   |
   v
gpt-4o chat completion
   |
   v
Grounded answer with page citation
```

### Run it

```bash
node query.js
```

---

## 7. Example Output

Running both scripts in order produces output like this (see `RAG/output.png`):

```text
$ node indexing.js
All the documents are Indexed ...................

$ node query.js
LLM Response :  Software prototyping is described as an iterative process that emphasizes
rapid development, evaluative use, feedback, modification, learning based on feedback,
consideration of alternatives, and the concreteness of developing a "real system"
presented to real users. The boundary between prototyping and normal system development
blurs when an evolutionary development approach (such as agile) is used.
(PDF: "software.pdf", Page 49)
```

Notice the answer **cites the exact page (49) and the PDF name**. That page citation is possible because we stored page metadata during indexing and asked the model to include it. This is the hallmark of a good RAG system: answers you can trace back to the source.

---

## 8. Why "Retrieval-Augmented"?

The name describes the two halves:

- **Retrieval** - we *retrieve* the most relevant chunks from our own data using vector similarity search.
- **Augmented Generation** - we *augment* the LLM's prompt with those chunks, so its *generation* is grounded in real facts.

Without retrieval, the model guesses. With retrieval, the model reads and answers.

---

## 9. Complete End-to-End Flow

```text
                    ONE-TIME INDEXING
software.pdf -> PDFLoader -> pages -> OpenAIEmbeddings -> Qdrant("software-docs")

                    EVERY QUERY
user question -> OpenAIEmbeddings -> Qdrant search (top 5)
             -> retrieved chunks + question -> SYSTEM_PROMPT
             -> gpt-4o -> grounded answer with page citation
```

---

## 10. How to Run the Whole Project

```bash
# 1. Install dependencies
npm install

# 2. Start the Qdrant vector database (Docker must be running)
docker compose up -d

# 3. Create a .env file
#    OPENAI_API_KEY=sk-...

# 4. Index the PDF (run once)
node RAG/indexing.js

# 5. Ask a question (edit the query() call in query.js to change the question)
node RAG/query.js
```

---

## 11. Key Takeaways

1. LLMs do not know your private data; RAG bridges that gap by retrieving relevant content first.
2. Embeddings turn text into vectors that capture meaning, so similar text has similar vectors.
3. A vector database (Qdrant) stores embeddings and performs fast similarity search.
4. RAG has two phases: **indexing** (once) and **querying** (every request).
5. You **must** use the same embedding model for indexing and querying.
6. Retrieving the top-k relevant chunks and injecting them into the prompt keeps answers grounded and reduces hallucination.
7. Storing metadata (page number, source) lets the model cite exactly where an answer came from.
8. LangChain provides ready-made loaders, embedding wrappers, and vector store integrations that make all of this a few lines of code.

---

## 12. Practice Questions

1. What problem does RAG solve that a plain LLM cannot?
2. What is an embedding, and why do similar texts get similar vectors?
3. What is the role of Qdrant in this project?
4. Why must the embedding model be identical during indexing and querying?
5. What are the two phases of a RAG pipeline, and which script handles each?
6. What does `asRetriever({k: 5})` do?
7. How does the system prompt reduce hallucination?
8. How is the model able to cite the exact page number of the answer?

---

## 13. One-Line Summary

Class 04 builds a complete RAG pipeline: a PDF is chunked and embedded into a Qdrant vector database, and at query time the most relevant chunks are retrieved and fed to an LLM so it can produce accurate, source-cited answers about content it was never trained on.
