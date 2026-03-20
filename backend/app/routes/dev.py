from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.services.dev_service import clear_test_data
from app.utils.config import settings
from app.utils.db import get_db

router = APIRouter(prefix="/dev", tags=["dev"])


@router.post("/clear-test-data")
def clear_test_data_endpoint(db: Session = Depends(get_db)) -> dict[str, object]:
    if not settings.debug_show_otp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Not found.",
        )

    deleted = clear_test_data(db)
    return {
        "message": "Test data cleared successfully",
        "deleted": deleted,
    }
