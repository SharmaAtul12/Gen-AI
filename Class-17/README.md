# Model Context Protocol (MCP) — Everything You Need to Know

## The Problem: Tools Were Not Standardized

### How it all started (2024)

In 2024, **Agentic AI / AI Agents** started gaining massive traction. Every AI system (OpenAI, Claude, etc.) had its own way of handling tools via **System Prompts**.

### The Fragmentation Problem

Consider a scenario where **Stripe** wants to provide tool access (like `createStripeCheckoutSession()`) to AI agents:

- **OpenAI** — needed tools defined in its own system prompt format
- **Claude** — needed tools defined in its own system prompt format
- **Cursor IDE** — needed `createStripeCheckoutSession()` defined again
- **Copilot** — needed `createStripeCheckoutSession()` defined again
- **ChaiCode Agent** — "Bring your own tools" approach

Every AI agent or IDE had to independently implement the same tool (`createStripeCheckoutSession()`). The **developer of the agent** (e.g., Stripe Team) had to write and maintain tool integrations for each platform separately.

### The SDK / Language Problem

On Stripe's side, they were already providing SDKs in multiple languages:
- JS SDK
- Python
- Java

But for AI tools, there was **no standard**. Each platform expected a different format.

### The Need for a Standard

This fragmentation led to the realization that there needs to be a **standard protocol** — similar to how **REST** became the standard for APIs across languages (Java, JS, Rust, Swift, etc.).

> Just like REST standardized how web services communicate, we needed something to standardize how AI agents interact with tools.

This is where **MCP (Model Context Protocol)** comes in.

---

## Analogy: How Standardization Worked Before (TCP/UDP → HTTP → REST)

To understand why MCP matters, let's look at how standardization evolved in networking:

### TCP Layer

At the base, we have **TCP** (and UDP) — raw transport protocols. TCP gives us:
- A connection between a client (laptop) and a server ("Process")
- Raw data transfer (e.g., `"piyush"`, `"gibreshxyz deipdfejfbruffbregjrgkrjbghbguhgeiurg"`)

But raw TCP is chaos — no structure, no meaning.

### HTTP: A Standard on Top of TCP

**HTTP** was built on top of TCP to bring structure:
- Methods: `GET`, `PUT`, `POST`, `PATCH`, `DELETE`
- Paths: `/users`
- Status codes: `200`
- Headers
- Cookies

Now everyone knows: if I send `GET /users`, I'll get users back with a `200` status.

### REST: A Convention on Top of HTTP

REST further standardized things:
- Methods map to **intent** (GET = read, POST = create, PUT = update, DELETE = remove)
- URLs map to **resources** (`/users`, `/products`)
- Request structure: `<INTENT>`, `headers "a=b, c=d"`, `Body: ""`
- Response: status `200` with data

### Frameworks Implement the Standard

Once HTTP/REST became the standard, multiple frameworks could implement it:
- **Express**
- **Koa**
- **Nest**

All of them speak the same protocol — the client doesn't care which framework the server uses.

### The Parallel to MCP

> Just like HTTP standardized communication over TCP, and REST standardized API design over HTTP — **MCP standardizes how AI agents communicate with tools**.

It doesn't matter if you're OpenAI, Claude, Cursor, or any other agent — if you speak MCP, you can use any MCP-compatible tool.

---

## MCP Architecture & Transport Mechanisms

### The Setup

An **MCP Client** (LLM + System Prompt) — like Claude, Cursor, Grok, OpenAI — connects to an **MCP Provider** (a separate process that exposes tools).

The key question: **How do they communicate? What's the transport?**

### MCP Supports 2 Transports

1. **STDIO Transport** (Standard Input/Output)
2. ~~HTTP Streaming Transport (SSE)~~ → (deprecated in favor of Streamable HTTP)

---

## Deep Dive: STDIO Transport

### What is STDIO?

STDIO = **Standard Input Output**

Think of it like `cin >>` and `cout <<` in C++, or reading/writing to a process's input and output streams.

### How STDIO Transport Works

