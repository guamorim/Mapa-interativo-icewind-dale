export interface MapMarker {
  id: string
  name: string
  color: string
  category: string
  x: number
  y: number
  description: string
  npcs: string[]
  locations: string[]
  image_url: string | null
  is_visible: boolean
  created_at?: string
  updated_at?: string
}

export type MarkerInput = Omit<MapMarker, 'id' | 'created_at' | 'updated_at'>

export type MissionStatus = 'notice' | 'active'

export interface Mission {
  id: string
  title: string
  description: string
  status: MissionStatus
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export type MissionInput = Omit<Mission, 'id' | 'created_at' | 'updated_at'>

export interface SettlementService {
  id: string
  marker_id: string
  name: string
  type: string
  proprietor: string
  services: string[]
  description: string
  is_visible: boolean
  created_at?: string
  updated_at?: string
}

export type SettlementServiceInput = Omit<
  SettlementService,
  'id' | 'created_at' | 'updated_at'
>

export interface SettlementServiceImportEntry {
  settlement: string
  name: string
  type: string
  proprietor: string
  services: string[]
  description: string
  is_visible: boolean
}

export interface SettlementServicesImport {
  version: 1
  establishments: SettlementServiceImportEntry[]
}
