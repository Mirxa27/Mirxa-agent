/**
 * Internal tools for MirxaAgent.
 * @note Adapted from browser-use
 */
import * as z from 'zod/v4'

import type { MirxaAgentCore } from '../MirxaAgentCore'
import { waitFor } from '../utils'

/**
 * Internal tool definition that has access to MirxaAgent `this` context
 */
export interface MirxaAgentTool<TParams = any> {
	// name: string
	description: string
	inputSchema: z.ZodType<TParams>
	execute: (this: MirxaAgentCore, args: TParams) => Promise<string>
}

export function tool<TParams>(options: MirxaAgentTool<TParams>): MirxaAgentTool<TParams> {
	return options
}

/**
 * Internal tools for MirxaAgent.
 * Note: Using any to allow different parameter types for each tool
 */
export const tools = new Map<string, MirxaAgentTool>()

tools.set(
	'done',
	tool({
		description:
			'Complete task. Text is your final response to the user — keep it concise unless the user explicitly asks for detail.',
		inputSchema: z.object({
			text: z.string(),
			success: z.boolean().default(true),
		}),
		execute: async function (this: MirxaAgentCore, input) {
			// @note main loop will handle this one
			return Promise.resolve('Task completed')
		},
	})
)

tools.set(
	'wait',
	tool({
		description: 'Wait for x seconds. Can be used to wait until the page or data is fully loaded.',
		inputSchema: z.object({
			seconds: z.number().min(1).max(10).default(1),
		}),
		execute: async function (this: MirxaAgentCore, input) {
			// try to subtract LLM calling time from the actual wait time
			const lastTimeUpdate = await this.pageController.getLastUpdateTime()
			const actualWaitTime = Math.max(0, input.seconds - (Date.now() - lastTimeUpdate) / 1000)
			console.log(`actualWaitTime: ${actualWaitTime} seconds`)
			await waitFor(actualWaitTime)

			return `✅ Waited for ${input.seconds} seconds.`
		},
	})
)

tools.set(
	'ask_user',
	tool({
		description:
			'Ask the user a question and wait for their answer. Use this if you need more information or clarification.',
		inputSchema: z.object({
			question: z.string(),
		}),
		execute: async function (this: MirxaAgentCore, input) {
			if (!this.onAskUser) {
				throw new Error('ask_user tool requires onAskUser callback to be set')
			}
			const answer = await this.onAskUser(input.question)
			return `User answered: ${answer}`
		},
	})
)

tools.set(
	'click_element_by_index',
	tool({
		description: 'Click element by index',
		inputSchema: z.object({
			index: z.int().min(0),
		}),
		execute: async function (this: MirxaAgentCore, input) {
			const result = await this.pageController.clickElement(input.index)
			return result.message
		},
	})
)

tools.set(
	'input_text',
	tool({
		description: 'Click and type text into an interactive input element',
		inputSchema: z.object({
			index: z.int().min(0),
			text: z.string(),
		}),
		execute: async function (this: MirxaAgentCore, input) {
			const result = await this.pageController.inputText(input.index, input.text)
			return result.message
		},
	})
)

tools.set(
	'select_dropdown_option',
	tool({
		description:
			'Select dropdown option for interactive element index by the text of the option you want to select',
		inputSchema: z.object({
			index: z.int().min(0),
			text: z.string(),
		}),
		execute: async function (this: MirxaAgentCore, input) {
			const result = await this.pageController.selectOption(input.index, input.text)
			return result.message
		},
	})
)

/**
 * @note Reference from browser-use
 */
tools.set(
	'scroll',
	tool({
		description:
			'Scroll vertically. Without index: scrolls the document. With index: scrolls the container at that index (or its nearest scrollable ancestor). Use index of a data-scrollable element to scroll a specific area.',
		inputSchema: z.object({
			down: z.boolean().default(true),
			num_pages: z.number().min(0).max(10).optional().default(0.1),
			pixels: z.number().int().min(0).optional(),
			index: z.number().int().min(0).optional(),
		}),
		execute: async function (this: MirxaAgentCore, input) {
			const result = await this.pageController.scroll({
				...input,
				numPages: input.num_pages,
			})
			return result.message
		},
	})
)

/**
 * @todo Tables need a dedicated parser to extract structured data. This tool is useless.
 */
