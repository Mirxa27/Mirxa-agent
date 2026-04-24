import { useEffect } from 'react'

const DEFAULT_TITLE = 'MirxaAgent - The GUI Agent Living in Your Webpage'

export function useDocumentTitle(title?: string) {
	useEffect(() => {
		document.title = title ? `${title} - MirxaAgent` : DEFAULT_TITLE
	}, [title])
}
