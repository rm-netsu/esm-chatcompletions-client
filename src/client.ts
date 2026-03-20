import {
	APIConnectionError,
	AuthenticationError,
	ChatCompletionsError,
	RateLimitError,
} from './errors.js'
import { streamSSE } from './streaming.js'
import type {
	ChatCompletionChunk,
	ChatCompletionRequest,
	ChatCompletionResponse,
	ClientOptions,
} from './types.js'

export class ChatCompletionsClient {
	#apiKey: string
	#baseURL: string
	#organization?: string
	#project?: string
	#headers: Record<string, string>
	#timeout: number
	#fetch: typeof fetch

	constructor(options: ClientOptions) {
		this.#apiKey = options.apiKey
		this.#baseURL = options.baseURL ?? 'https://api.openai.com/v1'
		this.#organization = options.organization
		this.#project = options.project
		this.#headers = options.headers ?? {}
		this.#timeout = options.timeout ?? 0
		this.#fetch = options.fetch ?? globalThis.fetch
	}

	async #request<T>(
		body: ChatCompletionRequest,
		signal?: AbortSignal,
	): Promise<T> {
		const url = `${this.#baseURL}/chat/completions`
		const headers: RequestInit['headers'] = {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${this.#apiKey}`,
			...this.#headers,
		}
		if (this.#organization)
			headers['OpenAI-Organization'] = this.#organization
		if (this.#project) headers['OpenAI-Project'] = this.#project

		let abortController: AbortController | undefined
		let timeoutId: NodeJS.Timeout | undefined
		if (this.#timeout > 0 && !signal) {
			abortController = new AbortController()
			timeoutId = setTimeout(
				() => abortController?.abort(),
				this.#timeout,
			)
			signal = abortController.signal
		}

		try {
			const response = await this.#fetch(url, {
				method: 'POST',
				headers,
				body: JSON.stringify(body),
				signal,
			})

			if (!response.ok) {
				let errorData: unknown
				try {
					errorData = await response.json()
				} catch {
					errorData = { message: response.statusText }
				}
				const errorMessage =
					!!errorData &&
					typeof errorData === 'object' &&
					'error' in errorData &&
					!!errorData.error &&
					typeof errorData.error === 'object' &&
					'message' in errorData.error &&
					typeof errorData.error.message === 'string'
						? errorData?.error?.message
						: response.statusText

				switch (response.status) {
					case 401:
						throw new AuthenticationError(
							errorMessage,
							response.status,
							response.headers,
							errorData,
						)
					case 429:
						throw new RateLimitError(
							errorMessage,
							response.status,
							response.headers,
							errorData,
						)
					default:
						throw new ChatCompletionsError(
							errorMessage,
							response.status,
							response.headers,
							errorData,
						)
				}
			}

			if (body.stream)
				// For streaming, we return the raw Response for further processing
				return response as T
			else return (await response.json()) as T
		} catch (error: unknown) {
			if (!(error instanceof Error))
				throw new APIConnectionError(
					`Request failed: ${String(error)}`,
					error,
				)

			if (error instanceof ChatCompletionsError) throw error
			if (error.name === 'AbortError')
				throw new APIConnectionError('Request timed out', error)

			throw new APIConnectionError(
				`Request failed: ${error.message}`,
				error,
			)
		} finally {
			if (timeoutId) clearTimeout(timeoutId)
		}
	}

	/**
	 * Perform a non‑streaming chat completion.
	 */
	async createChatCompletion(
		request: ChatCompletionRequest,
		options?: { signal?: AbortSignal },
	): Promise<ChatCompletionResponse> {
		const body = { ...request, stream: false }
		return this.#request<ChatCompletionResponse>(body, options?.signal)
	}

	/**
	 * Perform a streaming chat completion.
	 * Returns an async generator that yields each chunk as it arrives.
	 */
	async *createStreamingChatCompletion(
		request: ChatCompletionRequest,
		options?: { signal?: AbortSignal },
	): AsyncGenerator<ChatCompletionChunk, void, unknown> {
		const body = { ...request, stream: true }
		const response = await this.#request<Response>(body, options?.signal)
		if (!(response instanceof Response))
			throw new ChatCompletionsError(
				'Expected Response for streaming request',
			)

		yield* streamSSE(response)
	}
}
