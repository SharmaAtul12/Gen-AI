# GenAI Cohort - Class 10

# Building an AI Agent From Scratch in TypeScript (Builder Pattern + Observer Pattern + Tool-Calling Loop)

## 1. Introduction

Up to now we have *called* LLMs and built RAG systems. In this class we build something more powerful: an **AI Agent**.

> An agent is an LLM wrapped in a loop that can **think**, **decide to use tools**, **observe the results**, and **repeat** until it has a final answer.

The difference between a plain LLM call and an agent:

- A plain LLM call: you ask, it answers once. It cannot check the weather or run a command.
- An agent: it reasons step by step, and when it needs real-world data (weather, CLI output), it **requests a tool**, we run the tool, feed the result back, and it continues reasoning until done.

This class is also a strong lesson in **software design patterns**. We build the agent using:

- the **Builder pattern** for clean, fluent configuration,
- the **Observer pattern** (interceptors) for decoupled logging/monitoring,
- a **tool-calling loop** driven by a structured "harness" prompt.

The whole thing is written in **TypeScript** for type safety.

---

## 2. What We Are Building

A reusable `Agent` class you configure like this:

```ts
const agent = Agent.builder()
  .setInstructions(`You are an expert coding agent`)
  .tool(weatherTool)
  .tool(cliAccessTool)
  .build();

agent.attachInterceptor(message => console.log(`Message : ${message.role} ${message.content}`));

const result = await agent.run("Can you tell me the weather of Delhi");
```

The agent will reason, decide it needs the weather tool, call it, read the result, and return a final answer.

---

## 3. Project Setup

### 3.1 Dependencies (`package.json`)

```json
{
  "type": "module",
  "devDependencies": { "@types/node": "^26.1.2" },
  "dependencies": {
    "axios": "^1.19.0",
    "dotenv": "^17.4.2",
    "openai": "^7.1.0"
  }
}
```

- `openai` - to call the chat model.
- `axios` - used by the weather tool to fetch data from an HTTP API.
- `dotenv` - loads `OPENAI_API_KEY` from `.env`.
- `@types/node` - TypeScript type definitions for Node.js.

### 3.2 TypeScript config (`tsconfig.json`)

The key settings:

- `"target": "esnext"` and `"module": "nodenext"` - modern JavaScript/ESM output.
- `"rootDir": "./src"`, `"outDir": "./dist"` - compile TypeScript from `src/` into `dist/`.
- `"strict": true` - full type safety (the reason we get compile-time guarantees).

Compile and run:

```bash
npx tsc          # compiles src/*.ts -> dist/*.js
node dist/index.js
```

### 3.3 Project structure

```text
Class-10/
├── src/
│   ├── index.ts          # entry point: defines tools + runs the agent
│   └── app/
│       ├── agent.ts      # the Agent + AgentBuilder classes (the core)
│       └── config.ts     # HARNESS_PROMPT (the reasoning pipeline prompt)
├── tsconfig.json
└── package.json
```

---

## 4. The Core Types (`src/app/agent.ts`)

Three interfaces define the contract of the whole system.

```ts
export interface IMessage {
  role: "user" | "assistant" | "developer"
  content: string
}

export interface ITool {
  name: string
  description: string
  doc?: string
  executor: (input: string) => Promise<string>
}

export type Interceptor = (message: IMessage) => void
```

- **`IMessage`** - one entry in the conversation history. `role` says who "spoke": the `user`, the `assistant` (the LLM), or the `developer` (us, injecting tool results).
- **`ITool`** - a capability the agent can use. It has a `name`, a `description`, optional `doc` (usage signature), and an `executor` function that actually does the work and returns a string.
- **`Interceptor`** - a listener function that receives every message the agent produces. This is the Observer pattern hook.

---

## 5. Design Pattern 1 - The Builder Pattern (`AgentBuilder`)

### 5.1 The problem it solves

Without the builder, creating an agent would mean passing everything to one giant constructor:

```ts
// Painful and unreadable - gets worse as features grow
const agent = new Agent(
  "You are Math Expert",
  [weatherTool, calculatorTool],
  openAIClient,
  messageHistory,
  interceptors,
  toolMap,
  maxLoops,
  harnessPrompt,
  /* ...more in future */
);
```

