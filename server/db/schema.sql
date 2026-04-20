CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Sessions ──────────────────────────────────────────────────
-- Groups related prompts and AI responses into logical conversation threads.
CREATE TABLE sessions (
    session_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title       VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Messages ──────────────────────────────────────────────────
-- Stores the actual textual content with role differentiation.
CREATE TABLE messages (
    message_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id  UUID NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL CHECK (role IN ('user', 'qwen', 'chatgpt')),
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Metadata ──────────────────────────────────────────────────
-- Captures operational context for analytics and debugging.
CREATE TABLE metadata (
    meta_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id       UUID UNIQUE NOT NULL REFERENCES messages(message_id) ON DELETE CASCADE,
    source_platform  VARCHAR(50),
    model_version    VARCHAR(50),
    token_estimate   INT
);

-- ─── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_metadata_message ON metadata(message_id);
