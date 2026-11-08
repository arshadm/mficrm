import { AI_STREAM_ERROR_MARKER, ChatAskSchema, chatTitle, type ChatMessage } from '~/shared/ai'
import { idParam, prisma } from '../../../../db/prisma'
import { aiStream, businessForAi, loadBusinessDocuments } from '../../../../utils/ai'
import { aiRateLimit } from '../../../../utils/aiLimits'
import { chatHistory, chatRequest } from '../../../../utils/chats'

// Asks Claude a question in one of the company's conversations, or starts a new one (mficrm-bwv.2).
//
// The question is saved before Claude is called, so the team sees it straight away; the answer is saved when it
// ends, including a partial one when the asker presses Stop (closing the request) or something fails. The answer
// streams back as plain text; the conversation id is in the X-Chat-Id header. A failure after streaming has
// begun ends the stream with AI_STREAM_ERROR_MARKER and the message.

// A question still waiting for its answer blocks others in the same conversation, unless it's this old
const PENDING_TIMEOUT_MS = 3 * 60 * 1000

export default defineEventHandler(async (event) => {
  const user = await aiRateLimit(event)
  const business_id = idParam(event, 'id')
  const parsed = ChatAskSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message || 'Invalid question' })
  const { chat_id, text } = parsed.data
  const business = await businessForAi(business_id)

  let chat = chat_id
    ? await prisma.aiChat.findFirst({ where: { id: chat_id, business_id } })
    : null
  if (chat_id && !chat) throw createError({ statusCode: 404, message: 'Conversation not found' })
  const stored = ((chat?.messages ?? []) as unknown as ChatMessage[])
  const last = stored.at(-1)
  if (last?.role === 'user' && Date.now() - new Date(last.at).getTime() < PENDING_TIMEOUT_MS) {
    throw createError({ statusCode: 409, message: 'Claude is still answering the last question in this conversation' })
  }

  // Save the question first
  const question: ChatMessage = { role: 'user', text, at: new Date().toISOString(), user_id: user.id, username: user.username }
  const messages = [...stored, question]
  chat = chat
    ? await prisma.aiChat.update({ where: { id: chat.id }, data: { messages: messages as object[], updated_at: new Date() } })
    : await prisma.aiChat.create({ data: { business_id, title: chatTitle(text), messages: messages as object[], created_by: user.id } })
  const chatId = chat.id

  let answer = ''
  async function saveAnswer(error?: string) {
    const reply: ChatMessage = { role: 'assistant', text: answer.trim(), at: new Date().toISOString(), ...(error ? { error } : {}) }
    await prisma.aiChat.update({ where: { id: chatId }, data: { messages: [...messages, reply] as object[], updated_at: new Date() } })
  }

  // Closing the request (Stop in the browser) aborts the call to Claude
  const abort = new AbortController()
  event.node.res.on('close', () => { if (!event.node.res.writableFinished) abort.abort() })

  const [docs, note] = await Promise.all([
    loadBusinessDocuments(business_id),
    prisma.businessNote.findUnique({ where: { business_id }, select: { content: true } }),
  ])
  const request = chatRequest(docs, business, note?.content ?? '', chatHistory(stored), text)
  const stream = aiStream(request, 16000, abort.signal)

  // The first piece is awaited here, so a missing key, rate limit etc. still return a proper status
  let head: IteratorResult<string>
  try {
    head = await stream.next()
  } catch (err) {
    const message = abort.signal.aborted ? 'Stopped' : (err as { message?: string })?.message || 'Claude could not answer'
    await saveAnswer(message)
    throw err
  }

  setResponseHeaders(event, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'x-accel-buffering': 'no',
    'x-chat-id': String(chatId),
  })
  const encoder = new TextEncoder()
  return new ReadableStream({
    async start(controller) {
      let error: string | undefined
      try {
        if (!head.done) {
          answer += head.value
          controller.enqueue(encoder.encode(head.value))
        }
        for await (const piece of stream) {
          answer += piece
          controller.enqueue(encoder.encode(piece))
        }
      } catch (err) {
        error = abort.signal.aborted ? 'Stopped' : (err as { message?: string })?.message || 'The answer was interrupted.'
        if (!abort.signal.aborted) controller.enqueue(encoder.encode(`\n${AI_STREAM_ERROR_MARKER}${error}`))
      } finally {
        await saveAnswer(error).catch(() => {})
        try {
          controller.close()
        } catch {}
      }
    },
    cancel() {
      abort.abort()
    },
  })
})
