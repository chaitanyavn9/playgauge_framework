-- =============================================================================
-- playgauge_framework — PostgreSQL Schema
-- =============================================================================
-- Run: psql -U playgauge_user -d playgauge_db -f schema.sql
-- Or:  npm run db:migrate

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fast text search on failure messages

-- =============================================================================
-- 1. test_runs  — one row per test execution
-- =============================================================================
CREATE TABLE IF NOT EXISTS test_runs (
  id                        UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at                TIMESTAMPTZ NOT NULL    DEFAULT NOW(),

  -- Identity
  run_id                    TEXT        NOT NULL,   -- CI run ID or timestamp-based batch ID
  spec                      TEXT        NOT NULL,
  test                      TEXT        NOT NULL,
  module                    TEXT,
  integration_folder        TEXT,
  component_key             TEXT,
  page_key                  TEXT,
  environment               TEXT        NOT NULL DEFAULT 'dev',

  -- Status & retry
  test_status               TEXT        NOT NULL,   -- passed | failed | skipped
  is_failure                BOOLEAN     NOT NULL DEFAULT FALSE,
  retry_attempt             INT         NOT NULL DEFAULT 0,
  max_retries               INT         NOT NULL DEFAULT 0,
  passed_on_retry           BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Failure identity
  failure_message           TEXT,
  failure_stack_trace       TEXT,        -- full Playwright stack trace from failing step
  failure_signature         TEXT,        -- stable hash for deduplication
  failure_bucket_hint       TEXT,        -- TIMEOUT | ASSERTION | NETWORK | ...
  schema_version            TEXT        NOT NULL DEFAULT 'failure_features_v1',

  -- Console signals
  console_error_count       INT         NOT NULL DEFAULT 0,
  console_warn_count        INT         NOT NULL DEFAULT 0,
  uncaught_exception_count  INT         NOT NULL DEFAULT 0,

  -- API / Network metrics
  network_failure_count     INT         NOT NULL DEFAULT 0,
  api_call_count            INT         NOT NULL DEFAULT 0,
  api_dependency_edge_count INT         NOT NULL DEFAULT 0,
  duplicate_api_call_count  INT         NOT NULL DEFAULT 0,
  slow_api_call_count       INT         NOT NULL DEFAULT 0,
  slow_api_threshold_ms     INT         NOT NULL DEFAULT 1500,
  http_4xx_count            INT         NOT NULL DEFAULT 0,
  http_5xx_count            INT         NOT NULL DEFAULT 0,
  p95_api_duration          INT         NOT NULL DEFAULT 0,
  max_api_duration          INT         NOT NULL DEFAULT 0,
  top_failing_endpoint      TEXT,

  -- Observability scoring
  observability_severity    TEXT        NOT NULL DEFAULT 'NONE',
  observability_score       INT         NOT NULL DEFAULT 0,
  observability_reasons     TEXT[],

  -- Rule-based category (pre-AI)
  suspected_category_rule   TEXT,
  suspected_category_score  NUMERIC(5,3),

  -- AI analysis (populated after AI Analyzer runs)
  ai_failure_category       TEXT,        -- Automation Script Issue | Flaky Issue | ...
  ai_confidence             NUMERIC(5,3),
  ai_reasoning              TEXT,
  ai_suggestions            TEXT[],
  ai_analyzed_at            TIMESTAMPTZ,

  -- Screenshot (failure only)
  screenshot_base64         TEXT,        -- base64-encoded PNG

  -- Full feature vector JSON (for AI input)
  failure_features_json     JSONB,

  -- Future: Git integration
  git_commit_hash           TEXT,
  git_branch                TEXT,
  git_author                TEXT,
  modified_files            TEXT[],

  -- Future: App server logs
  server_log_before         TEXT,
  server_log_after          TEXT,

  timestamp                 BIGINT      NOT NULL   -- epoch ms from test run
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_test_runs_spec           ON test_runs (spec);
CREATE INDEX IF NOT EXISTS idx_test_runs_test           ON test_runs (test);
CREATE INDEX IF NOT EXISTS idx_test_runs_run_id         ON test_runs (run_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_environment    ON test_runs (environment);
CREATE INDEX IF NOT EXISTS idx_test_runs_is_failure     ON test_runs (is_failure);
CREATE INDEX IF NOT EXISTS idx_test_runs_failure_sig    ON test_runs (failure_signature);
CREATE INDEX IF NOT EXISTS idx_test_runs_ai_category    ON test_runs (ai_failure_category);
CREATE INDEX IF NOT EXISTS idx_test_runs_created_at     ON test_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_runs_fts_message    ON test_runs USING GIN (failure_message gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_test_runs_features_json  ON test_runs USING GIN (failure_features_json);


-- =============================================================================
-- 2. api_calls — raw API call log per test run
-- =============================================================================
CREATE TABLE IF NOT EXISTS api_calls (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id      UUID        NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  page        TEXT,
  endpoint    TEXT        NOT NULL,
  method      TEXT        NOT NULL,
  status      INT         NOT NULL,
  duration_ms INT         NOT NULL,
  timestamp   BIGINT      NOT NULL,
  is_slow     BOOLEAN     NOT NULL DEFAULT FALSE,
  is_failed   BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_api_calls_run_id    ON api_calls (run_id);
CREATE INDEX IF NOT EXISTS idx_api_calls_endpoint  ON api_calls (endpoint);
CREATE INDEX IF NOT EXISTS idx_api_calls_is_slow   ON api_calls (is_slow);
CREATE INDEX IF NOT EXISTS idx_api_calls_is_failed ON api_calls (is_failed);


-- =============================================================================
-- 3. console_signals — raw console errors/warnings per test run
-- =============================================================================
CREATE TABLE IF NOT EXISTS console_signals (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id      UUID        NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  message     TEXT        NOT NULL,
  signal_type TEXT        NOT NULL,
  level       TEXT        NOT NULL,   -- error | warn | uncaught_exception
  page        TEXT,
  timestamp   BIGINT      NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_console_signals_run_id ON console_signals (run_id);
CREATE INDEX IF NOT EXISTS idx_console_signals_level  ON console_signals (level);


-- =============================================================================
-- 4. failure_trends — materialized summary for trend dashboards / Grafana
-- =============================================================================
CREATE TABLE IF NOT EXISTS failure_trends (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_start          TIMESTAMPTZ NOT NULL,
  window_end            TIMESTAMPTZ NOT NULL,
  environment           TEXT        NOT NULL,
  module                TEXT,
  spec                  TEXT,
  test                  TEXT,
  total_runs            INT         NOT NULL DEFAULT 0,
  total_failures        INT         NOT NULL DEFAULT 0,
  failure_rate          NUMERIC(5,2),
  flaky_count           INT         NOT NULL DEFAULT 0,
  avg_observability_score NUMERIC(6,2),
  top_failure_category  TEXT,
  top_failure_signature TEXT
);

CREATE INDEX IF NOT EXISTS idx_failure_trends_env    ON failure_trends (environment);
CREATE INDEX IF NOT EXISTS idx_failure_trends_window ON failure_trends (window_start, window_end);


-- =============================================================================
-- 5. ai_analysis_runs — log of every AI Analyzer invocation
-- =============================================================================
CREATE TABLE IF NOT EXISTS ai_analysis_runs (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  run_batch_id    TEXT        NOT NULL,
  model           TEXT        NOT NULL DEFAULT 'claude-3-5-sonnet',
  tests_analyzed  INT         NOT NULL DEFAULT 0,
  tokens_used     INT,
  duration_ms     INT,
  report_path     TEXT,
  status          TEXT        NOT NULL DEFAULT 'completed'
);

-- =============================================================================
-- Migration helpers (run once on existing databases)
-- =============================================================================
-- If you are upgrading from a previous schema version, run the statements
-- below manually (they are idempotent — safe to run more than once):
--
--   ALTER TABLE test_runs
--     ADD COLUMN IF NOT EXISTS failure_stack_trace TEXT;
--
-- =============================================================================
-- Done
-- =============================================================================
