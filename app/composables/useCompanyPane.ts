// State of the company page's Notes | Chat side pane (mficrm-bwv.4), and the link from chat to notes
// ("Add to notes"). The open state, width and tab are remembered in this browser.

type PaneTab = 'notes' | 'chat'

const STORAGE_KEY = 'acquiredesk-company-pane'

function readStored(): { open?: boolean, width?: number, tab?: PaneTab } {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

export function useCompanyPane() {
  const open = useState('company-pane-open', () => false)
  const width = useState('company-pane-width', () => 460)
  const tab = useState<PaneTab>('company-pane-tab', () => 'notes')
  // Set by the notes panel while it is mounted
  const notesInserter = useState<((html: string) => void) | null>('company-pane-notes-insert', () => null)
  // A question for the chat to send when it's ready (e.g. from a keyboard shortcut or another tab)
  const chatFocus = useState('company-pane-chat-focus', () => 0)

  function restore() {
    const stored = readStored()
    if (typeof stored.open === 'boolean') open.value = stored.open
    if (typeof stored.width === 'number') width.value = Math.min(Math.max(stored.width, 320), 1200)
    if (stored.tab === 'notes' || stored.tab === 'chat') tab.value = stored.tab
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ open: open.value, width: width.value, tab: tab.value }))
    } catch {}
  }

  function show(which?: PaneTab) {
    open.value = true
    if (which) tab.value = which
    if (which === 'chat') chatFocus.value++
    persist()
  }

  function insertIntoNotes(html: string): boolean {
    if (!notesInserter.value) return false
    notesInserter.value(html)
    return true
  }

  return { open, width, tab, notesInserter, chatFocus, restore, persist, show, insertIntoNotes }
}