The MCP Client **spawns** the MCP Provider as a **child process** on the same machine. Communication happens through the process's stdin/stdout streams.

```
┌─────────────────┐          STDIO           ┌─────────────────┐
│                 │  ───── stdin (write) ───▶  │                 │
│  MCP Client     │                           │  MCP Provider   │
│  (LLM + Prompt) │  ◀──── stdout (read) ──── │  (Process)      │
│                 │                           │                 │
└─────────────────┘                           └─────────────────┘
```

### Provider Logic (Pseudocode)

```javascript
request.tools

if (input === "request:tools")
    stdio.out(JSON.stringify(tools))

if (input === "tool:execute")
    result = tool()
    stdio.out(JSON.stringify(result))
```

The provider listens on **stdin** for incoming requests and writes responses to **stdout**. It's essentially a process-level read/write mechanism.

### Key Points about STDIO

- Client and provider run on the **same machine**
- Communication is through **process streams** (stdin/stdout)
- No network involved — it's purely local
- The client spawns the provider as a subprocess

---

## Hands-On: Building an MCP Server with STDIO

### Code: `index.js`

```javascript
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as z from "zod/v4";

const server = new McpServer({ name: "Build-with-Atul-MCP", version: "1.0.0" });

server.registerTool(
  "add",
  {
    title: "add",
    description: "Add Two Numbers",
    inputSchema: z.object({ num1: z.number(), num2: z.number() }),
  },
  async (ctx) => {
    return {
      content: [{ type: 'text', text: `${ctx.num1 + ctx.num2}` }],
    }
  },
);

async function runServerOnStdIOTransport() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServerOnStdIOTransport();
```

### How to Run & Communicate via STDIO

Since the MCP server uses STDIO transport, we can run it and send **JSON-RPC 2.0** messages directly through stdin.

#### Step 1: Run the server

```bash
node index.js
```

The server starts and waits for input on **stdin**. No HTTP port, no URL — just a process listening.

#### Step 2: Send `initialize` request

First, you must initialize the connection:

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}}}
```

Server responds with its capabilities.

#### Step 3: Send `initialized` notification

```json
{"jsonrpc":"2.0","method":"notifications/initialized"}
```

#### Step 4: Request available tools (`tools/list`)

```json
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
```

Server responds with all registered tools:
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "add",
        "description": "Add Two Numbers",
        "inputSchema": {
          "type": "object",
          "properties": {
            "num1": { "type": "number" },
            "num2": { "type": "number" }
          }
        }
      }
    ]
  }
}
```

#### Step 5: Execute a tool (`tools/call`)

```json
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"add","arguments":{"num1":5,"num2":3}}}
```

