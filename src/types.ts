export type MissionStatus = 'available' | 'in_progress' | 'completed' | null

export interface MapMarker {
  id: string
  name: string
  color: string
  category: string
  x: number
  y: number
  description: string
  image_url: string | null
  is_visible: boolean
  mission_status: MissionStatus
  created_at?: string
  updated_at?: string
}

export type MarkerInput = Omit<MapMarker, 'id' | 'created_at' | 'updated_at'>