tools.set(
	'scroll_horizontally',
	tool({
		description:
			'Scroll horizontally. Without index: scrolls the document. With index: scrolls the container at that index (or its nearest scrollable ancestor). Use index of a data-scrollable element to scroll a specific area.',
		inputSchema: z.object({
			right: z.boolean().default(true),
			pixels: z.number().int().min(0),
			index: z.number().int().min(0).optional(),
		}),
		execute: async function (this: MirxaAgentCore, input) {
			const result = await this.pageController.scrollHorizontally(input)
			return result.message
		},
	})
)

tools.set(
	'execute_javascript',
	tool({
		description:
			'Execute JavaScript code on the current page. Supports async/await syntax. Use with caution!',
		inputSchema: z.object({
			script: z.string(),
		}),
		execute: async function (this: MirxaAgentCore, input) {
			const result = await this.pageController.executeJavascript(input.script)
			return result.message
		},
	})
)

tools.set(
	'go_to_url',
	tool({
		description:
			'Navigate the current tab to a URL. The URL must be a valid absolute URL including protocol (e.g. https://example.com). Use open_new_tab if you want to keep the current page open.',
		inputSchema: z.object({
			url: z
				.string()
				.describe('Absolute URL to navigate to, including protocol (e.g. https://example.com)'),
		}),
		execute: async function (this: MirxaAgentCore, input) {
			const result = await this.pageController.navigateTo(input.url)
			return result.message
		},
	})
)

tools.set(
	'go_back',
	tool({
		description:
			'Navigate the current tab back to the previous page in browser history. Use when you need to undo a navigation or return from an error page.',
		inputSchema: z.object({}),
		execute: async function (this: MirxaAgentCore, _input) {
			const result = await this.pageController.goBack()
			return result.message
		},
	})
)

tools.set(
	'send_keys',
	tool({
		description:
			'Send keyboard key(s) to the currently focused element. Use for pressing Escape to close a modal or dropdown, Tab to move focus, Enter to submit a form, or arrow keys (ArrowUp, ArrowDown, ArrowLeft, ArrowRight) to navigate menus. Key names follow the KeyboardEvent.key spec.',
		inputSchema: z.object({
			keys: z
				.array(z.string())
				.describe(
					'Keys to dispatch in sequence, e.g. ["Escape"], ["Tab"], ["Enter"], ["ArrowDown", "ArrowDown", "Enter"]'
				),
		}),
		execute: async function (this: MirxaAgentCore, input) {
			const result = await this.pageController.sendKeys(input.keys)
			return result.message
		},
	})
)

tools.set(
	'list_attached_files',
	tool({
		description:
			"List user-attached files available to this task (uploaded via the Mirxa Agent settings panel). Returns each file's name, mime type, size and a short preview. Use `read_attached_file` to read the full content of a specific file.",
		inputSchema: z.object({}),
		execute: async function (this: MirxaAgentCore, _input) {
			const adapter = this.config.attachedFiles
			if (!adapter) return 'No attached-files adapter configured.'
			const files = await adapter.list()
			if (files.length === 0) return 'No files attached.'
			return files
				.map(
					(f) =>
						`- ${f.name} (${f.mimeType}, ${f.size} bytes)${
							f.preview ? `\n  preview: ${f.preview}` : ''
						}`
				)
				.join('\n')
		},
	})
)

const READ_FILE_MAX_CHARS = 20_000

tools.set(
	'read_attached_file',
	tool({
		description:
			'Read the full content of a user-attached file by its `name` (or `id`). Use `list_attached_files` first to discover available files. Output is truncated to ~20K characters; for binary files the content is base64-encoded.',
		inputSchema: z
			.object({
				name: z.string().optional(),
				id: z.string().optional(),
			})
			.refine((v) => Boolean(v.name || v.id), {
				message: 'Provide either `name` or `id`.',
			}),
		execute: async function (this: MirxaAgentCore, input) {
			const adapter = this.config.attachedFiles
			if (!adapter) return 'No attached-files adapter configured.'
			const record = input.id
				? await adapter.getById(input.id)
				: await adapter.getByName(input.name!)
			if (!record) return `No attached file matched ${JSON.stringify(input)}.`
			const truncated = record.content.length > READ_FILE_MAX_CHARS
			const body = truncated
				? record.content.slice(0, READ_FILE_MAX_CHARS) +
					`\n…[truncated ${record.content.length - READ_FILE_MAX_CHARS} chars]`
				: record.content
			const tag = record.isBinary ? 'base64' : 'text'
			return `# ${record.name} (${record.mimeType}, ${record.size} bytes, ${tag})\n\n${body}`
		},
	})
)

// @todo upload_file
// @todo extract_structured_data
