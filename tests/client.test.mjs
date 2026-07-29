import assert from 'node:assert/strict'
import test from 'node:test'

import {
	ChatCompletionsClient,
	RequestAbortedError,
	RequestTimeoutError,
} from '../dist/index.js'
import { openAI } from '../dist/vendors/openai.js'

const request = {
	model: 'test-model',
	messages: [{ role: 'user', content: 'hello' }],
}

const chunk = {
	id: 'chunk-1',
	object: 'chat.completion.chunk',
	created: 1,
	model: 'test-model',
	choices: [
		{
			index: 0,
			delta: { content: 'hello' },
			finish_reason: null,
		},
	],
}

function streamResponse(parts, onCancel) {
	const encoder = new TextEncoder()
	return new Response(
		new ReadableStream({
			start(controller) {
				for (const part of parts) controller.enqueue(encoder.encode(part))
				controller.close()
			},
			cancel(reason) {
				onCancel?.(reason)
			},
		}),
	)
}

function streamingClient(response, options = {}) {
	return new ChatCompletionsClient({
		apiKey: 'test',
		...options,
		fetch: async () => response,
	})
}

test('parses fragmented SSE and split UTF-8 sequences', async () => {
	const json = JSON.stringify({
		...chunk,
		choices: [{ ...chunk.choices[0], delta: { content: 'привет' } }],
	})
	const bytes = new TextEncoder().encode(`data: ${json}\n\ndata: [DONE]\n\n`)
	const parts = Array.from(bytes, (byte) => new Uint8Array([byte]))
	const response = new Response(
		new ReadableStream({
			start(controller) {
				for (const part of parts) controller.enqueue(part)
				controller.close()
			},
		}),
	)

	const result = []
	for await (const item of streamingClient(
		response,
	).createStreamingChatCompletion(request)) {
		result.push(item)
	}

	assert.equal(result[0].choices[0].delta.content, 'привет')
})

test('accepts data fields without a space after the colon', async () => {
	const response = streamResponse([
		`data:${JSON.stringify(chunk)}\n\ndata:[DONE]\n\n`,
	])
	const result = []
	for await (const item of streamingClient(
		response,
	).createStreamingChatCompletion(request)) {
		result.push(item)
	}
	assert.deepEqual(result, [chunk])
})

test('flushes the final SSE event at EOF without a trailing newline', async () => {
	const response = streamResponse([`data: ${JSON.stringify(chunk)}`])
	const result = []
	for await (const item of streamingClient(
		response,
	).createStreamingChatCompletion(request)) {
		result.push(item)
	}
	assert.deepEqual(result, [chunk])
})

test('joins multiline SSE data fields', async () => {
	const json = JSON.stringify(chunk)
	const split = json.indexOf(',') + 1
	const response = streamResponse([
		`data: ${json.slice(0, split)}\ndata: ${json.slice(split)}\n\n`,
	])
	const result = []
	for await (const item of streamingClient(
		response,
	).createStreamingChatCompletion(request)) {
		result.push(item)
	}
	assert.deepEqual(result, [chunk])
})


test('supports CRLF and lone-CR SSE line endings', async () => {
	for (const separator of ['\r\n', '\r']) {
		const response = streamResponse([
			`data: ${JSON.stringify(chunk)}${separator}${separator}`,
		])
		const result = []
		for await (const item of streamingClient(
			response,
		).createStreamingChatCompletion(request)) {
			result.push(item)
		}
		assert.deepEqual(result, [chunk])
	}
})

test('rejects oversized SSE events', async () => {
	const response = streamResponse([`data: ${'x'.repeat(64)}\n\n`])
	const client = streamingClient(response, { maxSSEEventSize: 32 })
	await assert.rejects(async () => {
		for await (const _ of client.createStreamingChatCompletion(request)) {
			// No-op.
		}
	}, /SSE event exceeds/)
})

test('cancels the reader when the consumer leaves the loop early', async () => {
	let cancelled = false
	const encoder = new TextEncoder()
	const response = new Response(
		new ReadableStream({
			start(controller) {
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
				)
			},
			cancel() {
				cancelled = true
			},
		}),
	)

	for await (const _ of streamingClient(
		response,
	).createStreamingChatCompletion(request)) {
		break
	}

	assert.equal(cancelled, true)
})

test('keeps the timeout active when a user signal is also supplied', async () => {
	const external = new AbortController()
	const client = new ChatCompletionsClient({
		apiKey: 'test',
		timeout: 20,
		fetch: async (_input, init) =>
			new Promise((resolve, reject) => {
				const timer = setTimeout(
					() => resolve(Response.json({ ok: true })),
					100,
				)
				init.signal?.addEventListener(
					'abort',
					() => {
						clearTimeout(timer)
						reject(init.signal.reason)
					},
					{ once: true },
				)
			}),
	})

	await assert.rejects(
		client.createChatCompletion(request, { signal: external.signal }),
		RequestTimeoutError,
	)
})


