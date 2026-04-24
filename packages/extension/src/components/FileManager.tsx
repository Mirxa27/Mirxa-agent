import { FileText, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { type FileRecord, deleteFile, listFiles, saveFile } from '@/lib/db'

export function FileManager() {
	const [files, setFiles] = useState<FileRecord[]>([])
	const [uploading, setUploading] = useState(false)
	const [uploadError, setUploadError] = useState<string | null>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	const loadFiles = async () => {
		const list = await listFiles()
		setFiles(list)
	}

	useEffect(() => {
		loadFiles()
	}, [])

	const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFiles = Array.from(e.target.files ?? [])
		if (!selectedFiles.length) return
		setUploading(true)
		setUploadError(null)
		const failed: string[] = []
		try {
			for (const file of selectedFiles) {
				try {
					const content = await readFileAsBase64(file)
					await saveFile({ name: file.name, type: file.type, size: file.size, content })
				} catch (err) {
					console.error(`[FileManager] Failed to upload file "${file.name}":`, err)
					failed.push(file.name)
				}
			}
			if (failed.length > 0) {
				setUploadError(`Failed to upload: ${failed.join(', ')}`)
			}
			await loadFiles()
		} finally {
			setUploading(false)
			if (inputRef.current) inputRef.current.value = ''
		}
	}

	const handleDelete = async (id: string) => {
		await deleteFile(id)
		await loadFiles()
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between">
				<label className="text-xs text-muted-foreground">Files for Agent</label>
				<Button
					variant="outline"
					size="sm"
					className="h-7 text-xs cursor-pointer"
					onClick={() => inputRef.current?.click()}
					disabled={uploading}
				>
					<Upload className="size-3 mr-1" />
					{uploading ? 'Uploading...' : 'Upload'}
				</Button>
				<input ref={inputRef} type="file" multiple className="hidden" onChange={handleUpload} />
			</div>
			{uploadError && <p className="text-[10px] text-destructive">{uploadError}</p>}
			{files.length === 0 ? (
				<p className="text-[10px] text-muted-foreground">No files uploaded yet.</p>
			) : (
				<div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
					{files.map((f) => (
						<div
							key={f.id}
							className="flex items-center justify-between px-2 py-1 rounded-md border bg-muted/30 text-[10px]"
						>
							<div className="flex items-center gap-1.5 min-w-0">
								<FileText className="size-3 shrink-0 text-muted-foreground" />
								<span className="truncate font-mono">{f.name}</span>
								<span className="text-muted-foreground shrink-0">{formatBytes(f.size)}</span>
							</div>
							<Button
								variant="ghost"
								size="icon"
								className="h-5 w-5 shrink-0 cursor-pointer"
								onClick={() => handleDelete(f.id)}
								aria-label={`Delete ${f.name}`}
							>
								<Trash2 className="size-3 text-destructive" />
							</Button>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function readFileAsBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => {
			if (typeof reader.result !== 'string') {
				reject(new Error('FileReader returned unexpected result type'))
				return
			}
			const result = reader.result
			const commaIndex = result.indexOf(',')
			if (commaIndex === -1) {
				reject(
					new Error(
						`Invalid data URL format for file: expected comma separator after MIME type, got "${result.slice(0, 30)}"`
					)
				)
				return
			}
			resolve(result.slice(commaIndex + 1))
		}
		reader.onerror = reject
		reader.readAsDataURL(file)
	})
}
