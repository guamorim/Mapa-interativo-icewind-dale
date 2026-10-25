import type { MapMarker, MarkerInput, Mission, MissionInput } from '../types'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null

  if (!response.ok) {
    throw new ApiError(
      payload?.error ?? 'Não foi possível concluir a solicitação.',
      response.status,
    )
  }

  return payload as T
}

function masterHeaders(slug: string) {
  return { 'X-Master-Slug': slug }
}

export async function getPublicMarkers(): Promise<MapMarker[]> {
  const result = await request<{ markers: MapMarker[] }>('/api/markers')
  return result.markers
}

export async function getMasterMarkers(slug: string): Promise<MapMarker[]> {
  const result = await request<{ markers: MapMarker[] }>('/api/markers?scope=all', {
    headers: masterHeaders(slug),
  })
  return result.markers
}

export async function createMarker(
  slug: string,
  marker: MarkerInput,
): Promise<MapMarker> {
  const result = await request<{ marker: MapMarker }>('/api/markers', {
    method: 'POST',
    headers: masterHeaders(slug),
    body: JSON.stringify(marker),
  })
  return result.marker
}

export async function updateMarker(
  slug: string,
  id: string,
  marker: MarkerInput,
): Promise<MapMarker> {
  const result = await request<{ marker: MapMarker }>(
    `/api/markers?id=${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: masterHeaders(slug),
      body: JSON.stringify(marker),
    },
  )
  return result.marker
}

export async function deleteMarker(slug: string, id: string): Promise<void> {
  await request<{ ok: true }>(`/api/markers?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: masterHeaders(slug),
  })
}

export async function getPublicMissions(): Promise<Mission[]> {
  const result = await request<{ missions: Mission[] }>('/api/missions')
  return result.missions
}

export async function getMasterMissions(slug: string): Promise<Mission[]> {
  const result = await request<{ missions: Mission[] }>('/api/missions?scope=all', {
    headers: masterHeaders(slug),
  })
  return result.missions
}

export async function createMission(slug: string, mission: MissionInput): Promise<Mission> {
  const result = await request<{ mission: Mission }>('/api/missions', {
    method: 'POST',
    headers: masterHeaders(slug),
    body: JSON.stringify(mission),
  })
  return result.mission
}

export async function updateMission(
  slug: string,
  id: string,
  mission: MissionInput,
): Promise<Mission> {
  const result = await request<{ mission: Mission }>(
    `/api/missions?id=${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: masterHeaders(slug),
      body: JSON.stringify(mission),
    },
  )
  return result.mission
}

export async function deleteMission(slug: string, id: string): Promise<void> {
  await request<{ ok: true }>(`/api/missions?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: masterHeaders(slug),
  })
}
