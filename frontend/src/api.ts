import axios from 'axios';
import { API_BASE } from './config';
import type { Issue, RouteSafetyResult, SummaryStats, VisionResult, NearbyIssuesResult, AgentHealth } from './types';

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

/* ── Issues ─── */

export async function getIssues(
  lat?: number,
  lng?: number,
  radius_km?: number,
): Promise<Issue[]> {
  const params: Record<string, string | number> = {};
  if (lat !== undefined) params.lat = lat;
  if (lng !== undefined) params.lng = lng;
  if (radius_km !== undefined) params.radius_km = radius_km;
  const { data } = await client.get<Issue[]>('/issues/', { params });
  return data;
}

export async function getIssue(id: string): Promise<Issue> {
  const { data } = await client.get<Issue>(`/issues/${id}`);
  return data;
}

export async function createIssue(
  issueData: Partial<Issue>,
): Promise<{ issue?: Issue; merged: boolean; is_duplicate?: boolean; existing_issue_id?: string; existing_issue?: Issue; distance_meters?: number; message?: string }> {
  const { data } = await client.post('/issues/', issueData);
  return data;
}

export async function voteIssue(
  id: string,
  user_id: string,
): Promise<Issue> {
  const { data } = await client.post(`/issues/${id}/vote`, { user_id });
  return data;
}

export async function resolveIssue(id: string): Promise<Issue> {
  const { data } = await client.post(`/issues/${id}/resolve`);
  return data;
}

export async function getNearbyIssues(
  lat: number,
  lng: number,
  radius_km: number = 1,
): Promise<NearbyIssuesResult> {
  const { data } = await client.get<NearbyIssuesResult>('/issues/nearby', {
    params: { lat, lng, radius_km },
  });
  return data;
}

/* ── Upload ─── */

export async function uploadImage(
  file: File,
): Promise<{ image_url: string; category: string; severity: string; confidence: number; title: string; description: string }> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await client.post('/upload/image', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/* ── Agents ─── */

export async function checkRouteSafety(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): Promise<RouteSafetyResult> {
  const { data } = await client.post('/agents/route-safety', {
    origin,
    destination,
  });
  return data;
}

export async function getSummary(): Promise<SummaryStats> {
  const { data } = await client.get<SummaryStats>('/agents/summary');
  return data;
}

export async function triggerEscalation(): Promise<{ message: string }> {
  const { data } = await client.post('/agents/escalate');
  return data;
}

export async function geocodeAddress(
  address: string,
): Promise<{ success: boolean; lat?: number; lng?: number; message?: string }> {
  const { data } = await client.post('/agents/geocode', { address });
  return data;
}

export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ success: boolean; address?: string; message?: string }> {
  const { data } = await client.post('/agents/reverse-geocode', { lat, lng });
  return data;
}

export async function getAgentHealth(): Promise<AgentHealth> {
  const { data } = await client.get<AgentHealth>('/agents/health');
  return data;
}
