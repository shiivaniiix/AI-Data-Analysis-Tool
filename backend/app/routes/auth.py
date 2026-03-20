from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.models.auth import (
    AuthTokenResponse,
    DeleteAccountRequest,
    LoginRequest,
    SignupRequest,
    SignupResponse,
    UserResponse,
    VerifyOtpRequest,
)
from app.models.user import User
from app.services.auth_service import (
    create_user_with_otp,
    delete_user_account,
    login_user,
    verify_user_otp,
)
from app.services.token_service import get_current_user
from app.utils.config import settings
from app.utils.db import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> SignupResponse:
    _, otp_code = create_user_with_otp(
        db, email=payload.email, username=payload.username, password=payload.password
    )
    response = SignupResponse(
        message="Signup successful. Please verify your email with OTP."
    )
    if settings.debug_show_otp:
        response.dev_otp = otp_code
    return response


@router.post("/verify-otp", response_model=UserResponse)
def verify_otp(payload: VerifyOtpRequest, db: Session = Depends(get_db)) -> UserResponse:
    user = verify_user_otp(db, email=payload.email, otp_code=payload.otp)
    return UserResponse.model_validate(user)


@router.post("/login", response_model=AuthTokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthTokenResponse:
    token_data = login_user(db, identifier=payload.identifier, password=payload.password)
    return AuthTokenResponse(**token_data)


@router.post("/delete-account", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    payload: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    delete_user_account(db, user_id=current_user.id, password=payload.password)
