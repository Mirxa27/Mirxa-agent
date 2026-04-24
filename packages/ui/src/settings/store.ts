/**
 * Settings persistence for the in-page Mirxa Agent panel.
 *
 * - Connection / model settings are stored in localStorage (small, synchronous).
 * - Attached files are stored in IndexedDB (potentially large blobs).
 *
 * All APIs are namespaced under `mirxa-agent.*` to avoid clashing with the
 * host page's storage keys.
 */

const LS_PREFIX = 'mirxa-agent.'
const LS_LLM_KEY = LS_PREFIX + 'llm'

const IDB_NAME = 'mirxa-agent'
const IDB_STORE = 'attachedFiles'
const IDB_VERSION = 1

/** Persisted LLM connection settings. */
export interface LlmSettings {
	baseURL?: string
	apiKey?: string
	model?: string
}

/** Metadata for an attached file (cheap to enumerate). */
export interface AttachedFileMeta {
	id: string
	name: string
	mimeType: string
	size: number
	createdAt: number
	/** First ~120 chars of decoded text content, for previews. */
	preview: string
}

/** Full attached file record (with content). */
export interface AttachedFileRecord extends AttachedFileMeta {
	/** UTF-8 text content of the file. Binary files store base64. */
	content: string
	/** True if `content` is base64-encoded binary. */
	isBinary: boolean
}

// ---------- LLM settings (localStorage) ----------

export function loadLlmSettings(): LlmSettings {
	try {
		const raw = globalThis.localStorage?.getItem(LS_LLM_KEY)
		if (!raw) return {}
		const parsed = JSON.parse(raw)
		return typeof parsed === 'object' && parsed !== null ? parsed : {}
	} catch {
		return {}
	}
}

export function saveLlmSettings(settings: LlmSettings): void {
	try {
		globalThis.localStorage?.setItem(LS_LLM_KEY, JSON.stringify(settings))
	} catch (err) {
		console.warn('[mirxa-agent] failed to persist LLM settings', err)
	}
}

// ---------- Attached files (IndexedDB) ----------

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise
	dbPromise = new Promise((resolve, reject) => {
		if (typeof indexedDB === 'undefined') {
			reject(new Error('IndexedDB not available'))
			return
		}
		const req = indexedDB.open(IDB_NAME, IDB_VERSION)
		req.onupgradeneeded = () => {
			const db = req.result
			if (!db.objectStoreNames.contains(IDB_STORE)) {
				db.createObjectStore(IDB_STORE, { keyPath: 'id' })
			}
		}
		req.onsuccess = () => resolve(req.result)
		req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
	})
	return dbPromise
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	return openDb().then(
		(db) =>
			new Promise<T>((resolve, reject) => {
				const transaction = db.transaction(IDB_STORE, mode)
				const store = transaction.objectStore(IDB_STORE)
				const req = fn(store)
				req.onsuccess = () => resolve(req.result)
				req.onerror = () => reject(req.error ?? new Error('IndexedDB transaction failed'))
			})
	)
}

const TEXTUAL_TYPES = /^(text\/|application\/(json|xml|x-yaml|yaml|x-ndjson|x-csv))/i
const TEXTUAL_EXT =
	/\.(txt|md|markdown|json|jsonl|csv|tsv|xml|yml|yaml|html?|css|js|ts|tsx|jsx|log)$/i

export function isLikelyText(file: { name: string; type: string }): boolean {
	if (TEXTUAL_TYPES.test(file.type)) return true
	if (file.type === '' && TEXTUAL_EXT.test(file.name)) return true
	return false
}

function makePreview(content: string, isBinary: boolean): string {
	if (isBinary) return '[binary]'
	return content.slice(0, 120).replace(/\s+/g, ' ').trim()
}

function bufferToBase64(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf)
	let bin = ''
	for (const byte of bytes) bin += String.fromCharCode(byte)
	return btoa(bin)
}

export async function addAttachedFile(file: File): Promise<AttachedFileMeta> {
	const isBinary = !isLikelyText(file)
	let content: string
	if (isBinary) {
		content = bufferToBase64(await file.arrayBuffer())
	} else {
		content = await file.text()
	}
	const record: AttachedFileRecord = {
		id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
		name: file.name,
		mimeType: file.type || 'application/octet-stream',
		size: file.size,
		createdAt: Date.now(),
		content,
		isBinary,
		preview: makePreview(content, isBinary),
	}
	await tx('readwrite', (store) => store.put(record))
	return stripContent(record)
}

function stripContent(record: AttachedFileRecord): AttachedFileMeta {
	return {
		id: record.id,
		name: record.name,
		mimeType: record.mimeType,
		size: record.size,
		createdAt: record.createdAt,
		preview: record.preview,
	}
}

export async function listAttachedFiles(): Promise<AttachedFileMeta[]> {
	const all = await tx<AttachedFileRecord[]>(
		'readonly',
		(store) => store.getAll() as IDBRequest<AttachedFileRecord[]>
	)
	return all.map(stripContent).sort((a, b) => b.createdAt - a.createdAt)
}

export async function getAttachedFile(id: string): Promise<AttachedFileRecord | null> {
	const rec = await tx<AttachedFileRecord | undefined>(
		'readonly',
		(store) => store.get(id) as IDBRequest<AttachedFileRecord | undefined>
	)
	return rec ?? null
}

export async function getAttachedFileByName(name: string): Promise<AttachedFileRecord | null> {
	const all = await tx<AttachedFileRecord[]>(
		'readonly',
		(store) => store.getAll() as IDBRequest<AttachedFileRecord[]>
	)
	return all.find((r) => r.name === name) ?? null
}

export async function deleteAttachedFile(id: string): Promise<void> {
	await tx('readwrite', (store) => store.delete(id))
}

// ---------- Provider model discovery ----------

/**
 * Fetch the list of available models from an OpenAI-compatible endpoint.
 *
 * Calls `GET {baseURL}/models` with optional Bearer auth.
 * Returns model ids sorted alphabetically.
 */
export async function fetchProviderModels(
	baseURL: string,
	apiKey?: string,
	signal?: AbortSignal
): Promise<string[]> {
	const url = baseURL.replace(/\/+$/, '') + '/models'
	const headers: Record<string, string> = { Accept: 'application/json' }
	if (apiKey) headers.Authorization = `Bearer ${apiKey}`
	const res = await fetch(url, { headers, signal })
	if (!res.ok) {
		throw new Error(`HTTP ${res.status} ${res.statusText} from ${url}`)
	}
	const json = (await res.json()) as { data?: { id?: string }[]; models?: { id?: string }[] }
	const list = json.data ?? json.models ?? []
	const ids = list
		.map((m) => m?.id)
		.filter((id): id is string => typeof id === 'string' && id.length > 0)
	return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b))
}
