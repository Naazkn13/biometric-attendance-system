-- ============================================================
-- Migration 001: Whispr AI — Voice Assistant Tables
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Voice interaction audit log
CREATE TABLE IF NOT EXISTS voice_interaction_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    employee_id UUID REFERENCES employees(id),
    interaction_type TEXT NOT NULL,
    spoken_input TEXT,
    parsed_intent JSONB,
    whispr_response TEXT,
    action_taken JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. In-app notification queue
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_user_id UUID NOT NULL REFERENCES users(id),
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    spoken_message TEXT NOT NULL,
    related_entity_id UUID,
    related_entity_type TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_spoken BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_target_unread
    ON notifications(target_user_id, is_read) WHERE is_read = FALSE;

-- 3. FCM device tokens for push notifications
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    fcm_token TEXT NOT NULL,
    device_type TEXT DEFAULT 'android',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, fcm_token)
);

-- 4. Add multi-day leave support
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS leave_end_date DATE;

-- Backfill: set leave_end_date = leave_date for existing single-day leaves
UPDATE leave_requests SET leave_end_date = leave_date WHERE leave_end_date IS NULL;

-- 5. RLS policies (permissive for service role, same as existing tables)
ALTER TABLE voice_interaction_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for service role" ON voice_interaction_log;
CREATE POLICY "Allow all for service role" ON voice_interaction_log FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for service role" ON notifications;
CREATE POLICY "Allow all for service role" ON notifications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for service role" ON device_tokens;
CREATE POLICY "Allow all for service role" ON device_tokens FOR ALL USING (true) WITH CHECK (true);

-- 6. Enable Supabase Realtime on notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 7. Auto-update updated_at trigger for device_tokens
DROP TRIGGER IF EXISTS trigger_device_tokens_updated_at ON device_tokens;
CREATE TRIGGER trigger_device_tokens_updated_at
    BEFORE UPDATE ON device_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
