/**
 * Comprehensive TypeScript types for the Chat Completions API
 * Zero-dependency, pure ESM implementation
 */

// ============================================
// Chat Message Types
// ============================================

/** The role of the message sender */
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

/** Content part types for multimodal messages */
export type ContentPart = TextContentPart | ImageContentPart

/** Text content part */
export interface TextContentPart {
	type: 'text'
	text: string
}

/** Image content part (URL or base64) */
export interface ImageContentPart {
	type: 'image_url'
	image_url: {
		url: string
		detail?: 'low' | 'high' | 'auto'
	}
}

/** A single message in the conversation */
export interface ChatMessage {
	/** The role of the message sender */
	role: ChatRole
	/** The content of the message */
	content: string | ContentPart[]
	/** The name of the sender (optional) */
	name?: string
	/** Tool calls made by the assistant (optional) */
	tool_calls?: ChatToolCall[]
	/** The tool call ID (required for tool messages) */
	tool_call_id?: string
}

// ============================================
// Tool Definitions
// ============================================

/** Definition of a function that can be called */
export interface ChatFunctionDefinition {
	/** The name of the function */
	name: string
	/** A description of what the function does */
	description?: string
	/** The parameters the function accepts (JSON Schema) */
	parameters: Record<string, unknown>
}

/** A tool the model can call */
export interface ChatTool {
	type: 'function'
	function: ChatFunctionDefinition
}

/** A tool call made by the model */
export interface ChatToolCall {
	/** The ID of the tool call */
	id: string
	/** The type of the tool call (currently only 'function') */
	type: 'function'
	/** The function being called */
	function: {
		/** The name of the function */
		name: string
		/** The arguments to the function (JSON string) */
		arguments: string
	}
}

/** The result of a tool call */
export interface ToolCallResult {
	/** The ID of the tool call */
	tool_call_id: string
	/** The output of the tool */
	output: string
}

// ============================================
// Request Types
// ============================================

/** Response format options */
export type ResponseFormat =
	| { type: 'text' }
	| { type: 'json_object' }
	| {
			type: 'json_schema'
			json_schema: {
				name: string
				schema: Record<string, unknown>
				strict?: boolean
			}
	  }

/** Strategy for tool choice */
export type ToolChoice =
	| 'none'
	| 'auto'
	| { type: 'function'; function: { name: string } }

/** Logit bias for token probability manipulation */
export type LogitBias = Record<string, number>

/** A request to the Chat Completions API */
export interface ChatCompletionRequest {
	/** The list of messages in the conversation */
	messages: ChatMessage[]
	/** The model to use */
	model: string
	/** Maximum tokens to generate */
	max_tokens?: number
	/** Sampling temperature (0-2) */
	temperature?: number
	/** Nucleus sampling parameter (0-1) */
	top_p?: number
	/** Number of chat completion choices */
	n?: number
	/** Whether to stream the response */
	stream?: boolean
	/** List of tools the model can call */
	tools?: ChatTool[]
	/** Tool choice strategy */
	tool_choice?: ToolChoice
	/** Response format */
	response_format?: ResponseFormat
	/** Seed for reproducible results */
	seed?: number
	/** List of stop sequences */
	stop?: string | string[]
	/** Presence penalty */
	presence_penalty?: number
	/** Frequency penalty */
	frequency_penalty?: number
	/** Logit bias */
	logit_bias?: LogitBias
	/** Unique identifier for the request */
	user?: string
}

// ============================================
// Response Types
// ============================================

/** Usage statistics for the completion */
export interface CompletionUsage {
	/** Number of tokens in the prompt */
	prompt_tokens: number
	/** Number of tokens in the completion */
	completion_tokens: number
	/** Total number of tokens */
	total_tokens: number
}

/** The reason the completion finished */
export type FinishReason =
	| 'stop'
	| 'length'
	| 'content_filter'
	| 'tool_calls'
	| null

/** A single completion choice */
export interface ChatCompletionChoice {
	/** The index of the choice */
	index: number
	/** The message object */
	message: ChatMessage
	/** The reason the completion finished */
	finish_reason: FinishReason
	/** Log probabilities (optional) */
	logprobs?: ChatCompletionLogprobs
}

/** Log probabilities for each token */
export interface ChatCompletionLogprobs {
	/** Array of token log probabilities */
	content: ChatCompletionTokenLogprob[]
}

/** Token log probability information */
export interface ChatCompletionTokenLogprob {
	/** The token */
	token: string
	/** The log probability of the token */
	logprob: number
	/** List of tokens with their probabilities */
	top_logprobs: Array<{ [token: string]: number }>
}

/** Response from a non-streaming chat completion */
export interface ChatCompletionResponse {
	/** The unique identifier for the completion */
	id: string
	/** The type of the object (always 'chat.completion') */
	object: 'chat.completion'
	/** Unix timestamp of when the completion was created */
	created: number
	/** The model used */
	model: string
	/** The system fingerprint */
	fingerprint?: string
	/** List of completion choices */
	choices: ChatCompletionChoice[]
	/** Usage statistics */
	usage: CompletionUsage
	/** Service tier (optional) */
	service_tier?: string
}

// ============================================
// Streaming Response Types
// ============================================

/** A single chunk in a streaming response */
export interface ChatCompletionChunk {
	/** The unique identifier for the chunk */
	id: string
	/** The type of the object (always 'chat.completion.chunk') */
	object: 'chat.completion.chunk'
	/** Unix timestamp of when the chunk was created */
	created: number
	/** The model used */
	model: string
	/** The system fingerprint */
	fingerprint?: string
	/** List of streaming choices */
	choices: ChatCompletionChunkChoice[]
}

/** A single streaming choice */
export interface ChatCompletionChunkChoice {
	/** The index of the choice */
	index: number
	/** The delta content (partial message) */
	delta: Partial<ChatMessage>
	/** The reason the chunk finished (null if not finished) */
	finish_reason: FinishReason
}

// ============================================
// Error Types
// ============================================

/** API error response from OpenAI */
export interface APIErrorResponse {
	/** Error message */
	message: string
	/** Error type */
	type: string
	/** Error code */
	code?: string
	/** Param that caused the error */
	param?: string
	/** Additional error details */
	error?: {
		message: string
		type: string
		code?: string
		param?: string
	}
}

// ============================================
// Client Configuration Types
// ============================================

/** Configuration options for the ChatClient */
export interface ChatClientConfig {
	/** API key for authentication */
	apiKey?: string
	/** Base URL for the API (default: https://api.openai.com/v1) */
	baseUrl?: string
	/** Organization ID (optional) */
	organization?: string
	/** Additional headers to include in requests */
	headers?: Record<string, string>
	/** Custom fetch function (for testing or alternative implementations) */
	fetch?: typeof fetch
	/** Default model to use */
	defaultModel?: string
	/** Default request timeout in milliseconds */
	defaultTimeout?: number
}

/** Request options for individual requests */
export interface RequestOptions {
	/** Abort signal for cancelling the request */
	signal?: AbortSignal
	/** Request timeout in milliseconds */
	timeout?: number
	/** Additional headers for this request */
	headers?: Record<string, string>
	/** Override the API key for this request */
	apiKey?: string
	/** Override the base URL for this request */
	baseUrl?: string
}

// ============================================
// Utility Types
// ============================================

/** Type guard to check if content is a string */
export function isStringContent(
	content: string | ContentPart[],
): content is string {
	return typeof content === 'string'
}

/** Type guard to check if content is ContentPart array */
export function isContentPartArray(
	content: string | ContentPart[],
): content is ContentPart[] {
	return Array.isArray(content)
}
