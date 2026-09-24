# Agent Iteration 02 (FRONTEND) — Kit Detail Page: Builder + Practice Mode

## ⚠️ Self-checkpointing protocol (mandatory, same rule as the backend docs)

Check for `agent_iteration_02_memory.md` (frontend repo root — this is a **different file** from the backend's `agent_iteration_03_memory.md`, even though both projects call their memory file by iteration number; they live in different repos, never conflate them) at start. Read and resume if present. Work §0's checklist in order, checkpoint after each item, and proactively stop-and-save if your context budget is getting tight relative to remaining work — same template as the backend docs, adapted:

```markdown
# Iteration 02 (Frontend) — Progress Memory
Last updated: <ISO timestamp>
## Done / Decisions / Exact next step / Known issues
(same structure as the backend memory template)
```

---

## 0. Checklist

1. API client additions in `lib/api/kits.ts` for every backend route from `agent_iteration_03.md` (§1)
2. "My Kits" grid page (§2)
3. Kit detail route `/dashboard/kits/[kitId]` — layout, sidebar, breadcrumb (§3)
4. Extend the existing `KitView` into full read + edit mode — Builder state management (§4)
5. Brief / Requirements / Questions / Flashcards sections — Builder editing UX (§5)
6. Schedule section — dedicated editable view (§6)
7. Save/discard changes banner + commit flow (§7)
8. Regenerate actions (brief / category / schedule) — UX + loading states (§8)
9. Practice Mode — full flow (§9)
10. Loading/empty/error states + keyboard access pass (§10)
11. README notes (§11)

---

## Context — what already exists

`lib/api/kits.ts` has `createKit`, `getKit`, `subscribeToKit`, all the `AppendixAKit`/`GeneratedQuestion`/etc. types, and `STATUS_LABELS`. The Interview Prep page currently renders a **read-only** `KitView` inline after a kit finishes generating (no dedicated route, no persistence-backed reopening, no editing). This iteration:

- Moves kit viewing to its own route, `/dashboard/kits/[kitId]`, backed by `GET /api/kits/:id` (already exists per iteration 02 backend).
- Upgrades `KitView` from read-only to fully editable (the Builder).
- Adds a "My Kits" list page.
- Adds Practice Mode as a new full-screen flow.

**Sync note**: every endpoint path, request/response shape, and behavioral rule below matches `agent_iteration_03.md` (backend) exactly as written. If the backend agent deviated from that doc during implementation, reconcile this doc's §1 against the actual deployed routes before proceeding — don't guess.

---

## 1. API client additions — `lib/api/kits.ts`

Add these, following the existing `createKit`/`getKit` pattern (fetch + `Authorization` header, throw on `!res.ok`):

```ts
// Builder — brief
patchBrief(kitId, { summary?, what_they_do? }) → AppendixAKit['company_brief']

// Builder — questions
patchQuestion(kitId, qid, { prompt?, answerOutline?, category?, difficulty? }) → GeneratedQuestion
pinQuestion(kitId, qid, pinned: boolean) → GeneratedQuestion
createQuestion(kitId, { category, prompt, answerOutline, difficulty, requirementIds }) → GeneratedQuestion
deleteQuestion(kitId, qid) → void
reorderQuestions(kitId, category, order: string[]) → void

// Builder — flashcards (identical shape)
patchFlashcard / pinFlashcard / createFlashcard / deleteFlashcard / reorderFlashcards

// Builder — batch commit
commitBuilderChanges(kitId, diff: BuilderDiff) → AppendixAKit   // see §7 for BuilderDiff shape

// Regenerate
regenerateBrief(kitId) → AppendixAKit['company_brief']
regenerateQuestionCategory(kitId, category) → GeneratedQuestion[]   // the full updated set for that category
regenerateSchedule(kitId) → Schedule

// Manual schedule edit
patchSchedule(kitId, { days: ScheduleDay[] }) → { schedule: Schedule; warnings: string[] }

// Practice
startPracticeSession(kitId) → { sessionId: string }
recordAttempt(kitId, sessionId, { flashcardId, confidence: number | null, skipped: boolean }) → void
endPracticeSession(kitId, sessionId) → void
getPracticeQueue(kitId) → string[]   // ordered flashcard ids
listPracticeSessions(kitId) → PracticeSessionSummary[]
getPracticeSessionDetail(kitId, sessionId) → PracticeSessionDetail
```

Extend the `AppendixAKit`/`GeneratedQuestion`/`GeneratedFlashcard` types with the fields the backend now returns that the frontend didn't need before:

```ts
export interface GeneratedQuestion {
  // ...existing fields...
  state: 'GENERATED' | 'EDITED' | 'PINNED';
  orderIndex: number;
}
export interface GeneratedFlashcard {
  // ...existing fields...
  state: 'GENERATED' | 'EDITED' | 'PINNED';
  orderIndex: number;
}
export interface AppendixAKit {
  // ...existing fields...
  briefState: 'GENERATED' | 'EDITED';
  scheduleStale: boolean;
}
```

---

## 2. "My Kits" — grid page

Route: `/dashboard/kits` (list page — the existing Interview Prep "Create Kit" flow can either live here too or stay where it is and link here; your call, keep it consistent with the rest of the dashboard's nav).

- Fetch via a new `listKits(token)` API call → `GET /api/kits` (backend needs this list endpoint if it doesn't exist yet — simple `WHERE userId = req.user.userId ORDER BY createdAt DESC`, returning a lightweight summary shape, not the full kit: `{ id, roleTitle, companyName, status, createdAt, questionCount, daysAvailable }`. If this route isn't in the backend doc yet, flag it as a small backend gap rather than silently blocking — it's a trivial addition).
- Grid of cards, each showing: role title + company (or `source.company_url` if `companyName` is empty), a status badge (READY/generating/FAILED — reuse `STATUS_LABELS`), day count, question count, created date.
- Click → `router.push('/dashboard/kits/' + kit.id)`.
- A kit still `RESEARCHING`/`GENERATING`/etc. is clickable too — its detail page should itself resume watching status (see §3), not just show a static "in progress" card with no way in.
- Empty state (no kits yet): reuse the existing "No kits yet" panel from the current Interview Prep page.
- "Create Kit" button opens the same `CreateKitForm` modal that exists today, unchanged — on `onKitComplete`, navigate to the new kit's detail page instead of (or in addition to) closing the modal.

---

## 3. Kit detail route — `/dashboard/kits/[kitId]`

Layout: existing dashboard sidebar stays; main content area's header shows a breadcrumb: `PrepKit / Dashboard / {kitId}` (or swap the raw id for the role title once loaded — nicer, still keep the id in a title attribute/tooltip for reference). Each breadcrumb segment before the current one is a clickable link back to that level (`PrepKit` → app home, `Dashboard` → `/dashboard`).

Page-level data flow:

```ts
const { kitId } = useParams();
const [kit, setKit] = useState<AppendixAKit | null>(null);
const [status, setStatus] = useState<KitStatus | null>(null);

useEffect(() => {
  // 1. fetch current state immediately
  getKit(kitId, token).then(({ status, kit }) => {
    setStatus(status);
    if (kit) setKit(kit);
  });

  // 2. if not yet READY/FAILED, also subscribe for live updates (handles the
  //    "clicked into a kit that's still generating" case from §2)
  if (status !== 'READY' && status !== 'FAILED') {
    const unsubscribe = subscribeToKit(kitId, token, {
      onStatus: setStatus,
      onResult: (result) => { setKit(result); setStatus('READY'); },
      onError: (msg) => { setStatus('FAILED'); /* store msg for display */ },
    });
    return unsubscribe;
  }
}, [kitId]);
```

- While `status !== 'READY'`: render the same staged-progress UI the creation modal uses (reuse the component, don't fork it) — this is what makes reopening a still-generating kit not feel broken.
- `status === 'FAILED'`: render a real error state with the message and a "Try again" button that re-submits `createKit` with... actually there's no stored `jd`/`companyUrl` to resubmit from this page alone unless the backend's `GET /api/kits/:id` also returns them (it should — `jdText`, `companyUrl`, `daysAvailable` are already columns on `Kit`; include them in the response so a failed kit can offer "edit and retry" pre-filling the creation form).
- `status === 'READY'`: render the full `KitView` (§4 onward) with three top-level tab/section targets the user asked for as distinct buttons: **Overview** (brief/requirements/questions/flashcards, i.e. today's `KitView` content), **Schedule** (dedicated day-by-day editor, §6), **Practice** (launches the full-screen Practice Mode flow, §9). Keep Overview as the default active view.

---

## 4. Builder state management — the core of this iteration

Local edit state is the answer to the "Save changes" banner UX you described. Model it as a diff against the loaded `kit`, not as a second copy of the whole kit:

```ts
interface BuilderDiff {
  brief?: { summary?: string; what_they_do?: string };
  questions: {
    updates: Map<string, Partial<GeneratedQuestion>>;   // qid -> changed fields
    creates: NewQuestionDraft[];
    deletes: Set<string>;
    reorders: Map<QuestionCategory, string[]>;           // category -> full ordered id list, if touched
    pins: Map<string, boolean>;
  };
  flashcards: { /* identical shape */ };
}
```

- A `useBuilderStore` (zustand, matching your existing `useAuthStore` pattern) holds: the base `kit` (as last fetched/saved), the `diff` above, and derived getters: `isDirty` (any non-empty part of the diff), and `displayedKit` — a **memoized merge** of `kit` + `diff`, which is what every rendering component actually reads from (never render straight off `kit` once editing has started, or local edits won't show).
- Every editing interaction (§5, §6) mutates the `diff`, never calls the API directly — except pin/unpin and delete, which are cheap, unambiguous, low-risk actions with clear reasonable UX as **immediate** API calls (§7 explains why these two are the exception).
- `displayedKit` merge logic: apply `updates` over matching ids, filter out `deletes`, append `creates` (with a temporary client-side id like `temp-<uuid>` until the commit response returns the real `qN`), and apply `reorders` as the category's `orderIndex` ordering.

---

## 5. Editing UX — Brief, Requirements, Questions, Flashcards

**Brief**: click-to-edit — the summary/what-they-do text renders as plain text by default; clicking it (or an inline pencil icon on hover) swaps to a textarea with a checkmark/x to confirm/cancel. Confirming writes into `diff.brief`, doesn't call the API. If `kit.briefState === 'EDITED'` already, show a small "edited" tag near the section heading (mirrors the `PINNED`/`EDITED` badges on questions below) so the user knows a future "Regenerate brief" will be blocked (§8 explains why, surface that reasoning in the disabled button's tooltip, don't just grey it out silently).

**Requirements**: read-only in this iteration (the spec's Builder section doesn't list requirement editing — extraction accuracy is instead what §1 of the automated grading scores; don't build editing for something not asked for and not graded).

**Questions** — the main Builder surface:

- Each `QuestionCard` (already exists, extend it) gets, in edit mode: an edit icon → prompt and answer-outline become inline-editable text areas; a category `<select>` (moving categories is just changing this field — writes into `diff.questions.updates`, and note in the UI that moving it will also implicitly reorder it to the end of its new category's list); a difficulty selector (the existing dot indicator becomes clickable, 1–3); a pin toggle icon (fills solid when `PINNED`); a delete icon (with a confirm — this one, per §7, fires immediately, not batched).
- Visual state badges: small colored tag per card — `GENERATED` (no badge, default/untouched), `EDITED` (a subtle "edited" pill), `PINNED` (a filled pin icon + tag) — this directly visualizes the tri-state the whole "hardest state problem" is about; make it legible, it's worth showing off in the walkthrough video.
- Reordering within a category: drag-and-drop (e.g. `@dnd-kit/core`, consistent with whatever the rest of the app already uses if anything) — on drop, write the full new order for that category into `diff.questions.reorders`.
- "Add question" button per category → opens a small inline form (category pre-filled, requirement multi-select sourced from `kit.role.requirements`, prompt/answer/difficulty fields) → appended to `diff.questions.creates` on submit, rendered immediately in the list with a "new" badge (not `GENERATED`/`EDITED`/`PINNED` — it's own visual state, since it doesn't exist server-side yet).

**Flashcards**: same interaction pattern as questions (edit front/back inline, pin, delete-immediately, add-new, drag-reorder) — no category field (flashcards aren't categorized) and no "regenerate flashcards" button anywhere in the UI, since that's explicitly not one of the three regenerate targets (§8 of the backend doc — don't build a control for an action that doesn't exist server-side).

---

## 6. Schedule — dedicated view

Two distinct actions, both must be visually distinct buttons so the user understands they're different operations (this maps 1:1 to the backend's two different endpoints, §5/§6 of the backend doc):

- **"Regenerate schedule"** — reruns the allocation algorithm from scratch against the current question set. Use when the user wants a fresh, algorithm-driven plan (e.g. after a lot of question edits). Confirm dialog if there's any manual arrangement that would be discarded ("this replaces your current day-by-day layout — continue?").
- **"Edit manually"** toggles an edit mode on the day view: drag questions between day tabs (cross-day drag, not just within-day reorder), reorder within a day, inline-edit the `focus` label per day. Saving this calls `patchSchedule` **directly** (not batched into the diff store — the schedule is its own save unit, separate from the question/flashcard/brief diff, since it's a fundamentally different kind of edit — arrangement, not content). Show a small "Save schedule" button scoped to just this section, distinct from the global Builder save banner.
- **`scheduleStale` banner**: whenever `kit.scheduleStale === true`, show a persistent, non-blocking notice at the top of the Schedule section — *"Your schedule doesn't reflect recent question changes — Regenerate or edit manually to update it."* — with quick-action buttons for both. This is the direct UI answer to "reschedule on adding/deleting... etc." from your brief: it's not automatic, it's a clear, actionable prompt.
- Each day still resolves `question_ids` against the loaded `questions[]` client-side (unchanged from the read-only version) to render prompts/categories/difficulty inline.

---

## 7. Save / discard flow

- A slim, persistent top banner appears whenever `isDirty` (the Builder store's derived flag) is true: *"You have unsaved changes"* + **Save** (primary, filled violet, maybe with a small pulsing/glow treatment since you asked for this to feel good — a subtle shadow pulse on the button is enough, don't overdo it into distraction) + **Discard** (secondary, with a confirm).
- **Save** → `commitBuilderChanges(kitId, diff)` → on success: replace `kit` with the response, clear `diff`, banner disappears. On failure: keep the diff intact (don't lose the user's work), show an inline error near the banner with a retry action.
- **Discard** → clears `diff` back to empty, `displayedKit` reverts to last-saved `kit`.
- **Why pin/unpin and delete are the two exceptions that fire immediately, not batched**: both are unambiguous, low-regret actions with instant, clear feedback expectations (a deleted card should disappear now, not "maybe disappear when you hit save later" — that's a confusing half-state for a destructive action). Every other edit (text changes, category moves, reorders, creates) is exactly the kind of thing worth batching and reviewing before committing. Note this reasoning explicitly in the README — it's a real, defensible UX judgment call, which is exactly the kind of thing the rubric's "strong opinions, backed by reasoning" line is asking for.
- Navigating away with `isDirty === true` → browser `beforeunload` warning + an in-app route-change guard (Next.js router event or a confirm-on-navigate wrapper) so accidental loss is caught in both cases.

---

## 8. Regenerate actions — UX

All three (§4/§5 of backend) are synchronous requests from the frontend's perspective — show a scoped loading spinner on the specific section being regenerated (not a full-page block), disable that section's own edit controls while in flight, leave the rest of the page interactive.

- **Regenerate brief**: button next to the Brief heading. Disabled + tooltip explaining why if `briefState === 'EDITED'` (matches the backend's `409` — don't let the user hit a wall they can't understand; preempt it in the UI). On success, replace the brief section content, `briefState` resets to `GENERATED` (badge disappears).
- **Regenerate category**: a small button per category tab in the Questions section ("Regenerate technical questions," etc.). No pre-check needed client-side for the "all pinned/edited" case — just call it; if the backend returns the unchanged set (because nothing was eligible to replace), that's still a valid, non-error response, render it plainly (maybe a subtle toast: "Nothing to regenerate — every question here is edited or pinned").
- **Regenerate schedule**: covered in §6.
- After any regenerate action, **merge the response into `kit` directly** (these are server-committed changes, not local diff state) — regeneration is immediate/authoritative, not part of the batched Save flow.

---

## 9. Practice Mode — full-screen flow

Entered via the "Practice" button/tab from the kit detail page (§3). This is a distinct, focused, full-screen experience — not another section squeezed into the Overview page.

**Landing screen** (before starting): show session history (`listPracticeSessions`) as a compact list — date, cards attempted, average confidence — with a prominent **"Start practice session"** button. First-time users (empty history) skip straight to a friendly "Let's get started" state with the same button, no empty-history clutter.

**Starting a session**: `startPracticeSession(kitId)` → `getPracticeQueue(kitId)` → begin the card loop with that ordered id list resolved against `kit.flashcards`.

**Card loop** — this is the part you explicitly want to feel great, so build it as a proper flip-card component, not a fade-swap:

- One card centered, front (`flashcard.front`) shown by default.
- Tap/click or a "Reveal answer" button → a genuine 3D flip transition (CSS `transform: rotateY` on a card with `backface-visibility: hidden` on both faces, or a small motion library like `framer-motion` if already a dependency — a \~400-500ms ease is the right feel, not instant, not sluggish) revealing `flashcard.back`.
- After reveal: a confidence control — given the 1–10 backend scale, don't force the user to pick a precise number; use a **5-position labeled slider or button row** (e.g. "No idea" / "Shaky" / "OK" / "Confident" / "Nailed it") mapped internally to representative values (1/3/5/8/10) — this keeps the interaction fast and low-friction while still giving the backend's algorithm real spread to sort on. Also offer a distinct **"Skip"** action (records `{skipped: true, confidence: null}`) for a card the user doesn't want to engage with right now.
- Selecting a confidence (or skipping) immediately calls `recordAttempt` in the background (don't block the UI on it — fire and forget with a retry-on-failure queue, since losing one attempt record is low-stakes and shouldn't interrupt flow) and advances to the next card with a subtle slide/fade transition.
- Progress indicator: "Card 4 of 18" + a slim progress bar, and a running "X covered, Y remaining" stat pulled from the queue length vs. cards attempted so far this session.
- **End of queue**: a summary screen — cards reviewed, distribution across confidence levels (a small bar/donut is a nice touch here, not required), and a **"Finish session"** button that calls `endPracticeSession`. This is the only action that makes the session count (per backend §7) — make that implicit in the UX by framing this button as "Finish & save session," not just "Close."
- **Exiting mid-session** (back button, closing the tab, navigating away): don't call `endPracticeSession` — this is the deliberate "abandoned sessions don't count" behavior from the backend. No special client-side handling needed beyond simply *not* calling end on unmount; the session row exists but stays `endedAt: null` forever, which the backend already treats as invisible to history/algorithm. Optionally show a lightweight confirm ("Leave without saving this session's progress?") on back-navigation mid-session, since silently losing a session the user thought they'd finished is a worse experience than a one-click confirm.

**Session review** (from the landing screen's history list): click a past session → detail view showing each card attempted with its recorded confidence, useful for the user to see their own trend, not just for the algorithm's benefit.

---

## 10. Loading / empty / error states + keyboard access

Required explicitly by the rubric's "Interaction design" line (10 points) — don't treat this as optional polish:

- **Loading**: every async action (commit, regenerate, session start/end) shows a scoped spinner on the triggering control, not a full-page blocker, except initial kit load and the generation-in-progress view (§3), which legitimately are full-view states.
- **Empty**: zero questions in a category → "No questions here yet" + the add-question control, not a blank panel. Zero flashcards → same treatment, and Practice Mode's landing screen should itself block entry with a clear message + link back to the Builder if `kit.flashcards.length === 0`, rather than starting a session with nothing in the queue.
- **Error**: every mutating call needs a visible failure path — a toast or inline message, never a silent no-op. The commit flow specifically must preserve the local diff on failure (§7).
- **Keyboard**: every interactive control (edit-toggle, save/discard, category tabs, day tabs, flip-card reveal, confidence buttons) must be reachable and operable via `Tab`/`Enter`/`Space` — this includes the flip card (bind `Enter`/`Space` to the same reveal action as the click handler) and drag-and-drop reordering (provide an accessible keyboard-alternative, e.g. up/down move buttons that appear on focus, since drag alone is not keyboard-operable — `@dnd-kit` has built-in keyboard sensor support, enable it rather than building a parallel mechanism).

---

## 11. README notes to carry over from this iteration

- The Builder's diff-then-commit local state model, and the two deliberate exceptions (pin, delete — immediate) vs. everything else (batched) — explain the reasoning from §7.
- The distinction between "regenerate schedule" (algorithmic) and "edit manually" (direct) as two separate, clearly-labeled actions, and what `scheduleStale` communicates.
- The 5-label confidence UI mapped onto the backend's 1–10 scale, and why (fast interaction, still enough spread for the sort algorithm).
- Why abandoned practice sessions need no special frontend handling — it falls out of simply not calling `endPracticeSession`.