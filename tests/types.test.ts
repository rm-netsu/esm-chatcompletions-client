import type {
	ChatCompletionRequest,
	ContentPart,
} from '../src/index.js'
import type {
	OpenAIChatCompletionRequest,
	OpenAIDeveloperMessage,
} from '../src/vendors/openai.js'

const text: ContentPart = { type: 'text', text: 'hello' }
const image: ContentPart = {
	type: 'image_url',
	image_url: { url: 'https://example.test/image.png' },
}
void text
void image

// @ts-expect-error A text part must contain text.
const missingText: ContentPart = { type: 'text' }
void missingText

const mixedPart: ContentPart = {
	type: 'text',
	text: 'hello',
	// @ts-expect-error Image fields are not valid on a text part.
	image_url: { url: 'https://example.test/image.png' },
}
void mixedPart

const portableRequest: ChatCompletionRequest = {
	model: 'portable-model',
	messages: [{ role: 'user', content: 'hello' }],
	provider_specific_option: true,
}
void portableRequest

const developerMessage: OpenAIDeveloperMessage = {
	role: 'developer',
	content: 'Follow the application policy.',
}
const openAIRequest: OpenAIChatCompletionRequest = {
	model: 'openai-model',
	messages: [developerMessage, { role: 'user', content: 'hello' }],
	max_completion_tokens: 100,
	stream_options: { include_usage: true },
}
void openAIRequest
