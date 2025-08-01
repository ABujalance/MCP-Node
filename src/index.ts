#!/usr/bin/env node
import { Server as MCPServer } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

export class CustomMCPServer {
  private server: MCPServer;

  constructor() {
    console.debug('[Setup] Initializing Custom MCP server...');

    this.server = new MCPServer(
      {
        name: 'custom-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error('[Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.debug('MCP server running on stdio');
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'get_potatoes',
          description: 'Get ammount of potatoes by size',
          inputSchema: {
            type: 'object',
            properties: {
              size: {
                type: 'string',
                description: 'Potato size (S, M or L)',
              },
            },
            required: ['size'],
          },
        },
        {
          name: 'get_tomatoes',
          description: 'Get ammount of potatoes by color or size',
          inputSchema: {
            type: 'object',
            properties: {
              size: {
                type: 'string',
                description: 'Size (S, M or L)',
              },
              color: {
                type: 'string',
                description: 'Color (Red or Green)',
              },
            },
            required: ['size'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        if (!['get_potatoes', 'get_tomatoes'].includes(request.params.name)) {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`,
          );
        }

        const args = request.params.arguments as {
          size: string;
          color?: string;
        };

        if (!args.size) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Missing required parameter: size',
          );
        }

        switch (request.params.name) {
          case 'get_potatoes': {
            console.debug(`[API] Fetching potatoes for size: ${args.size}`);
            const response = 10;

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      size: args.size,
                      quantity: response,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }
          case 'get_tomatoes': {
            console.debug(
              `[API] Fetching tomatoes for size: ${args.size} and color: ${args.color}`,
            );
            const response = 15;

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      size: args.size,
                      quantity: response,
                    },
                    null,
                    2,
                  ),
                },
              ],
            };
          }
          default: {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({}, null, 2),
                },
              ],
            };
          }
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error('[Error] Failed to fetch data:', error);
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to fetch data: ${error.message}`,
          );
        }
        throw error;
      }
    });
  }
}

const server = new CustomMCPServer();
server.run().catch(console.error);