Server responds:
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [{ "type": "text", "text": "8" }]
  }
}
```

### All in One (pipe commands)

You can test it all in one shot using echo and pipe:

```bash
echo {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}} | node index.js
```

Or interactively — run `node index.js` and paste each JSON line one by one into the terminal.

### Key Takeaway

MCP uses **JSON-RPC 2.0** over STDIO. The flow is:
1. `initialize` → handshake
2. `notifications/initialized` → confirm
3. `tools/list` → discover tools
4. `tools/call` → execute a tool

This is exactly what Claude, Cursor, or any MCP client does under the hood when connecting to your MCP server via STDIO.

---

## Connecting the MCP Server to an AI Agent (VS Code / Cursor)

Now that we have our MCP server ready, let's connect it to an actual AI agent so it can discover and use our tools.

### Configuration: `mcp.json`

In your IDE (VS Code / Cursor), create an `mcp.json` config:

```json
{
  "servers": {
    "Build-With-Atul-MCP": {
      "type": "stdio",
      "command": "node",
      "cwd": "${workspaceFolder}/Class-17",
      "args": ["index.js"]
    }
  }
}
```

This tells the agent:
- **Server name**: `Build-With-Atul-MCP`
- **Transport**: `stdio` (spawn as a child process)
- **Command**: `node` with `index.js` as argument
- **Working directory**: `Class-17` folder

Once configured, the server shows as **✓ Running | 1 tools** in the IDE.

### Using It with the Agent

Now you can simply ask the agent:

> "hey can you use Build-With-Atul MCP, and add 4 and 5"

**What happens under the hood:**
1. Agent does **optimized tool selection**
2. Agent says: "I'll use the available MCP tool to add 4 and 5 and confirm the result."
3. Agent runs: `add` – Build-With-Atul-MCP (MCP Server)
4. Gets the result

**Result:**

> The MCP addition of 4 and 5 gives:
> **9**
> ✅ Verified with the Build-With-Atul MCP tool.

The agent also performed extra tasks like "Created 2 todos" — showing it can chain actions.

### The Magic

You wrote a simple tool, registered it via MCP, and now **any MCP-compatible agent** can discover and use it without any platform-specific integration. That's the power of standardization!

---

## Real-World Demo: Controlling a Smart Lamp via MCP

Here's a fun real-world use case — controlling a **Smart Bulb/Lamp** directly from Cursor IDE using MCP.

### Architecture

```
┌──────────┐         ┌─────────────┐         ┌──────────┐
│  Phone   │────────▶│  Smart Bulb │◀────────│   LAMP   │
│   App    │         │   (WiFi)    │         │          │
└──────────┘         └─────────────┘         └──────────┘
                            │
                     Calls (Intercept)
                            │
                            ▼
                    ┌───────────────┐
                    │  MCP Wrapper  │──────────▶  Smart Bulb API
                    │               │
                    │  turnOnLight  │
                    │  turnOffLight │
                    └───────────────┘
                            ▲
                            │
                    ┌───────────────┐
                    │   JS Script   │
                    │  (Repeat?)    │
                    └───────────────┘
```

### How It Works

1. Smart Bulbs typically have a **phone app** that communicates with the bulb
2. The API calls from the app can be **intercepted**
3. You write an **MCP Wrapper** around those API calls exposing tools like:
   - `turnOnLight` — turns the smart lamp ON
   - `turnOffLight` — turns the smart lamp OFF
4. Register this as an MCP server in Cursor
5. Now you can tell Cursor: *"Hey, turn on my lamp"* — and it does!

### Why Not Everything Works: The Car Example & Idempotency Keys

This approach was also tried with a **Car** (mobile control for car — lock/unlock, start, etc.).

**The Problem: Idempotency Keys**

Cars (and many secure IoT devices) use **idempotency keys** — a unique seed/token generated for each request to prevent replay attacks and duplicate commands.

```
┌────────┐              ┌──────────────────┐
│  Car   │◀────────────▶│  Mobile Control  │
└────────┘              └──────────────────┘
```

**How idempotency keys work:**
- Every time you send a command (e.g., "unlock car"), the mobile app generates a unique **seed**
- The server validates this seed and processes the request
- If you try to send the **same seed** again, the server rejects it (already used)
- Each new request needs a **fresh seed**

**Why this breaks MCP wrapping:**
- When you intercept the car's API calls, you can capture the request format
- But each request requires a **new idempotency key/seed** that is generated dynamically
- You can't simply replay intercepted calls — the seed has already been consumed
- The seed generation often involves cryptographic secrets tied to the authenticated session

So unlike a simple smart bulb (which accepts stateless on/off commands), a car's API has **anti-replay protection** that makes it much harder to wrap in an MCP server.

> **Lesson**: MCP wrapping works great for simple APIs, but devices with strong security (idempotency keys, rotating tokens, session-bound seeds) require deeper integration to work properly.

---

## Streamable HTTP Transport (The Second Transport)

Now let's look at the second transport method — **Streamable HTTP**.

### Updated Code: `index.js`

We added a `subtract` tool and the HTTP transport:

```javascript
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as z from "zod/v4";

import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';

const server = new McpServer({ name: "Build-with-Atul-MCP", version: "1.0.0" });

// ... tools registered (add, subtract) ...

