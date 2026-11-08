// AI assistance availability (mficrm-b6g), fetched once per session
export function useAi() {
  const status = useState<{ configured: boolean, model: string } | null>('ai-status', () => null)
  const requestFetch = useRequestFetch()

  async function loadStatus() {
    if (status.value) return status.value
    try {
      status.value = await requestFetch('/api/ai/status')
    } catch {
      status.value = { configured: false, model: '' }
    }
    return status.value
  }

  const configured = computed(() => !!status.value?.configured)
  return { status, configured, loadStatus }
}

/** The message from an API error, for display */
export function errorMessage(e: unknown, fallback = 'Something went wrong'): string {
  return (e as { data?: { message?: string } })?.data?.message || fallback
}
