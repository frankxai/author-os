import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { authorOsToolDefinitions, callAuthorOsTool } from './tools.js';

function zodShapeFromJsonSchema(schema = {}) {
  const shape = {};
  for (const [key, property] of Object.entries(schema.properties || {})) {
    let value;
    switch (property.type) {
      case 'number':
        value = z.number();
        break;
      case 'boolean':
        value = z.boolean();
        break;
      case 'array':
        value = z.array(z.unknown());
        break;
      case 'object':
        value = z.record(z.string(), z.unknown());
        break;
      case 'string':
      default:
        value = z.string();
    }
    if (!schema.required?.includes(key)) value = value.optional();
    shape[key] = value.describe(property.description || key);
  }
  return shape;
}

export async function startAuthorOsMcpSdkServer() {
  const server = new McpServer({
    name: 'author-os',
    version: '0.2.0',
  });

  for (const tool of authorOsToolDefinitions) {
    server.tool(
      tool.name,
      tool.description,
      zodShapeFromJsonSchema(tool.inputSchema),
      async input => callAuthorOsTool(tool.name, input),
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
