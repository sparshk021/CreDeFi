from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.schemas.graph import (
    GraphComputeRequest,
    GraphComputeResponse,
    GraphRecomputeAllResponse,
    NodeMetricsResponse,
)
from app.services.trust_graph_service import TrustGraphService

router = APIRouter(prefix="/graph", tags=["graph"])


@router.post("/compute", response_model=GraphComputeResponse)
async def compute_graph(
    body: GraphComputeRequest,
    session: AsyncSession = Depends(get_session),
):
    svc = TrustGraphService(session)
    try:
        node, graph = await svc.compute_for_user(body.user_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        )

    return GraphComputeResponse(
        user_id=node.node_id,
        reputation_score=node.reputation_score,
        metrics=NodeMetricsResponse(
            node_id=node.node_id,
            pagerank=node.pagerank,
            betweenness_centrality=node.betweenness_centrality,
            closeness_centrality=node.closeness_centrality,
            clustering_coeff=node.clustering_coeff,
            degree_in=node.degree_in,
            degree_out=node.degree_out,
            reciprocity=node.reciprocity,
            edge_diversity=node.edge_diversity,
            community_id=node.community_id,
            reputation_score=node.reputation_score,
        ),
        total_nodes=graph.total_nodes,
        total_edges=graph.total_edges,
        model_version=graph.model_version,
    )


@router.post("/recompute-all", response_model=GraphRecomputeAllResponse)
async def recompute_all(
    session: AsyncSession = Depends(get_session),
):
    svc = TrustGraphService(session)
    result = await svc.recompute_all()
    return GraphRecomputeAllResponse(
        total_nodes=result.total_nodes,
        total_edges=result.total_edges,
        model_version=result.model_version,
    )
