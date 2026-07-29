import { ChatCompletionsError } from './errors.js'
import type { ChatCompletionChunk } from './types.js'

const DEFAULT_MAX_EVENT_SIZE = 1024 * 1024

export interface SSEStreamOptions {
	maxEventSize?: number
}

export async function* streamSSE<
	Chunk extends ChatCompletionChunk = ChatCompletionChunk,
>(
	response: Pick<Response, 'body'>,
	options: SSEStreamOptions = {},
): AsyncGenerator<Chunk, void, unknown> {
	const reader = response.body?.getReader()
	if (!reader) throw new ChatCompletionsError('Response body is not readable')

	const maxEventSize = options.maxEventSize ?? DEFAULT_MAX_EVENT_SIZE
	if (!Number.isFinite(maxEventSize) || maxEventSize <= 0) {
		reader.releaseLock()
		throw new RangeError('maxEventSize must be a positive finite number')
	}

	const decoder = new TextDecoder()
	const lineParts: string[] = []
	const dataLines: string[] = []
	let lineLength = 0
	let eventLength = 0
	let readerDone = false
	let skipLineFeed = false

	const appendLinePart = (part: string): void => {
		if (!part) return
		lineParts.push(part)
		lineLength += part.length
		if (eventLength + lineLength > maxEventSize) {
			throw new ChatCompletionsError(
				`SSE event exceeds the ${maxEventSize} character limit`,
			)
		}
	}

	const takeLine = (): string => {
		const line = lineParts.join('')
		lineParts.length = 0
		lineLength = 0
		return line
	}

	const processLine = (line: string): void => {
		if (!line || line.startsWith(':')) return

		const separator = line.indexOf(':')
		const field = separator === -1 ? line : line.slice(0, separator)
		if (field !== 'data') return

		let value = separator === -1 ? '' : line.slice(separator + 1)
		if (value.startsWith(' ')) value = value.slice(1)

		dataLines.push(value)
		eventLength += value.length + 1
		if (eventLength > maxEventSize) {
			throw new ChatCompletionsError(
				`SSE event exceeds the ${maxEventSize} character limit`,
			)
		}
	}

	const takeEvent = (): string | undefined => {
		if (dataLines.length === 0) return undefined
		const data = dataLines.join('\n')
		dataLines.length = 0
		eventLength = 0
		return data
	}

	const parseEvent = (data: string): Chunk => {
		try {
			return JSON.parse(data) as Chunk
		} catch (cause) {
			const preview =
				data.length > 512 ? `${data.slice(0, 512)}…` : data
			throw new ChatCompletionsError(
				`Failed to parse SSE data: ${preview}`,
				undefined,
				undefined,
				cause,
			)
		}
	}

	try {
		while (true) {
			const { done, value } = await reader.read()
			if (done) {
				readerDone = true
				break
			}

			const decoded = decoder.decode(value, { stream: true })
			let start = 0
			for (let index = 0; index < decoded.length; index += 1) {
				const code = decoded.charCodeAt(index)
				if (skipLineFeed) {
					skipLineFeed = false
					if (code === 10) {
						start = index + 1
						continue
					}
				}
				if (code !== 10 && code !== 13) continue

				appendLinePart(decoded.slice(start, index))
				const line = takeLine()
				start = index + 1
				if (code === 13) skipLineFeed = true

				if (line.length > 0) {
					processLine(line)
					continue
				}

				const data = takeEvent()
				if (data === undefined) continue
				if (data.trim() === '[DONE]') return
				yield parseEvent(data)
			}
			appendLinePart(decoded.slice(start))
		}

		appendLinePart(decoder.decode())
		if (lineParts.length > 0) processLine(takeLine())

		const data = takeEvent()
		if (data !== undefined && data.trim() !== '[DONE]') {
			yield parseEvent(data)
		}
	} finally {
		if (!readerDone) {
			try {
				await reader.cancel()
			} catch {
				// The original parser or consumer error has priority.
			}
		}
		reader.releaseLock()
	}
}
