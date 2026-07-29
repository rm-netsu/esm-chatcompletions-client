export type MaybePromise<T> = T | Promise<T>

export type HeadersProvider =
	| HeadersInit
	| (() => MaybePromise<HeadersInit | undefined>)

export type ExtensibleString<Known extends string> =
	| Known
	| (string & Record<never, never>)

export interface BaseChatMessage {
	role: string
	[key: string]: unknown
}

export type ChatMessage =
	| SystemMessage
	| UserMessage
	| AssistantMessage
	| ToolMessage
	| FunctionMessage

export interface SystemMessage extends BaseChatMessage {
	role: 'system'
	content: string
	name?: string
}

export interface UserMessage extends BaseChatMessage {
	role: 'user'
	content: string | ContentPart[]
	name?: string
}

export interface AssistantMessage extends BaseChatMessage {
	role: 'assistant'
	content?: string | null
	name?: string
	tool_calls?: ToolCall[]
	function_call?: FunctionCall
}

export interface ToolMessage extends BaseChatMessage {
	role: 'tool'
	content: string
	tool_call_id: string
}

/** @deprecated Use tool messages and `tools` where the provider supports them. */
export interface FunctionMessage extends BaseChatMessage {
	role: 'function'
	content: string
	name: string
}

export type ContentPart = TextContentPart | ImageContentPart

export interface TextContentPart {
	type: 'text'
	text: string
}

export interface ImageContentPart {
	type: 'image_url'
	image_url: {
		url: string
		detail?: 'auto' | 'low' | 'high'
	}
}

export interface FunctionDefinition {
	name: string
	description?: string
	parameters?: Record<string, unknown>
	strict?: boolean
}

export interface FunctionCall {
	name: string
	arguments: string
}

export interface ToolCall {
	id: string
	type: 'function'
	function: FunctionCall
}

export interface FunctionTool {
	type: 'function'
	function: FunctionDefinition
}

export type Tool = FunctionTool

export type ToolChoice =
	| 'none'
	| 'auto'
	| 'required'
	| {
			type: 'function'
			function: { name: string }
	  }

export type FunctionChoice = 'none' | 'auto' | { name: string }

export interface ResponseFormat {
	type: ExtensibleString<'text' | 'json_object'>
	[key: string]: unknown
}

/**
 * Common subset shared by most OpenAI-compatible Chat Completions APIs.
 * Unknown provider fields are intentionally allowed and passed through as-is.
 */
export interface ChatCompletionRequest<
	Message extends BaseChatMessage = ChatMessage,
> {
	model: string
	messages: Message[]
	temperature?: number
	top_p?: number
	n?: number
	/** Ignored by the client; selected by the called method. */
	stream?: boolean
	stop?: string | string[] | null
	max_tokens?: number
	presence_penalty?: number
	frequency_penalty?: number
	logit_bias?: Record<string, number>
	user?: string
	tools?: Tool[]
	tool_choice?: ToolChoice
	response_format?: ResponseFormat
	seed?: number
	/** @deprecated Use `tools`. */
	functions?: FunctionDefinition[]
	/** @deprecated Use `tool_choice`. */
	function_call?: FunctionChoice
	[key: string]: unknown
}

export type FinishReason = ExtensibleString<
	'stop' | 'length' | 'tool_calls' | 'content_filter' | 'function_call'
>

export interface ChatCompletionResponse {
	id: string
	object: string
	created: number
	model: string
	choices: Choice[]
	usage?: Usage
	system_fingerprint?: string
	[key: string]: unknown
}

export interface Choice {
	index: number
	message: AssistantMessage
	finish_reason: FinishReason | null
	logprobs?: unknown
	[key: string]: unknown
}

export interface Usage {
	prompt_tokens: number
	completion_tokens: number
	total_tokens: number
	prompt_tokens_details?: Record<string, unknown>
	completion_tokens_details?: Record<string, unknown>
	[key: string]: unknown
}

export interface ChatCompletionChunk {
	id: string
	object: string
	created: number
	model: string
	choices: ChoiceChunk[]
	usage?: Usage | null
	system_fingerprint?: string
	[key: string]: unknown
}

export interface ChoiceChunk {
	index: number
	delta: ChatCompletionDelta
	finish_reason: FinishReason | null
	logprobs?: unknown
	[key: string]: unknown
}

export interface ChatCompletionDelta {
	role?: 'assistant'
	content?: string | null
	tool_calls?: ToolCallDelta[]
	function_call?: Partial<FunctionCall>
	[key: string]: unknown
}

export interface ToolCallDelta {
	index: number
	id?: string
	type?: 'function'
	function?: Partial<FunctionCall>
	[key: string]: unknown
}

export interface ClientOptions {
	/** Optional bearer token. Omit it and supply custom headers for other auth. */
	apiKey?: string
	/** Base URL to which `/chat/completions` is appended. */
	baseURL?: string | URL
	/** Full endpoint URL. Takes precedence over `baseURL`. */
	endpoint?: string | URL
	/** Static or lazily evaluated headers, useful for rotating credentials. */
	headers?: HeadersProvider
	/** Overall request timeout in milliseconds. `0` disables it. */
	timeout?: number
	/** Maximum decoded SSE event size. Defaults to 1 MiB. */
	maxSSEEventSize?: number
	/** Custom Fetch implementation. */
	fetch?: typeof globalThis.fetch
	/** @deprecated OpenAI-specific compatibility shim. Use `vendors/openai`. */
	organization?: string
	/** @deprecated OpenAI-specific compatibility shim. Use `vendors/openai`. */
	project?: string
}

export interface RequestOptions {
	signal?: AbortSignal
	/** Overrides the client timeout for this request. */
	timeout?: number
	/** Overrides matching client headers for this request. */
	headers?: HeadersInit
}
