"""Push notification service — Firebase Cloud Messaging integration.

Set FIREBASE_CREDENTIALS_PATH in .env to activate real push.
Without it, pushes are logged but not sent (safe for dev/testing).
"""

import logging
from typing import Optional, List

logger = logging.getLogger(__name__)

_firebase_initialized = False


def _init_firebase() -> bool:
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
        logger.info("firebase-admin not installed. Push notifications disabled.")
        return False
    except Exception as exc:
        logger.error(f"Firebase initialization failed: {exc}")
        return False


def send_push_notification(
    fcm_tokens: List[str],
    title: str,
    body: str,
    data: Optional[dict] = None,
    channel_id: str = "default",
    sticky: bool = False,
    category_identifier: Optional[str] = None,
) -> None:
    """Send a push notification to one or more FCM device tokens.

    Args:
        fcm_tokens: List of FCM device tokens.
        title: Notification title.
        body: Notification body text.
        data: Extra key/value data delivered to the app.
        channel_id: Android notification channel. Use 'leave_requests' for
            admin leave approval notifications (high importance, no auto-dismiss).
        sticky: Android only — when True the notification cannot be dismissed
            by swiping; only dismissed by the app taking action.
        category_identifier: Maps to an Expo/iOS notification category
            (e.g. 'LEAVE_REQUEST') so action buttons are shown on the device.
    """
    if not fcm_tokens:
        return

    # Merge category into data so Expo's notification handler picks it up
    merged_data: dict = dict(data or {})
    if category_identifier:
        merged_data["categoryIdentifier"] = category_identifier

    if not _init_firebase():
        logger.info(
            f"[PUSH PLACEHOLDER] title='{title}' body='{body}' "
            f"tokens={len(fcm_tokens)} channel={channel_id} sticky={sticky} "
            f"category={category_identifier} data={merged_data}"
        )
        return

    try:
        from firebase_admin import messaging

        android_notification = messaging.AndroidNotification(
            channel_id=channel_id,
            sticky=sticky,
        )

        apns_payload = None
        if category_identifier:
            apns_payload = messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        category=category_identifier,
                        content_available=True,
                    )
                )
            )

        message = messaging.MulticastMessage(
            tokens=fcm_tokens,
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data={k: str(v) for k, v in merged_data.items()},
            android=messaging.AndroidConfig(
                priority="high",
                notification=android_notification,
            ),
            apns=apns_payload,
        )

        response = messaging.send_each_for_multicast(message)
        logger.info(
            f"Push sent: success={response.success_count} "
            f"failure={response.failure_count}"
        )

        for idx, send_resp in enumerate(response.responses):
            if send_resp.exception:
                logger.warning(
                    f"Push failed for token {fcm_tokens[idx][:20]}...: "
                    f"{send_resp.exception}"
                )
    except Exception as exc:
        logger.error(f"Push notification error: {exc}")


def send_push_to_user(
    user_id: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
    channel_id: str = "default",
    sticky: bool = False,
    category_identifier: Optional[str] = None,
) -> None:
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
        send_push_notification(
            tokens, title, body, data,
            channel_id=channel_id,
            sticky=sticky,
            category_identifier=category_identifier,
        )
    else:
        logger.debug(f"No FCM tokens for user {user_id}, push skipped")


def send_push_to_admins(
    title: str,
    body: str,
    data: Optional[dict] = None,
    channel_id: str = "default",
    sticky: bool = False,
    category_identifier: Optional[str] = None,
) -> None:
    """Send push notification to all active admin/superadmin users."""
    from app.database import get_supabase

    supabase = get_supabase()
    admin_resp = (
        supabase.table("users")
        .select("id")
        .in_("role", ["ADMIN", "SUPERADMIN", "HM"])
        .eq("is_active", True)
        .execute()
    )

    for admin in (admin_resp.data or []):
        send_push_to_user(
            admin["id"], title, body, data,
            channel_id=channel_id,
            sticky=sticky,
            category_identifier=category_identifier,
        )


def send_push_to_all_active_employees(
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> None:
    """Broadcast a push notification to every active employee (EMPLOYEE role)."""
    from app.database import get_supabase

    supabase = get_supabase()
    emp_resp = (
        supabase.table("users")
        .select("id")
        .eq("role", "EMPLOYEE")
        .eq("is_active", True)
        .execute()
    )

    for user in (emp_resp.data or []):
        send_push_to_user(user["id"], title, body, data)
