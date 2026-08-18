# Class 15 — Durable Execution with Inngest

This class is about **orchestrating long-running, multi-step AI agent workflows** reliably.
When you chain multiple agents together (Input Agent → Research Agent → DB Agent →
Notification Agent), a lot can go wrong: a step crashes, an API times out, the server
restarts, an email is sent twice, or you lose track of where a job stopped.

The core question from the whiteboard is:

> **"Async Architecture?"** — How do we run agents asynchronously, survive failures,
> retry safely, and know what is happening — without building all that plumbing ourselves?

Inngest is the answer. Below we walk through the problem first (life *without* Inngest),
then the solution (life *with* Inngest), then the actual code in this project.

---

## 1. Life WITHOUT Inngest — The Manual Problem

When you build an agentic pipeline by hand, you write **procedural code**: line 1, line 2,
line 3, line 4… all in one function. The moment one line fails, everything after it is lost,
and everything before it may re-run. This is the "in-flight user email" problem — if the job
dies halfway, did the user already get an email? Did we already write to the DB?

### The "Orchestration Problem"

```
Run Agent 1 (Input)            -> Async
Run Agent 2 (Research Agent)   -> Async
Run Agent 3 (DB Operations)    -> Async
Agent 4 (Notification)         -> Async
```

Running these "async" by hand means **you** now personally own all of the hard parts:

| Problem you must solve yourself | What it means |
| ------------------------------- | ------------- |
| **State Management** | Where did the workflow stop? Which agents already finished? You must persist this somewhere. |
| **Retry Mechanism** | An agent/API failed. How many times do you retry? With what backoff? Who triggers the retry? |
| **Error Handling** | One agent throws. Do you kill the whole pipeline, or resume from the failed step? |
| **Monitoring** | Is the job stuck? How long did each step take? You need dashboards/logs. |
| **Idempotency** | If step 3 re-runs, does the user get 2 emails / 2 DB rows? |
| **Orchestration** | Who decides the order and passes data between agents? |

### The DIY solution: a Queue System (RabbitMQ + Workers)

To do this properly by hand, you end up building a full **queue + worker** architecture:

```
                          ┌─────────────────────┐
                          │   State Management  │
                          │  • Retry Mechanism  │
                          │  • Error Handling   │
                          │  • Monitoring       │
                          └──────────┬──────────┘
                                     │ (you build & maintain all of this)
                                     ▼
        ┌──────────────────────────────────────────────────────┐
        │                    Queue System                       │
        │                  ┌──────────────┐                     │
        │                  │   RabbitMQ   │                     │
        │                  └──────┬───────┘                     │
        │            ┌────────────┼─────────────┐               │
        │            ▼            ▼             ▼               │
        │      ┌──────────┐ ┌──────────┐ ┌──────────┐          │
        │      │ Agent 1  │ │ Agent 2  │ │ Agent 3  │          │
        │      │  Input   │ │ Research │ │   DB     │          │
        │      │ (worker) │ │ (worker) │ │ (worker) │          │
        │      └──────────┘ └──────────┘ └──────────┘          │
        └──────────────────────────────────────────────────────┘
                     │
                     ▼  serialize / deserialize messages
              agent1 { name, age }   ← every message must be encoded,
                                        put on the queue, pulled off, decoded
```

**Scaling makes it worse.** Imagine 10 agents, each with 5 internal steps:

```
   10 Agents
 ┌───┐ ┌───┐ ┌───┐        Every one of these needs its own worker,
 │ 1 │ │ 1 │ │ 1 │        its own queue binding, its own retry/error
 │ 2 │ │ 2 │ │ 2 │        rules, and its own monitoring hookup.
 │ 3 │ │ 3 │ │ 3 │
 │ 4 │ │ 4 │ │ 4 │        Now multiply the boilerplate by 10x...
 │ 5 │ │ 5 │ │ 5 │
 └───┘ └───┘ └───┘

 Agent 1   Agent 1   Agent 1   Agent 1   Agent 1
  Input     Input     Input     Input     Input
 (worker)  (worker)  (worker)  (worker)  (worker)   ← lots of workers to run & babysit
```

**Summary of what you do manually without Inngest:**
1. Stand up and maintain a message broker (RabbitMQ).
2. Write a worker process for **every** agent/step.
3. Serialize/deserialize every message (`agent1 { name, age }`) between queues.
4. Build your own retry logic and dead-letter handling.
5. Build your own state store to know where a job is.
6. Build your own error handling to resume vs restart.
7. Build your own monitoring/dashboards.
8. Guarantee idempotency yourself so nothing runs twice.

