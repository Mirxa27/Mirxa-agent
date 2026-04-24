/**
 * File tools for the agent
 *
 * These tools allow the agent to access files that the user has uploaded
 * via the Settings → Files for Agent panel.
 */
import * as z from 'zod/v4'

import { listFiles } from '@/lib/db'

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

const TEXT_MIME_PREFIXES = ['text/', 'application/json', 'application/xml', 'application/javascript']
const TEXT_EXTENSIONS = /\.(txt|md|json|csv|xml|js|ts|jsx|tsx|py|html|css|yaml|yml|toml|ini|sh|log|env|conf|cfg)$/i

function isTextFile(name: string, mime: string): boolean {
	return TEXT_MIME_PREFIXES.some((p) => mime.startsWith(p)) || TEXT_EXTENSIONS.test(name)
}

function base64ToText(base64: string): string {
	const binaryStr = atob(base64)
	const bytes = Uint8Array.from(binaryStr, (c) => c.charCodeAt(0))
	return new TextDecoder('utf-8').decode(bytes)
}

export function createFileTools() {
	return {
		list_uploaded_files: {
			description:
				'List all files the user has uploaded for agent use. Returns file names, types, and sizes. Call this first to discover available files before reading them.',
			inputSchema: z.object({}),
			execute: async (): Promise<string> => {
				const files = await listFiles()
				if (files.length === 0) return 'No files have been uploaded yet.'
				return (
					`${files.length} uploaded file(s):\n` +
					files.map((f) => `- ${f.name} (${f.type || 'unknown type'}, ${formatBytes(f.size)})`).join('\n')
				)
			},
		},

		read_uploaded_file: {
			description:
				'Read the contents of an uploaded file by its exact filename. Text files are returned as UTF-8 text. Binary files are returned as base64. Use list_uploaded_files first to see what files are available.',
			inputSchema: z.object({
				name: z.string().describe('The exact filename to read (case-sensitive)'),
			}),
			execute: async (input: unknown): Promise<string> => {
				const { name } = input as { name: string }
				const files = await listFiles()
				const file = files.find((f) => f.name === name)

				if (!file) {
					const available = files.map((f) => f.name).join(', ')
					return `File "${name}" not found. Available files: ${available || 'none'}`
				}

				if (isTextFile(file.name, file.type)) {
					try {
						return base64ToText(file.content)
					} catch (err) {
						return `Error decoding file "${name}": ${err instanceof Error ? err.message : String(err)}`
					}
				}

				return `[Binary file: ${file.name} (${file.type}), base64-encoded]\n${file.content}`
			},
		},
	}
}
