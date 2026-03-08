/**
 * Custom error classes for the Chat Completions API client
 */

import type { APIErrorResponse } from './types.js'

/** Base class for all API-related errors */
export class APIError extends Error {
	/** HTTP status code */
	public readonly status: number
	/** Response headers */
	public readonly headers: Headers
	/** Error type */
	public readonly type: string
	/** Error code */
	public readonly code?: string
	/** Parameter that caused the error */
	public readonly param?: string
	/** Whether this is a retryable error */
	public readonly retryable: boolean

	constructor(
		message: string,
		status: number,
		headers: Headers,
		type: string = 'api_error',
		code?: string,
		param?: string,
	) {
		super(message)
		this.name = 'APIError'
		this.status = status
		this.headers = headers
		this.type = type
		this.code = code
		this.param = param
		this.retryable = this.#determineRetryable(status)

		// Maintains proper stack trace in V8 environments
		if (Error.captureStackTrace) Error.captureStackTrace(this, APIError)
	}

	/** Determines if the error is retryable based on status code */
	#determineRetryable(status: number): boolean {
		// 429 Too Many Requests and 5xx errors are retryable
		return status === 429 || (status >= 500 && status < 600)
	}

	/** Parse error response body and create appropriate error */
	static async fromResponse(response: Response): Promise<APIError> {
		const status = response.status
		const headers = response.headers

		let message = `API request failed with status ${status}`
		let type = 'api_error'
		let code: string | undefined
		let param: string | undefined

		try {
			const errorData: APIErrorResponse = await response.json()

			if (errorData.message) message = errorData.message

			if (errorData.type) type = errorData.type

			if (errorData.code) code = errorData.code

			if (errorData.param) param = errorData.param

			// Check for nested error object
			if (errorData.error) {
				if (errorData.error.message && !errorData.message)
					message = errorData.error.message

				if (errorData.error.type) type = errorData.error.type

				if (errorData.error.code) code = errorData.error.code

				if (errorData.error.param) param = errorData.error.param
			}
		} catch {
			// If we can't parse JSON, use status text
			message = `${response.statusText} (${status})`
		}

		return new APIError(message, status, headers, type, code, param)
	}

	/** Get rate limit information from headers */
	getRateLimitInfo(): {
		limit?: number
		remaining?: number
		reset?: number
	} {
		const limit = this.headers.get('x-ratelimit-limit')
		const remaining = this.headers.get('x-ratelimit-remaining')
		const reset = this.headers.get('x-ratelimit-reset')

		return {
			limit: limit ? parseInt(limit, 10) : undefined,
			remaining: remaining ? parseInt(remaining, 10) : undefined,
			reset: reset ? parseInt(reset, 10) : undefined,
		}
	}
}

/** Error when a request is aborted */
export class AbortError extends Error {
	public readonly name = 'AbortError'
	public readonly retryable = false

	constructor(message: string = 'The request was aborted') {
		super(message)

		if (Error.captureStackTrace) Error.captureStackTrace(this, AbortError)
	}
}

/** Error when the request times out */
export class TimeoutError extends Error {
	public readonly name = 'TimeoutError'
	public readonly retryable = true
	public readonly timeout: number

	constructor(timeout: number) {
		super(`Request timed out after ${timeout}ms`)
		this.timeout = timeout

		if (Error.captureStackTrace) Error.captureStackTrace(this, TimeoutError)
	}
}

/** Error when network is unavailable */
export class NetworkError extends Error {
	public readonly name = 'NetworkError'
	public readonly retryable = true
	public readonly cause?: Error

	constructor(message: string, cause?: Error) {
		super(message)
		this.cause = cause

		if (Error.captureStackTrace) Error.captureStackTrace(this, NetworkError)
	}
}

/** Error for invalid configuration */
export class ConfigurationError extends Error {
	public readonly name = 'ConfigurationError'
	public readonly retryable = false

	constructor(message: string) {
		super(message)

		if (Error.captureStackTrace)
			Error.captureStackTrace(this, ConfigurationError)
	}
}

/** Error for invalid request parameters */
export class ValidationError extends Error {
	public readonly name = 'ValidationError'
	public readonly retryable = false
	public readonly field?: string

	constructor(message: string, field?: string) {
		super(message)
		this.field = field

		if (Error.captureStackTrace)
			Error.captureStackTrace(this, ValidationError)
	}
}

/** Error for parsing responses */
export class ParseError extends Error {
	public readonly name = 'ParseError'
	public readonly retryable = false
	public readonly status?: number

	constructor(message: string, status?: number) {
		super(message)
		this.status = status

		if (Error.captureStackTrace) Error.captureStackTrace(this, ParseError)
	}
}

/** Union type for all errors the client can throw */
export type ClientError =
	| APIError
	| AbortError
	| TimeoutError
	| NetworkError
	| ConfigurationError
	| ValidationError
	| ParseError
