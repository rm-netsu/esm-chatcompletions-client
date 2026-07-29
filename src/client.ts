import {
	APIConnectionError,
	AuthenticationError,
	ChatCompletionsError,
	RateLimitError,
	RequestAbortedError,
	RequestTimeoutError,
} from './errors.js'
import { streamSSE } from './streaming.js'
import type {
	BaseChatMessage,
	ChatCompletionChunk,
	ChatCompletionRequest,
	ChatCompletionResponse,
	ClientOptions,
	HeadersProvider,
	RequestOptions,
} from './types.js'

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_MAX_SSE_EVENT_SIZE = 1024 * 1024

interface AbortContext {
	signal: AbortSignal | undefined
	timedOut: () => boolean
	cleanup: () => void
}

interface OpenResponse {
	response: Response
	abort: AbortContext
}

function resolveEndpoint(options: ClientOptions): string {
	if (options.endpoint) return String(options.endpoint)
	const baseURL = String(options.baseURL ?? DEFAULT_BASE_URL).replace(
		/\/+$/,
		'',
	)
	return `${baseURL}/chat/completions`
}

async function resolveHeaders(
	provider: HeadersProvider | undefined,
): Promise<HeadersInit | undefined> {
	return typeof provider === 'function' ? provider() : provider
}

function createAbortContext(
	userSignal: AbortSignal | undefined,
	timeout: number,
): AbortContext {
	if (timeout <= 0) {
		return {
			signal: userSignal,
			timedOut: () => false,
			cleanup: () => undefined,
		}
	}

	const controller = new AbortController()
	let timeoutReached = false
	let timeoutId: ReturnType<typeof setTimeout> | undefined

	const forwardAbort = (): void => {
		if (!controller.signal.aborted) controller.abort(userSignal?.reason)
	}

	if (userSignal?.aborted) {
		forwardAbort()
	} else {
		userSignal?.addEventListener('abort', forwardAbort, { once: true })
		timeoutId = setTimeout(() => {
			timeoutReached = true
			controller.abort()
		}, timeout)
	}

	return {
		signal: controller.signal,
		timedOut: () => timeoutReached,
		cleanup: () => {
			if (timeoutId !== undefined) clearTimeout(timeoutId)
			userSignal?.removeEventListener('abort', forwardAbort)
		},
	}
}

function errorMessage(error: unknown): string | undefined {
	if (!error || typeof error !== 'object') return undefined
	if ('error' in error) {
		const nested = errorMessage(error.error)
		if (nested) return nested
	}
	if ('message' in error && typeof error.message === 'string') {
		return error.message
	}
	return undefined
}

async function toHTTPError(response: Response): Promise<ChatCompletionsError> {
	const raw = await response.text()
	let parsed: unknown
	try {
		parsed = raw ? JSON.parse(raw) : undefined
	} catch {
		parsed = undefined
	}

	const message =
		errorMessage(parsed) ??
		(raw.trim() || response.statusText || `HTTP ${response.status}`)
	const details = parsed ?? (raw || undefined)

	switch (response.status) {
		case 401:
			return new AuthenticationError(
				message,
				response.status,
				response.headers,
				details,
			)
		case 429:
			return new RateLimitError(
				message,
				response.status,
				response.headers,
				details,
			)
		default:
			return new ChatCompletionsError(
				message,
				response.status,
				response.headers,
				details,
			)
	}
}

function normalizeRequestError(
	error: unknown,
	abort: AbortContext,
	timeout: number,
): ChatCompletionsError {
	if (error instanceof ChatCompletionsError) return error
	if (abort.timedOut()) return new RequestTimeoutError(timeout, error)
	if (abort.signal?.aborted) {
		return new RequestAbortedError(abort.signal.reason, error)
	}
	if (error instanceof Error) {
		return new APIConnectionError(`Request failed: ${error.message}`, error)
	}
	return new APIConnectionError(`Request failed: ${String(error)}`, error)
}

export class ChatCompletionsClient {
	readonly #endpoint: string
	readonly #apiKey: string | undefined
	readonly #organization: string | undefined
	readonly #project: string | undefined
	readonly #headers: HeadersProvider | undefined
	readonly #timeout: number
	readonly #maxSSEEventSize: number
	readonly #fetch: typeof globalThis.fetch

