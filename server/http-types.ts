import type { IncomingHttpHeaders, ServerResponse } from 'node:http'

export interface ApiRequest {
  method?: string
  headers: IncomingHttpHeaders
  query: Record<string, string | string[] | undefined>
  body?: unknown
}

export interface ApiResponse extends ServerResponse {
  status(code: number): ApiResponse
  json(payload: unknown): ApiResponse
}
