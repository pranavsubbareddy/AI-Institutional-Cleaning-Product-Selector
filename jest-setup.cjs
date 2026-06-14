// Polyfill TextEncoder/TextDecoder for LangChain in Jest (jsdom environment)
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill ReadableStream for @langchain/openai and @langchain/google-genai
if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = require('stream/web').ReadableStream;
}
