from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.models.auth import (
    AuthTokenResponse,
    DeleteAccountRequest,
    LoginRequest,
    MessageResponse,
    SignupRequest,
    SignupResponse,
    StartEmailChangeRequest,
    SignupVerifyRequest,
    SignupResendRequest,
    UpdateUsernameRequest,
    UserResponse,
    VerifyEmailChangeRequest,
)
from app.models.user import User
from app.services.auth_service import (
    delete_user_account,
    login_user,
    resend_signup_otp,
    start_email_change,
    start_signup,
    update_username,
    verify_email_change,
    verify_signup_otp,
)
from app.services.token_service import get_current_user
from app.utils.db import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup/start", response_model=SignupResponse, status_code=status.HTTP_200_OK)
def signup_start(payload: SignupRequest, db: Session = Depends(get_db)) -> SignupResponse:
    start_signup(
        db, email=payload.email, username=payload.username, password=payload.password
    )
    return SignupResponse(
        message="OTP sent. Verify your email to create your account."
    )


@router.post("/signup/verify", response_model=UserResponse)
def signup_verify(payload: SignupVerifyRequest, db: Session = Depends(get_db)) -> UserResponse:
    user = verify_signup_otp(db, email=payload.email, otp_code=payload.otp)
    return UserResponse.model_validate(user)


@router.post("/signup/resend", response_model=MessageResponse)
def signup_resend(payload: SignupResendRequest, db: Session = Depends(get_db)) -> MessageResponse:
    resend_signup_otp(db, email=payload.email)
    return MessageResponse(message="OTP resent successfully.")


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


@router.get("/profile", response_model=UserResponse)
def get_profile(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)


@router.post("/profile/username", response_model=UserResponse)
def profile_update_username(
    payload: UpdateUsernameRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    user = update_username(db, user_id=current_user.id, username=payload.username)
    return UserResponse.model_validate(user)


@router.post("/profile/email/start", response_model=MessageResponse)
def profile_email_start(
    payload: StartEmailChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MessageResponse:
    start_email_change(db, user_id=current_user.id, new_email=payload.new_email)
    return MessageResponse(message="OTP sent to your new email.")


@router.post("/profile/email/verify", response_model=UserResponse)
def profile_email_verify(
    payload: VerifyEmailChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    user = verify_email_change(
        db,
        user_id=current_user.id,
        new_email=payload.new_email,
        otp_code=payload.otp,
    )
    return UserResponse.model_validate(user)
