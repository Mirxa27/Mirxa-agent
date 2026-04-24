/**
 * Copyright (C) 2025 Alibaba Group Holding Limited
 * All rights reserved.
 */
import { type AgentConfig, MirxaAgentCore } from '@mirxa-agent/core'
import { PageController, type PageControllerConfig } from '@mirxa-agent/page-controller'
import { Panel, type PanelConfig } from '@mirxa-agent/ui'

export * from '@mirxa-agent/core'

export type MirxaAgentConfig = AgentConfig & PageControllerConfig & Omit<PanelConfig, 'language'>

export class MirxaAgent extends MirxaAgentCore {
	panel: Panel

	constructor(config: MirxaAgentConfig) {
		const pageController = new PageController({
			...config,
			enableMask: config.enableMask ?? true,
		})

		super({ ...config, pageController })

		this.panel = new Panel(this, {
			language: config.language,
			promptForNextTask: config.promptForNextTask,
		})
	}
}