As features grow (memory, guardrails, temperature), this constructor becomes impossible to remember.

### 5.2 The builder solution

```ts
export class AgentBuilder {
  public instructions: string | undefined
  public toolList: ITool[]

  constructor() {
    this.toolList = []
  }

  public setInstructions(instructions: string) {
    this.instructions = instructions;
    return this          // <-- returns `this` to enable chaining
  }

  public tool(t: ITool) {
    this.toolList.push(t)
    return this          // <-- returns `this` to enable chaining
  }

  public build() {
    return new Agent(this)   // <-- pass the whole builder to the Agent
  }
}
```

Now configuration is step-by-step and readable:

```ts
const agent = Agent.builder()
  .setInstructions("You are Math Expert")
  .tool(weatherTool)
  .tool(calculatorTool)
  .build();
```

### 5.3 Why each method returns `this` (Fluent Interface)

Every configuration method returns `this` (the same builder object). That is what allows **method chaining**. If a method returned nothing, the next `.tool(...)` in the chain would crash because you would be calling it on `undefined`.

```text
Agent.builder()        -> Builder
  .setInstructions(..)  -> Builder   (returns this)
  .tool(weather)        -> Builder   (returns this)
  .tool(calculator)     -> Builder   (returns this)
  .build()              -> Agent     (returns a new Agent)
```

### 5.4 The end-to-end builder flow

```text
1. User wants an Agent
2. Agent.builder()            -> static method
3. return new AgentBuilder()  -> empty builder { instructions: undefined, toolList: [] }
4. .setInstructions("...")    -> builder.instructions set, returns this
5. .tool(weatherTool)         -> pushed into toolList, returns this
6. .tool(calculatorTool)      -> pushed into toolList, returns this
7. .build()                   -> new Agent(builder)  (whole builder passed in)
```

(See `Notes/Builder Pattern.png` and `Notes/Initial-Flow.png` for the full annotated walkthrough.)

### 5.5 Why pass the whole builder to the Agent?

`build()` does `return new Agent(this)`, handing the **entire builder** to the Agent. This means when you add a new config option later (memory, guardrails, callbacks), you only modify the builder and the Agent constructor. You never change the `build()` signature. This separation of "collect configuration" (builder) from "execute" (agent) is the whole point of the pattern.

Analogy: building a custom gaming PC. Instead of telling the shopkeeper everything in one confusing sentence, you choose parts step by step (CPU, then GPU, then RAM), and the PC is assembled only at the end. `.build()` is "assemble now."

---

## 6. The Agent Constructor - Initialization

When `build()` calls `new Agent(builder)`, the constructor sets up everything the agent needs to run.

```ts
export class Agent {
  private instructions: string
  private messageHistory: IMessage[]
  private toolMap: Map<string, ITool>
  private MAX_LOOPS = 30;
  private openai: OpenAI
  private interceptors: Interceptor[]

  constructor(builder: AgentBuilder) {
    this.toolMap = new Map();
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.interceptors = []

    // 1. Convert the tool ARRAY into a Map for O(1) lookup by name
    for (const t of builder.toolList) {
      this.toolMap.set(t.name, t)
    }

    // 2. Build the final system prompt: harness + user instructions + tool catalog
    this.instructions =
    `
      ${HARNESS_PROMPT}

      System Prompt :
      ${builder.instructions}

      Available Tools :
      ${builder.toolList.map(t => JSON.stringify({
        functionName: t.name,
        functionDescription: t.description,
        functionDoc: t.doc
      })).join("/n")}
    `
    this.messageHistory = []
  }

  static builder() {
    return new AgentBuilder()
  }
}
```

### What happens in the constructor

