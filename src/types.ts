export interface ChatCompletionRequest {
	model: string;
	messages: ChatMessage[];
	temperature?: number;
	top_p?: number;
	n?: number;
	stream?: boolean;
	stop?: string | string[];
	max_tokens?: number;
	presence_penalty?: number;
	frequency_penalty?: number;
	logit_bias?: Record<string, number>;
	user?: string;

	// Optional advanced fields
	functions?: unknown[];
	function_call?: unknown;
	tools?: unknown[];
	tool_choice?: unknown;
	response_format?: unknown;
	seed?: number;
}

export type ChatMessage =
	| SystemMessage
	| UserMessage
	| AssistantMessage
	| ToolMessage
	| FunctionMessage;

export interface SystemMessage {
	role: 'system';
	content: string;
	name?: string;
}

export interface UserMessage {
	role: 'user';
	content: string | ContentPart[];
	name?: string;
}

export interface AssistantMessage {
	role: 'assistant';
	content?: string | null;
	name?: string;
	tool_calls?: ToolCall[];
	function_call?: unknown;
}

export interface ToolMessage {
	role: 'tool';
	content: string;
	tool_call_id: string;
}

export interface FunctionMessage {
	role: 'function';
	content: string;
	name: string;
}

export interface ContentPart {
	type: 'text' | 'image_url';
	text?: string;
	image_url?: {
		url: string;
		detail?: 'auto' | 'low' | 'high';
	};
}

export interface ToolCall {
	id: string;
	type: 'function';
	function: {
		name: string;
		arguments: string;
	};
}

export interface ChatCompletionResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: Choice[];
	usage?: Usage;
	system_fingerprint?: string;
}

export interface Choice {
	index: number;
	message: AssistantMessage;
	finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
	logprobs?: unknown;
}

export interface Usage {
	prompt_tokens: number;
	completion_tokens: number;
	total_tokens: number;
}

export interface ChatCompletionChunk {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: ChoiceChunk[];
	system_fingerprint?: string;
}

export interface ChoiceChunk {
	index: number;
	delta: Partial<AssistantMessage>;
	finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
	logprobs?: unknown;
}

export interface ClientOptions {
	apiKey: string;
	baseURL?: string; // default: https://api.openai.com/v1
	organization?: string;
	project?: string;
	headers?: Record<string, string>;
	timeout?: number; // milliseconds, 0 = no timeout
	fetch?: typeof fetch; // custom fetch (e.g. for Node < 18)
}
