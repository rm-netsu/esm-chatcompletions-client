# ESM Chat Completions Client

A lightweight, zero-dependency, ESM-compatible TypeScript client for OpenAI-compatible Chat Completions APIs.

## Installation

Add to .npmrc to use package from github
```
@rm-netsu:registry=https://npm.pkg.github.com
```

Install with npm:
```bash
npm install @rm-netsu/esm-chatcompletions-client
```

Install with bun:
```bash
bun add @rm-netsu/esm-chatcompletions-client
```

## Usage example

```typescript
import { ChatCompletionsClient } from '@rm-netsu/chat-completions-client'

const client = new ChatCompletionsClient({
	apiKey: 'your-openai-api-key',
	timeout: 30000, // optional, 30 seconds
});

// Non‑streaming example
const nonStreaming = async () => {
	const response = await client.createChatCompletion({
		model: 'gpt-4o-mini',
		messages: [{ role: 'user', content: 'Tell me a joke.' }],
		temperature: 0.7,
	})
	console.log(response.choices[0].message.content)
}

// Streaming example
const streaming = async () => {
	const stream = client.createStreamingChatCompletion({
		model: 'gpt-4o-mini',
		messages: [{
			role: 'user',
			content: 'Write a short poem about coding.',
		}],
	})

	for await (const chunk of stream) {
		const content = chunk.choices[0]?.delta?.content;
		if (content) process.stdout.write(content);
	}
	console.log() // final newline
}
```

## Supported Environments

- Node.js 18+
- Bun 1.0+
- Modern browsers (Chrome, Firefox, Safari, Edge)