test('keeps the timeout active while a streaming body is being read', async () => {
	const client = new ChatCompletionsClient({
		timeout: 20,
		fetch: async (_input, init) =>
			new Response(
				new ReadableStream({
					start(controller) {
						const fail = () => controller.error(init.signal.reason)
						if (init.signal?.aborted) fail()
						else init.signal?.addEventListener('abort', fail, { once: true })
					},
				}),
			),
	})

	await assert.rejects(async () => {
		for await (const _ of client.createStreamingChatCompletion(request)) {
			// No-op.
		}
	}, RequestTimeoutError)
})

test('distinguishes an explicit abort from a timeout', async () => {
	const controller = new AbortController()
	const reason = new Error('cancelled by caller')
	const client = new ChatCompletionsClient({
		apiKey: 'test',
		timeout: 1000,
		fetch: async (_input, init) =>
			new Promise((_resolve, reject) => {
				if (init.signal?.aborted) {
					reject(init.signal.reason)
					return
				}
				init.signal?.addEventListener(
					'abort',
					() => reject(init.signal.reason),
					{ once: true },
				)
			}),
	})

	const pending = client.createChatCompletion(request, {
		signal: controller.signal,
	})
	controller.abort(reason)

	await assert.rejects(pending, (error) => {
		assert.ok(error instanceof RequestAbortedError)
		assert.equal(error.reason, reason)
		return true
	})
})

test('preserves a plain-text HTTP error body', async () => {
	const client = new ChatCompletionsClient({
		fetch: async () => new Response('upstream exploded', { status: 500 }),
	})

	await assert.rejects(client.createChatCompletion(request), (error) => {
		assert.equal(error.message, 'upstream exploded')
		assert.equal(error.error, 'upstream exploded')
		return true
	})
})


test('retains the upstream request id on HTTP errors', async () => {
	const client = new ChatCompletionsClient({
		fetch: async () =>
			Response.json(
				{ error: { message: 'bad request' } },
				{ status: 400, headers: { 'x-request-id': 'req-123' } },
			),
	})

	await assert.rejects(client.createChatCompletion(request), (error) => {
		assert.equal(error.requestId, 'req-123')
		assert.equal(error.message, 'bad request')
		return true
	})
})

test('does not require a Response from the current realm', async () => {
	const responseLike = {
		ok: true,
		status: 200,
		headers: new Headers(),
		json: async () => ({
			id: 'response-1',
			object: 'chat.completion',
			created: 1,
			model: 'test-model',
			choices: [],
		}),
	}
	const client = new ChatCompletionsClient({
		fetch: async () => responseLike,
	})
	const response = await client.createChatCompletion(request)
	assert.equal(response.id, 'response-1')
})

test('normalizes a trailing slash and permits per-request header overrides', async () => {
	let capturedURL
	let capturedHeaders
	const client = new ChatCompletionsClient({
		apiKey: 'client-key',
		baseURL: 'https://example.test/v1///',
		headers: () => ({ 'X-Client': 'yes', Authorization: 'custom' }),
		fetch: async (input, init) => {
			capturedURL = String(input)
			capturedHeaders = new Headers(init.headers)
			return Response.json({
				id: 'response-1',
				object: 'chat.completion',
				created: 1,
				model: 'test-model',
				choices: [],
			})
		},
	})

	await client.createChatCompletion(request, {
		headers: { 'X-Client': 'request' },
	})

	assert.equal(capturedURL, 'https://example.test/v1/chat/completions')
	assert.equal(capturedHeaders.get('authorization'), 'custom')
	assert.equal(capturedHeaders.get('x-client'), 'request')
})

test('OpenAI vendor options stay isolated and compose with the core client', async () => {
	let capturedURL
	let capturedHeaders
	const client = new ChatCompletionsClient({
		...openAI({
			apiKey: 'openai-key',
			endpoint: 'https://openai.example/custom-chat',
			organization: 'org-1',
			project: 'project-1',
		}),
		fetch: async (input, init) => {
			capturedURL = String(input)
			capturedHeaders = new Headers(init.headers)
			return Response.json({
				id: 'response-1',
				object: 'chat.completion',
				created: 1,
				model: 'test-model',
				choices: [],
			})
		},
	})

	await client.createChatCompletion(request)
	assert.equal(capturedURL, 'https://openai.example/custom-chat')
	assert.equal(capturedHeaders.get('authorization'), 'Bearer openai-key')
	assert.equal(capturedHeaders.get('openai-organization'), 'org-1')
	assert.equal(capturedHeaders.get('openai-project'), 'project-1')
})
