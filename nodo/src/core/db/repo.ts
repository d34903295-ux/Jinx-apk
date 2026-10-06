import type { ChatRecord, MessageRecord, Role } from '../../types'
import { db } from './schema'

/** Acceso a datos. La UI nunca toca `db` directamente: pasa por aquí. */

// ---------- Ajustes ----------

export type SettingKey = 'activeModel' | 'theme' | 'perfMode'

export async function getSetting<T>(key: SettingKey): Promise<T | undefined> {
  const row = await db.settings.get(key)
  return row?.value as T | undefined
}

export async function setSetting(key: SettingKey, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}

// ---------- Chats ----------

export function listChats(): Promise<ChatRecord[]> {
  return db.chats.orderBy('updatedAt').reverse().toArray()
}

export async function createChat(title: string): Promise<number> {
  const now = Date.now()
  return db.chats.add({ title, createdAt: now, updatedAt: now })
}

export async function deleteChat(chatId: number): Promise<void> {
  await db.transaction('rw', db.chats, db.messages, async () => {
    await db.messages.where('chatId').equals(chatId).delete()
    await db.chats.delete(chatId)
  })
}

export async function renameChat(chatId: number, title: string): Promise<void> {
  const name = title.trim().slice(0, 80)
  if (!name) return
  await db.chats.update(chatId, { title: name, updatedAt: Date.now() })
}

export async function deleteMessage(messageId: number): Promise<void> {
  await db.messages.delete(messageId)
}

// ---------- Mensajes ----------

export function getMessages(chatId: number): Promise<MessageRecord[]> {
  return db.messages.where('chatId').equals(chatId).sortBy('createdAt')
}

export async function addMessage(
  chatId: number,
  role: Role,
  content: string,
  citations: import('../../types').Citation[] = [],
  toolCalls: import('../../types').ToolCall[] = [],
): Promise<number> {
  const now = Date.now()
  const id = await db.messages.add({
    chatId,
    role,
    content,
    citations,
    toolCalls,
    createdAt: now,
  })
  await db.chats.update(chatId, { updatedAt: now })
  return id
}

/** Título corto a partir del primer mensaje del usuario. */
export function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > 48 ? `${clean.slice(0, 45)}…` : clean || 'Nuevo chat'
}

// ---------- Notas ----------

export function listNotes(): Promise<import('../../types').NoteRecord[]> {
  return db.notes.orderBy('updatedAt').reverse().toArray()
}

export function getNote(id: number): Promise<import('../../types').NoteRecord | undefined> {
  return db.notes.get(id)
}

export async function createNote(title: string, body: string): Promise<number> {
  const now = Date.now()
  return db.notes.add({ title: title.trim(), body: body.trim(), updatedAt: now })
}

export async function updateNote(id: number, title: string, body: string): Promise<number> {
  const now = Date.now()
  await db.notes.update(id, { title: title.trim(), body: body.trim(), updatedAt: now })
  return id
}

export async function deleteNote(id: number): Promise<void> {
  await db.notes.delete(id)
}

export async function searchNotes(query: string): Promise<import('../../types').NoteRecord[]> {
  const q = query.toLowerCase()
  return db.notes
    .filter((n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
    .toArray()
}