async function runServerOnHttpTransport() {
  const app = createMcpExpressApp();

  app.use('/mcp', async (req, res) => {
    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.listen(3000, () => console.log('Server is running on PORT 3000'));
}
```

### Connecting Streamable HTTP in `mcp.json`

```json
{
  "servers": {
    "Build-With-Atul-MCP": {
      "type": "stdio",
      "command": "node",
      "cwd": "${workspaceFolder}/Class-17",
      "args": ["index.js"]
    },
    "Build-With-Atul-MCP-Streamable": {
      "type": "http",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

Notice the difference — for HTTP transport, you just give it a **URL**. No command, no cwd, no args.

---

## STDIO vs Streamable HTTP: Key Differences

| Feature | STDIO | Streamable HTTP |
|---------|-------|-----------------|
| **Connection** | Client spawns server as child process | Server runs independently, client connects via URL |
| **Location** | Must be on **same machine** | Can be **anywhere** (local or remote) |
| **Config** | `command`, `args`, `cwd` | Just a `url` |
| **Lifecycle** | Server lives/dies with the client | Server runs independently |
| **Use Case** | Local tools, dev environment | Deployed services, shared tools, remote access |
| **Network** | No network (process pipes) | HTTP over network |
| **Scalability** | Single user | Multiple clients can connect |

### When to Use Which?

**STDIO** — when:
- Tool runs locally on your machine
- You want zero setup (no server to manage)
- Personal/dev tools

**Streamable HTTP** — when:
- Tool is deployed on a server (cloud)
- Multiple agents/users need to access the same tool
- You want the MCP server to be always running independently
- Production/shared tools

### The Big Takeaway

> **STDIO** = local, same machine, spawned as subprocess
> **Streamable HTTP** = remote-capable, runs as a standalone server, accessed via URL

With HTTP transport, you could deploy your MCP server to AWS/GCP/anywhere and any MCP client in the world can connect to it. With STDIO, it's purely local.

---

## Why Do We Need MCP?

### The Core Question: How Do Tools Attach?

Think about it — there are so many AI platforms and agent frameworks:

- **Claude**
- **OpenAI**
- **AgentSDK** (OpenAI's agent framework)
- **GoogleADK** (Google's Agent Development Kit)

Each one needs tools. But **how do tools attach** to these platforms?

Without MCP, every tool provider would need to write separate integrations for Claude, OpenAI, AgentSDK, GoogleADK, and every new platform that comes along. That's an N×M problem (N tools × M platforms).

With MCP, it becomes **N + M** — each tool implements MCP once, each platform supports MCP once, and everything works together.

> MCP is the universal plug. Write your tool once, and it works with Claude, OpenAI, Google ADK, AgentSDK, Cursor, and any future MCP-compatible agent.

---

## Why Host MCP? (The Abstraction Principle)

### The HTTP API Analogy

Think about how **HTTP APIs** work:

```
Client ──── /users ────▶ API Layer (Controller) ──▶ Server
                         app.get('/users')          controller.getAllUsers()
```

The **client** never sees the actual implementation (`controller.getAllUsers()`). It only knows:
- There's an endpoint `/users`
- It accepts `GET` requests
- It returns user data

The internal logic — database queries, validation, transformations — is completely **hidden**. The client only interacts with the **metadata** (endpoint path, method, response format).

### MCP Works the Same Way

```
LLM Agent ──────────▶ Tools (MCP Server)
                       │
                       ▼
                 tool metadata
                 name, desc
```

In MCP, tools are stored like a `HashMap<String, Function>`:
- **Key** = tool name (e.g., `"add"`)
- **Value** = actual function implementation

But the **agent/client only sees the metadata**:
- Tool **name** (e.g., `"add"`)
- Tool **description** (e.g., `"Add Two Numbers"`)
- Tool **input schema** (what parameters it needs)

The agent **never sees the actual code**. It just knows *what* the tool does, *what* it needs, and *what* it returns.

### Why This Matters

1. **Security** — Your tool's internal logic (API keys, business logic, database queries) stays hidden
2. **Abstraction** — The agent doesn't need to understand implementation details
3. **Control** — You decide what gets exposed and what stays private
4. **Hosting** — You run the MCP server, the agent just consumes the metadata and results

> Just like a REST API hides `controller.getAllUsers()` behind `GET /users`, MCP hides your actual tool functions behind metadata (name + description + schema). The client requests, the server executes, and only the result is returned.

---

## Problems with MCP: Context Poisoning & The MCP Gateway Solution

### The Problem: Too Many Tools = Context Poisoning

Imagine you connect multiple MCP servers to your agent:

- **Stripe** — 46 tools
- **Gmail** — 102 tools
- **mcp.ChaiCode** — 27 tools
- **piyushgarg** — 27 tools

That's **200+ tools** loaded into the agent's context!

This causes **Context Poisoning**:
- The LLM's context window gets flooded with tool metadata
- The agent gets confused about which tool to pick
- Response quality degrades because there's too much irrelevant context
- Tokens are wasted on tool descriptions that aren't needed for the current query

### The Solution: MCP Gateway (RAG for Tools)

**MCP Gateway** (concept emerging in early 2025) solves this by implementing **RAG (Retrieval Augmented Generation) for tools**.

Instead of loading ALL tools into context, the gateway does smart retrieval:

```
User: "Can you create a payment link"
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  MCP Gateway (mcpgateway.com)                               │
│                                                             │
│  find_tool("Can you create a payment link")  ──▶  RAG      │
│  execute_tool(tool_name)                                    │
│                                                             │
│  Connected servers: Stripe(46), Gmail(102), ChaiCode(27)... │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
    Returns only the relevant tool (e.g., Stripe's createPaymentLink)
```

### How It Works

1. **Agent** receives user query: *"Can you create a payment link"*
2. Agent calls gateway: `find_tool("Can you create a payment link")`
3. Gateway uses **RAG/vector search** to find the most relevant tool from ALL connected servers
4. Returns only that specific tool's metadata to the agent
5. Agent calls: `execute_tool(tool_name)` to run it

The agent only ever has **2 tools** in its context:
- `find_tool(query)` — search for relevant tools
- `execute_tool(tool_name)` — execute the found tool

Instead of 200+ tools polluting the context, only 2 meta-tools are needed!

### MCP Gateway Also Provides

- **Rate Limiting** — control how often tools are called
- **Authentication** — secure access to tools
- **Key Management** — manage API keys centrally
- **Monitoring** — track tool usage
- **Tracing** — debug tool calls
- **Observability** — understand what's happening across all tools

### MCP Gateway = Nginx for MCP

Just like **Nginx** acts as a reverse proxy/gateway for HTTP APIs, **MCP Gateway** is the reverse proxy for MCP servers.

Think of it as:
- **Kong** → API Gateway (for REST)
- **MCP Gateway** → Tool Gateway (for MCP)

Can be built with:
- **JavaScript from scratch**
- **Docker** containers
- Existing solutions like Kong (API Gateway → MCP Gateway)

> **Key Insight**: MCP Gateway implements RAG at the gateway level — instead of dumping all tool metadata into the LLM context, it retrieves only the relevant tools on demand. This solves context poisoning elegantly.

---

## Wrapping Up

MCP is doing for AI tools what REST did for APIs — creating a universal language. Instead of every tool provider building N integrations for N platforms, you build one MCP server and it works everywhere.

**Key concepts covered:**
1. **The Problem** — tool fragmentation across AI platforms
2. **The Analogy** — TCP → HTTP → REST standardization journey
3. **Transport Mechanisms** — STDIO (local) vs Streamable HTTP (remote)
4. **Hands-On** — building and connecting an MCP server
5. **Real-World** — smart lamp control, car API limitations with idempotency
6. **Abstraction** — why hosting MCP makes sense (metadata vs implementation)
7. **Scaling** — MCP Gateway solves context poisoning with RAG

MCP is still early (2024-2025), but it's rapidly becoming the standard. If you're building AI tools or integrations, this is the protocol to learn.

---

*If you found this helpful, drop a like and follow for more AI/GenAI deep dives!*
