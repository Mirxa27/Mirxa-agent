/// <reference types="vite/client" />
import type { MirxaAgent } from './MirxaAgent'

declare global {
	interface Window {
		mirxaAgent?: MirxaAgent
		MirxaAgent: typeof MirxaAgent
	}
}
