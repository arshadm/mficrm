// Flatten Prisma relations into the row shapes the API has always returned (the SQLite version selected joined
// columns with aliases, e.g. `u.username AS assigned_username`).

type Named = { username: string, email?: string | null } | null

/** Business + assignee → business with assigned_username / assigned_email */
export function withAssignee<T extends { assignee: Named }>({ assignee, ...row }: T) {
  return { ...row, assigned_username: assignee?.username ?? null, assigned_email: assignee?.email ?? null }
}

/** Interaction + user → interaction with username / user_email */
export function withUser<T extends { user: Named }>({ user, ...row }: T) {
  return { ...row, username: user?.username ?? null, user_email: user?.email ?? null }
}
