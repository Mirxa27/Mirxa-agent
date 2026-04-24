/**
 * Settings drawer: a modal overlay attached to the panel root.
 * Houses provider/model configuration and the file manager.
 *
 * Vanilla DOM API (no React) to match the rest of @mirxa-agent/ui.
 */
import {
	type AttachedFileMeta,
	type LlmSettings,
	addAttachedFile,
	deleteAttachedFile,
	fetchProviderModels,
	listAttachedFiles,
	loadLlmSettings,
	saveLlmSettings,
} from './store'

import styles from './SettingsDrawer.module.css'

export interface SettingsDrawerCallbacks {
	/** Called when LLM settings are saved. */
	onLlmSettingsChange?: (settings: LlmSettings) => void
}

const PRESETS: { label: string; baseURL: string; sample: string }[] = [
	{ label: 'OpenAI', baseURL: 'https://api.openai.com/v1', sample: 'gpt-4o-mini' },
	{
		label: 'DashScope (Qwen)',
		baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
		sample: 'qwen3.5-plus',
	},
	{ label: 'DeepSeek', baseURL: 'https://api.deepseek.com/v1', sample: 'deepseek-chat' },
	{ label: 'Ollama (local)', baseURL: 'http://localhost:11434/v1', sample: 'llama3.1' },
]

export class SettingsDrawer {
	#root: HTMLElement
	#callbacks: SettingsDrawerCallbacks
	#fileListEl!: HTMLElement
	#statusEl!: HTMLElement
	#baseURLInput!: HTMLInputElement
	#apiKeyInput!: HTMLInputElement
	#modelInput!: HTMLInputElement
	#modelDataList!: HTMLDataListElement
	#fetchModelsBtn!: HTMLButtonElement
	#fileInput!: HTMLInputElement
	#abortController: AbortController | null = null

	constructor(parent: HTMLElement, callbacks: SettingsDrawerCallbacks = {}) {
		this.#callbacks = callbacks
		this.#root = document.createElement('div')
		this.#root.className = styles.overlay
		this.#root.setAttribute('data-mirxa-agent-ignore', 'true')
		this.#root.setAttribute('data-browser-use-ignore', 'true')
		this.#root.style.display = 'none'
		this.#root.innerHTML = this.#template()
		parent.appendChild(this.#root)

		this.#wire()
		this.#hydrate()
	}

	get root(): HTMLElement {
		return this.#root
	}

	show(): void {
		this.#root.style.display = 'flex'
		this.#refreshFiles().catch(console.error)
	}

	hide(): void {
		this.#root.style.display = 'none'
		this.#abortController?.abort()
		this.#abortController = null
	}

	dispose(): void {
		this.#abortController?.abort()
		this.#root.remove()
	}

	#template(): string {
		const presetButtons = PRESETS.map(
			(p) =>
				`<button type="button" class="${styles.presetBtn}" data-preset="${p.baseURL}" data-model="${p.sample}">${p.label}</button>`
		).join('')
		return `
			<div class="${styles.dialog}" role="dialog" aria-label="Mirxa Agent settings">
				<header class="${styles.header}">
					<h2>Settings</h2>
					<button type="button" class="${styles.closeBtn}" data-action="close" aria-label="Close">×</button>
				</header>
				<nav class="${styles.tabs}">
					<button type="button" class="${styles.tab} ${styles.tabActive}" data-tab="provider">Provider</button>
					<button type="button" class="${styles.tab}" data-tab="files">Files</button>
				</nav>
				<section class="${styles.panel}" data-panel="provider">
					<div class="${styles.field}">
						<label>Quick presets</label>
						<div class="${styles.presets}">${presetButtons}</div>
					</div>
					<div class="${styles.field}">
						<label for="mirxa-baseurl">Base URL</label>
						<input id="mirxa-baseurl" type="url" placeholder="https://api.openai.com/v1" autocomplete="off" />
					</div>
					<div class="${styles.field}">
						<label for="mirxa-apikey">API key</label>
						<input id="mirxa-apikey" type="password" placeholder="sk-…" autocomplete="off" />
					</div>
					<div class="${styles.field}">
						<label for="mirxa-model">Model</label>
						<div class="${styles.row}">
							<input id="mirxa-model" type="text" list="mirxa-model-list" placeholder="gpt-4o-mini" autocomplete="off" />
							<button type="button" class="${styles.secondaryBtn}" data-action="fetch-models">Fetch models</button>
						</div>
						<datalist id="mirxa-model-list"></datalist>
					</div>
					<div class="${styles.status}" data-role="status"></div>
					<div class="${styles.actions}">
						<button type="button" class="${styles.primaryBtn}" data-action="save-llm">Save</button>
					</div>
				</section>
				<section class="${styles.panel} ${styles.hidden}" data-panel="files">
					<p class="${styles.hint}">
						Upload files the agent can read while performing tasks. Reference them by filename in your prompt
						(e.g. <em>"use customers.csv"</em>). Stored locally in your browser; never sent unless the agent reads them.
					</p>
					<div class="${styles.field}">
						<input type="file" multiple data-role="file-input" />
					</div>
					<ul class="${styles.fileList}" data-role="file-list"></ul>
				</section>
			</div>
		`
	}