	constructor(options: ClientOptions = {}) {
		const fetchImplementation = options.fetch ?? globalThis.fetch
		if (typeof fetchImplementation !== 'function') {
			throw new TypeError(
				'Fetch is not available; provide it through ClientOptions.fetch',
			)
		}

		this.#endpoint = resolveEndpoint(options)
		this.#apiKey = options.apiKey
		this.#organization = options.organization
		this.#project = options.project
		this.#headers = options.headers
		this.#timeout = options.timeout ?? 0
		this.#maxSSEEventSize =
			options.maxSSEEventSize ?? DEFAULT_MAX_SSE_EVENT_SIZE
		this.#fetch = fetchImplementation

		if (!Number.isFinite(this.#timeout) || this.#timeout < 0) {
			throw new RangeError('timeout must be a non-negative finite number')
		}
		if (
			!Number.isFinite(this.#maxSSEEventSize) ||
			this.#maxSSEEventSize <= 0
		) {
			throw new RangeError(
				'maxSSEEventSize must be a positive finite number',
			)
		}
	}

	async #open(
		body: ChatCompletionRequest<BaseChatMessage>,
		options: RequestOptions | undefined,
	): Promise<OpenResponse> {
		const timeout = options?.timeout ?? this.#timeout
		if (!Number.isFinite(timeout) || timeout < 0) {
			throw new RangeError('timeout must be a non-negative finite number')
		}

		const abort = createAbortContext(options?.signal, timeout)
		try {
			const headers = new Headers()
			headers.set('Content-Type', 'application/json')
			if (this.#apiKey)
				headers.set('Authorization', `Bearer ${this.#apiKey}`)
			if (this.#organization) {
				headers.set('OpenAI-Organization', this.#organization)
			}
			if (this.#project) headers.set('OpenAI-Project', this.#project)

			const clientHeaders = await resolveHeaders(this.#headers)
			if (clientHeaders) {
				for (const [name, value] of new Headers(clientHeaders)) {
					headers.set(name, value)
				}
			}
			if (options?.headers) {
				for (const [name, value] of new Headers(options.headers)) {
					headers.set(name, value)
				}
			}

			const init: RequestInit = {
				method: 'POST',
				headers,
				body: JSON.stringify(body),
			}
			if (abort.signal) init.signal = abort.signal

			const response = await this.#fetch(this.#endpoint, init)

			if (!response.ok) throw await toHTTPError(response)
			return { response, abort }
		} catch (error) {
			abort.cleanup()
			throw normalizeRequestError(error, abort, timeout)
		}
	}

	/** Perform a non-streaming chat completion. */
	async createChatCompletion<
		ResponseType extends ChatCompletionResponse = ChatCompletionResponse,
		Message extends BaseChatMessage = BaseChatMessage,
	>(
		request: ChatCompletionRequest<Message>,
		options?: RequestOptions,
	): Promise<ResponseType> {
		const body = { ...request, stream: false }
		const opened = await this.#open(body, options)
		const timeout = options?.timeout ?? this.#timeout

		try {
			return (await opened.response.json()) as ResponseType
		} catch (error) {
			if (error instanceof SyntaxError) {
				throw new ChatCompletionsError(
					'Failed to parse the JSON response',
					opened.response.status,
					opened.response.headers,
					error,
				)
			}
			throw normalizeRequestError(error, opened.abort, timeout)
		} finally {
			opened.abort.cleanup()
		}
	}

	/**
	 * Perform a streaming chat completion and yield decoded SSE chunks.
	 * Breaking out of the loop cancels the response body immediately.
	 */
	async *createStreamingChatCompletion<
		Chunk extends ChatCompletionChunk = ChatCompletionChunk,
		Message extends BaseChatMessage = BaseChatMessage,
	>(
		request: ChatCompletionRequest<Message>,
		options?: RequestOptions,
	): AsyncGenerator<Chunk, void, unknown> {
		const body = { ...request, stream: true }
		const opened = await this.#open(body, options)
		const timeout = options?.timeout ?? this.#timeout

		try {
			yield* streamSSE<Chunk>(opened.response, {
				maxEventSize: this.#maxSSEEventSize,
			})
		} catch (error) {
			throw normalizeRequestError(error, opened.abort, timeout)
		} finally {
			opened.abort.cleanup()
		}
	}
}
