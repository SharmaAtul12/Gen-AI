# Gen-AI Cohort — My Learning Journey

Welcome to my Gen-AI notebook. This repository is the trail of breadcrumbs I left behind
while working through the Gen-AI cohort — the notes I scribbled, the scripts I broke and
fixed, and the small projects that slowly taught me how modern AI systems are actually
built. It reads less like a textbook and more like a travel diary: each class is a stop on
the road from "what even is a token?" to "let me orchestrate a fleet of agents that survive
crashes."

Everything here is JavaScript and Node.js first, with a little TypeScript later on, and
plenty of API-based AI integrations along the way.

> The story so far: **18 classes completed.** What started as printing tokens to a console
> has grown into RAG pipelines, autonomous agents, graph memory, durable multi-step
> workflows, standardized tool protocols, and packaged, publishable agent skills.

---

## The Story in Three Acts

The cohort naturally splits into three arcs, and looking back, each one changed how I think
about building with AI.

**Act I — Learning to Speak to Models (Classes 01–04).**
This is where I met the LLM as a raw tool. I learned that a model is really just tokens in,
tokens out, and that *how* you ask matters as much as *what* you ask. I practised prompting
styles, wired up real SDKs, and got my first taste of grounding a model in my own documents
with a simple RAG setup.

**Act II — Building Real Things (Classes 05–13).**
The training wheels came off. I built project milestones (a ChatGPT-style clone and a
NotebookLM-style clone), went deep on advanced retrieval, shipped an end-to-end RAG service
with queues and workers, and started thinking about how an agent *remembers* across turns.
The two main projects from this arc are [ChaiGPT](https://github.com/SharmaAtul12/ChaiGPT)
and [Chaibook](https://github.com/SharmaAtul12/Chaibook)
([deployed](http://chaibook-one.vercel.app/)).

**Act III — Thinking Like a Systems Engineer (Classes 14–18).**
The final act is about the plumbing that makes AI reliable and reusable. I learned to model
connected data with graph databases, run long multi-step agent workflows that don't fall
apart when a step fails, ship a real-world PR review agent, standardize tool access across AI
platforms with MCP, and finally package it all into publishable **Skills** — building and
shipping my own Next.js setup skill. This is where "AI feature" turned into "AI system."

---

## Snapshot of Where Things Stand

- All **18 classes** are complete, from LLM fundamentals to packaged, publishable Skills.
- Most folders hold runnable Node.js examples with their own dependencies and `.env` setup.
- **Class 08** is the most complete service-style project: document ingestion, a queue, a
  worker, Qdrant, and OpenAI working together.
- **Class 10** introduces TypeScript and the Agent SDK, with a proper `src/app` structure.
- **Classes 14 and 15** add the systems layer: Neo4j graph modeling and Inngest durable
  execution.
- **Class 16** is a project milestone: a GitHub PR Review Agent (full code in its own repo).
- **Class 17** builds a hands-on MCP server with both STDIO and Streamable HTTP transports.
- **Class 18** covers Claude Skills end-to-end and ships a published skill:
  [NextJS-Project-Setup-Skill](https://github.com/SharmaAtul12/NextJS-Project-Setup-Skill).
- Project classes (05, 06, 11, 12, 13, 16) are milestone markers — the full code lives in
  their dedicated project repositories ([ChaiGPT](https://github.com/SharmaAtul12/ChaiGPT),
  [Chaibook](https://github.com/SharmaAtul12/Chaibook), and
  [Github-PR-Review-Agent](https://github.com/SharmaAtul12/Github-PR-Review-Agent)).

---

## Class-by-Class Overview

| Class | Focus | Key Details |
| --- | --- | --- |
| Class 01 | LLM basics | Tokens, prompt basics, `hello.js`, `token.js`. |
| Class 02 | Prompting techniques | Zero-shot, few-shot, CoT, tool use, role-play, weather app. |
| Class 03 | SDK integrations | OpenAI, Claude, and Gemini SDKs, plus streaming and interview practice. |
| Class 04 | Docker + RAG basics | Containers with `docker-compose`, simple indexing and querying. |
| Class 05 | Project 1, Part 1 | ChatGPT clone milestone (full code in [ChaiGPT](https://github.com/SharmaAtul12/ChaiGPT) repo). |
| Class 06 | Project 1, Part 2 | ChatGPT clone continued. |
| Class 07 | Advanced RAG | Query rewriting, ranking, HyDE, guardrails, retrieval routing. |
| Class 08 | End-to-end RAG project | Ingestion, queueing, workers, Qdrant, and OpenAI. |
| Class 09 | Memory in AI agents | Short-term vs long-term memory, extraction, eviction. |
| Class 10 | Agent SDK | TypeScript app structure, config, and the Agent SDK. |
| Class 11 | Project 2, Part 1 | NotebookLM clone milestone (full code in [Chaibook](https://github.com/SharmaAtul12/Chaibook) repo). |
| Class 12 | Project 2, Part 2 | NotebookLM clone continued. |
| Class 13 | Project 2, Part 3 | NotebookLM clone continued. |
| Class 14 | Graph databases | Neo4j and Cypher, graph memory agent assignment. |
| Class 15 | Durable execution | Inngest for reliable, multi-step agent workflows. |
| Class 16 | GitHub PR Review Agent | Project milestone (full code in Github-PR-Review-Agent repo). |
| Class 17 | Model Context Protocol | MCP server with STDIO and Streamable HTTP transports. |
| Class 18 | Skills (Claude Skills) | Building, testing, packaging, and publishing skills; shipped [NextJS-Project-Setup-Skill](https://github.com/SharmaAtul12/NextJS-Project-Setup-Skill). |

---

## The Detailed Journey

### Class 01 — First Contact with the LLM
Where it all began. I learned how large language models work at the most basic level:
everything is a token, and the model just predicts the next one. The first scripts
(`hello.js`, `token.js`) demystified tokenization and made an abstract idea feel concrete.
Takeaway: an LLM is not magic, it is arithmetic over tokens.

### Class 02 — Learning How to Ask
This class was all about prompting as a skill. I worked through the classic patterns:
- **Zero-shot** — just ask (`01-zero.js`)
- **Few-shot** — show examples first (`02-few-shot.js`)
- **Chain-of-thought** — make the model reason step by step (`03-cot.js`)
- **CoT with tools** — reasoning plus actions (`04-cot-tool.js`)
- **Role-play** — give the model a persona (`05-role-play.js`)

I also built a small weather app exercise to see prompting in a tiny real project. The
`prompts.md` file collects the patterns I want to reuse.

### Class 03 — Plugging Into Real Providers
Time to stop using toy calls and talk to real APIs. I integrated the **OpenAI**, **Claude**,
and **Gemini** SDKs, then learned to **stream** responses token-by-token instead of waiting
for the whole reply. The `Interviews/` screenshots capture practice questions from this
stretch. Lesson learned: every provider has its own personality and quirks, but the mental
model is shared.

### Class 04 — Docker and My First RAG
Two big ideas landed here. First, **Docker** and `docker-compose` for running dependencies
in containers instead of installing everything locally. Second, my first **RAG** workflow:
`indexing.js` to chunk and store a PDF (`software.pdf`), and `query.js` to retrieve and
answer questions against it. This was the first time the model answered using *my* data
instead of its training memory.

### Class 05 — Project 1, Part 1 (ChatGPT Clone)
The first project milestone. This folder is a marker for Part 1 of the ChatGPT-style clone;
the full implementation lives in the [**ChaiGPT**](https://github.com/SharmaAtul12/ChaiGPT)
repository. Starting a real project made all the earlier fundamentals click.

### Class 06 — Project 1, Part 2
The project continues. Part 2 builds on the foundation from Part 1, still tracked in the
[ChaiGPT](https://github.com/SharmaAtul12/ChaiGPT) repo. Milestone folders like this keep
the cohort progress readable at a glance.

### Class 07 — Advanced RAG
Basic RAG retrieves and answers. Advanced RAG makes that pipeline *smart*. I studied how a
production-grade system:
- **understands the query** before searching,
- **rewrites vague queries** (e.g. "dead zone node" → "temporal dead zone in JavaScript"),
- uses **HyDE** to generate a hypothetical answer and search with it,
- **ranks and routes** retrieval across multiple sources,
- and adds **guardrails** to protect the system.

The `StepBack.pdf` and detailed notes turned a fuzzy topic into a memorable pipeline.

### Class 08 — End-to-End RAG Service
The most complete project-style example in the repo. Instead of one script, this is a real
service split across `src/`:
- `indexer.js` — ingest and index documents
- `qdrant.js` — the vector store
- `openai.js` — embeddings and generation
- `queue.js` and `worker.js` — background processing so ingestion doesn't block requests
- `retriever.js` — pull relevant context at query time
- `config.js` and `index.js` — wiring it all together

With `docker-compose.yml` bringing up the infrastructure, this class taught me how RAG looks
when it has to survive real traffic.

### Class 09 — Giving Agents a Memory
A raw LLM is stateless — it forgets everything between calls. This class was about faking and
then genuinely building memory:
- **Short-term memory** via message history and a sliding window,
- **Long-term memory** in SQL, vector, and graph stores,
- **Memory extraction** to keep only the facts worth saving,
- and **eviction policies** so memory doesn't grow forever.

The one-liner I kept: an agent *feels* like it remembers because the app decides exactly what
context to send.

### Class 10 — Stepping Up to the Agent SDK
This class introduced the **Agent SDK** and, with it, **TypeScript**. I set up a proper
project structure (`src/app/agent.ts`, `src/app/config.ts`, `src/index.ts`) with `tsconfig.json`
and a `dist/` build output. The notes folder captures the design patterns that make agents
tick — the Builder pattern, the initial flow, the interceptor/observer flow, and the tool
flow. This was the shift from calling a model to *architecting* an agent.

### Class 11 — Project 2, Part 1 (NotebookLM Clone)
The second project begins. This is the milestone marker for Part 1 of a NotebookLM-style
clone; the full code lives in the [**Chaibook**](https://github.com/SharmaAtul12/Chaibook)
repository ([live demo](http://chaibook-one.vercel.app/)). A more ambitious project that
pulls together retrieval, memory, and agents.

### Class 12 — Project 2, Part 2
The Chaibook clone continues into Part 2, building on the foundation from the previous
milestone.

### Class 13 — Project 2, Part 3
Part 3 rounds out the Chaibook clone milestones. Three parts of steady, incremental
progress on a real product-shaped project.

### Class 14 — Thinking in Graphs (Neo4j + Cypher)
A mindset shift: sometimes the *relationships* matter more than the records. This class
covered why graph databases exist, how they compare to SQL and NoSQL, and how to model and
query connected data with **Neo4j** and **Cypher** (`MATCH`, `CREATE`, `MERGE`, `SET`,
`DELETE`, multi-hop and variable-length traversals). The capstone assignment: build a
**graph memory agent** in Node.js that stores user context, topics, and conversations as
nodes and edges, retrieves relevant memory before answering, and runs a self-correction loop
to keep improving. This is where memory (Class 09) and structure came together.

### Class 15 — Durable Execution with Inngest
The finale of the reliability arc. When you chain agents together, everything that can go
wrong will: steps crash, APIs time out, servers restart, emails get sent twice. This class
contrasts the painful DIY approach (RabbitMQ, workers, hand-rolled retries, state tracking,
monitoring, idempotency) with **Inngest**, a durable execution engine. You write a workflow
as a series of **steps** (`step.run`, `step.sleep`), and Inngest gives you checkpointing,
automatic per-step retries, durable sleeps, and a monitoring dashboard for free. The project
is a minimal Express + Inngest app (`index.js` + `inngest/index.js`) with a `hello-agent`
function that shows a step succeeding, a durable pause, and a step that fails and retries —
without re-running earlier steps. The 80/20 lesson: let the engine handle the plumbing so
you can focus on the agent logic.

### Class 16 — GitHub PR Review Agent (Project 3)
Putting agents to work on a real developer workflow. This class produced a **GitHub PR Review
Agent** — an autonomous agent that reviews pull requests, analyzes diffs, and provides
feedback. The full implementation lives in the
[Github-PR-Review-Agent](https://github.com/SharmaAtul12/Github-PR-Review-Agent) repository.
This was the first time the agent wasn't just answering questions but actively participating
in a software engineering process.

### Class 17 — Model Context Protocol (MCP)
The standardization chapter. In 2024, every AI platform (OpenAI, Claude, Cursor, etc.) had
its own way of attaching tools — an N×M fragmentation problem. **MCP** solves this the same
way REST solved API design: one universal protocol that any tool implements once and any
agent consumes once.

I built an MCP server (`index.js`) with two transports:
- **STDIO** — the client spawns the server as a child process and communicates via
  stdin/stdout using JSON-RPC 2.0. Local, zero-network, great for dev tools.
- **Streamable HTTP** — the server runs independently on a port and any remote client
  connects via URL. Deploy once, use from anywhere.

Key concepts that landed:
- The JSON-RPC lifecycle: `initialize` → `notifications/initialized` → `tools/list` →
  `tools/call`.
- Why MCP hides implementation behind metadata (name + description + schema), just like REST
  hides controllers behind endpoints.
- **Context poisoning** — connecting 200+ tools floods the LLM context. The emerging
  **MCP Gateway** pattern applies RAG to tools: only retrieve the relevant tool on demand.
- Real-world limits: simple IoT (smart bulbs) wraps easily; secure devices with idempotency
  keys (cars) resist naïve wrapping.

The takeaway: write your tool once with MCP, and it works with Claude, OpenAI, Cursor, Google
ADK, and any future MCP-compatible agent.

### Class 18 — Skills (Claude Skills)
The packaging chapter. If MCP fixed *how* tools connect, Skills fix *how capabilities are
bundled and shared*. This class started with the limitations of raw MCP (too many tools
loading = context poisoning, network latency, server-side scalability, forced statelessness)
and introduced **Skills** as the answer: a package (`SKILL.md` + optional `scripts/`,
`references/`, `assets/`) that bundles prompts, code, docs, and even an MCP server into one
publishable unit.

Key concepts that landed:
- **Progressive disclosure** — only frontmatter metadata loads up front (Level 1), the body
  loads when the skill triggers (Level 2), and resources load on demand (Level 3+), so the
  context stays clean.
- **Local-first execution** — skills run on the downloader's machine, sidestepping the
  scalability and statelessness problems of central MCP servers.
- **Writing the frontmatter** — the `name` + `description` are the only always-loaded part,
  so the description must say *what it does* and *when to trigger it*.
- **Packaging & publishing** — turning a skill into a plugin (`.claude-plugin/plugin.json`),
  zipping it correctly, choosing between Claude Code and Claude.ai, and publishing via GitHub
  / `skills.sh` so anyone can run `npx skills add <repo>`.
- **MCP vs Connector vs Skill vs Plugin** — not competing choices but layers that stack.

The capstone: I built and published my own skill,
[**NextJS-Project-Setup-Skill**](https://github.com/SharmaAtul12/NextJS-Project-Setup-Skill),
which scaffolds a Next.js project through conversation. Install it with:

```bash
npx skills add https://github.com/SharmaAtul12/NextJS-Project-Setup-Skill
```

This is where "I use tools" turned into "I ship reusable capabilities others can install."

---

## Getting Started

1. Open the class folder you want to explore.
2. Install dependencies with `npm install` if a `package.json` is present.
3. Copy or review the environment file (`.env` or `.env.example`) and add any required API keys.
4. For classes that need infrastructure (Class 04, 08, 14, 15), start the containers or dev
   server as described in that class's notes (`docker-compose up`, `npx inngest-cli@latest dev`, etc.).
5. Run the relevant script from that folder (for example, `node 01-zero.js` or `node index.js`).

---

## Notes

- This repository is a **learning workspace**, not a production-ready application. The value
  is in the notes and the journey, not in polished deployable code.
- The structure is intentionally **class-based** so progress across the cohort is easy to
  follow, from the first token to the MCP standard.
- The main projects ([ChaiGPT](https://github.com/SharmaAtul12/ChaiGPT),
  [Chaibook](https://github.com/SharmaAtul12/Chaibook), and
  [Github-PR-Review-Agent](https://github.com/SharmaAtul12/Github-PR-Review-Agent)) live in
  their own repositories; the milestone folders here mark where each part was covered in the
  timeline.
