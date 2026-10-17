-- StickyTask: create tasks table
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

CREATE TABLE IF NOT EXISTS tasks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title         TEXT NOT NULL,
    description   TEXT,
    due_date      DATE,
    due_time      TIME,
    priority      TEXT CHECK (priority IN ('low', 'medium', 'high')),
    tags          TEXT[] DEFAULT '{}',
    status        TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in progress', 'done')),
    snooze_until  TIMESTAMP,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks (priority);
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_tasks_snooze_until ON tasks (snooze_until);
