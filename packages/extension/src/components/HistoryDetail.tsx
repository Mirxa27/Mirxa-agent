import { ArrowDownToLine, ArrowLeft, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { type SessionRecord, deleteSession, getSession } from '@/lib/db'
import { downloadHistoryExport } from '@/lib/history-export'

import { EventCard } from './cards'

export function HistoryDetail({
	sessionId,
	onBack,
	onRerun,
}: {
	sessionId: string
	onBack: () => void
	onRerun: (task: string) => void
}) {
	const [session, setSession] = useState<SessionRecord | null | 'loading' | 'error'>('loading')

	useEffect(() => {
		let cancelled = false
		getSession(sessionId)
			.then((s) => {
				if (!cancelled) setSession(s ?? null)
			})
			.catch((err) => {
				console.error('[HistoryDetail] Failed to load session:', err)
				if (!cancelled) setSession('error')
			})
		return () => {
			cancelled = true
		}
	}, [sessionId])

	// Loading skeleton
	if (session === 'loading') {
		return (
			<div
				className="flex flex-col h-screen bg-background"
				aria-busy="true"
				aria-label="Loading session details"
			>
				<header className="flex items-center gap-2 border-b px-3 py-2">
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onBack}
						className="cursor-pointer"
						aria-label="Back"
					>
						<ArrowLeft className="size-3.5" />
					</Button>
					<div className="h-3 w-16 bg-muted animate-pulse rounded" />
				</header>
				<div className="border-b px-3 py-2 bg-muted/30 space-y-2">
					<div className="h-2 w-10 bg-muted animate-pulse rounded" />
					<div className="h-3 w-3/4 bg-muted animate-pulse rounded" />
				</div>
				<div className="flex-1 overflow-y-auto p-3 space-y-2">
					{[...Array(3)].map((_, i) => (
						<div key={i} className="rounded-lg border bg-muted/40 p-2.5 space-y-2">
							<div className="h-2.5 bg-muted animate-pulse rounded w-1/4" />
							<div className="h-2 bg-muted animate-pulse rounded w-full" />
							<div className="h-2 bg-muted animate-pulse rounded w-3/4" />
						</div>
					))}
				</div>
			</div>
		)
	}

	// Error state
	if (session === 'error' || session === null) {
		return (
			<div className="flex flex-col h-screen bg-background">
				<header className="flex items-center gap-2 border-b px-3 py-2">
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onBack}
						className="cursor-pointer"
						aria-label="Back"
					>
						<ArrowLeft className="size-3.5" />
					</Button>
					<span className="text-sm font-medium flex-1">History</span>
				</header>
				<div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground px-6 text-center">
					<p className="text-xs">
						{session === 'error'
							? 'Failed to load session. The database may be unavailable.'
							: 'Session not found. It may have been deleted.'}
					</p>
					<Button
						variant="outline"
						size="sm"
						onClick={onBack}
						className="mt-2 text-xs cursor-pointer"
					>
						Go back
					</Button>
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col h-screen bg-background">
			{/* Header */}
			<header className="flex items-center gap-2 border-b px-3 py-2">
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={onBack}
					className="cursor-pointer"
					aria-label="Back"
				>
					<ArrowLeft className="size-3.5" />
				</Button>
				<span className="text-sm font-medium truncate">History</span>
			</header>

			{/* Task */}
			<div className="border-b px-3 py-2 bg-muted/30">
				<div className="text-[10px] text-muted-foreground uppercase tracking-wide">Task</div>
				<div className="text-xs font-medium" title={session.task}>
					{session.task}
				</div>
				<div className="mt-2 flex items-center gap-2">
					<button
						type="button"
						onClick={() => onRerun(session.task)}
						className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<RotateCcw className="size-3" />
						Run again
					</button>
					<button
						type="button"
						onClick={() => downloadHistoryExport(session.task, session.createdAt, session.history)}
						className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
					>
						<ArrowDownToLine className="size-3" />
						Export
					</button>
					<button
						type="button"
						onClick={async () => {
							await deleteSession(sessionId)
							onBack()
						}}
						className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
					>
						<Trash2 className="size-3" />
						Delete
					</button>
				</div>
			</div>

			{/* Events (read-only) */}
			<div className="flex-1 overflow-y-auto p-3 space-y-2">
				{session.history.map((event, index) => (
					<EventCard key={index} event={event} />
				))}
			</div>
		</div>
	)
}
