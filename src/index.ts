import { MCPClient } from './client';
import { CustomMCPServer } from './server';

// const server = new CustomMCPServer();
// server.run().catch(console.error);

const client = new MCPClient({
  name: 'mcp-client',
  version: '1.0.0',
  googleGeminiOptions: { apiKey: process.env.GEMINI_API_KEY },
});

client.connectToServer('build/server.js');

const res = client.processQuery('Hello, can I get tomatoes with size L?');
