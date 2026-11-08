import { assertUsable, findLink, noStore } from '../../../utils/publicForms'

// The form behind a link: name, description and the schema of the link's version. Nothing else.
export default defineEventHandler(async (event) => {
  noStore(event)
  const link = await findLink(event)
  assertUsable(link)
  return {
    name: link.form.name,
    description: link.form.description,
    schema: link.schema,
    expires_at: link.expires_at,
  }
})
