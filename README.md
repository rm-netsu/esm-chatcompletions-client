# ESM Chat Completions Client

A lightweight, zero-dependency, ESM-compatible TypeScript client for OpenAI-compatible Chat Completions APIs.

## Features

- **Zero Runtime Dependencies** - Only uses native ECMAScript APIs
- **Pure ESM** - Built as an ECMAScript Module
- **Universal Compatibility** - Works in Node.js (18+), Bun, and modern browsers
- **TypeScript Support** - Full type definitions included
- **Streaming Support** - Built-in SSE parsing for streaming responses
- **Comprehensive Types** - Complete type definitions for all API parameters
- **Error Handling** - Custom error classes with detailed error information
- **Flexible Configuration** - Support for custom fetch, headers, and base URLs

## Installation

```bash
npm install @rm-netsu/esm-chatcompletions-client
```

Or using Bun:

```bash
bun add @rm-netsu/esm-chatcompletions-client
```

## Quick Start

```typescript
import { ChatClient, userMessage, assistantMessage } from '@rm-netsu/esm-chatcompletions-client'

// Create a client
const client = new ChatClient({
	apiKey: process.env.OPENAI_API_KEY,
})

// Make a simple request
const response = await client.complete({
	messages: [
		userMessage('What is the capital of France?')
	],
	model: 'gpt-4o',
})

console.log(response.choices[0].message.content)
```

## Streaming Responses

```typescript
// Stream responses for real-time output
for await (const chunk of client.stream({
	messages: [
		userMessage('Write a story about a robot')
	],
	model: 'gpt-4o',
})) {
	const content = chunk.choices[0]?.delta?.content
	if (content) process.stdout.write(content)
}
```

## Configuration

### OpenAI

```typescript
const client = new ChatClient({
	apiKey: 'your-api-key',
	baseUrl: 'https://api.openai.com/v1',
	defaultModel: 'gpt-4o',
})
```

### Ollama (Local)

```typescript
const client = new ChatClient({
	baseUrl: 'http://localhost:11434/v1',
})
```

### Custom Headers

```typescript
const client = new ChatClient({
	apiKey: 'your-api-key',
	baseUrl: 'https://api.anthropic.com/v1',
	headers: {
		'anthropic-version': '2023-06-01',
	},
})
```

## API Reference

### ChatClient

#### Constructor Options

```typescript
interface ChatClientConfig {
	apiKey?: string           // API key for authentication
	baseUrl?: string          // Base URL (default: https://api.openai.com/v1)
	organization?: string     // Organization ID
	headers?: Record<string, string> // Additional headers
	fetch?: typeof fetch      // Custom fetch function
	defaultModel?: string     // Default model to use
	defaultTimeout?: number   // Default timeout in ms (default: 60000)
}
```

#### Methods

##### `complete(request, options?)`

Makes a non-streaming chat completion request.

```typescript
const response = await client.complete({
	messages: [userMessage('Hello')],
	model: 'gpt-4o',
	temperature: 0.7,
	max_tokens: 100,
})
```

##### `stream(request, options?)`

Makes a streaming chat completion request. Returns an async generator.

```typescript
for await (const chunk of client.stream({
	messages: [userMessage('Hello')],
	model: 'gpt-4o',
})) {
	console.log(chunk.choices[0].delta.content)
}
```

##### `chat(messages, model?, options?)`

Convenience method for simple chat interactions.

```typescript
const response = await client.chat(
	[userMessage('Hello')],
	'gpt-4o'
)
```

#### Request Options

```typescript
interface RequestOptions {
	signal?: AbortSignal     // For cancelling requests
	timeout?: number         // Request timeout in ms
	headers?: Record<string, string> // Additional headers
	apiKey?: string          // Override API key
	baseUrl?: string         // Override base URL
}
```

### Message Factory Functions

```typescript
import { 
	systemMessage, 
	userMessage, 
	assistantMessage, 
	toolMessage 
} from '@rm-netsu/esm-chatcompletions-client'

// Create messages
const messages = [
	systemMessage('You are a helpful assistant'),
	userMessage('What is 2+2?'),
	assistantMessage('2+2 equals 4'),
	userMessage('Thanks!'),
]
```

### Error Handling

```typescript
import { 
	APIError, 
	AbortError, 
	TimeoutError, 
	ValidationError,
	ConfigurationError 
} from '@rm-netsu/esm-chatcompletions-client'

try {
	const response = await client.complete({
		messages: [userMessage('Hello')],
		model: 'gpt-4o',
	})
} catch (error) {
	if (error instanceof APIError) {
		console.log('API Error:', error.message)
		console.log('Status:', error.status)
		console.log('Type:', error.type)
		console.log('Retryable:', error.retryable)
		
		// Get rate limit info
		const rateInfo = error.getRateLimitInfo()
		console.log('Rate limit:', rateInfo)
	} else if (error instanceof AbortError) {
		console.log('Request was aborted')
	} else if (error instanceof TimeoutError) {
		console.log('Request timed out')
	} else if (error instanceof ValidationError) {
		console.log('Validation error:', error.message)
		console.log('Field:', error.field)
	}
}
```

## Type Definitions

The library includes comprehensive TypeScript types for:

- All request parameters (temperature, top_p, tools, etc.)
- All response types (completion, chunk, usage)
- Message types (system, user, assistant, tool)
- Tool definitions and calls
- Error types

```typescript
import type {
	ChatCompletionRequest,
	ChatCompletionResponse,
	ChatCompletionChunk,
	ChatMessage,
	ChatTool,
	CompletionUsage,
	FinishReason,
} from '@rm-netsu/esm-chatcompletions-client'
```

## Browser Usage

The library works in browsers that support `fetch` and `ReadableStream`:

```html
<script type="module">
	import { ChatClient, userMessage } from './dist/index.js'

	const client = new ChatClient({
		apiKey: 'your-api-key',
	})

	const response = await client.complete({
		messages: [userMessage('Hello')],
		model: 'gpt-4o',
	})

	console.log(response.choices[0].message.content)
</script>
```

## Supported Environments

- Node.js 18+
- Bun 1.0+
- Modern browsers (Chrome, Firefox, Safari, Edge)

## License

MIT
