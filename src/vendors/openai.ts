import type {
	BaseChatMessage,
	ChatCompletionRequest,
	ChatMessage,
	ClientOptions,
	HeadersProvider,
} from '../types.js'

export interface OpenAIClientOptions
	extends Omit<
		ClientOptions,
		'baseURL' | 'endpoint' | 'headers' | 'organization' | 'project'
	> {
	baseURL?: string | URL
	endpoint?: string | URL
	headers?: HeadersProvider
	organization?: string
	project?: string
}

export interface OpenAIDeveloperMessage extends BaseChatMessage {
	role: 'developer'
	content: string
	name?: string
}

export type OpenAIChatMessage = ChatMessage | OpenAIDeveloperMessage

export interface OpenAIStreamOptions {
	include_usage?: boolean
	include_obfuscation?: boolean
}

export interface OpenAIChatCompletionExtensions {
	max_completion_tokens?: number
	reasoning_effort?: 'minimal' | 'low' | 'medium' | 'high'
	stream_options?: OpenAIStreamOptions
	parallel_tool_calls?: boolean
	store?: boolean
	metadata?: Record<string, string>
	service_tier?: 'auto' | 'default' | 'flex' | 'priority'
}

export type OpenAIChatCompletionRequest<
	Message extends BaseChatMessage = OpenAIChatMessage,
> = ChatCompletionRequest<Message> & OpenAIChatCompletionExtensions

/**
 * Produces core client options with optional OpenAI-specific headers.
 * The helper is isolated in a vendor module and adds no code to the core import.
 */
export function openAI(options: OpenAIClientOptions): ClientOptions {
	const {
		organization,
		project,
		headers: sourceHeaders,
		baseURL = 'https://api.openai.com/v1',
		endpoint,
		...core
	} = options

	return {
		...core,
		baseURL,
		...(endpoint ? { endpoint } : {}),
		headers: async () => {
			const supplied =
				typeof sourceHeaders === 'function'
					? await sourceHeaders()
					: sourceHeaders
			const headers = new Headers(supplied)
			if (organization) headers.set('OpenAI-Organization', organization)
			if (project) headers.set('OpenAI-Project', project)
			return headers
		},
	}
}
