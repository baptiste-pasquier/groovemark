export interface Timestamp {
  label: string
  time: string
  rated: boolean
}

export interface Favorite {
  id: string
  url: string
  title: string
  artists: string[]
  type: 'youtube' | 'soundcloud'
  thumbnail: string
  timestamps: Timestamp[]
}
