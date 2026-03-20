import type { Business, BusinessCase, GrowthPlan, WorkingCapital, Valuation, RiskItem, Interaction } from '~/shared/types'

export function useBusiness(id: Ref<string | number>) {
  const business = ref<Business | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  async function fetchBusiness() {
    loading.value = true
    try {
      business.value = await $fetch<Business>(`/api/businesses/${id.value}`)
    } catch (e: unknown) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function saveBusiness(data: Partial<Business>) {
    saving.value = true
    try {
      business.value = await $fetch<Business>(`/api/businesses/${id.value}`, {
        method: 'PATCH',
        body: data,
      })
    } finally {
      saving.value = false
    }
  }

  return { business, loading, saving, error, fetchBusiness, saveBusiness }
}

export function useBusinessCase(id: Ref<string | number>) {
  const data = ref<BusinessCase | null>(null)
  const saving = ref(false)

  async function fetch() {
    data.value = await $fetch<BusinessCase>(`/api/businesses/${id.value}/business-case`)
  }

  async function save(payload: Partial<BusinessCase>) {
    saving.value = true
    try {
      data.value = await $fetch<BusinessCase>(`/api/businesses/${id.value}/business-case`, {
        method: 'PATCH',
        body: payload,
      })
    } finally {
      saving.value = false
    }
  }

  return { data, saving, fetch, save }
}

export function useGrowthPlan(id: Ref<string | number>) {
  const data = ref<GrowthPlan | null>(null)
  const saving = ref(false)

  async function fetch() {
    data.value = await $fetch<GrowthPlan>(`/api/businesses/${id.value}/growth-plan`)
  }

  async function save(payload: Partial<GrowthPlan>) {
    saving.value = true
    try {
      data.value = await $fetch<GrowthPlan>(`/api/businesses/${id.value}/growth-plan`, {
        method: 'PATCH',
        body: payload,
      })
    } finally {
      saving.value = false
    }
  }

  return { data, saving, fetch, save }
}

export function useWorkingCapital(id: Ref<string | number>) {
  const data = ref<WorkingCapital | null>(null)
  const saving = ref(false)

  async function fetch() {
    data.value = await $fetch<WorkingCapital>(`/api/businesses/${id.value}/working-capital`)
  }

  async function save(payload: Partial<WorkingCapital>) {
    saving.value = true
    try {
      data.value = await $fetch<WorkingCapital>(`/api/businesses/${id.value}/working-capital`, {
        method: 'PATCH',
        body: payload,
      })
    } finally {
      saving.value = false
    }
  }

  return { data, saving, fetch, save }
}

export function useValuation(id: Ref<string | number>) {
  const data = ref<Valuation | null>(null)
  const saving = ref(false)

  async function fetch() {
    data.value = await $fetch<Valuation>(`/api/businesses/${id.value}/valuation`)
  }

  async function save(payload: Partial<Valuation>) {
    saving.value = true
    try {
      data.value = await $fetch<Valuation>(`/api/businesses/${id.value}/valuation`, {
        method: 'PATCH',
        body: payload,
      })
    } finally {
      saving.value = false
    }
  }

  return { data, saving, fetch, save }
}

export function useRisks(id: Ref<string | number>) {
  const risks = ref<RiskItem[]>([])
  const loading = ref(false)

  async function fetchRisks() {
    loading.value = true
    try {
      risks.value = await $fetch<RiskItem[]>(`/api/businesses/${id.value}/risks`)
    } finally {
      loading.value = false
    }
  }

  async function addRisk(payload: Partial<RiskItem>) {
    const result = await $fetch<RiskItem>(`/api/businesses/${id.value}/risks`, {
      method: 'POST',
      body: payload,
    })
    risks.value.push(result)
    return result
  }

  async function updateRisk(riskId: number, payload: Partial<RiskItem>) {
    const result = await $fetch<RiskItem>(`/api/businesses/${id.value}/risks/${riskId}`, {
      method: 'PATCH',
      body: payload,
    })
    const idx = risks.value.findIndex(r => r.id === riskId)
    if (idx !== -1) risks.value[idx] = result
    return result
  }

  async function deleteRisk(riskId: number) {
    await $fetch(`/api/businesses/${id.value}/risks/${riskId}`, { method: 'DELETE' })
    risks.value = risks.value.filter(r => r.id !== riskId)
  }

  return { risks, loading, fetchRisks, addRisk, updateRisk, deleteRisk }
}

export function useInteractions(id: Ref<string | number>) {
  const interactions = ref<Interaction[]>([])
  const loading = ref(false)

  async function fetchInteractions() {
    loading.value = true
    try {
      interactions.value = await $fetch<Interaction[]>(`/api/businesses/${id.value}/interactions`)
    } finally {
      loading.value = false
    }
  }

  async function addInteraction(payload: Partial<Interaction>) {
    const result = await $fetch<Interaction>(`/api/businesses/${id.value}/interactions`, {
      method: 'POST',
      body: payload,
    })
    interactions.value.unshift(result)
    return result
  }

  async function deleteInteraction(interactionId: number) {
    await $fetch(`/api/businesses/${id.value}/interactions/${interactionId}`, { method: 'DELETE' })
    interactions.value = interactions.value.filter(i => i.id !== interactionId)
  }

  return { interactions, loading, fetchInteractions, addInteraction, deleteInteraction }
}
