import type { HistoricalEvent } from '@page-agent/core'
import { type DBSchema, type IDBPDatabase, openDB } from 'idb'

const DB_NAME = 'mirxa-ext'
const DB_VERSION = 2

export interface SessionRecord {
	id: string
	task: string
	history: HistoricalEvent[]
	status: 'completed' | 'error'
	createdAt: number
}

export interface FileRecord {
	id: string
	name: string
	type: string
	size: number
	content: string // base64 encoded
	createdAt: number
}

interface PageAgentDB extends DBSchema {
	sessions: {
		key: string
		value: SessionRecord
		indexes: { 'by-created': number }
	}
	files: {
		key: string
		value: FileRecord
		indexes: { 'by-created': number }
	}
}

let dbPromise: Promise<IDBPDatabase<PageAgentDB>> | null = null

function getDB() {
	if (!dbPromise) {
		dbPromise = openDB<PageAgentDB>(DB_NAME, DB_VERSION, {
			upgrade(db) {
				if (!db.objectStoreNames.contains('sessions')) {
					const store = db.createObjectStore('sessions', { keyPath: 'id' })
					store.createIndex('by-created', 'createdAt')
				}
				if (!db.objectStoreNames.contains('files')) {
					const fileStore = db.createObjectStore('files', { keyPath: 'id' })
					fileStore.createIndex('by-created', 'createdAt')
				}
			},
		})
	}
	return dbPromise
}

export async function saveSession(
	session: Omit<SessionRecord, 'id' | 'createdAt'>
): Promise<SessionRecord> {
	const db = await getDB()
	const record: SessionRecord = {
		...session,
		id: crypto.randomUUID(),
		createdAt: Date.now(),
	}
	await db.put('sessions', record)
	return record
}

/** List sessions, newest first */
export async function listSessions(): Promise<SessionRecord[]> {
	const db = await getDB()
	const all = await db.getAllFromIndex('sessions', 'by-created')
	return all.reverse()
}

export async function getSession(id: string): Promise<SessionRecord | undefined> {
	const db = await getDB()
	return db.get('sessions', id)
}

export async function deleteSession(id: string): Promise<void> {
	const db = await getDB()
	await db.delete('sessions', id)
}

export async function clearSessions(): Promise<void> {
	const db = await getDB()
	await db.clear('sessions')
}

export async function saveFile(file: Omit<FileRecord, 'id' | 'createdAt'>): Promise<FileRecord> {
	const db = await getDB()
	const record: FileRecord = {
		...file,
		id: crypto.randomUUID(),
		createdAt: Date.now(),
	}
	await db.put('files', record)
	return record
}

/** List files, newest first */
export async function listFiles(): Promise<FileRecord[]> {
	const db = await getDB()
	const all = await db.getAllFromIndex('files', 'by-created')
	return all.reverse()
}

export async function deleteFile(id: string): Promise<void> {
	const db = await getDB()
	await db.delete('files', id)
}

export async function getFileContent(id: string): Promise<string | undefined> {
	const db = await getDB()
	const record = await db.get('files', id)
	return record?.content
}
