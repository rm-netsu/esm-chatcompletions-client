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

// Utility Types
export type { ClientError } from './errors.js'

export type {
	APIErrorResponse,
	ChatClientConfig,
	ChatCompletionChoice,
	ChatCompletionChunk,
	ChatCompletionChunkChoice,
	ChatCompletionLogprobs,
	ChatCompletionRequest,
	ChatCompletionResponse,
	ChatCompletionTokenLogprob,
	ChatFunctionDefinition,
	ChatMessage,
	ChatRole,
	ChatTool,
	ChatToolCall,
	CompletionUsage,
	ContentPart,
	FinishReason,
	ImageContentPart,
	LogitBias,
	RequestOptions,
	ResponseFormat,
	TextContentPart,
	ToolCallResult,
	ToolChoice,
} from './types.js'

// Utility Functions
export {
	isContentPartArray,
	isStringContent,
} from './types.js'

// ============================================
// Error Exports
// ============================================

export {
	AbortError,
	APIError,
	ConfigurationError,
	NetworkError,
	ParseError,
	TimeoutError,
	ValidationError,
} from './errors.js'

// ============================================
// Streaming Exports
// ============================================

export {
	collectStreamResponse,
	createSSEToJSONLines,
	createStreamIterator,
	parseSSEStream,
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
import pkg from '../package.json' with { type: 'json' }
export const VERSION = pkg.version