1. **Create the OpenAI client** using the API key.
2. **Empty interceptor array and message history** are initialized.
3. **`toolList` (array) -> `toolMap` (Map)** - tools were collected as an array, but at runtime we need to look up a tool by name quickly. A `Map` gives **O(1)** lookup: `toolMap.get("fetchWeatherInfo")`.
4. **Build the final system prompt** by combining three things:
   - the `HARNESS_PROMPT` (the reasoning pipeline rules),
   - the user's `instructions` ("You are an expert coding agent"),
   - the **tool catalog** - each tool serialized to JSON so the LLM knows what tools exist, what they do, and how to call them.

```text
Final System Prompt = HARNESS_PROMPT + user instructions + JSON list of available tools
```

The `static builder()` method is just a convenient entry point that returns a fresh `AgentBuilder`.

(See `Notes/Tool-Flow.png` for how the toolList array becomes the toolMap and the tool catalog.)

---

## 7. Design Pattern 2 - The Observer Pattern (Interceptors)

### 7.1 The idea

The agent should not hard-code `console.log`. What if you later want to send messages to a database, a UI, or an analytics service? Hard-coding logging into the agent would make it rigid.

The **Observer pattern** solves this: the agent simply **broadcasts** every message to a list of listeners (interceptors). It does not know or care what they do.

```ts
public attachInterceptor(interceptor: Interceptor) {
  this.interceptors.push(interceptor)     // register a listener
}

private notifyInterceptors(message: IMessage) {
  for (const interceptor of this.interceptors) {
    interceptor(message)                  // broadcast to every listener
  }
}
```

### 7.2 How it is used

```ts
agent.attachInterceptor(message =>
  console.log(`Message : ${message.role} ${message.content}`)
);
```

Now every time the agent produces a message (an LLM response or a tool result), it calls `notifyInterceptors(message)`, which fans the message out to all registered listeners.

### 7.3 Why this is powerful

- The agent **never calls `console.log` directly**. It only says "here is a new message."
- The interceptor decides what to do (print, store, render, analyze).
- This keeps the agent **loosely coupled** and **highly extensible**: add a database logger tomorrow without touching the agent code.

Analogy: a YouTuber (the agent) uploads a video (publishes a message). They do not call each subscriber individually. YouTube notifies all subscribers (interceptors). The YouTuber does not know who is watching.

```text
        Agent (Publisher)
             │ notifyInterceptors(message)
   ┌─────────┼──────────┬───────────┐
   v         v          v           v
console    database   React UI   analytics
logger     logger     renderer   tracker
```

(See `Notes/InterceptorFlow(Observer-Pattern).png`.)

---

## 8. Design Pattern 3 - The Tool-Calling Agent Loop (`run`)

This is the brain of the agent. It repeatedly calls the LLM, and whenever the LLM asks for a tool, it runs the tool and feeds the result back.

```ts
public async run(query: string) {
  // Append the user query to history
  this.messageHistory.push({ role: 'user', content: query })

  for (let i = 0; i < this.MAX_LOOPS; i++) {

    // 1. Call the LLM with system prompt + full history
    const llmResponse = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: this.instructions },
        ...this.messageHistory.map((msg) => ({ role: msg.role, content: msg.content }))
      ]
    })

    // 2. Save the LLM's raw response and broadcast it
    const rawResponse = llmResponse.choices[0].message.content as string
    this.messageHistory.push({ role: 'assistant', content: rawResponse })
    this.notifyInterceptors({ role: 'assistant', content: rawResponse })

    // 3. Parse the JSON response (the harness forces JSON output)
    const parsedResult = JSON.parse(rawResponse)

    // 4. If it's the final answer, stop
    if (parsedResult.step.toLowerCase() === "output") {
      return this.messageHistory
    }

    // 5. If it's a tool request, run the tool and feed the result back
    if (parsedResult.step.toLowerCase() === "tool_request") {
      const { functionName, input } = parsedResult
      const tool = this.toolMap.get(functionName)

      if (!tool) {
        this.messageHistory.push({
          role: 'developer',
          content: `Error : function with name ${functionName} does not exist`
        })
        continue
      }

      const toolResult = await tool.executor(input)
      const toolMessage = {
        role: 'developer' as const,
        content: `Tool Result : ${JSON.stringify({ functionName, input, toolResult })}`
      }
      this.messageHistory.push(toolMessage)
      this.notifyInterceptors(toolMessage)
    }
  }
}
```

