import { initPageController } from '@/agent/RemotePageController.content'

// import { DEMO_CONFIG } from '@/agent/constants'

const DEBUG_PREFIX = '[Content]'

export default defineContentScript({
	matches: ['<all_urls>'],
	runAt: 'document_end',

	main() {
		console.debug(`${DEBUG_PREFIX} Loaded on ${window.location.href}`)
		initPageController()

		// if auth token matches, expose agent to page
		chrome.storage.local.get('MirxaExtUserAuthToken').then((result) => {
			// extension side token.
			// @note this is isolated world. it is safe to assume user script cannot access it
			const extToken = result.MirxaExtUserAuthToken
			if (!extToken) return

			// page side token
			const pageToken = localStorage.getItem('MirxaExtUserAuthToken')
			if (!pageToken) return

			if (pageToken !== extToken) return

			console.log('[MirxaExt]: Auth tokens match. Exposing agent to page.')

			// add isolated world script
			exposeAgentToPage().then(
				// add main-world script
				() => injectScript('/main-world.js')
			)
		})
	},
})

async function exposeAgentToPage() {
	const { MultiMirxaAgent } = await import('@/agent/MultiMirxaAgent')
	console.log('[MirxaExt]: MultiMirxaAgent loaded')

	/**
	 * singleton MultiMirxaAgent to handle requests from the page
	 */
	let multiMirxaAgent: InstanceType<typeof MultiMirxaAgent> | null = null

	window.addEventListener('message', async (e) => {
		if (e.source !== window) return

		const data = e.data
		if (typeof data !== 'object' || data === null) return
		if (data.channel !== 'MIRXA_EXT_REQUEST') return

		const { action, payload, id } = data

		switch (action) {
			case 'execute': {
				// singleton check
				if (multiMirxaAgent && multiMirxaAgent.status === 'running') {
					window.postMessage(
						{
							channel: 'MIRXA_EXT_RESPONSE',
							id,
							action: 'execute_result',
							error: 'Agent is already running a task. Please wait until it finishes.',
						},
						'*'
					)
					return
				}

				try {
					const { task, config } = payload
					const { systemInstruction, ...agentConfig } = config

					// Dispose old instance before creating new one
					multiMirxaAgent?.dispose()

					multiMirxaAgent = new MultiMirxaAgent({
						...agentConfig,
						instructions: systemInstruction ? { system: systemInstruction } : undefined,
					})

					// events

					multiMirxaAgent.addEventListener('statuschange', (event) => {
						if (!multiMirxaAgent) return
						window.postMessage(
							{
								channel: 'MIRXA_EXT_RESPONSE',
								id,
								action: 'status_change_event',
								payload: multiMirxaAgent.status,
							},
							'*'
						)
					})

					multiMirxaAgent.addEventListener('activity', (event) => {
						if (!multiMirxaAgent) return
						window.postMessage(
							{
								channel: 'MIRXA_EXT_RESPONSE',
								id,
								action: 'activity_event',
								payload: (event as CustomEvent).detail,
							},
							'*'
						)
					})

					multiMirxaAgent.addEventListener('historychange', (event) => {
						if (!multiMirxaAgent) return
						window.postMessage(
							{
								channel: 'MIRXA_EXT_RESPONSE',
								id,
								action: 'history_change_event',
								payload: multiMirxaAgent.history,
							},
							'*'
						)
					})

					// result

					const result = await multiMirxaAgent.execute(task)

					window.postMessage(
						{
							channel: 'MIRXA_EXT_RESPONSE',
							id,
							action: 'execute_result',
							payload: result,
						},
						'*'
					)
				} catch (error) {
					window.postMessage(
						{
							channel: 'MIRXA_EXT_RESPONSE',
							id,
							action: 'execute_result',
							error: (error as Error).message,
						},
						'*'
					)
				}

				break
			}

			case 'stop': {
				multiMirxaAgent?.stop()
				break
			}

			default:
				console.warn(`${DEBUG_PREFIX} Unknown action from page:`, action)
				break
		}
	})
}
