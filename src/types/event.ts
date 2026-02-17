export interface EventDj {
  name: string
  score: -1 | 0 | 1 | 2 | 3
  time?: string
}

export interface Event {
  id: string
  name: string
  venue: string
  date: string
  djs: EventDj[]
  created?: string
}
