export class ChatCompletionsError extends Error {
	constructor(
		message: string,
		public status?: number,
		public headers?: Headers,
		public error?: unknown,
	) {
		super(message)
		this.name = 'ChatCompletionsError'
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
