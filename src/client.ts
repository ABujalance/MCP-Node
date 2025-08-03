import {
  Content,
  FunctionDeclaration,
  GoogleGenAI,
  GoogleGenAIOptions,
} from '@google/genai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  ListToolsResultSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';

dotenv.config();

interface MCPClientConfig {
  name?: string;
  version?: string;
  googleGeminiOptions?: GoogleGenAIOptions;
}

export class MCPClient {
  private client: Client | null = null;
  private googleGemini: GoogleGenAI;
  private transport: StdioClientTransport | null = null;

  constructor(config: MCPClientConfig = {}) {
    this.googleGemini = new GoogleGenAI(config.googleGeminiOptions || {});
  }

  async connectToServer(serverScriptPath: string): Promise<void> {
    const isPython = serverScriptPath.endsWith('.py');
    const isJs = serverScriptPath.endsWith('.js');

    if (!isPython && !isJs) {
      throw new Error('Server script must be a .py or .js file');
    }

    const command = isPython ? 'python' : 'node';

    this.transport = new StdioClientTransport({
      command,
      args: [serverScriptPath],
    });

    this.client = new Client(
      {
        name: 'mcp-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      },
    );

    await this.client.connect(this.transport);

    // List available tools
    const response = await this.client.request(
      { method: 'tools/list' },
      ListToolsResultSchema,
    );

    console.log(
      '\nConnected to server with tools:',
      response.tools.map((tool: any) => tool.name),
    );
  }

  async processQuery(query: string): Promise<string> {
    if (!this.client) {
      throw new Error('Client not connected');
    }

    // Initialize messages array with user query
    let messages: Content = {
      role: 'user',
      parts: [{ text: query }],
    };
    // Get available tools
    const toolsResponse = await this.client.request(
      { method: 'tools/list' },
      ListToolsResultSchema,
    );

    const availableTools: FunctionDeclaration[] = toolsResponse.tools.map(
      this.convertMcpSchemaToGemini,
    );

    const finalText: string[] = [];
    let currentResponse = await this.googleGemini.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: messages,
      config: { tools: [{ functionDeclarations: availableTools }] },
    });

    // Process the response and any tool calls

    const firstPart = currentResponse?.candidates?.[0].content?.parts?.[0];

    console.log({ firstPart });

    if (!firstPart) {
      return 'No response found';
    }

    if (firstPart.functionCall) {
      console.info('Model wants to call a tool: ', firstPart.functionCall);

      const toolResult = this.executeMCPTool(firstPart.functionCall);
    }

    return 'Bye';
  }

  private executeMCPTool(toolCall: any) {
    console.log({ toolCall });
    // const { name, args } = toolCall;
    // console.log(`Executing mock MCP tool: ${name} with arguments:`, args);

    // if (name === 'get_weather_data') {
    //   const location = args.location;
    //   // Simulate a successful API response from the MCP server
    //   const weatherData = {
    //     location: location,
    //     temperature: '22°C',
    //     condition: 'Sunny',
    //     windSpeed: '15 km/h',
    //   };
    //   return {
    //     name: 'get_weather_data',
    //     result: weatherData,
    // //   };
    // }

    // Handle other potential tool calls
    // return {
    //   name: name,
    //   result: { error: 'Unknown tool' },
    // };
  }

  private convertMcpSchemaToGemini(mcpTool: Tool) {
    const deepConvert = (schema: any) => {
      // If schema is not an object, return as is.
      if (typeof schema !== 'object' || schema === null) {
        return schema;
      }

      // Create a new object to avoid modifying the original.
      const converted: any = {};

      for (const key in schema) {
        if (schema.hasOwnProperty(key)) {
          if (key === 'type' && typeof schema[key] === 'string') {
            // Convert the type to uppercase for Gemini API compatibility.
            converted[key] = schema[key].toUpperCase();
          } else if (key === 'properties' && typeof schema[key] === 'object') {
            // Recursively convert properties object.
            converted[key] = deepConvert(schema[key]);
          } else if (key === 'items' && typeof schema[key] === 'object') {
            // Recursively convert array items object.
            converted[key] = deepConvert(schema[key]);
          } else {
            // Keep other properties as they are.
            converted[key] = schema[key];
          }
        }
      }
      return converted;
    };

    return {
      name: mcpTool.name,
      description: mcpTool.description,
      parameters: deepConvert(mcpTool.inputSchema),
    };
  }
}
