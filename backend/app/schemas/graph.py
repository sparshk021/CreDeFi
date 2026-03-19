import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ---------- Request ----------

class GraphComputeRequest(BaseModel):
    user_id: uuid.UUID


class GraphRecomputeAllRequest(BaseModel):
    """Empty body — triggers full graph rebuild."""
    pass


# ---------- Per-node response ----------

class NodeMetricsResponse(BaseModel):
    node_id: str
    pagerank: float
    betweenness_centrality: float
    closeness_centrality: float
    clustering_coeff: float
    degree_in: int
    degree_out: int
    reciprocity: float
    edge_diversity: float
    community_id: int | None
    reputation_score: float


class GraphComputeResponse(BaseModel):
    user_id: str
    reputation_score: float
    metrics: NodeMetricsResponse
    total_nodes: int
    total_edges: int
    model_version: str


class GraphRecomputeAllResponse(BaseModel):
    total_nodes: int
    total_edges: int
    model_version: str


# ---------- TrustGraphEdge ----------

class TrustGraphEdgeCreate(BaseModel):
    target_user_id: uuid.UUID
    edge_type: str = Field(default="trust", max_length=50)
    weight: float = Field(default=1.0, ge=0.0, le=10.0)
    context: str | None = None


class TrustGraphEdgeResponse(BaseModel):
    id: uuid.UUID
    source_user_id: uuid.UUID
    target_user_id: uuid.UUID
    edge_type: str
    weight: float
    context: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- GraphFeatureVector ----------

class GraphFeatureVectorResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    pagerank: float
    betweenness_centrality: float
    closeness_centrality: float
    degree_in: int
    degree_out: int
    clustering_coeff: float
    community_id: int | None
    embedding: list[float] | None
    model_version: str
    created_at: datetime

    model_config = {"from_attributes": True}