	#wire(): void {
		this.#baseURLInput = this.#root.querySelector<HTMLInputElement>('#mirxa-baseurl')!
		this.#apiKeyInput = this.#root.querySelector<HTMLInputElement>('#mirxa-apikey')!
		this.#modelInput = this.#root.querySelector<HTMLInputElement>('#mirxa-model')!
		this.#modelDataList = this.#root.querySelector<HTMLDataListElement>('#mirxa-model-list')!
		this.#fetchModelsBtn = this.#root.querySelector<HTMLButtonElement>(
			'[data-action="fetch-models"]'
		)!
		this.#statusEl = this.#root.querySelector<HTMLElement>('[data-role="status"]')!
		this.#fileInput = this.#root.querySelector<HTMLInputElement>('[data-role="file-input"]')!
		this.#fileListEl = this.#root.querySelector<HTMLElement>('[data-role="file-list"]')!

		// Close
		this.#root.addEventListener('click', (e) => {
			const target = e.target as HTMLElement
			if (target === this.#root) this.hide()
			if (target.dataset.action === 'close') this.hide()
		})

		// Tabs
		this.#root.querySelectorAll<HTMLElement>(`.${styles.tab}`).forEach((tabBtn) => {
			tabBtn.addEventListener('click', () => {
				const which = tabBtn.dataset.tab!
				this.#root.querySelectorAll<HTMLElement>(`.${styles.tab}`).forEach((t) => {
					t.classList.toggle(styles.tabActive, t.dataset.tab === which)
				})
				this.#root.querySelectorAll<HTMLElement>(`.${styles.panel}`).forEach((p) => {
					p.classList.toggle(styles.hidden, p.dataset.panel !== which)
				})
			})
		})

		// Presets
		this.#root.querySelectorAll<HTMLButtonElement>(`.${styles.presetBtn}`).forEach((btn) => {
			btn.addEventListener('click', () => {
				this.#baseURLInput.value = btn.dataset.preset!
				if (!this.#modelInput.value) this.#modelInput.value = btn.dataset.model!
				this.#setStatus('Preset applied — paste your API key and click Fetch models.', 'info')
			})
		})

		// Fetch models
		this.#fetchModelsBtn.addEventListener('click', () => {
			void this.#fetchModels()
		})

		// Save
		this.#root
			.querySelector<HTMLButtonElement>('[data-action="save-llm"]')!
			.addEventListener('click', () => {
				const settings: LlmSettings = {
					baseURL: this.#baseURLInput.value.trim() || undefined,
					apiKey: this.#apiKeyInput.value.trim() || undefined,
					model: this.#modelInput.value.trim() || undefined,
				}
				saveLlmSettings(settings)
				this.#callbacks.onLlmSettingsChange?.(settings)
				this.#setStatus('Settings saved.', 'success')
			})

		// File upload
		this.#fileInput.addEventListener('change', () => {
			void this.#handleFileUpload()
		})
	}

	#hydrate(): void {
		const s = loadLlmSettings()
		if (s.baseURL) this.#baseURLInput.value = s.baseURL
		if (s.apiKey) this.#apiKeyInput.value = s.apiKey
		if (s.model) this.#modelInput.value = s.model
	}

	async #fetchModels(): Promise<void> {
		const baseURL = this.#baseURLInput.value.trim()
		if (!baseURL) {
			this.#setStatus('Enter a base URL first.', 'error')
			return
		}
		this.#abortController?.abort()
		this.#abortController = new AbortController()
		this.#fetchModelsBtn.disabled = true
		this.#setStatus('Fetching models…', 'info')
		try {
			const ids = await fetchProviderModels(
				baseURL,
				this.#apiKeyInput.value.trim() || undefined,
				this.#abortController.signal
			)
			this.#modelDataList.innerHTML = ids
				.map((id) => `<option value="${escapeHtml(id)}"></option>`)
				.join('')
			this.#setStatus(`Loaded ${ids.length} models. Type or pick one above.`, 'success')
		} catch (err) {
			this.#setStatus(`Failed: ${(err as Error).message}`, 'error')
		} finally {
			this.#fetchModelsBtn.disabled = false
		}
	}

	async #handleFileUpload(): Promise<void> {
		const files = Array.from(this.#fileInput.files ?? [])
		if (files.length === 0) return
		try {
			for (const f of files) {
				await addAttachedFile(f)
			}
			this.#fileInput.value = ''
			await this.#refreshFiles()
		} catch (err) {
			this.#setStatus(`Upload failed: ${(err as Error).message}`, 'error')
		}
	}

	async #refreshFiles(): Promise<void> {
		let files: AttachedFileMeta[]
		try {
			files = await listAttachedFiles()
		} catch (err) {
			this.#fileListEl.innerHTML = `<li class="${styles.fileItem}">Error loading files: ${escapeHtml(
				(err as Error).message
			)}</li>`
			return
		}
		if (files.length === 0) {
			this.#fileListEl.innerHTML = `<li class="${styles.fileEmpty}">No files attached.</li>`
			return
		}
		this.#fileListEl.innerHTML = files
			.map(
				(f) => `
				<li class="${styles.fileItem}" data-id="${escapeHtml(f.id)}">
					<div class="${styles.fileMain}">
						<div class="${styles.fileName}">${escapeHtml(f.name)}</div>
						<div class="${styles.fileMeta}">${formatBytes(f.size)} · ${escapeHtml(f.mimeType)}</div>
						${f.preview ? `<div class="${styles.filePreview}">${escapeHtml(f.preview)}</div>` : ''}
					</div>
					<button type="button" class="${styles.deleteBtn}" data-action="delete-file" data-id="${escapeHtml(
						f.id
					)}" aria-label="Delete ${escapeHtml(f.name)}">Delete</button>
				</li>
			`
			)
			.join('')

		this.#fileListEl
			.querySelectorAll<HTMLButtonElement>('[data-action="delete-file"]')
			.forEach((btn) => {
				btn.addEventListener('click', async () => {
					await deleteAttachedFile(btn.dataset.id!)
					await this.#refreshFiles()
				})
			})
	}

	#setStatus(message: string, kind: 'info' | 'success' | 'error'): void {
		this.#statusEl.textContent = message
		this.#statusEl.dataset.kind = kind
	}
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
	return `${(n / 1024 / 1024).toFixed(2)} MB`
}
