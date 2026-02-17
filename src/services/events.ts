import pb from './pocketbase'
import type { Event } from '../types/event'

const COLLECTION_NAME = 'events'

export interface PocketbaseEvent extends Event {
  collectionId?: string
  collectionName?: string
  created?: string
  updated?: string
  owner?: string
}

function mapRecord(record: PocketbaseEvent): Event {
  return {
    id: record.id,
    name: record.name,
    venue: record.venue,
    date: record.date,
    djs: record.djs || [],
    created: record.created,
  }
}

export const eventsService = {
  async getAll(): Promise<Event[]> {
    try {
      const records = await pb.collection(COLLECTION_NAME).getFullList<PocketbaseEvent>({
        sort: '-created',
      })
      return records.map(mapRecord)
    } catch (error) {
      console.error('Error fetching events from Pocketbase:', error)
      return []
    }
  },

  async create(event: Omit<Event, 'id'>): Promise<Event> {
    const data = {
      ...event,
      owner: pb.authStore.model?.id,
    }
    const record = await pb.collection(COLLECTION_NAME).create<PocketbaseEvent>(data)
    return mapRecord(record)
  },

  async update(id: string, event: Partial<Event>): Promise<Event> {
    const record = await pb.collection(COLLECTION_NAME).update<PocketbaseEvent>(id, event)
    return mapRecord(record)
  },

  async delete(id: string): Promise<void> {
    await pb.collection(COLLECTION_NAME).delete(id)
  },

  async isAvailable(): Promise<boolean> {
    try {
      await pb.health.check()
      return true
    } catch {
      return false
    }
  },
}
