// The user stored in the nuxt-auth-utils session (set by server/api/auth/login.post.ts)
declare module '#auth-utils' {
  interface User {
    id: number
    username: string
    email: string | null
    role: 'admin' | 'user'
  }
}

export {}
