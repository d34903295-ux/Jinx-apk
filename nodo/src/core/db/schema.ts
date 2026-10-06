import Dexie, { type EntityTable } from 'dexie'
import type {
  ChatRecord,
  ChunkRecord,
  DocumentRecord,
  MessageRecord,
  NoteRecord,
  SettingRecord,
} from '../../types'

/**
 * Base de datos local (IndexedDB vía Dexie).
 * El esquema completo se define desde la v1 para no tener que migrar en fases posteriores.
 * Solo se indexan los campos por los que se consulta; el resto se guarda igual.
 */
export const db = new Dexie('nodo') as Dexie & {
  documents: EntityTable<DocumentRecord, 'id'>
  chunks: EntityTable<ChunkRecord, 'id'>
  chats: EntityTable<ChatRecord, 'id'>
  messages: EntityTable<MessageRecord, 'id'>
  notes: EntityTable<NoteRecord, 'id'>
  settings: EntityTable<SettingRecord, 'key'>
}

db.version(1).stores({
  documents: '++id, name, createdAt',
  chunks: '++id, docId, page',
  chats: '++id, updatedAt',
  messages: '++id, chatId, createdAt',
  notes: '++id, title, updatedAt',
  settings: '&key',
})
