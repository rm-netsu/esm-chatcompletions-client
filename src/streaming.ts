import { ChatCompletionsError } from './errors.js'
import type { ChatCompletionChunk } from './types.js'

export async function* streamSSE(
	response: Response,
): AsyncGenerator<ChatCompletionChunk, void, unknown> {
	const reader = response.body?.getReader()
	if (!reader) throw new ChatCompletionsError('Response body is not readable')

	const decoder = new TextDecoder()
	let buffer = ''

	while (true) {
		const { done, value } = await reader.read()
		if (done) break

		buffer += decoder.decode(value, { stream: true })
		const lines = buffer.split('\n')
		buffer = lines.pop() || ''

		for (const line of lines) {
			if (line.startsWith('data: ')) {
				const data = line.slice(6).trim()
				if (data === '[DONE]') return
				try {
					const chunk = JSON.parse(data) as ChatCompletionChunk
					yield chunk
				} catch (e) {
					throw new ChatCompletionsError(
						`Failed to parse SSE data: ${data}`,
						undefined,
						undefined,
						e,
					)
				}
			}
			// Ignore comments (lines starting with ':')
		}
	}
}
