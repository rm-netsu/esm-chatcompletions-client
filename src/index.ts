/**
 * ESM Chat Completions Client
 * A lightweight, zero-dependency client for OpenAI-compatible Chat Completions APIs
 */

import type { ChatMessage, ChatToolCall } from './types.js'

// ============================================
// Main Client Export
// ============================================

export { ChatClient, createChatClient } from './client.js'

// ============================================
// Type Exports
// ============================================

// Message Types
export type {
	ChatRole,
	ContentPart,
	TextContentPart,
	ImageContentPart,
	ChatMessage,
} from './types.js'

// Tool Types
export type {
	ChatFunctionDefinition,
	ChatTool,
	ChatToolCall,
	ToolCallResult,
} from './types.js'

// Request Types
export type {
	ChatCompletionRequest,
	ResponseFormat,
	ToolChoice,
	LogitBias,
} from './types.js'

// Response Types
export type {
	CompletionUsage,
	FinishReason,
	ChatCompletionChoice,
	ChatCompletionLogprobs,
	ChatCompletionTokenLogprob,
	ChatCompletionResponse,
	ChatCompletionChunk,
	ChatCompletionChunkChoice,
	APIErrorResponse,
} from './types.js'

// Configuration Types
export type {
	ChatClientConfig,
	RequestOptions,
} from './types.js'

// Utility Types
export type { ClientError } from './errors.js'

// Utility Functions
export {
	isStringContent,
	isContentPartArray,
} from './types.js'

// ============================================
// Error Exports
// ============================================

export {
	APIError,
	AbortError,
	TimeoutError,
	NetworkError,
	ConfigurationError,
	ValidationError,
	ParseError,
} from './errors.js'

// ============================================
// Streaming Exports
// ============================================

export {
	parseSSEStream,
	createStreamIterator,
	collectStreamResponse,
	createSSEToJSONLines,
} from './streaming.js'

// ============================================
// Convenience Factory Functions
// ============================================

/** Creates a system message */
export const systemMessage = (content: string): ChatMessage => {
	return { role: 'system' as const, content }
}

/** Creates a user message */
export const userMessage = (content: string): ChatMessage => {
	return { role: 'user' as const, content }
}

/** Creates an assistant message */
export const assistantMessage = (
	content: string,
	toolCalls?: ChatToolCall[],
): ChatMessage => {
	return {
		role: 'assistant' as const,
		content,
		...(toolCalls ? { tool_calls: toolCalls } : {}),
	}
}

/** Creates a tool message */
export const toolMessage = (
	content: string,
	toolCallId: string,
): ChatMessage => {
	return { role: 'tool' as const, content, tool_call_id: toolCallId }
}

// ============================================
// Version Information
// ============================================

/** Library version */
export const VERSION = '0.1.0-vc.1'