That is a huge amount of **non-AI plumbing** before you write a single line of real agent logic.

---

## 2. Life WITH Inngest — How It Makes This Easy

Inngest is a **durable execution** engine. You write your workflow as a normal function
made of **steps**, and Inngest handles state, retries, error recovery, and monitoring for you.

> An Inngest function is a regular function wrapped with trigger + execution metadata.
> Inngest starts a run when a matching event arrives, then **records each step so failed
> work can retry from the last successful checkpoint instead of restarting from scratch.**
> *(Content rephrased from [Inngest Docs](https://www.inngest.com/docs/learn/inngest-functions) for compliance with licensing restrictions.)*

Instead of the whole RabbitMQ + workers + state DB stack, you get:

```
        ┌──────────────────────────────────────────────┐
        │                  Inngest                      │
        │                (chai-agent)                   │
        │   ┌────────────────────────────────────────┐  │
        │   │  Step 1: { code1, code2 }  ──► retried  │  │
        │   │  Step 2: { code }          ──► retried  │  │
        │   │  Step 3: { code }          ──► retried  │  │
        │   │  Step 4: { code }          ──► retried  │  │
        │   └────────────────────────────────────────┘  │
        │        Durable Executions (checkpointed)       │
        └──────────────────────────────────────────────┘
                    │
                    ▼
              Disk Write  (state is persisted after each step)
```

Each **step** runs once, caches (memoizes) its result, and retries **independently** on
failure. If step 3 fails, steps 1 and 2 are **not** re-run — Inngest replays their cached
results and resumes at step 3. That is the whole point of durable execution.
*(Concept summarized from [Inngest Steps docs](https://www.inngest.com/docs/learn/inngest-steps).)*

### What Inngest gives you for free

```
   Durable Execution   →  survives crashes/restarts, resumes from last good step
   Auto Retry          →  each step retries on its own, no queue code
   Monitoring          →  built-in dashboard for every run and step
   Event Driven Simple  →  trigger functions with a single event
```

### The 80 / 20 insight from the board

```
   80%  Inngest handles the "temp / non-AI" work
        (state, retries, errors, monitoring, orchestration)

   20%  You focus on the purely-AI orchestration
        (what each agent actually does)
```

As a developer your job shrinks to:

> **"Steps define karne hai, steps ke andar code karna hai."**
> (You just define the steps, and put your code inside each step.)

And **what is a step?**

> **Step = code which can be retried.**

That is the mental model. You stop building infrastructure and start writing agent logic.

### Before vs After

| Concern | Without Inngest (manual) | With Inngest |
| ------- | ------------------------ | ------------ |
| Orchestration | RabbitMQ + workers you write | `inngest.createFunction` with steps |
| State | Your own DB / tracking table | Automatic checkpointing |
| Retries | Hand-written backoff + DLQ | `step.run` retries automatically |
| Error recovery | Restart whole job | Resume from failed step |
| Delays / waits | Cron + polling | `step.sleep('5s')` |
| Monitoring | Build dashboards | Built-in dev server & dashboard |
| Idempotency | You enforce it | Steps run once, results cached |

---

## 3. Code Walkthrough — This Project's Implementation

This project is a minimal Express + Inngest app that runs a small agent workflow.

### Files

```
Class-15/
├── index.js              # Express server that exposes Inngest over HTTP
├── inngest/
│   └── index.js          # Inngest client + the durable function (the workflow)
└── package.json          # deps: express, inngest
```

### 3.1 `inngest/index.js` — the client and the durable function

```js
import { Inngest } from "inngest";

// 1) Create a client to send and receive events
export const inngest = new Inngest({ id: "my-app" });

// 2) Define a durable function
const helloAgentFunction = inngest.createFunction(
  {
    id: "hello-agent",
    triggers: [{ event: 'chai/hello.agent' }],   // runs when this event fires
  },
  async function ({ step, event }) {

    // STEP 1 — Input Agent: collect user input.
    // Wrapped in step.run so its result is checkpointed & retriable.
    await step.run('collect-user-input', async () => {
      console.log("I am running and collecting user input");
      return { name: "Atul", lastname: "Sharma" };
    });

    // WAIT — durable sleep. The function pauses without holding compute.
    // After 5s Inngest resumes exactly here.
    await step.sleep('wait-for-research', '5s');

    // STEP 2 — Notification Agent: send a notification.
    // This step randomly throws to demonstrate automatic retries.
    await step.run('notification-agent', async () => {
      console.log("This Is the notification agent...");
      const zeroOrOne = Math.random() < 0.5 ? 0 : 1;
      if (zeroOrOne === 0) throw new Error("Something went wrong in the notification agent");
      console.log("Notification sent successfully");
      return { emailAck: true };
    });
  }
);

export const functions = [helloAgentFunction];
```

**Key concepts shown here:**

- **`new Inngest({ id: "my-app" })`** — creates the client used to both send and receive events.
- **`createFunction(config, handler)`** — defines a durable workflow.
  - `id: "hello-agent"` — unique name of the function.
  - `triggers: [{ event: 'chai/hello.agent' }]` — the function starts a **run** whenever
    an event named `chai/hello.agent` is received.
- **`step.run('name', async () => {...})`** — a checkpointed, retriable unit of work.
  - The name (`collect-user-input`, `notification-agent`) identifies the step.
  - Its return value is cached (memoized). On replay/retry, a completed step is **not**
    re-executed — its saved result is reused.
  - If the callback throws (like the random error in `notification-agent`), Inngest
    **retries that step automatically** without re-running earlier steps.
- **`step.sleep('wait-for-research', '5s')`** — a **durable** pause. Unlike `setTimeout`,
  it does not keep the process busy; Inngest suspends the run and resumes it after 5s,
  even across restarts.

This maps directly to the whiteboard: **Input Agent → (wait for research) → Notification
Agent**, where each agent is a retriable step.

### 3.2 `index.js` — serving the function over HTTP

```js
import express from "express";
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";

const app = express();

// Required: parse incoming JSON payloads from Inngest
app.use(express.json());

// Expose the functions at /api/inngest so the Inngest engine can invoke them
app.use("/api/inngest", serve({ client: inngest, functions }));

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

**What this does:**
- `serve({ client, functions })` registers your durable functions on the route
  `/api/inngest`. This is the endpoint the Inngest engine (Dev Server or Cloud) calls to
  execute each step. Every step invocation is a separate HTTP call, which is how Inngest
  can checkpoint and resume between steps.
- `express.json()` is required so the incoming step payloads are parsed.

### 3.3 How to run it

```bash
# 1) install deps
npm install

# 2) start your app (Express server on :3000)
node index.js

# 3) in another terminal, start the Inngest Dev Server (gives you a local dashboard)
npx inngest-cli@latest dev
```

Then open the Inngest Dev Server UI (usually `http://localhost:8288`), find the
`hello-agent` function, and **send/trigger the `chai/hello.agent` event**. You will see:

- Step `collect-user-input` run and return `{ name, lastname }`.
- A 5-second durable sleep.
- Step `notification-agent` either succeed, or **throw and automatically retry** — and
  crucially, when it retries, step 1 is **not** run again (its result is replayed).

That single observation is the whole lesson: **durable execution + automatic per-step
retries, with zero queue/worker/state code written by you.**

---

## TL;DR

- **Without Inngest:** you hand-build RabbitMQ, workers, retries, state, error handling,
  monitoring, and idempotency — a mountain of non-AI plumbing that gets worse as agents scale.
- **With Inngest:** you write a function made of **steps** (`step.run`, `step.sleep`).
  Inngest gives you **durable execution, auto retry, monitoring, and simple event-driven
  triggers** out of the box. You spend 80% less time on infra and focus on your agents.
- **In this project:** `inngest/index.js` defines a `hello-agent` function triggered by
  `chai/hello.agent` with two steps and a durable sleep; `index.js` serves it via Express
  at `/api/inngest`.

### Sources
- [How durable workflow engines work — Inngest](https://www.inngest.com/blog/how-durable-workflow-engines-work)
- [Durable Background Logic (Functions) — Inngest Docs](https://www.inngest.com/docs/learn/inngest-functions)
- [Checkpointed, Retriable Units of Work (Steps) — Inngest Docs](https://www.inngest.com/docs/learn/inngest-steps)
- [Durable Execution — Inngest Docs](https://www.inngest.com/docs/learn/how-functions-are-executed)

*Content from the sources above was rephrased/summarized for compliance with licensing restrictions.*