### Step-by-step

1. **Add the user query** to the conversation history.
2. **Loop up to `MAX_LOOPS` (30) times.** The cap prevents an infinite loop if the model never reaches an OUTPUT step.
3. Each iteration **calls the LLM** with the system prompt plus the entire history so far.
4. The response is stored and **broadcast to interceptors**.
5. The response is **parsed as JSON** (the harness prompt guarantees JSON with a `step` field).
6. **Decision based on `step`:**
   - `"output"` -> the agent is done. Return the full history.
   - `"tool_request"` -> look up the tool in `toolMap`, run its `executor(input)`, and push the result back into history as a `developer` message. Then `continue` the loop so the LLM can read the tool result and keep reasoning.
   - Unknown tool -> push an error message and continue (self-correction).

### The loop visualized

```text
user query
   │
   v
┌──────────────────────────────────────────┐
│  LLM(system prompt + history)             │ <───────────┐
│         │                                 │             │
│         v                                 │             │
│   parse JSON -> step?                     │             │
│     ├─ "output"       -> return history   │  (feed tool │
│     └─ "tool_request" -> run tool ────────┼── result ───┘
│                          push result       │
└──────────────────────────────────────────┘
   (repeat up to MAX_LOOPS)
```

This "LLM ↔ tools ↔ LLM" cycle until a final answer is the essence of every agent framework.

---

## 9. The Harness Prompt (`src/app/config.ts`)

The agent loop only works because the LLM reliably outputs structured JSON with a `step`. The **`HARNESS_PROMPT`** is what enforces that.

It instructs the model to follow a reasoning pipeline:

```text
INITIAL -> THINK -> ANALYZE -> (THINK -> ANALYZE ...) -> TOOL_REQUEST -> OUTPUT
```

- **INITIAL** - restate what the user wants.
- **THINK** - plan how to solve it, break it into sub-problems.
- **ANALYZE** - verify the current step is correct.
- **TOOL_REQUEST** - ask for a tool in a strict JSON shape:
  ```json
  { "step": "TOOL_REQUEST", "functionName": "getWeatherData", "input": "Goa" }
  ```
- **OUTPUT** - the final answer, which ends the loop.

The prompt also enforces strict rules:

- output **one step at a time**,
- always use valid **JSON**,
- follow the pipeline sequence.

And it gives **few-shot examples** (a math problem solved with BODMAS, and a weather lookup using a tool) so the model learns the exact format. The output format the model must always follow:

```json
{
  "step": "INITIAL | THINK | ANALYZE | TOOL_REQUEST | OUTPUT",
  "text": "<Actual response>",
  "functionName": "<Function Name if TOOL_REQUEST>",
  "input": "<Function Input if TOOL_REQUEST>"
}
```

This is essentially **Chain-of-Thought reasoning** (from Class 02) formalized into a machine-parseable protocol that the agent loop can drive.

---

## 10. The Tools (`src/index.ts`)

Two tools are defined, each conforming to the `ITool` interface.

### 10.1 Weather tool

```ts
const weatherTool: ITool = {
  name: 'fetchWeatherInfo',
  description: 'Fetches real-time weather information by city name',
  doc: 'fetchWeatherInfo(cityName: string): weatherInfo',
  async executor(cityName) {
    const url = `https://wttr.in/${cityName.toLowerCase()}?format=%C+%t`;
    const result = await axios.get(url, { responseType: "text" });
    return JSON.stringify({ cityName, weatherInfo: result.data });
  }
}
```

It calls the free `wttr.in` weather service and returns a condition + temperature string. This is how the agent gets **real, live data** the LLM could never know on its own.

### 10.2 CLI access tool

```ts
const cliAccessTool: ITool = {
  name: 'executeCLICommand',
  description: 'Executes a command in the CLI and returns the output',
  doc: 'cliAccess(command: string): commandOutput',
  executor(cmd) {
    return new Promise((res) => {
      exec(cmd, (err, out) => {
        if (err) return res(`Error executing command: ${err.message}`);
        return res(out);
      })
    })
  }
}
```

This wraps Node's `child_process.exec` so the agent can run shell commands and read their output. It uses a Promise to convert the callback-style `exec` into something the `await tool.executor(...)` loop can await.

> Security note: a tool that executes arbitrary CLI commands is powerful but dangerous. The LLM decides what command to run, so in any real system this must be sandboxed, allow-listed, or gated behind confirmation. Never expose unrestricted shell access to an autonomous agent in production.

### 10.3 Wiring it together

```ts
async function init() {
  const agent = Agent.builder()
    .setInstructions(`You are an expert coding agent`)
    .tool(weatherTool)
    .tool(cliAccessTool)
    .build()

  agent.attachInterceptor(message =>
    console.log(`Message : ${message.role} ${message.content}`)
  )

  const result = await agent.run("Can you tell me the weather of Delhi")
  console.log(result![result?.length! - 1])
}

