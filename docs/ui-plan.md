# Cold Call Guide — Screen Design

## Screen 1: Live Call Guide

### Header
- Product name: Growth Call Guide
- Call timer
- Prospect name, role, and company
- Call status

### Stage progress
- Display all eight numbered stages.
- Highlight the current stage.
- Make the current position easy to identify.

### Current stage
- Stage number and name
- One-line purpose
- Three example prospect responses from stages.json

### Record what happened
- Four quick-action buttons
- Visually highlight selected options
- Allow multiple selections where appropriate

### Prospect notes
- One text area for the prospect's own words
- Preserve notes for each stage when navigating

### Navigation
- Next button displays the upcoming stage name.
- End Call is available from every stage.
- Final stage provides a way to finish and save the call.
- Ask for the final outcome when ending the call.

### Design principles
- Readable at a glance during a live conversation
- Minimal typing and easy-to-tap controls
- Clear distinction between stages and actions
- Responsive on laptop and mobile screens
---------------------------------------------------------------------------------------------------------------------


## Screen 2: Past Calls

### Page header
- Title: Past Calls
- Short description explaining that this page lists previously saved calls.
- Navigation back to the Live Call Guide or an option to start a new call.

### Call statistics
- Total number of saved calls.
- Count of calls grouped by the last stage reached.
- Calculate the statistics from saved call records rather than hardcoding values.

### Past calls list

For each call, display:
- Prospect name, when available.
- Company name, when available.
- Last stage reached, from Stage 1 to Stage 8.
- Final recorded outcome.
- Call date and time.

### Call details
- Allow a caller to inspect saved notes and stage results if time permits.
- Keep this secondary to the main call list.

### Empty state
- Explain that no calls have been saved yet.
- Provide a clear way to start the first call.

### Loading and error states
- Show a loading message while calls are being retrieved.
- Display a readable error if the backend cannot be reached.
- Never present sample records as real saved calls.

### Design principles
- Make the last stage and outcome easy to scan.
- Use readable spacing and concise labels.
- Support laptop and mobile layouts.
- Display real saved data from the backend.
