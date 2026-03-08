/**
 * Main Chat Completions API Client
 * A zero-dependency, ESM-compatible client for OpenAI-compatible Chat Completions APIs
 */

import {
	AbortError,
	APIError,
	ConfigurationError,
	NetworkError,
	TimeoutError,
	ValidationError,
} from './errors.js'

import { parseSSEStream } from './streaming.js'

import type {
	ChatClientConfig,
	ChatCompletionChunk,
	ChatCompletionRequest,
	ChatCompletionResponse,
	ChatMessage,
	ChatToolCall,
	RequestOptions,
} from './types.js'

/**
 * Default API configuration
 */
const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_TIMEOUT = 60_000 // 60 seconds
const MAX_TIMEOUT = 300_000 // 5 minutes

/** Main Chat Completions Client */
export class ChatClient {
	/** API key for authentication */
	public readonly apiKey?: string
	/** Base URL for the API */
	public readonly baseUrl: string
	/** Organization ID */
	public readonly organization?: string
	/** Additional headers */
	public readonly headers: Record<string, string>
	/** Custom fetch function */
	public readonly fetch: typeof fetch
	/** Default model */
	public readonly defaultModel?: string
	/** Default timeout */
	public readonly defaultTimeout: number

	/** Creates a new ChatClient instance */
	constructor(config: ChatClientConfig = {}) {
		this.apiKey = config.apiKey
		this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL
		this.organization = config.organization
		this.defaultModel = config.defaultModel
		this.defaultTimeout = config.defaultTimeout ?? DEFAULT_TIMEOUT

		// Set up custom fetch or use global
		this.fetch = config.fetch ?? globalThis.fetch.bind(globalThis)

		// Build default headers
		this.headers = {
			'Content-Type': 'application/json',
			...(config.headers ?? {}),
		}

		// Validate configuration
		this.#validateConfig()
	}

	/** Validates the client configuration */
	#validateConfig(): void {
		if (!this.baseUrl) throw new ConfigurationError('Base URL is required')

		// Validate base URL format
		try {
			new URL(this.baseUrl)
		} catch {
			throw new ConfigurationError(`Invalid base URL: ${this.baseUrl}`)
		}

