/**
 * Streaming support for Chat Completions API
 * Implements SSE (Server-Sent Events) parsing without external dependencies
 */

import { AbortError, ParseError } from './errors.js'
import type { ChatCompletionChunk } from './types.js'

/** Internal SSE event structure */
interface SSEEvent {
	event?: string
	data?: string
	id?: string
	retry?: number
}

/** Parses a single SSE line */
const parseSSELine = (line: string): SSEEvent | null => {
	// Skip comments
	if (line.startsWith(':')) return null

	// Split on first colon
	const colonIndex = line.indexOf(':')
	let field: string
	let value: string

	if (colonIndex === -1) {
		field = line
		value = ''
	} else {
		field = line.slice(0, colonIndex)
		// Skip optional leading space after colon
		value = line.slice(colonIndex + 1).replace(/^ /, '')
	}

	return { [field]: value } as SSEEvent
}

/** Parses a complete SSE data field (may be JSON) */
const parseSSEData = (data: string): unknown => {
	// Try to parse as JSON, but handle cases where it might not be valid JSON
	if (data.trim() === '') return null

	try {
		return JSON.parse(data)
	} catch {
		// Return raw string if not valid JSON
		return data
	}
}

/**
 * Creates an async generator that yields ChatCompletionChunk objects from a ReadableStream
 * This implements SSE (Server-Sent Events) parsing manually without external dependencies
 */
export async function* parseSSEStream(
	body: ReadableStream<Uint8Array>,
	signal?: AbortSignal,
): AsyncGenerator<ChatCompletionChunk, void, unknown> {
	const reader = body.getReader()
	const decoder = new TextDecoder('utf-8')

	// Buffer to hold incomplete lines
	let buffer = ''

	// Track if stream is done
	let done = false

	// Handle abort signal
	if (signal)
		signal.addEventListener('abort', () => {
			reader.cancel().catch(() => {})
		})

	try {
		while (!done) {
			// Check for abort before reading
			if (signal?.aborted) throw new AbortError()

			const { value, done: readerDone } = await reader.read()

			if (readerDone) {
				done = true

				// Process any remaining buffer
				if (buffer.trim()) {
					const event = parseSSELine(buffer)
					if (event?.data && event.data !== '[DONE]') {
						const parsedData = parseSSEData(event.data)
						if (parsedData && typeof parsedData === 'object')
							yield parsedData as ChatCompletionChunk
					}
				}
				continue
			}

			// Decode the chunk and add to buffer
			const decoded = decoder.decode(value, { stream: true })
			buffer += decoded

			// Process complete lines (separated by double newline)
			const lines = buffer.split('\n')

			// Keep the last incomplete line in the buffer
			buffer = lines.pop() || ''

			// Process each complete line
			for (const line of lines) {
				const trimmedLine = line.trim()

				if (!trimmedLine) continue

				const event = parseSSELine(trimmedLine)

				if (!event) continue

				// Handle [DONE] signal
				if (event.data === '[DONE]') {
					done = true
					break
				}

				// Parse and yield the data
				if (event.data) {
					const parsedData = parseSSEData(event.data)

					if (parsedData === null) continue

					// Validate it's a valid ChatCompletionChunk
					if (
						parsedData &&
						typeof parsedData === 'object' &&
						'object' in parsedData &&
						parsedData.object === 'chat.completion.chunk'
					) {
						yield parsedData as ChatCompletionChunk
					} else if (typeof parsedData === 'object') {
						// Yield any valid JSON object as a chunk (for compatibility)
						yield parsedData as ChatCompletionChunk
					}
				}
			}
		}
	} finally {
		// Always release the reader
		reader.releaseLock()
	}
}

/**
 * Creates a simple async iterator wrapper for streaming responses
 * This provides a cleaner API for consuming streaming responses
 */
export const createStreamIterator = (
	response: Response,
): AsyncGenerator<ChatCompletionChunk, void, unknown> => {
	if (!response.body)
		throw new ParseError('Response body is null', response.status)

	const signal = response
		.clone()
		.headers.get('content-type')
		?.includes('text/event-stream')
		? undefined
		: undefined

	return parseSSEStream(response.body, signal)
}

/**
 * Utility function to collect all chunks and combine them into a complete response
 *
 * @todo Implement tokens counting
 */
export const collectStreamResponse = async (
	stream: AsyncGenerator<ChatCompletionChunk, void, unknown>,
): Promise<{
	chunks: ChatCompletionChunk[]
	combinedContent: string
	totalUsage: {
		prompt_tokens: number
		completion_tokens: number
		total_tokens: number
	}
}> => {
	const chunks: ChatCompletionChunk[] = []
	let combinedContent = ''
	const totalPromptTokens = 0
	const totalCompletionTokens = 0

	for await (const chunk of stream) {
		chunks.push(chunk)

		// Extract content from delta
		if (chunk.choices?.[0]?.delta?.content) {
			combinedContent += chunk.choices[0].delta.content
		}

		// Accumulate usage if present (only in last chunk typically)
		if (chunk.choices?.[0]?.finish_reason) {
			// Usage might be in any chunk, accumulate from all
		}
	}

	return {
		chunks,
		combinedContent,
		totalUsage: {
			prompt_tokens: totalPromptTokens,
			completion_tokens: totalCompletionTokens,
			total_tokens: totalPromptTokens + totalCompletionTokens,
		},
	}
}

/**
 * Creates a transform stream that converts SSE to JSON lines
 * Useful for debugging or logging
 */
export const createSSEToJSONLines = (): TransformStream<Uint8Array, string> => {
	let buffer = ''
	const decoder = new TextDecoder('utf-8')

	return new TransformStream({
		transform(chunk, controller) {
			buffer += decoder.decode(chunk, { stream: true })
			const lines = buffer.split('\n')
			buffer = lines.pop() || ''

			for (const line of lines) {
				const trimmed = line.trim()
				if (trimmed && !trimmed.startsWith(':'))
					if (trimmed.startsWith('data: ')) {
						const data = trimmed.slice(6)
						if (data !== '[DONE]')
							try {
								const json = JSON.parse(data)
								controller.enqueue(`${JSON.stringify(json)}\n`)
							} catch {
								// Skip invalid JSON
							}
					}
			}
		},
		flush(controller) {
			if (buffer.trim()) controller.enqueue(`${buffer}\n`)
		},
	})
}
