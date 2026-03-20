import type { NextStep, NextStepsData } from '~/shared/types'

export function useNextSteps(id: Ref<string | number>) {
  const data = ref<NextStepsData>({ primary: null, subtasks: [], history: [] })
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function fetchNextSteps() {
    loading.value = true
    error.value = null
    try {
      data.value = await $fetch<NextStepsData>(`/api/businesses/${id.value}/next-steps`)
    } catch (e: unknown) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function createNextStep(payload: { title: string; notes?: string | null; due_date: string }) {
    saving.value = true
    try {
      const step = await $fetch<NextStep>(`/api/businesses/${id.value}/next-steps`, {
        method: 'POST',
        body: payload,
      })
      data.value.primary = step
      return step
    } finally {
      saving.value = false
    }
  }

  async function updateNextStep(stepId: number, payload: Partial<NextStep>) {
    const step = await $fetch<NextStep>(`/api/businesses/${id.value}/next-steps/${stepId}`, {
      method: 'PATCH',
      body: payload,
    })
    if (data.value.primary?.id === stepId) data.value.primary = step
    return step
  }

  async function completeStep(stepId: number, completionNote?: string) {
    saving.value = true
    try {
      const step = await $fetch<NextStep>(`/api/businesses/${id.value}/next-steps/${stepId}/complete`, {
        method: 'POST',
        body: { completion_note: completionNote },
      })
      data.value.primary = null
      data.value.subtasks = []
      data.value.history.unshift(step)
      return step
    } finally {
      saving.value = false
    }
  }

  async function skipStep(stepId: number, completionNote?: string) {
    saving.value = true
    try {
      const step = await $fetch<NextStep>(`/api/businesses/${id.value}/next-steps/${stepId}/skip`, {
        method: 'POST',
        body: { completion_note: completionNote },
      })
      data.value.primary = null
      data.value.subtasks = []
      data.value.history.unshift(step)
      return step
    } finally {
      saving.value = false
    }
  }

  async function addSubtask(stepId: number, payload: { title: string; due_date?: string | null }) {
    const subtask = await $fetch<NextStep>(`/api/businesses/${id.value}/next-steps/${stepId}/subtasks`, {
      method: 'POST',
      body: payload,
    })
    data.value.subtasks.push(subtask)
    return subtask
  }

  async function toggleSubtask(subtaskId: number, isDone: boolean) {
    const updated = await $fetch<NextStep>(`/api/next-steps/subtasks/${subtaskId}`, {
      method: 'PATCH',
      body: { status: isDone ? 'done' : 'pending' },
    })
    const idx = data.value.subtasks.findIndex(s => s.id === subtaskId)
    if (idx !== -1) data.value.subtasks[idx] = updated
    return updated
  }

  async function deleteSubtask(subtaskId: number) {
    await $fetch(`/api/next-steps/${subtaskId}`, { method: 'DELETE' })
    data.value.subtasks = data.value.subtasks.filter(s => s.id !== subtaskId)
  }

  async function deleteStep(stepId: number) {
    await $fetch(`/api/next-steps/${stepId}`, { method: 'DELETE' })
    data.value.primary = null
    data.value.subtasks = []
  }

  return {
    data, loading, saving, error,
    fetchNextSteps, createNextStep, updateNextStep,
    completeStep, skipStep,
    addSubtask, toggleSubtask, deleteSubtask, deleteStep,
  }
}
