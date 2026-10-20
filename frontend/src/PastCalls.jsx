
import { useCallback, useEffect, useState } from 'react'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  'https://cold-call-guide-api.onrender.com'
).replace(/\/+$/, '')

async function fetchApi(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      data.detail || `Request failed with HTTP ${response.status}.`,
    )
  }

  return data
}

function formatDate(value) {
  if (!value) return 'Date unavailable'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'Date unavailable'

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatLabel(value) {
  if (!value) return 'Not recorded'

  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function PastCalls({ onStartNewCall }) {
  const [calls, setCalls] = useState([])
  const [stages, setStages] = useState([])
  const [stageStats, setStageStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statsError, setStatsError] = useState('')
  const [refreshCount, setRefreshCount] = useState(0)
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    setStatsError('')

    // Load each resource independently so a statistics failure
    // does not prevent the call history from appearing.
    const results = await Promise.allSettled([
      fetchApi('/calls'),
      fetchApi('/stats/calls-by-stage'),
      fetchApi('/stages'),
    ])

    const [callsResult, statsResult, stagesResult] = results

    if (callsResult.status === 'fulfilled') {
      const records = callsResult.value.calls

      if (Array.isArray(records)) {
        setCalls(records)
      } else {
        setCalls([])
        setError('The backend returned an invalid call-history response.')
      }
    } else {
      setError(
        callsResult.reason?.message ||
          'Unable to retrieve saved calls.',
      )
    }

    if (statsResult.status === 'fulfilled') {
      setStageStats(statsResult.value.stage_counts || [])
    } else {
      setStatsError('Call statistics are temporarily unavailable.')
    }

    if (stagesResult.status === 'fulfilled') {
      setStages(stagesResult.value.stages || [])
    } else {
      setStages([])
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData, refreshCount])

  const completedCount = calls.filter(
    (call) => call.status === 'completed',
  ).length

  const inProgressCount = calls.filter(
    (call) => call.status === 'in_progress',
  ).length

  const filteredCalls = calls.filter((call) => {
    const query = search.trim().toLowerCase()

    if (!query) return true

    return [
      call.prospect_name,
      call.company_name,
      call.prospect_role,
      call.outcome,
      stages.find((stage) => stage.id === call.last_stage_reached)?.name,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  })

  function stageName(stageNumber) {
    const stage = stages.find((item) => item.id === stageNumber)

    return stage?.name || `Stage ${stageNumber ?? 'unknown'}`
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-700">
              CALL ACTIVITY
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Past Calls
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
              Review previous conversations, see the last stage reached,
              and track the outcome of each call.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setRefreshCount((count) => count + 1)}
              disabled={loading}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh calls'}
            </button>

            <button
              type="button"
              onClick={onStartNewCall}
              className="rounded-xl bg-indigo-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-800"
            >
              + Start new call
            </button>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4"
          >
            <p className="font-semibold text-red-800">
              Unable to load call history
            </p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => setRefreshCount((count) => count + 1)}
              className="mt-3 text-sm font-semibold text-red-800 underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}

        <section
          aria-label="Call statistics"
          className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total calls</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">
              {loading ? '—' : calls.length}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Retrieved from Supabase
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Completed calls</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">
              {loading ? '—' : completedCount}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Calls with a final outcome
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">In progress</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">
              {loading ? '—' : inProgressCount}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Calls not yet completed
            </p>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-bold">Calls by stage reached</h2>
              <p className="mt-1 text-sm text-slate-500">
                Based on each call's last recorded stage.
              </p>
            </div>

            {statsError && (
              <p className="text-sm text-amber-700">{statsError}</p>
            )}
          </div>

          {!statsError && stageStats.length > 0 && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {stageStats.map((item) => (
                <div
                  key={item.stage_number}
                  className="rounded-xl bg-slate-50 p-3"
                >
                  <p className="text-xs font-semibold text-slate-500">
                    S{item.stage_number}
                  </p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {item.count}
                  </p>
                  <p
                    className="mt-1 truncate text-xs text-slate-500"
                    title={stageName(item.stage_number)}
                  >
                    {stageName(item.stage_number)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {!loading && !statsError && stageStats.length === 0 && (
            <p className="mt-4 text-sm text-slate-500">
              No stage statistics are available yet.
            </p>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:p-6">
            <div>
              <h2 className="text-lg font-bold">Call history</h2>
              <p className="mt-1 text-sm text-slate-500">
                {loading
                  ? 'Loading saved calls...'
                  : `${filteredCalls.length} call${filteredCalls.length === 1 ? '' : 's'} shown`}
              </p>
            </div>

            <div className="w-full sm:max-w-sm">
              <label htmlFor="call-search" className="sr-only">
                Search calls
              </label>
              <input
                id="call-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search prospect, company, outcome..."
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              />
            </div>
          </div>

          {loading && (
            <div className="p-8 text-center text-sm text-slate-500">
              Retrieving calls from the backend...
            </div>
          )}

          {!loading && !error && filteredCalls.length === 0 && (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-xl text-indigo-700">
                {search ? '⌕' : '＋'}
              </div>

              <h3 className="mt-4 text-lg font-bold">
                {search ? 'No matching calls' : 'No calls yet'}
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                {search
                  ? 'Try a different search term.'
                  : 'Once you complete a call, its saved details and outcome will appear here.'}
              </p>

              {!search && (
                <button
                  type="button"
                  onClick={onStartNewCall}
                  className="mt-5 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-800"
                >
                  Start your first call
                </button>
              )}
            </div>
          )}

          {!loading && filteredCalls.length > 0 && (
            <div className="divide-y divide-slate-200">
              {filteredCalls.map((call) => {
                const completed = call.status === 'completed'

                return (
                  <article
                    key={call.id}
                    className="p-5 transition hover:bg-slate-50 sm:p-6"
                  >
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="break-words font-bold text-slate-900">
                            {call.prospect_name || 'Unnamed prospect'}
                          </h3>

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              completed
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {completed ? 'Completed' : 'In progress'}
                          </span>
                        </div>

                        <p className="mt-1 break-words text-sm text-slate-500">
                          {[
                            call.prospect_role,
                            call.company_name,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'No company details recorded'}
                        </p>

                        {call.summary && (
                          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                            {call.summary}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 md:min-w-44 md:text-right">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Last stage reached
                        </p>
                        <p className="mt-1 text-sm font-semibold text-indigo-800">
                          {call.last_stage_reached} / 8 ·{' '}
                          {stageName(call.last_stage_reached)}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          {formatDate(call.started_at)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                      <span className="text-xs text-slate-500">
                        Outcome:
                      </span>
                      <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                        {formatLabel(call.outcome)}
                      </span>
                      <span className="text-xs text-slate-400">
                        {call.ended_at
                          ? `Ended ${formatDate(call.ended_at)}`
                          : 'Not yet ended'}
                      </span>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <footer className="mt-6 text-xs leading-5 text-slate-400">
          Call history reflects records returned by the backend. Statistics
          and stage labels are retrieved from the project's API.
        </footer>
      </div>
    </main>
  )
}

export default PastCalls