		// Validate timeout
		if (this.defaultTimeout > MAX_TIMEOUT)
			throw new ConfigurationError(
				`Timeout cannot exceed ${MAX_TIMEOUT}ms`,
			)
	}

	/** Creates the authorization header value */
	#getAuthorizationHeader(apiKey?: string): string {
		const key = apiKey ?? this.apiKey
		if (!key)
			throw new ConfigurationError(
				'API key is required. Provide it in the constructor or in request options.',
			)

		return `Bearer ${key}`
	}

	/** Builds the full URL for the chat completions endpoint */
	#buildUrl(baseUrl?: string): string {
		const base = baseUrl ?? this.baseUrl
		// Remove trailing slash and append endpoint
		const cleanBase = base.replace(/\/$/, '')
		return `${cleanBase}/chat/completions`
	}

	/** Builds request headers */
	#buildHeaders(options?: RequestOptions): Headers {
		const headers = new Headers(this.headers)

		// Add authorization
		const authHeader = this.#getAuthorizationHeader(options?.apiKey)
		headers.set('Authorization', authHeader)

		// Add organization if set
		if (this.organization)
			headers.set('OpenAI-Organization', this.organization)

		// Add custom headers from options
		if (options?.headers)
			for (const [key, value] of Object.entries(options.headers))
				headers.set(key, value)

		return headers
	}

	/** Creates an abort controller with timeout */
	#createAbortedSignal(
		timeout?: number,
		signal?: AbortSignal,
	): { signal: AbortSignal; timeoutId?: ReturnType<typeof setTimeout> } {
		const controller = new AbortController()
		const timeoutValue = timeout ?? this.defaultTimeout

		let timeoutId: ReturnType<typeof setTimeout> | undefined

		if (timeoutValue > 0)
			timeoutId = setTimeout(() => {
				controller.abort()
			}, timeoutValue)

		// If user provided a signal, link them
		if (signal)
			signal.addEventListener('abort', () => {
				controller.abort()
				if (timeoutId) clearTimeout(timeoutId)
			})

		return { signal: controller.signal, timeoutId }
	}

	/** Cleans up timeout after fetch completes */
	#cleanupTimeout(timeoutId?: ReturnType<typeof setTimeout>): void {
		if (timeoutId) clearTimeout(timeoutId)
	}

	/** Validates the request before sending */
	#validateRequest(request: ChatCompletionRequest): void {
		if (!request.messages || !Array.isArray(request.messages))
			throw new ValidationError('messages array is required')

		if (request.messages.length === 0)
			throw new ValidationError('messages array cannot be empty')

		// Validate each message
		for (let i = 0; i < request.messages.length; i++) {
			const message = request.messages[i]

			if (!message.role)
				throw new ValidationError(
					`Message at index ${i} is missing role`,
				)

			if (!message.content)
				throw new ValidationError(
					`Message at index ${i} is missing content`,
				)
		}

		// Validate model
		if (!request.model && !this.defaultModel)
			throw new ValidationError('model is required')

		// Validate temperature range
		if (
			request.temperature !== undefined &&
			(request.temperature < 0 || request.temperature > 2)
		)
			throw new ValidationError('temperature must be between 0 and 2')

		// Validate top_p range
		if (
			request.top_p !== undefined &&
			(request.top_p < 0 || request.top_p > 1)
		)
			throw new ValidationError('top_p must be between 0 and 1')

		// Validate max_tokens
		if (request.max_tokens !== undefined && request.max_tokens <= 0)
			throw new ValidationError('max_tokens must be greater than 0')

		// Validate stop sequences
		if (request.stop) {
			if (typeof request.stop === 'string') {
				if (request.stop.length === 0)
					throw new ValidationError('stop string cannot be empty')
			} else if (Array.isArray(request.stop)) {
				if (request.stop.length === 0)
					throw new ValidationError('stop array cannot be empty')

				for (const s of request.stop)
					if (typeof s !== 'string' || s.length === 0)
						throw new ValidationError(
							'stop array must contain non-empty strings',
						)
			}
		}

		// Validate presence_penalty
		if (
			request.presence_penalty !== undefined &&
			(request.presence_penalty < -2 || request.presence_penalty > 2)
		)
			throw new ValidationError(
				'presence_penalty must be between -2 and 2',
			)

		// Validate frequency_penalty
		if (
			request.frequency_penalty !== undefined &&
			(request.frequency_penalty < -2 || request.frequency_penalty > 2)
		)
			throw new ValidationError(
				'frequency_penalty must be between -2 and 2',
			)
	}

	/** Sends a non-streaming chat completion request */
	async #complete(
		request: ChatCompletionRequest,
		options?: RequestOptions,
	): Promise<ChatCompletionResponse> {
		// Validate request
		this.#validateRequest(request)

		// Build the final request
		const finalRequest: ChatCompletionRequest = {
			...request,
			model: request.model ?? this.defaultModel ?? '',
			stream: false, // Force non-streaming
		}

		// Create abort signal with timeout
		const { signal, timeoutId } = this.#createAbortedSignal(
			options?.timeout,
			options?.signal,
		)

		try {
			const url = this.#buildUrl(options?.baseUrl)
			const headers = this.#buildHeaders(options)

			const response = await this.fetch(url, {
				method: 'POST',
				headers,
				body: JSON.stringify(finalRequest),
				signal,
			})

			// Check for errors
			if (!response.ok) throw await APIError.fromResponse(response)

			// Parse response
			const data = await response.json()

			// Validate response structure
			if (!data || typeof data !== 'object')
				throw new ValidationError('Invalid response format')

			if (data.object !== 'chat.completion')
				throw new ValidationError(
					`Unexpected response object: ${data.object}`,
				)

			return data as ChatCompletionResponse
		} catch (error) {
			// Transform known errors
			if (error instanceof DOMException && error.name === 'AbortError')
				if (signal.aborted)
					// Check if it was due to timeout or user abort
					// If we have a timeoutId and it was cleared, it was a user abort
					// Otherwise it might be a timeout
					throw new AbortError()

			if (error instanceof Error && error.name === 'AbortError')
				throw new AbortError()

			// Re-throw known errors
			if (
				error instanceof APIError ||
				error instanceof AbortError ||
				error instanceof ValidationError ||
				error instanceof TimeoutError
			)
				throw error

			// Network errors
			if (error instanceof TypeError && error.message.includes('fetch'))
				throw new NetworkError('Network error occurred', error)

			// Re-throw unknown errors
			throw error
		} finally {
			this.#cleanupTimeout(timeoutId)
		}
	}

	/**
	 * Sends a streaming chat completion request
	 * Returns an async generator that yields ChatCompletionChunk objects
	 */
	async *stream(
		request: ChatCompletionRequest,
		options?: RequestOptions,
	): AsyncGenerator<ChatCompletionChunk, void, unknown> {
		// Validate request
		this.#validateRequest(request)

		// Build the final request (force streaming)
		const finalRequest: ChatCompletionRequest = {
			...request,
			model: request.model ?? this.defaultModel ?? '',
			stream: true, // Force streaming
		}

		// Create abort signal with timeout
		const { signal, timeoutId } = this.#createAbortedSignal(
			options?.timeout,
			options?.signal,
		)

		let response: Response | undefined

		try {
			const url = this.#buildUrl(options?.baseUrl)
			const headers = this.#buildHeaders(options)

			response = await this.fetch(url, {
				method: 'POST',
				headers,
				body: JSON.stringify(finalRequest),
				signal,
			})

			// Check for errors
			if (!response.ok) throw await APIError.fromResponse(response)

			// Check content type
			const contentType = response.headers.get('content-type')
			if (!contentType?.includes('text/event-stream')) {
				// Some APIs might not return correct content-type
				// Try to parse anyway
			}

			// Stream the response
			if (!response.body)
				throw new ValidationError('Response body is null')

			// Parse SSE stream
			yield* parseSSEStream(response.body, signal)
		} catch (error) {
			// Transform known errors
			if (error instanceof Error && error.name === 'AbortError') {
				// Check if it was a timeout or user abort
				if (signal.aborted) throw new AbortError()
			}

			// Re-throw known errors
			if (
				error instanceof APIError ||
				error instanceof AbortError ||
				error instanceof ValidationError
			)
				throw error

			// Network errors
			if (error instanceof TypeError && error.message.includes('fetch'))
				throw new NetworkError('Network error occurred', error)

			// Re-throw unknown errors
			throw error
		} finally {
			this.#cleanupTimeout(timeoutId)
		}
	}

	/** Convenience method for simple chat interactions */
	async chat(
		messages: ChatMessage[],
		model?: string,
		options?: RequestOptions,
	): Promise<ChatCompletionResponse> {
		return this.#complete(
			{
				messages,
				model: model ?? this.defaultModel ?? 'gpt-4o',
			},
			options,
		)
	}

	/** Convenience method for simple streaming chat interactions */
	async *chatStream(
		messages: ChatMessage[],
		model?: string,
		options?: RequestOptions,
	): AsyncGenerator<ChatCompletionChunk, void, unknown> {
		yield* this.stream(
			{
				messages,
				model: model ?? this.defaultModel ?? 'gpt-4o',
			},
			options,
		)
	}

	/** Creates a helper for building messages */
	createMessages(...messages: Partial<ChatMessage>[]): ChatMessage[] {
		return messages as ChatMessage[]
	}

	/** Creates a system message */
	static systemMessage(content: string): ChatMessage {
		return { role: 'system', content }
	}

	/** Creates a user message */
	static userMessage(content: string): ChatMessage {
		return { role: 'user', content }
	}

	/** Creates an assistant message */
	static assistantMessage(
		content: string,
		toolCalls?: ChatToolCall[],
	): ChatMessage {
		return {
			role: 'assistant',
			content,
			...(toolCalls ? { tool_calls: toolCalls } : {}),
		}
	}

	/** Creates a tool message */
	static toolMessage(content: string, toolCallId: string): ChatMessage {
		return { role: 'tool', content, tool_call_id: toolCallId }
	}
}

/** Factory function to create a ChatClient with default configuration */
export const createChatClient = (config?: ChatClientConfig): ChatClient => {
	return new ChatClient(config)
}

// ============================================
// Convenience exports
// ============================================

export { ChatClient as default } from './client.js'
