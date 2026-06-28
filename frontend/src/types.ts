export interface Issue {
  id: string;
  created_at: string;
  title: string;
  description: string;
  category: 'pothole' | 'water_leakage' | 'garbage' | 'streetlight' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number | null;
  status: 'open' | 'resolved';
  latitude: number;
  longitude: number;
  address: string;
  image_url: string | null;
  votes: number;
  reporter_id: string;
  merged_into: string | null;
}

export interface RouteWarning {
  issue_id: string;
  title: string;
  category: string;
  severity: string;
  distance_meters: number;
  warning_message: string;
  latitude: number;
  longitude: number;
  bearing?: string;
  passed?: boolean;
}

export interface VisionResult {
  category: string;
  severity: string;
  confidence: number;
  title: string;
  description: string;
}

export interface AgentHealth {
  vision_agent: string;
  duplicate_agent: string;
  route_safety_agent: string;
  escalation_agent: string;
  nearby_agent: string;
  database: string;
  overall: 'healthy' | 'degraded';
}

export interface RouteSafetyResult {
  warnings: RouteWarning[];
  total: number;
}

export interface NearbyIssuesResult {
  issues: (Issue & { distance_meters: number })[];
  count: number;
  summary: string;
}

export interface SummaryStats {
  total: number;
  open: number;
  resolved: number;
  by_category: Record<string, number>;
  summary?: string;
}
