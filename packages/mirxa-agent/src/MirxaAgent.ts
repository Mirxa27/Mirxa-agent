/**
 * Copyright (C) 2025 Alibaba Group Holding Limited
 * Copyright (C) 2026 Mirxa27
 * All rights reserved.
 */
import { type AgentConfig, MirxaAgentCore } from '@mirxa-agent/core'
import { PageController, type PageControllerConfig } from '@mirxa-agent/page-controller'
import {
	Panel,
	type PanelConfig,
	getAttachedFile,
	getAttachedFileByName,
	listAttachedFiles,
	loadLlmSettings,
} from '@mirxa-agent/ui'

export * from '@mirxa-agent/core'

export type MirxaAgentConfig = AgentConfig & PageControllerConfig & Omit<PanelConfig, 'language'>

export class MirxaAgent extends MirxaAgentCore {
	panel: Panel

	constructor(config: MirxaAgentConfig) {
		const pageController = new PageController({
			...config,
			enableMask: config.enableMask ?? true,
		})

		// Layer persisted user settings on top of programmatic defaults so the
		// in-page Settings panel can override provider/model/api key without
		// requiring a code change.
		const persisted = loadLlmSettings()
		const merged: MirxaAgentConfig = {
			...config,
			baseURL: persisted.baseURL ?? config.baseURL,
			apiKey: persisted.apiKey ?? config.apiKey,
			model: persisted.model ?? config.model,
		}

		super({
			...merged,
			pageController,
			// Wire attached-file tools to the panel's IndexedDB-backed store
			// unless the consumer supplied their own adapter.
			attachedFiles: merged.attachedFiles ?? {
				list: listAttachedFiles,
				getById: getAttachedFile,
				getByName: getAttachedFileByName,
			},
		})

		this.panel = new Panel(this, {
			language: config.language,
			promptForNextTask: config.promptForNextTask,
			showSettings: config.showSettings,
			settingsCallbacks: {
				onLlmSettingsChange: (s) => {
					this.setLLMConfig({
						baseURL: s.baseURL,
						apiKey: s.apiKey,
						model: s.model,
					})
				},
				...config.settingsCallbacks,
			},
		})
	}
}
