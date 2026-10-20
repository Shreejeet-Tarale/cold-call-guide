
import { useEffect, useState } from 'react'
import PastCalls from './PastCalls'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  'https://cold-call-guide-api.onrender.com'
).replace(/\/+$/, '')

const OUTCOMES = [
  { value: 'next_step_agreed', label: 'Next step agreed' },
  { value: 'agreed_to_receive_report', label: 'Agreed to receive report' },
  { value: 'interested', label: 'Interested' },
  { value: 'follow_up', label: 'Follow-up required' },
  { value: 'call_again', label: 'Call again' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'do_not_call', label: 'Do not call' },
  { value: 'wrong_person', label: 'Wrong person' },
  { value: 'moved_company', label: 'Contact moved company' },
  { value: 'not_logged', label: 'No outcome recorded' },
]

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      data.detail || `The server returned HTTP ${response.status}.`,
    )
  }

  return data
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function App() {
  const [activeView, setActiveView] = useState('live')
  const [stages, setStages] = useState([])
  const [stageStatus, setStageStatus] = useState('loading')
  const [stageError, setStageError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  const [prospectName, setProspectName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [prospectRole, setProspectRole] = useState('')

  const [activeCall, setActiveCall] = useState(null)
  const [completedCall, setCompletedCall] = useState(null)
  const [currentStageIndex, setCurrentStageIndex] = useState(0)
  const [stageEntries, setStageEntries] = useState({})
  const [callStartedAt, setCallStartedAt] = useState(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showEndDialog, setShowEndDialog] = useState(false)
  const [outcome, setOutcome] = useState('')

  // Load stage content from the deployed FastAPI backend.
  useEffect(() => {
    let cancelled = false

    async function loadStages() {
      setStageStatus('loading')
      setStageError('')

      try {
        const data = await apiRequest('/stages')

        if (!Array.isArray(data.stages) || data.stages.length !== 8) {
          throw new Error('The API did not return all eight call stages.')
        }

        if (!cancelled) {
          setStages(data.stages)
          setStageStatus('ready')
        }
      } catch (err) {
        if (!cancelled) {
          setStageError(err.message || 'Unable to load stage content.')
          setStageStatus('error')
        }
      }
    }

    loadStages()

    return () => {
      cancelled = true
    }
  }, [retryCount])

  // Keep the call timer updated while a call is active.
  useEffect(() => {
    if (!callStartedAt) return undefined

    const timer = window.setInterval(() => {
      setElapsedSeconds(
        Math.floor((Date.now() - callStartedAt) / 1000),
      )
    }, 1000)

    return () => window.clearInterval(timer)
  }, [callStartedAt])

  const currentStage = stages[currentStageIndex]

  const currentEntry = currentStage
    ? stageEntries[currentStage.id] || {
        selected_actions: [],
        prospect_words: '',
      }
    : { selected_actions: [], prospect_words: '' }

  function updateCurrentEntry(updater) {
    if (!currentStage) return

    setStageEntries((previous) => {
      const existing = previous[currentStage.id] || {
        selected_actions: [],
        prospect_words: '',
      }

      return {
        ...previous,
        [currentStage.id]: updater(existing),
      }
    })
  }

  function toggleAction(action) {
    updateCurrentEntry((entry) => {
      const selected = entry.selected_actions.includes(action)

      return {
        ...entry,
        selected_actions: selected
          ? entry.selected_actions.filter((item) => item !== action)
          : [...entry.selected_actions, action],
      }
    })
  }

  async function handleStartCall(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      const data = await apiRequest('/calls', {
        method: 'POST',
        body: JSON.stringify({
          prospect_name: prospectName.trim() || null,
          company_name: companyName.trim() || null,
          prospect_role: prospectRole.trim() || null,
        }),
      })

      setActiveCall(data.call)
      setCompletedCall(null)
      setCurrentStageIndex(0)
      setStageEntries({})
      setCallStartedAt(Date.now())
      setElapsedSeconds(0)
      setOutcome('')
      setNotice('Call started. Stage 1 is ready.')
    } catch (err) {
      setError(err.message || 'Unable to start the call.')
    } finally {
      setIsSaving(false)
    }
  }

  async function saveCurrentStage() {
    if (!activeCall || !currentStage) {
      throw new Error('No active call or stage is available to save.')
    }

    const entry = stageEntries[currentStage.id] || {
      selected_actions: [],
      prospect_words: '',
    }

    await apiRequest(`/calls/${activeCall.id}/stages`, {
      method: 'POST',
      body: JSON.stringify({
        stage_number: currentStage.id,
        selected_actions: entry.selected_actions,
        prospect_words: entry.prospect_words.trim() || null,
      }),
    })
  }

  async function handleNextStage() {
    if (!activeCall || !currentStage || isSaving) return

    if (currentStageIndex === stages.length - 1) {
      setError('')
      setShowEndDialog(true)
      return
    }

    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      await saveCurrentStage()

      const savedStageName = currentStage.name

      setCurrentStageIndex((index) =>
        Math.min(index + 1, stages.length - 1),
      )

      setNotice(`${savedStageName} saved successfully.`)
    } catch (err) {
      setError(err.message || 'Unable to save this stage.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePreviousStage() {
    if (!activeCall || currentStageIndex === 0 || isSaving) return

    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      await saveCurrentStage()
      setCurrentStageIndex((index) => Math.max(index - 1, 0))
    } catch (err) {
      setError(err.message || 'Unable to save this stage.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleEndCall(event) {
    event.preventDefault()

    if (!activeCall || !outcome || isSaving) return

    setError('')
    setNotice('')
    setIsSaving(true)

    try {
      // Save the current stage before completing the call.
      await saveCurrentStage()

      const data = await apiRequest(
        `/calls/${activeCall.id}/end`,
        {
          method: 'POST',
          body: JSON.stringify({
            outcome,
            summary: null,
          }),
        },
      )

      setCompletedCall(data.call)
      setActiveCall(null)
      setCallStartedAt(null)
      setElapsedSeconds(0)
      setShowEndDialog(false)
      setOutcome('')
      setNotice('Call saved successfully.')
    } catch (err) {
      setError(err.message || 'Unable to complete the call.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleNewCall() {
    setProspectName('')
    setCompanyName('')
    setProspectRole('')
    setStageEntries({})
    setActiveCall(null)
    setCompletedCall(null)
    setCurrentStageIndex(0)
    setCallStartedAt(null)
    setElapsedSeconds(0)
    setError('')
    setNotice('')
    setOutcome('')
  }

  const progress = stages.length
    ? ((currentStageIndex + 1) / stages.length) * 100
    : 0

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-700 text-lg font-bold text-white">
              M
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight">
                MERIDIAN
              </p>
              <p className="text-xs text-slate-500">
                GROWTH CALL GUIDE
              </p>
            </div>
          </div>
          
          <nav
            aria-label="Main navigation"
            className="flex flex-wrap items-center gap-2"
          >
            <button
              type="button"
              onClick={() => setActiveView('live')}
              aria-current={activeView === 'live' ? 'page' : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                activeView === 'live'
                  ? 'bg-indigo-700 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Live Call
            </button>

            <button
              type="button"
              onClick={() => setActiveView('history')}
              disabled={Boolean(activeCall)}
              aria-current={activeView === 'history' ? 'page' : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                activeView === 'history'
                  ? 'bg-indigo-700 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Past Calls
            </button>
          </nav>

          <div className="flex items-center gap-3">
            {activeCall && (
              <>
                <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex">
                  CALL IN PROGRESS
                </span>
                <div className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm font-semibold tabular-nums">
                  {formatDuration(elapsedSeconds)}
                </div>
              </>
            )}
            {!activeCall && (
              <span className="hidden text-xs text-slate-500 sm:inline">
                Structured conversations. Clear outcomes.
              </span>
            )}
          </div>
        </div>
      </header>

      {activeView === 'history' ? (
        <PastCalls
          onStartNewCall={() => {
            handleNewCall()
            setActiveView('live')
          }}
        />
      ) : (
      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8 lg:py-10">
        <div className="mb-8 flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-700">
            SALES CONVERSATION WORKSPACE
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {activeCall ? 'Live call guide' : 'Start a conversation'}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            {activeCall
              ? 'Stay focused on the prospect. Record what happened, capture their words, and agree on the next action.'
              : 'A practical workspace to guide each call, capture what prospects say, and save the final outcome.'}
          </p>
        </div>

        {notice && (
          <div
            role="status"
            className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            {notice}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <p className="font-semibold">Something needs attention</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {stageStatus === 'loading' && !activeCall && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600 shadow-sm">
            Loading call stages from the backend...
          </div>
        )}

        {stageStatus === 'error' && !activeCall && (
          <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-red-800">
              Could not load call stages
            </h2>
            <p className="mt-2 text-sm text-slate-600">{stageError}</p>
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              className="mt-4 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800"
            >
              Retry connection
            </button>
          </div>
        )}

        {!activeCall && stageStatus === 'ready' && (
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
                  NEW CALL
                </p>
                <h2 className="mt-2 text-xl font-bold">
                  Prospect details
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Enter the details you know. You can leave fields blank
                  when information is unavailable.
                </p>
              </div>

              <form onSubmit={handleStartCall} className="space-y-5">
                <div>
                  <label
                    htmlFor="prospect-name"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Prospect name
                  </label>
                  <input
                    id="prospect-name"
                    value={prospectName}
                    onChange={(event) => setProspectName(event.target.value)}
                    placeholder="e.g. Dr. Anjali Menon"
                    maxLength={200}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="company-name"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Company
                  </label>
                  <input
                    id="company-name"
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder="e.g. Example Manufacturing"
                    maxLength={200}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="prospect-role"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Prospect's role
                  </label>
                  <input
                    id="prospect-role"
                    value={prospectRole}
                    onChange={(event) => setProspectRole(event.target.value)}
                    placeholder="e.g. Operations Manager"
                    maxLength={200}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSaving || stageStatus !== 'ready'}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? 'Starting call...' : 'Start call'}
                  <span aria-hidden="true">→</span>
                </button>
              </form>

              {completedCall && (
                <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="font-semibold text-emerald-900">
                    Previous call saved
                  </p>
                  <p className="mt-1 text-sm text-emerald-800">
                    Outcome: {completedCall.outcome}
                  </p>
                  <button
                    type="button"
                    onClick={handleNewCall}
                    className="mt-3 text-sm font-semibold text-emerald-900 underline underline-offset-4"
                  >
                    Clear previous result
                  </button>
                </div>
              )}
            </section>

            <aside className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-300">
                READY WHEN YOU ARE
              </p>
              <h2 className="mt-3 text-2xl font-bold leading-tight">
                Eight stages.
                <br />
                One clear conversation.
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                Follow the call structure without losing sight of what
                the prospect is actually telling you.
              </p>

              <div className="mt-8 space-y-4">
                {stages.map((stage) => (
                  <div key={stage.id} className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-indigo-200">
                      {stage.id}
                    </span>
                    <div className="pt-1">
                      <p className="text-sm font-medium">{stage.name}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 border-t border-white/10 pt-5 text-xs leading-5 text-slate-400">
                Stage content is loaded from your deployed backend.
                Call records and notes are saved to Supabase.
              </div>
            </aside>
          </div>
        )}

        {activeCall && currentStage && (
          <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_0.7fr]">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-5 sm:p-7">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
                      CURRENT PROSPECT
                    </p>
                    <h2 className="mt-2 text-xl font-bold">
                      {activeCall.prospect_name || 'Unnamed prospect'}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {[activeCall.prospect_role, activeCall.company_name]
                        .filter(Boolean)
                        .join(' · ') || 'Company details not provided'}
                    </p>
                  </div>
                  <div className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    In progress
                  </div>
                </div>

                <div className="mt-7">
                  <div className="mb-3 flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-500">CALL PROGRESS</span>
                    <span className="text-slate-700">
                      {currentStageIndex + 1} of {stages.length}
                    </span>
                  </div>
                  <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-8 gap-1.5 sm:gap-2">
                    {stages.map((stage, index) => {
                      const isCurrent = index === currentStageIndex
                      const isComplete = index < currentStageIndex

                      return (
                        <div
                          key={stage.id}
                          title={stage.name}
                          aria-current={isCurrent ? 'step' : undefined}
                          className={`flex h-9 items-center justify-center rounded-lg text-xs font-semibold ${
                            isCurrent
                              ? 'bg-indigo-700 text-white ring-4 ring-indigo-100'
                              : isComplete
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'border border-slate-200 bg-white text-slate-500'
                          }`}
                        >
                          {stage.id}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-7">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
                  STAGE {currentStage.id} OF {stages.length}
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight">
                  {currentStage.name}
                </h2>
                <div className="mt-4 rounded-xl border-l-4 border-indigo-600 bg-indigo-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-800">
                    Purpose
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {currentStage.purpose}
                  </p>
                </div>

                <div className="mt-7">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-slate-800">
                      They may say
                    </h3>
                    <span className="text-xs text-slate-400">
                      Conversation prompts
                    </span>
                  </div>
                  <div className="space-y-2">
                    {currentStage.they_may_say.map((line, index) => (
                      <div
                        key={`${currentStage.id}-${index}`}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm leading-6 text-slate-700"
                      >
                        <span className="mr-2 text-indigo-500">“</span>
                        {line}
                        <span className="ml-1 text-indigo-500">”</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-8">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-slate-800">
                      What happened?
                    </h3>
                    <span className="text-xs text-slate-400">
                      Select applicable options
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {currentStage.tap_options.map((action) => {
                      const selected =
                        currentEntry.selected_actions.includes(action)

                      return (
                        <button
                          key={action}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleAction(action)}
                          className={`flex min-h-12 items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                            selected
                              ? 'border-indigo-700 bg-indigo-700 text-white shadow-sm'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
                          }`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${
                              selected
                                ? 'border-white bg-white text-indigo-700'
                                : 'border-slate-300'
                            }`}
                          >
                            {selected ? '✓' : ''}
                          </span>
                          {action}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="mt-8">
                  <label
                    htmlFor="prospect-words"
                    className="block text-sm font-bold text-slate-800"
                  >
                    Their words
                  </label>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Capture the prospect's actual words. Notes are saved
                    when you move stages or end the call.
                  </p>
                  <textarea
                    id="prospect-words"
                    value={currentEntry.prospect_words}
                    onChange={(event) =>
                      updateCurrentEntry((entry) => ({
                        ...entry,
                        prospect_words: event.target.value,
                      }))
                    }
                    maxLength={5000}
                    rows={4}
                    placeholder="What did the prospect say?"
                    className="mt-3 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                  />
                  <p className="mt-1 text-right text-xs text-slate-400">
                    {currentEntry.prospect_words.length}/5000
                  </p>
                </div>

                <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={() => setShowEndDialog(true)}
                    disabled={isSaving}
                    className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    End call
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handlePreviousStage}
                      disabled={currentStageIndex === 0 || isSaving}
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={handleNextStage}
                      disabled={isSaving}
                      className="rounded-xl bg-indigo-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving
                        ? 'Saving...'
                        : currentStageIndex === stages.length - 1
                          ? 'Finish call'
                          : `Next: ${stages[currentStageIndex + 1].name}`}
                      {!isSaving && <span className="ml-2">→</span>}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <aside className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
                  CALLER REMINDERS
                </p>
                <h3 className="mt-2 text-lg font-bold">
                  Keep it conversational
                </h3>
                <div className="mt-4 space-y-4">
                  {[
                    'Use these prompts as guidance, not as a script.',
                    'Listen carefully and let the prospect finish speaking.',
                    'Capture their words rather than assumptions.',
                    'Confirm the next action before ending the call.',
                  ].map((reminder, index) => (
                    <div key={reminder} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
                        {index + 1}
                      </span>
                      <p className="text-sm leading-6 text-slate-600">
                        {reminder}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900 p-5 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-300">
                  CURRENT STAGE
                </p>
                <p className="mt-2 text-2xl font-bold">
                  {currentStage.id} / {stages.length}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  {currentStage.name}
                </p>
                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-indigo-400 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500">
                Your stage actions and notes are saved to Supabase when
                you move to another stage or finish the call.
              </div>
            </aside>
          </div>
        )}
      </main>
      )}

      {showEndDialog && activeCall && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSaving) {
              setShowEndDialog(false)
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="end-call-title"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-7"
          >
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
              CALL OUTCOME
            </p>
            <h2 id="end-call-title" className="mt-2 text-2xl font-bold">
              Finish this call?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Choose the outcome that best reflects the conversation.
              The current stage will be saved before the call is closed.
            </p>

            <form onSubmit={handleEndCall} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="call-outcome"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Final outcome
                </label>
                <select
                  id="call-outcome"
                  value={outcome}
                  onChange={(event) => setOutcome(event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                >
                  <option value="">Select an outcome</option>
                  {OUTCOMES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowEndDialog(false)}
                  disabled={isSaving}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Continue call
                </button>
                <button
                  type="submit"
                  disabled={!outcome || isSaving}
                  className="rounded-xl bg-indigo-700 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? 'Saving call...' : 'Save and end call'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
