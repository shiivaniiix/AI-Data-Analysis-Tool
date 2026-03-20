from fastapi import APIRouter

from app.models.health import HealthResponse
from app.services.health_service import health_status

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health_check() -> dict[str, str]:
    return health_status()
