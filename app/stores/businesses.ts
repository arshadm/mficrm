import { defineStore } from 'pinia'
import type { Business } from '~/shared/types'

export const useBusinessesStore = defineStore('businesses', () => {
  const businesses = ref<Business[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const filters = ref({
    search: '',
    stage: '',
    category: '',
    platform: '',
    assigned_to: '',
    date_from: '',
    date_to: '',
    sort_by: 'last_updated',
    sort_dir: 'desc',
  })

  async function fetchBusinesses() {
    loading.value = true
    error.value = null
    try {
      const params = Object.fromEntries(
        Object.entries(filters.value).filter(([, v]) => v !== '')
      )
      businesses.value = await $fetch<Business[]>('/api/businesses', { query: params })
    } catch (e: unknown) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function createBusiness(data: Partial<Business>) {
    const result = await $fetch<Business>('/api/businesses', { method: 'POST', body: data })
    businesses.value.unshift(result)
    return result
  }

  async function updateBusiness(id: number, data: Partial<Business>) {
    const result = await $fetch<Business>(`/api/businesses/${id}`, { method: 'PATCH', body: data })
    const idx = businesses.value.findIndex(b => b.id === id)
    if (idx !== -1) businesses.value[idx] = result
    return result
  }

  async function deleteBusiness(id: number) {
    await $fetch(`/api/businesses/${id}`, { method: 'DELETE' })
    businesses.value = businesses.value.filter(b => b.id !== id)
  }

  async function updateStage(id: number, stage: string) {
    return updateBusiness(id, { stage: stage as Business['stage'] })
  }

  return { businesses, loading, error, filters, fetchBusinesses, createBusiness, updateBusiness, deleteBusiness, updateStage }
})
