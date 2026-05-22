"""Push notification service — Firebase Cloud Messaging integration.

This is a placeholder that logs push attempts. To activate real push
notifications, set up a Firebase project and add the service account
key path to your .env as FIREBASE_CREDENTIALS_PATH.
"""

import logging
from typing import Optional, List

logger = logging.getLogger(__name__)

# Firebase state — initialized lazily on first push attempt
_firebase_initialized = False


def _init_firebase() -> bool:
    """Initialize Firebase Admin SDK if credentials are available."""
    global _firebase_initialized
    if _firebase_initialized:
        return True

    try:
        import firebase_admin
        from firebase_admin import credentials
        from app.config import get_settings

        settings = get_settings()
        cred_path = getattr(settings, "firebase_credentials_path", None)

        if not cred_path:
            logger.info(
                "Firebase not configured — FIREBASE_CREDENTIALS_PATH not set. "
                "Push notifications will be logged but not sent."
            )
            return False

        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        _firebase_initialized = True
        logger.info("Firebase Admin SDK initialized successfully")
        return True
    except ImportError:
        logger.info(
            "firebase-admin not installed. Push notifications disabled. "
            "Install with: pip install firebase-admin"
        )
        return False
    except Exception as exc:
        logger.error(f"Firebase initialization failed: {exc}")
        return False


def send_push_notification(
    fcm_tokens: List[str],
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> None:
    """Send a push notification to one or more FCM device tokens.

    If Firebase is not configured, the push is logged but not sent.
    This allows development and testing without Firebase setup.
    """
    if not fcm_tokens:
        return

    if not _init_firebase():
        logger.info(
            f"[PUSH PLACEHOLDER] title='{title}' body='{body}' "
            f"tokens={len(fcm_tokens)} data={data}"
        )
        return

    try:
        from firebase_admin import messaging

        message = messaging.MulticastMessage(
            tokens=fcm_tokens,
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data={k: str(v) for k, v in (data or {}).items()},
            android=messaging.AndroidConfig(
                priority="high",
            ),
        )

        response = messaging.send_each_for_multicast(message)
        logger.info(
            f"Push sent: success={response.success_count} "
            f"failure={response.failure_count}"
        )

        # Deactivate invalid tokens
        for idx, send_resp in enumerate(response.responses):
            if send_resp.exception:
                logger.warning(
                    f"Push failed for token {fcm_tokens[idx][:20]}...: "
                    f"{send_resp.exception}"
                )
    except Exception as exc:
        logger.error(f"Push notification error: {exc}")


def send_push_to_user(user_id: str, title: str, body: str, data: Optional[dict] = None) -> None:
    """Send push notification to all active devices of a user."""
    from app.database import get_supabase

    supabase = get_supabase()
    resp = (
        supabase.table("device_tokens")
        .select("fcm_token")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
    )

    tokens = [row["fcm_token"] for row in (resp.data or [])]
    if tokens:
        send_push_notification(tokens, title, body, data)
    else:
        logger.debug(f"No FCM tokens for user {user_id}, push skipped")


def send_push_to_admins(title: str, body: str, data: Optional[dict] = None) -> None:
    """Send push notification to all admin users' devices."""
    from app.database import get_supabase

    supabase = get_supabase()
    admin_resp = (
        supabase.table("users")
        .select("id")
        .in_("role", ["ADMIN", "SUPERADMIN"])
        .eq("is_active", True)
        .execute()
    )

    for admin in (admin_resp.data or []):
        send_push_to_user(admin["id"], title, body, data)
