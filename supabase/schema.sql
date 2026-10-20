-- ==========================================
-- Cold Call Guide: Database Schema
-- ==========================================

-- 1. Calls table
-- Stores the overall details and outcome of each call.

CREATE TABLE IF NOT EXISTS public.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    prospect_name TEXT,
    company_name TEXT,
    prospect_role TEXT,

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,

    last_stage_reached SMALLINT NOT NULL DEFAULT 1
        CHECK (last_stage_reached BETWEEN 1 AND 8),

    status TEXT NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'completed')),

    outcome TEXT,
    summary TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_call_times
        CHECK (ended_at IS NULL OR ended_at >= started_at)
);


-- 2. Stage results table
-- Stores the actions and notes recorded at each call stage.

CREATE TABLE IF NOT EXISTS public.stage_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    call_id UUID NOT NULL
        REFERENCES public.calls(id) ON DELETE CASCADE,

    stage_number SMALLINT NOT NULL
        CHECK (stage_number BETWEEN 1 AND 8),

    selected_actions TEXT[] NOT NULL DEFAULT '{}',

    prospect_words TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- A call can have only one saved result per stage.
    CONSTRAINT unique_call_stage
        UNIQUE (call_id, stage_number)
);


-- 3. Indexes for common queries
-- These help retrieve recent calls and stage results efficiently.

CREATE INDEX IF NOT EXISTS idx_calls_started_at
    ON public.calls (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_stage_results_call_id
    ON public.stage_results (call_id);


-- 4. Enable Row Level Security (RLS)
-- The backend will use a server-side Supabase service-role key.
-- Never expose that key in the frontend or commit it to GitHub.

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_results ENABLE ROW LEVEL SECURITY;