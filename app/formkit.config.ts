import { defineFormKitConfig } from '@formkit/vue'
import { genesisIcons } from '@formkit/icons'
import type { FormKitNode } from '@formkit/core'

// FormKit setup for rendering CRM forms (mficrm-b6g.1). No FormKit theme stylesheet is loaded (that would come
// from a CDN, which the CSP blocks): classes come from rootClasses below, using the app's theme tokens so dark
// mode works. Icons are bundled; the loader never fetches missing ones from the CDN.

const field = 'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 group-data-[invalid]:border-destructive group-data-[errors]:border-destructive'

function classesFor(section: string, node: FormKitNode): string {
  const family = node.props.family as string | undefined
  const type = node.props.type as string
  const box = family === 'box'
  switch (section) {
    case 'outer': return type === 'group' || type === 'form' ? '' : 'group space-y-1.5 data-[disabled]:opacity-70'
    case 'label': return box && node.props.options ? 'text-sm' : box ? 'text-sm cursor-pointer' : 'block text-sm font-medium leading-none'
    case 'legend': return 'text-sm font-medium leading-none mb-1.5'
    case 'help': return box && !node.props.options ? 'text-xs text-muted-foreground pl-6' : 'text-xs text-muted-foreground whitespace-pre-line'
    case 'inner': return box ? 'flex items-center' : type === 'file' ? 'flex flex-col items-stretch gap-1' : 'relative flex items-center'
    case 'wrapper': return box ? 'flex items-start gap-2' : 'space-y-1.5'
    case 'options': return 'space-y-1.5 pt-1'
    case 'decorator': return 'hidden'
    case 'prefix': return 'pointer-events-none absolute left-3 text-sm text-muted-foreground'
    case 'selectIcon': return 'pointer-events-none absolute right-3 h-4 w-4 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4'
    case 'input':
      if (box) return 'mt-0.5 h-4 w-4 rounded border-input accent-primary cursor-pointer'
      if (type === 'file') return 'block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80'
      if (type === 'textarea') return `${field} min-h-24`
      if (type === 'select') return `${field} h-10 appearance-none pr-9`
      return `${field} h-10`
    case 'messages': return 'space-y-0.5'
    case 'message': return 'text-xs text-destructive'
    case 'fileList': return 'space-y-1 text-sm'
    case 'fileItem': return 'flex items-center gap-2'
    case 'fileItemIcon':
    case 'noFilesIcon': return 'h-4 w-4 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4'
    case 'fileRemove':
    case 'fileRemoveAll': return 'ml-auto whitespace-nowrap text-xs text-muted-foreground hover:text-destructive'
    case 'fileRemoveIcon': return 'hidden'
    case 'noFiles': return 'hidden'
    default: return ''
  }
}

export default defineFormKitConfig({
  icons: { ...genesisIcons },
  iconLoader: () => undefined,
  config: {
    rootClasses: (section, node) => {
      const classes = classesFor(section, node)
      return classes ? Object.fromEntries(classes.split(' ').map(c => [c, true])) : {}
    },
  },
})
