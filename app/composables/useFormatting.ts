// Dates are formatted with a fixed locale and time zone: the server (UTC, en-US) and the browser would otherwise
// render different text for the same value, which breaks hydration. Date-only values ('YYYY-MM-DD') are
// midnight UTC, so they're shown in UTC to never shift a day.
const LOCALE = 'en-GB'
const TIME_ZONE = 'Europe/London'
const isDateOnly = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

export function useFormatting() {
  function formatMoney(value: number | null | undefined): string {
    if (value == null) return '—'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
  }

  function formatDate(date: string | null | undefined): string {
    if (!date) return '—'
    return new Date(date).toLocaleDateString(LOCALE, { year: 'numeric', month: 'short', day: 'numeric', timeZone: isDateOnly(date) ? 'UTC' : TIME_ZONE })
  }

  function formatDateTime(date: string | null | undefined): string {
    if (!date) return '—'
    return new Date(date).toLocaleString(LOCALE, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE,
    })
  }

  function formatRelative(date: string | null | undefined): string {
    if (!date) return '—'
    const d = new Date(date)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days}d ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    if (days < 365) return `${Math.floor(days / 30)}mo ago`
    return `${Math.floor(days / 365)}y ago`
  }

  function isOverdue(date: string | null | undefined): boolean {
    if (!date) return false
    return new Date(date) < new Date()
  }

  return { formatMoney, formatDate, formatDateTime, formatRelative, isOverdue }
}
