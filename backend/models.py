from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class IssueCreate(BaseModel):
    title: str
    description: str
    category: str
    severity: str
    latitude: float
    longitude: float
    address: str
    reporter_id: str
    image_url: Optional[str] = None
    confidence: Optional[float] = None


class IssueResponse(BaseModel):
    id: str
    created_at: str
    title: str
    description: str
    category: str
    severity: str
    confidence: Optional[float] = None
    status: str
    latitude: float
    longitude: float
    address: str
    image_url: Optional[str] = None
    votes: int = 0
    reporter_id: str
    merged_into: Optional[str] = None


class VoteRequest(BaseModel):
    issue_id: str
    user_id: str


class LatLng(BaseModel):
    lat: float
    lng: float


class RouteRequest(BaseModel):
    origin: LatLng
    destination: LatLng
    mode: str = "driving"  # driving, cycling, foot


class RouteWarning(BaseModel):
    issue_id: str
    title: str
    category: str
    severity: str
    distance_meters: float
    warning_message: str
