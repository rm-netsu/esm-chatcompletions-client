# ESM Chat Completions Client

A lightweight, zero-dependency, ESM-only TypeScript client for the common
subset of OpenAI-compatible Chat Completions APIs.

The library intentionally does one thing: it sends Chat Completions requests
and decodes their JSON or SSE responses. It does not hide requests behind a
large SDK, retry them implicitly, validate provider-specific schemas at
runtime, or require provider adapters.

## Installation

For GitHub Packages, add the registry to `.npmrc`:

```ini
@rm-netsu:registry=https://npm.pkg.github.com
```

```bash
npm install @rm-netsu/esm-chatcompletions-client
# or
bun add @rm-netsu/esm-chatcompletions-client
```

## Basic usage

```typescript
import { ChatCompletionsClient } from '@rm-netsu/esm-chatcompletions-client'

const client = new ChatCompletionsClient({
	apiKey: process.env.OPENAI_API_KEY,
	timeout: 30_000,
})

const response = await client.createChatCompletion({
	model: 'gpt-4o-mini',
	messages: [{ role: 'user', content: 'Tell me a short joke.' }],
	temperature: 0.7,
})

console.log(response.choices[0]?.message.content)
```

## Streaming

```typescript
const stream = client.createStreamingChatCompletion({
	model: 'gpt-4o-mini',
	messages: [{ role: 'user', content: 'Write a short poem.' }],
})

for await (const chunk of stream) {
	const content = chunk.choices[0]?.delta.content
	if (content) process.stdout.write(content)
}
```

Leaving the loop early cancels the response body, so the connection and
upstream generation are not left running unnecessarily.

## Any compatible provider

Use `endpoint` when a provider does not follow the conventional
`<baseURL>/chat/completions` layout. `apiKey` is optional; authentication can be
implemented entirely with headers.

```typescript
const client = new ChatCompletionsClient({
	endpoint: 'https://provider.example/api/generate-chat?version=2',
	headers: async () => ({
		'X-API-Key': await obtainCurrentToken(),
	}),
})
```

Static client headers can be overridden for one request:

```typescript
await client.createChatCompletion(request, {
	headers: { 'X-Trace-ID': traceId },
	timeout: 10_000,
	signal: controller.signal,
})
```

The timeout and the caller's `AbortSignal` remain active together. Explicit
cancellation throws `RequestAbortedError`; an elapsed timeout throws
`RequestTimeoutError`.

## Provider-specific fields

The core request describes a deliberately conservative common API, but unknown
request fields are passed through unchanged:

```typescript
const response = await client.createChatCompletion({
	model: 'provider-model',
	messages: [{ role: 'user', content: 'Hello' }],
	provider_specific_option: { mode: 'fast' },
})
```

For reusable provider typing, define an extension or publish it as a separate
vendor module. The package includes an optional OpenAI module:

```typescript
import { ChatCompletionsClient } from '@rm-netsu/esm-chatcompletions-client'
import {
	openAI,
	type OpenAIChatCompletionRequest,
} from '@rm-netsu/esm-chatcompletions-client/vendors/openai'

const client = new ChatCompletionsClient(
	openAI({
		apiKey: process.env.OPENAI_API_KEY,
		organization: process.env.OPENAI_ORGANIZATION,
	}),
)

const request: OpenAIChatCompletionRequest = {
	model: 'gpt-4o-mini',
	messages: [
		{ role: 'developer', content: 'Reply briefly.' },
		{ role: 'user', content: 'Hello' },
	],
	max_completion_tokens: 200,
	stream_options: { include_usage: true },
}
```

Importing the core package does not import vendor code.

## Extended response types

The methods accept a custom response or streaming chunk type without changing
runtime behavior:

```typescript
import type {
	ChatCompletionResponse,
} from '@rm-netsu/esm-chatcompletions-client'

interface ProviderResponse extends ChatCompletionResponse {
	provider_trace_id: string
}

const response = await client.createChatCompletion<ProviderResponse>(request)
console.log(response.provider_trace_id)
```

## Error handling

```typescript
import {
	APIConnectionError,
	AuthenticationError,
	ChatCompletionsError,
	RateLimitError,
	RequestAbortedError,
	RequestTimeoutError,
} from '@rm-netsu/esm-chatcompletions-client'
```

HTTP errors retain the status, response headers, parsed or plain-text error
body, and `x-request-id` when present. The client does not retry automatically;
a caller can wrap the supplied `fetch` or retry at the application boundary
with provider-appropriate policy.

## Client options

| Option | Purpose |
| --- | --- |
| `apiKey` | Optional bearer token |
| `baseURL` | Base URL; `/chat/completions` is appended |
| `endpoint` | Full endpoint URL; overrides `baseURL` |
| `headers` | Static or async headers provider |
| `timeout` | Overall timeout in milliseconds; `0` disables it |
| `maxSSEEventSize` | Maximum decoded SSE event size; default 1 MiB |
| `fetch` | Custom Fetch implementation |

The legacy `organization` and `project` options remain as compatibility shims.
New code should use `vendors/openai` instead.

## Supported environments

- Node.js 18+
- Bun 1.0+
- Modern browsers with Fetch, Streams, `TextDecoder`, and `AbortController`

Do not embed a long-lived provider API key in browser code. Browser usage should
normally target a trusted application backend or use short-lived credentials.

## Development

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

The build is plain standards-based ESM emitted by TypeScript; no runtime
packages or bundler are required.
