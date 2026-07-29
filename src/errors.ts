export class ChatCompletionsError extends Error {
	readonly requestId: string | undefined

	constructor(
		message: string,
		public readonly status?: number,
		public readonly headers?: Headers,
		public readonly error?: unknown,
	) {
		super(message)
		this.name = 'ChatCompletionsError'
		this.requestId = headers?.get('x-request-id') ?? undefined
	}
}

export class AuthenticationError extends ChatCompletionsError {
	constructor(
		message: string,
		status?: number,
		headers?: Headers,
		error?: unknown,
	) {
		super(message, status, headers, error)
		this.name = 'AuthenticationError'
	}
}

export class RateLimitError extends ChatCompletionsError {
	constructor(
		message: string,
		status?: number,
		headers?: Headers,
		error?: unknown,
	) {
		super(message, status, headers, error)
		this.name = 'RateLimitError'
	}
}

export class APIConnectionError extends ChatCompletionsError {
	constructor(message: string, cause?: unknown) {
		super(message)
		this.name = 'APIConnectionError'
		this.cause = cause
	}
}

export class RequestAbortedError extends APIConnectionError {
	constructor(
		public readonly reason?: unknown,
		cause?: unknown,
	) {
		super('Request was aborted', cause)
		this.name = 'RequestAbortedError'
	}
}

export class RequestTimeoutError extends APIConnectionError {
	constructor(
		public readonly timeout: number,
		cause?: unknown,
	) {
		super(`Request timed out after ${timeout} ms`, cause)
		this.name = 'RequestTimeoutError'
	}
}
