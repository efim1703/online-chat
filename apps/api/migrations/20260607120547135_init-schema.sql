-- Up Migration
CREATE TABLE organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name            TEXT NOT NULL,
  public_key      TEXT NOT NULL UNIQUE,
  allowed_origins TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  email           TEXT NOT NULL,
  name            TEXT,
  role            TEXT NOT NULL,
  google_sub      TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE visitors (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES projects(id),
  external_id    TEXT,
  anonymous_name TEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id),
  visitor_id       UUID NOT NULL REFERENCES visitors(id),
  assigned_user_id UUID REFERENCES users(id),
  status           TEXT NOT NULL DEFAULT 'open',
  created_at       TIMESTAMP NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  sender_type     TEXT NOT NULL,
  sender_id       UUID,
  body            TEXT NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT now(),
  delivered_at    TIMESTAMP,
  read_at         TIMESTAMP
);

CREATE TABLE widget_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  visitor_id UUID NOT NULL REFERENCES visitors(id),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation
  ON messages (conversation_id, created_at);
CREATE INDEX idx_conversations
  ON conversations (project_id, status);
CREATE INDEX idx_visitors
  ON visitors (project_id);
CREATE INDEX idx_widget_sessions
  ON widget_sessions (token_hash);

-- Down Migration
DROP TABLE IF EXISTS widget_sessions CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS visitors CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
