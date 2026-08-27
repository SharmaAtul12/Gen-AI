# Class-18: Skills (Claude Skills)

> **Learning path:** Start with *why* skills exist (the problems with MCP), understand *what* a skill is and how it fixes those problems, then learn to *build* one (frontmatter → body → folders → progressive disclosure), *test* it, *package* it as a plugin, decide *where* to use it, and finally *publish* it. The last section clarifies how MCP, Connectors, Skills, and Plugins relate.

---

## 🚀 The Skill I Built — Next.js Project Setup Skill

As part of this class, I built and published my own skill. You can install it directly:

```bash
npx skills add https://github.com/SharmaAtul12/NextJS-Project-Setup-Skill
```

> Repo: [SharmaAtul12/NextJS-Project-Setup-Skill](https://github.com/SharmaAtul12/NextJS-Project-Setup-Skill)

A Claude skill that scaffolds a new Next.js project **through conversation** instead of assuming defaults. It asks for your preferences (TypeScript/JavaScript, package manager, linter, optional TanStack Query) and only runs the steps you actually want. It sets up the core project (App Router, Tailwind, shadcn/ui) and wires dark mode by default (`next-themes` + a `ThemeProvider` and toggle). Each step reads existing files before editing, so it stays correct no matter which optional steps ran or in what order.

---

## 1. Why Skills? — Problems with MCP (Model Context Protocol)

The class begins by discussing why MCP has limitations and why some people say **"MCP is dead"**:

1. **Too many tools loading** — When you have many MCP servers, too many tools get loaded into context, which bloats the prompt and confuses the model. This is also called **context poisoning** — the context gets filled with too many tool definitions, degrading the model's ability to reason and pick the right tool.
2. **Network - Latency?** — MCP tools often rely on network calls, introducing latency into every tool execution.
3. **Tools execute on server - Scalability** — Tool execution happens on the server side, raising scalability concerns as usage grows.
4. **Server side tool - Stateless** — MCP tools are stateless on the server side. They *have* to be kept stateless because so many calls are coming in — maintaining state per call would not scale. This means they can't easily hold context between calls.

> 💀 "MCP is dead" — This sentiment comes from these fundamental limitations that make MCP hard to scale and maintain in production workflows.

---

## 2. What are Claude Skills?

A **Skill** is *a special capability* — think of it like a **package** (similar to `npm i express` or `pip install ...`) that bundles together everything an agent needs to perform a task.

### A Skill is a combination of many things

A single skill (e.g. `chaicode-skill`) can package together:

- **Prompts**
- **Tools**
- **Code / scripts**
- **MCP Server**

All of this is bundled into a **zip file**.

### Key idea: Publish and Reuse

```
A special capability
        │
     Package  ──►  chaicode-skill  ──►  Internet Publish
                   (Prompts, Tools,
                    Code/scripts,
                    MCP Server)
                     = zip file
```

- A skill can be **published on the internet**.
- Once published, it **can be used by anyone**.
- Install a skill using a command like:

```bash
npx skills add <skill>
```

### Examples

- `chaicode-skill`
- `stripe-skill`

Skills tie into **Vibe Coding** workflows with Claude — you add a skill and Claude gains that special capability instantly.

### Skills Run on Almost Every Coding Agent

One of the biggest advantages of skills is portability — they aren't locked to a single tool. Skills run on mostly **every coding agent**, including:

- **Claude**
- **Cursor**
- **Antigravity**
- **VSCode**
- **Copilot**

> Write a skill once, and it works across the ecosystem of coding agents.

---

## 3. How Skills Solve the MCP Problems

### Example: ChaiCode Payment Gateway (`chaicode-pay-skill`)

Imagine a skill that contains **everything** about the ChaiCode Payment Gateway:

- **100 markdown files** (docs)
- **Prompts**
- **features/** and prompt scripts
- **scripts** (e.g. `payment-link.js`)
- **Docs**
- **Executable Scripts**
- **MCP Server**

Install it with:

```bash
npx skill add chaicode-pay-skill
```

This gives the coding agent **every bit of context about this payment gateway**.

### 3.1 Progressive Loading — solves "context poisoning"

Suppose a skill has **100 markdown files**. Not all of them are loaded into the context at once.

- Only some **metadata** is loaded up front (like an index / table of contents).
- Based on what the **coding agent actually needs**, it will **load the full file** it wants — on demand.

This works like an **LLM Wiki** with a **Vectorless Index**:

```
100 markdown files
   [ file 1 ]  ─┐
   [ file 2 ]  ─┼──► only metadata loaded first
   [ file 3 ]  ─┘        │
                         └──► agent picks & loads the specific file it needs
```

Because only relevant content enters the context, you avoid **too many tools loading** and **context poisoning**.

### 3.2 Runs on the User's Machine — solves scalability & statelessness

- The code is **running and executing on the machine of the person who downloaded** the skill.
- Since execution is **local**, there are **no scalability issues** on a central server.
- There's no need to keep everything stateless to handle massive concurrent server calls — each user runs their own copy locally.

### 3.3 Summary: Skills vs MCP

| MCP Problem | How Skills Fix It |
|-------------|-------------------|
| Too many tools loading (context poisoning) | Progressive loading — only metadata first, full files on demand |
| Network latency | Runs locally on the user's machine |
| Server-side execution / scalability | Execution happens on the downloader's machine — no central bottleneck |
| Forced statelessness under load | Local execution means no need to force statelessness for scale |

### 3.4 MCP Server is *part of* the Skill (best of both worlds)

A skill can **also bundle an MCP server** inside it. So MCP isn't thrown away — it becomes just *one component* of the skill.

- In case the agent **wants to use MCP**, that MCP part **can still be executed on the server**.
- The difference is that MCP is now **optional and on-demand**, not the default entry point for everything.

#### Why this is better than raw MCP

With **raw MCP**, every tool definition is loaded up front and every call goes over the network to a stateless server. That causes context poisoning, latency, and scalability pressure.

With **MCP inside a Skill**:

- **No upfront tool bloat** — the agent first reads lightweight metadata. It only reaches for the MCP server *when it actually needs that specific capability*, so the context stays clean.
- **Local-first, server-when-needed** — most work (docs, prompts, scripts) runs **locally on the user's machine**. The network/server is only used for the specific MCP call that truly requires it, minimizing latency.
- **Selective execution** — instead of exposing all MCP tools all the time, the skill decides *when* the MCP server is relevant, reducing wrong-tool confusion.
- **Packaged & versioned** — the MCP server ships together with its prompts, docs, and scripts as one publishable unit, so it's easier to distribute and reuse than wiring up a standalone MCP server.

> In short: Skills keep the power of MCP for cases that genuinely need server-side execution, while removing MCP's biggest downsides (context poisoning, always-on latency, and central scalability limits) by making it a lazy-loaded, local-first, packaged component.

---

## 4. How to Create a Skill

### Part 1: The frontmatter (the part that matters most)

Every `SKILL.md` starts with **YAML frontmatter** between `---` lines:

```yaml
---
name: nextjs-project-setup
description: ...
---
```

This frontmatter is the **only part of the skill that's always loaded into the agent's context** — even when the skill isn't being used. In other words, **this header loads first, not the entire skill**.

The agent decides whether to *use* the skill by reading this description and matching it against what you're asking. That means:

- **`name`** — a short identifier, `lowercase-with-dashes`.
- **`description`** — needs to say **both** what the skill does **and** when to trigger it. Be a little "pushy" here — mention specific phrases a user might say, because the agent tends to **under-trigger** skills with vague descriptions.

#### Writing a good description

**Bad:**
```yaml
description: Sets up a Next.js project.
```

**Better:**
```yaml
description: Scaffolds a Next.js app with TypeScript, Tailwind, shadcn/ui, and TanStack Query pre-configured. Use whenever the user asks to start, create, or scaffold a new Next.js project, or mentions this stack.
```

> The better description spells out the exact tech and the trigger phrases, so the agent knows precisely when to fire the skill.

#### Minimal required frontmatter

That's all you need to start:

```yaml
---
name: your-skill-name
description: What it does. Use when user asks to [specific phrases].
---
```

#### Field requirements

**`name` (required):**

- **kebab-case only**
- No spaces or capitals
- Should match the folder name

**`description` (required):**

- **MUST include BOTH:**
  - What the skill does
  - When to use it (trigger conditions)
- Under **1024 characters**
- **No XML tags** (`<` or `>`)
- Include specific tasks users might say
- Mention file types if relevant

**`license` (optional):**

- Use if making the skill open source
- Common: `MIT`, `Apache-2.0`

**`compatibility` (optional):**

- 1–500 characters
- Indicates environment requirements: e.g. intended product, required system packages, network access needs, etc.

**`metadata` (optional):**

- Any custom key-value pairs
- Suggested: `author`, `version`, `mcp-server`
- Example:

```yaml
metadata:
    author: ProjectHub
    version: 1.0.0
    mcp-server: projecthub
```

#### Security restrictions

**Forbidden in frontmatter:**

- XML angle brackets (`<` `>`)
- Skills with `claude` or `anthropic` in the name (reserved)

> **Why:** The frontmatter appears in Claude's system prompt. Malicious content there could inject instructions.

#### Writing Effective Skills — the description field (progressive disclosure Level 1)

According to Anthropic's engineering blog, this metadata "provides just enough information for Claude to know when each skill should be used without loading all of it into context." This is the **first level of progressive disclosure**.

**Structure:**

```
[What it does] + [When to use it] + [Key capabilities]
```

**Examples of good descriptions:**

```yaml
# Good - specific and actionable
description: Analyzes Figma design files and generates developer handoff documentation. Use when user uploads .fig files, asks for "design specs", "component documentation", or "design-to-code handoff".

# Good - includes trigger phrases
description: Manages Linear project workflows including sprint planning, task creation, and status tracking. Use when user mentions "sprint", "Linear tasks", "project planning", or asks to "create tickets".

# Good - clear value proposition
description: End-to-end customer onboarding workflow for PayFlow. Handles account creation, payment setup, and subscription management. Use when user says "onboard new customer", "set up subscription", or "create PayFlow account".
```

> The pattern in every good example: state what it does, spell out the trigger phrases a user might actually type, and hint at the key capabilities.

### Part 2: The body

After the frontmatter, the rest of the `SKILL.md` is plain **markdown** — instructions written *to the agent (Claude)*, telling it what to do step by step.

Key point: this body **only loads into context when the skill actually triggers**. Because it's loaded on demand, it can be **longer and more detailed** than the description.

```
SKILL.md
├── frontmatter (name + description)   → always loaded (metadata)
└── body (markdown instructions)       → loaded only when the skill triggers
```

> Tip: A fast way to iterate is to write a first draft of `name` and `description` into your `SKILL.md`, check what's working and what needs tightening, and only then add the body and the script.

### The Body + Optional Folders (in simple language)

The `SKILL.md` body is just **plain markdown written as instructions to Claude** — usually **ordered steps**. Each step says what to do, and when to **ask the user** something versus just **assume a default**.

You can extend a skill with **three optional folders**, each with its own job:

- **`scripts/`** — **executable code** (bash, python) for steps that are the same every single time (deterministic). Instead of retyping commands inline, point to the script. This avoids typos in flags or command order.

- **`references/`** — **lookup documentation** (specs, schemas, lists of valid options, troubleshooting notes) that Claude reads **only when a step needs it**. This keeps the main body short. Good for content that's large, only occasionally needed, or likely to change.

- **`assets/`** — **literal output files** (code templates, images, boilerplate) that get copied into place **as-is**, never retyped from memory. This stops Claude from misremembering the exact file content.

> Rule of thumb: only add a folder when it holds **genuinely new, non-duplicated content**. Don't create empty structure just for the sake of it.

```
my-skill/
├── SKILL.md        # frontmatter + ordered step-by-step instructions
├── scripts/        # deterministic executable code (run it, don't retype)
├── references/     # docs Claude reads only when needed
└── assets/         # literal files copied as-is
```

### Technical Requirements & Critical Rules

#### File structure

```
your-skill-name/
├── SKILL.md              # Required - main skill file
├── scripts/              # Optional - executable code
│   ├── process_data.py   # Example
│   └── validate.sh       # Example
├── references/           # Optional - documentation
│   ├── api-guide.md      # Example
│   └── examples/         # Example
└── assets/               # Optional - templates, etc.
    └── report-template.md # Example
```

#### Critical rules

**`SKILL.md` naming:**

- Must be exactly `SKILL.md` (case-sensitive)
- No variations accepted (`SKILL.MD`, `skill.md`, etc.)

**Skill folder naming:**

- ✅ Use kebab-case: `notion-project-setup`
- ❌ No spaces: `Notion Project Setup`
- ❌ No underscores: `notion_project_setup`
- ❌ No capitals: `NotionProjectSetup`

**No `README.md` inside the skill folder:**

- Don't include `README.md` inside your skill folder
- All documentation goes in `SKILL.md` or `references/`
- Note: when distributing via GitHub, you'll still want a **repo-level** README for human users — see the publishing section.

### Level 3: Resources and code (loaded as needed)

Skills can bundle additional materials. Example layout of a `pdf-processing/` skill:

```
pdf-processing/
├── SKILL.md          # main instructions
├── FORMS.md          # form-filling guide
├── REFERENCE.md      # detailed API reference
└── scripts/
    └── fill_form.py  # utility script
```

- **Instructions:** Additional markdown files (`FORMS.md`, `REFERENCE.md`) containing specialized guidance and workflows.
- **Code:** Executable scripts (`fill_form.py`, `validate.py`) that Claude runs using bash — providing deterministic operations **without loading their code into context**.
- **Resources:** Reference materials such as database schemas, API documentation, templates, or examples.

Claude accesses these files **only when referenced**. This filesystem model means each content type has different strengths: **instructions** for flexible guidance, **code** for reliability, **resources** for factual lookup.

### Progressive Disclosure — the 3 loading levels

| Level | When loaded | Token cost | Content |
|-------|-------------|------------|---------|
| **Level 1: Metadata** | Always (at startup) | ~100 tokens per skill | `name` and `description` from YAML frontmatter |
| **Level 2: Instructions** | When skill is triggered | Under 5k tokens | `SKILL.md` body with instructions and guidance |
| **Level 3+: Resources** | As needed | None until accessed | Bundled files. Reference files load into context when read; scripts run through bash, and **only their output** enters context |

> **Progressive disclosure** ensures only relevant content occupies the context window at any given time.

---

## 5. Testing and Iteration

Skills can be tested at varying levels of rigor depending on your needs:

- **Manual testing in Claude.ai** — Run queries directly and observe behavior. Fast iteration, no setup required.
- **Scripted testing in Claude Code** — Automate test cases for repeatable validation across changes.
- **Programmatic testing via skills API** — Build evaluation suites that run systematically against defined test sets.

Choose the approach that matches your quality requirements and the visibility of your skill. A skill used internally by a small team has different testing needs than one deployed to thousands of enterprise users.

> **Pro Tip:** Iterate on a *single task* before expanding. The most effective skill creators iterate on one challenging task until Claude succeeds, then extract the winning approach into a skill. This leverages Claude's in-context learning and gives faster signal than broad testing. Once you have a working foundation, expand to multiple test cases for coverage.

### Recommended testing approach

Effective skills testing typically covers three areas. The first (and most important) is **triggering tests**.

#### 1. Triggering tests

**Goal:** Ensure your skill loads at the right times.

Test cases:

- ✅ Triggers on obvious tasks
- ✅ Triggers on paraphrased requests
- ❌ Doesn't trigger on unrelated topics

**Example test suite:**

```
Should trigger:
- "Help me set up a new ProjectHub workspace"
- "I need to create a project in ProjectHub"
- "Initialize a ProjectHub project for Q4 planning"

Should NOT trigger:
- "What's the weather in San Francisco?"
- "Help me write Python code"
- "Create a spreadsheet" (unless ProjectHub skill handles sheets)
```

---

## 6. Packaging a Skill as a Plugin: `.claude-plugin/plugin.json`

To turn a skill into a distributable **plugin** (so it can be published and installed by anyone), you add a `.claude-plugin/` folder at the root with a `plugin.json` manifest inside it.

### Why does this folder exist?

- **It's the plugin's identity card.** `plugin.json` holds the metadata Claude Code (and other agents) use to display, namespace, install, and version your plugin in the plugin manager.
- **`name` drives namespacing.** Every skill, agent, and command your plugin ships is prefixed with this name (e.g. a `reviewer` agent in a `plugin-dev` plugin shows up as `plugin-dev:reviewer`). So the name matters — pick it carefully.
- **The manifest is optional but recommended.** If you omit it, Claude Code auto-discovers components in default folders and derives the name from the directory. You add a manifest when you want proper metadata, custom paths, or stable versioning.

> ⚠️ **Important placement rule:** Only `plugin.json` goes inside `.claude-plugin/`. All other folders — `skills/`, `agents/`, `hooks/`, `scripts/`, `assets/`, `references/` — must live at the **plugin root**, NOT inside `.claude-plugin/`.

### Where it sits in the folder structure

```
nextjs-project-setup-skill/
├── .claude-plugin/
│   └── plugin.json      ← ONLY the manifest lives here
├── SKILL.md             ← at the root
├── assets/              ← at the root
├── references/          ← at the root
└── scripts/             ← at the root
```

### How to write `plugin.json`

Here's the example built in class for the Next.js setup skill:

```json
{
  "name": "nextjs-project-setup-skill",
  "version": "1.0.0",
  "description": "Scaffolds a Next.js project with TypeScript/JavaScript, Tailwind, shadcn/ui, optional dark mode, and optional TanStack Query.",
  "author": {
    "name": "Atul Sharma"
  },
  "license": "MIT",
  "keywords": ["nextjs", "typescript", "tailwind", "shadcn", "tanstack-query", "scaffolding"]
}
```

### Field reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | ✅ Yes (the only required field) | Unique identifier in **kebab-case**, no spaces. Used for namespacing every component. |
| `version` | Optional | Semantic version (`MAJOR.MINOR.PATCH`). Pinning it means users only get updates when you bump it. If omitted, the git commit SHA is used, so every commit counts as a new version. |
| `description` | Optional | Brief explanation of what the plugin does. |
| `author` | Optional | Object with `name`, and optionally `email` and `url`. |
| `homepage` | Optional | Documentation URL. |
| `repository` | Optional | Source code URL. |
| `license` | Optional | License identifier, e.g. `"MIT"`, `"Apache-2.0"`. |
| `keywords` | Optional | Array of discovery tags. Must be an array — a string here is a load error. |

There are also optional **component-path fields** (`skills`, `commands`, `agents`, `hooks`, `mcpServers`, `lspServers`) for pointing at custom locations, but for a simple skill you usually don't need them — the defaults are auto-discovered.

### Rules to remember

- All paths in the manifest must be **relative** and start with `./`.
- `name` must be **kebab-case** with no spaces.
- Bump `version` every time you want users to receive changes (if you set it explicitly).
- Validate before publishing with:

```bash
claude plugin validate ./my-plugin --strict
```

> Sources: [Claude Code Plugins reference](https://raw.githubusercontent.com/ivan-magda/claude-code-plugin-template/main/docs/plugins-reference.md), [Claude Code: Building & Distributing Plugins](https://codingnomads.com/claude-code-building-distributing-plugins). Content was rephrased for compliance with licensing restrictions.

### Packaging into a ZIP for distribution

To distribute the plugin, you package the whole skill folder into a **zip file**. The key rule:

> The zip's **root** must contain the `.claude-plugin/` folder (with `plugin.json` inside it), along with the rest of the skill files (`SKILL.md`, `scripts/`, `references/`, `assets/`).

In other words, when someone unzips it, they should immediately see `.claude-plugin/` at the top level — not nested inside an extra parent folder.

```
my-skill.zip
└── (root)
    ├── .claude-plugin/
    │   └── plugin.json     ← manifest at the root of the zip
    ├── SKILL.md
    ├── scripts/
    ├── references/
    └── assets/
```

✅ **Correct** — `.claude-plugin/` sits at the zip root.

❌ **Wrong** — zipping the parent folder so it unzips as `my-skill/.claude-plugin/...` (an extra wrapping directory). This breaks discovery.

This zip is what gets **published to the internet**, and anyone can then download and install it.

---

## 7. Where to Use the Skill: Claude Code vs Claude.ai

Which path you take depends on **where** you want to use the skill. The `plugin.json` you built is specifically a **Claude Code** structure — but the underlying skill also works on **Claude.ai** without needing that wrapper at all. Here are both paths, from the official docs.

### Path 1: Claude Code (uses `.claude-plugin/plugin.json`)

Drop the whole plugin folder into one of these locations:

```bash
# Personal — available in all your projects
~/.claude/skills/nextjs-project-setup-skill/

# Project-specific — shared with anyone who clones the repo
.claude/skills/nextjs-project-setup-skill/
```

Since you have a `plugin.json`, the folder should follow the **plugin layout** we discussed (`.claude-plugin/plugin.json` + components at the root) rather than being just the bare skill folder.

After placing it, **start a new Claude Code session** and run `/skills` to confirm it loaded.

### Path 2: Claude.ai (web or desktop app)

This path **does not need `plugin.json` at all** — that field is Claude Code-only. You just need the `SKILL.md` + `assets/` folder:

1. **Zip** your skill folder (`SKILL.md` at the root, `assets/` alongside it — **no `.claude-plugin/` needed here**).
2. Go to **Settings → Customize → Skills**.
3. Click **"+" → "Create skill"**.
4. **Upload the ZIP**.

It'll appear in your skills list, toggle-able on/off.

> Note: This makes the skill **private to your account**. If you're on **Team/Enterprise** and want to share it org-wide, that's a separate "provision skills for your organization" step under **Organization settings**.

### Which one do you need?

| You want to use it in... | Do you need `plugin.json`? | How to install |
|--------------------------|----------------------------|----------------|
| **Claude Code** (terminal/IDE) | ✅ Yes (plugin layout) | Drop into `~/.claude/skills/` or `.claude/skills/`, then `/skills` |
| **Claude.ai** (chat) | ❌ No — skip it | Zip `SKILL.md` + `assets/`, upload via Settings → Skills |

> Decision point: If your target is **Claude.ai**, you can skip the whole `plugin.json` step — just zip and upload the skill folder directly. The plugin wrapper is only for Claude Code.

---

## 8. How to Publish a Skill

There are two main ways to publish a skill:

### 1. Claude Marketplace

Publish it directly to the **Claude Marketplace** so users can discover and install it through the plugin manager.

### 2. npm publish via `skills.sh` (GitHub route)

Use the **`skills.sh`** tool to publish. The flow:

1. **Publish the skill on GitHub** (a "GitHub Skill Publish").
2. Anyone can then install it with:

```bash
npx skills add <repo_url>
```

#### What `npx skills add` does under the hood

```
                 Publish?
                    │
       ┌────────────┴─────────────┐
   npm publish              Claude Marketplace
     (dev)                        │
       │                          │
     skills.sh ──────────────────┘
       │
GitHub Skill Publish
       │
npx skills add <repo_name>
       │
       └──────────► Claude / tools configure
```

- The `npx skills add <repo_url>` tool **checks whether the skill is available on `skills.sh`**.
- **If it's registered on `skills.sh`**, it pulls it from there.
- **If not**, it will **pull the repo directly** from the given URL — so anyone can use it even if it isn't formally registered.
- Finally, it **configures the skill with your coding agent** (Claude / tools configure), wiring up everything automatically.

### Publishing a Skill on GitHub — the exact folder restructure

Before pushing to GitHub, restructure the repo into the proper plugin layout:

1. **Keep `.claude-plugin/` at the root** (outside everything else) — it holds `plugin.json`.
2. **Create a `skills/` folder** and **move `SKILL.md` and the other folders** (`assets/`, `references/`, `scripts/`) into it.

Final structure:

```
next-js-skill-publish/          ← repo root
├── .claude-plugin/             ← stays at the root
│   └── plugin.json
└── skills/                     ← new folder holding the actual skill
    ├── assets/
    ├── references/
    ├── scripts/
    └── SKILL.md
```

3. Then commit and push to GitHub:

```bash
git init
git add .
git commit -m "Publish Next.js setup skill"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

Once it's on GitHub, anyone can install it with:

```bash
npx skills add <repo_url>
```

### Where does `.mcp.json` go?

If your skill bundles an MCP server, the `.mcp.json` file goes at the **plugin root** — as a **sibling to `.claude-plugin/`**, at the same level as `skills/`:

```
nextjs-project-setup-skill/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── ...
└── .mcp.json          ← here (plugin root, NOT inside .claude-plugin/)
```

Remember: only `plugin.json` lives inside `.claude-plugin/`. Everything else that runs — `skills/`, `.mcp.json`, `hooks/`, `agents/`, `.lsp.json` — sits at the plugin root.

### What a skill can bundle (recap)

A published skill can package together:

- **MCP**
- **PLUGIN**
- **CONNECTOR**
- **SKILLS**
- **MD files and folders**

> So publishing isn't limited to plain markdown — a single publishable skill can carry MCP servers, plugins, connectors, and documentation together, and `npx skills add` sets it all up on the installer's machine.

---

## 9. Reference: MCP vs Connector vs Skill vs Plugin

These four are often confused as competing choices, but they're actually **different layers** that work together. Here's the clean breakdown.

### MCP (Model Context Protocol)

The **open standard / protocol** — think of it as "USB for AI." It's the universal way for an AI assistant to plug into external software and tools.

- An **MCP server** is the *machinery*: a live service that tells the AI what a tool can do and executes those tool calls.
- It defines *how* the AI and an external tool talk to each other.
- It's the connection to the outside world.

### Connector

A **connector is an MCP server seen from the user's side** — the thing you click **"Connect"** on in Claude's settings.

- It's a **bridge** between Claude and an external app or service (Gmail, Slack, GitHub, a database, etc.).
- Once connected, Claude can read that service's data and take actions in it, right from the chat.
- It **inherits your permissions** — Claude can only see and do what you already can in the connected service.
- Connectors are typically the **official, vetted** integrations Anthropic has reviewed and surfaced inside the Claude interface.

> In short: **MCP = the protocol/machinery. Connector = the same MCP server from the user's "click to connect" perspective.**

### Skill

A **skill is a capability** — a reusable folder of instructions, scripts, and resources (`SKILL.md` + optional `scripts/`, `references/`, `assets/`) that teaches Claude *how* to do a repeatable, specialized task.

- Skills hold **method / know-how**, not connections.
- Loaded progressively (metadata first, body on trigger, resources on demand).
- A skill *can use* MCP tools, but it isn't itself a connection to the outside world.

### Plugin

A **plugin is the package** — a bundle that ships any combination of the above (skills, agents, hooks, commands, and MCP server references) as a single installable toolkit.

- Plugins can reference both **remote and local MCP servers**.
- They're how you **distribute** a job-specific toolkit through a marketplace or GitHub.
- A plugin can *contain* skills; a skill can *use* MCP tools.

### Quick comparison

| Concept | What it is | Role | Analogy |
|---------|-----------|------|---------|
| **MCP** | Open protocol + server | The machinery/connection to external tools | The USB standard |
| **Connector** | An MCP server from the user's side | Click-to-connect bridge to an app/service | Plugging a device into the USB port |
| **Skill** | Folder of instructions + scripts + resources | Teaches Claude *how* to do a task (method) | A recipe / playbook |
| **Plugin** | A packaged bundle | *Ships* skills, agents, hooks, MCP refs together | The box the recipe + tools come in |

### How they fit together

> These are not competing choices — they're **layers**:
> - A **skill** is a capability (method).
> - **MCP** is the connection to the outside world; a **connector** is that connection from the user's click-to-connect view.
> - A **plugin** is the package that ships any of them.
>
> So a single **plugin** might bundle a **skill** that calls an **MCP** server, which the user experiences as a **connector**.

> Sources: [Drag: MCP Server vs Connector vs Plugin vs Skill](https://www.dragapp.com/blog/mcp-server-vs-connector-vs-plugin-vs-skill/), [Claude docs: What to build](https://claude.com/docs/connectors/building/what-to-build), [Claude docs: Connectors overview](https://claude.com/docs/connectors/overview), [DesignRevision: Skills vs Plugins vs Agents vs MCP](https://designrevision.com/blog/claude-code-skills-vs-plugins-vs-agents). Content was rephrased for compliance with licensing restrictions.
