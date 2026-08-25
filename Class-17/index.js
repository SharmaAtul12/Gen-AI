import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as z from "zod/v4";

import { createMcpExpressApp } from '@modelcontextprotocol/express';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';


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

server.registerTool(
  'subtract',
  {
    title: 'subtract',
    description: 'subtract two numbers',
    inputSchema: z.object({ num1: z.number(), num2: z.number() }),
  },
  async (ctx) => {
    return {
      content: [{ type: 'text', text: `${ctx.num1 - ctx.num2}` }],
    };
  },
);

async function runServerOnStdIOTransport() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

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

runServerOnStdIOTransport();
runServerOnHttpTransport();