init();
```

The agent is built with both tools, an interceptor logs every message, and it is asked about Delhi's weather. The agent reasons, calls `fetchWeatherInfo` with `"Delhi"`, reads the result, and outputs the answer. The last message in the returned history is printed.

---

## 11. Complete End-to-End Flow

```text
Agent.builder()
   .setInstructions(...) .tool(weather) .tool(cli) .build()
        │
        v
   new Agent(builder)
        │  - toolList -> toolMap (O(1) lookup)
        │  - system prompt = HARNESS + instructions + tool catalog
        v
   agent.attachInterceptor(logger)
        │
        v
   agent.run("weather of Delhi")
        │
        v
   LOOP:
     LLM(system + history)
       -> {step:"INITIAL"} ..broadcast..
       -> {step:"THINK"}   ..broadcast..
       -> {step:"TOOL_REQUEST", functionName:"fetchWeatherInfo", input:"Delhi"}
            -> run weatherTool.executor("Delhi") -> live weather
            -> push developer message ..broadcast..
       -> {step:"OUTPUT", text:"The weather in Delhi is ..."}  -> STOP
        │
        v
   return messageHistory  (last message = final answer)
```

---

## 12. How to Run

```bash
# 1. Install dependencies
npm install

# 2. Create a .env file
#    OPENAI_API_KEY=sk-...

# 3. Compile TypeScript
npx tsc

# 4. Run the compiled output
node dist/index.js
```

---

## 13. Key Takeaways

1. An agent is an LLM wrapped in a **loop** that can think, call tools, observe results, and continue until done.
2. The **Builder pattern** separates configuration from execution and enables clean, chainable, extensible setup.
3. Methods return `this` to enable **method chaining** (the fluent interface).
4. The tool array is converted into a **Map** for fast O(1) lookup by name at runtime.
5. The **Observer pattern** (interceptors) decouples the agent from logging/UI/storage; the agent just broadcasts messages.
6. The **harness prompt** forces a structured JSON reasoning pipeline that the loop can parse and drive.
7. `MAX_LOOPS` guards against infinite loops.
8. **Tools** give the agent real-world abilities (live weather, running commands) the LLM alone lacks.
9. Executing arbitrary CLI commands from an agent is powerful but must be sandboxed in real systems.

---

## 14. Practice Questions

1. What is the difference between a plain LLM call and an agent?
2. Why does every builder method return `this`?
3. Why do we convert `toolList` (array) into `toolMap` (Map) in the constructor?
4. What three parts make up the agent's final system prompt?
5. Explain the Observer pattern in the context of interceptors. Why is the agent "loosely coupled"?
6. Walk through one iteration of the `run` loop for a tool request.
7. What role does the `HARNESS_PROMPT` play, and why must the LLM output JSON?
8. Why is `MAX_LOOPS` necessary?
9. What are the security risks of the CLI access tool, and how would you mitigate them?

---

## 15. One-Line Summary

Class 10 builds a complete AI agent from scratch in TypeScript: the Builder pattern gives it a clean fluent configuration API, the Observer pattern lets it broadcast messages to pluggable interceptors, a harness prompt drives a structured reasoning pipeline, and a tool-calling loop lets it invoke real tools (weather, CLI) and reason over their results until it produces a final answer.
