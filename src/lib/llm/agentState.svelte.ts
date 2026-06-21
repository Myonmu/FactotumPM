import type { AgentResult } from './types'

let userRequest = $state('')
let agentResult = $state<AgentResult | null>(null)
let agentError = $state<string | null>(null)
let agentLoading = $state(false)
let selectedPromptId = $state('')

export function getAgentUserRequest() {
    return userRequest
}

export function setAgentUserRequest(value: string) {
    userRequest = value
}

export function getAgentResult() {
    return agentResult
}

export function setAgentResult(result: AgentResult | null) {
    agentResult = result
}

export function getAgentError() {
    return agentError
}

export function setAgentError(error: string | null) {
    agentError = error
}

export function getAgentLoading() {
    return agentLoading
}

export function setAgentLoading(loading: boolean) {
    agentLoading = loading
}

export function getAgentSelectedPromptId() {
    return selectedPromptId
}

export function setAgentSelectedPromptId(promptId: string) {
    selectedPromptId = promptId
}

export function clearAgentResult() {
    agentResult = null
    agentError = null
}
