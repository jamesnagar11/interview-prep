import { create } from "zustand";
import type {
  AppendixAKit,
  GeneratedQuestion,
  GeneratedFlashcard,
  QuestionCategory,
  BuilderDiff,
  NewQuestionDraft,
  NewFlashcardDraft,
} from "../api/kits";

// ─── State shape ──────────────────────────────────────────────────────────────

interface BuilderState {
  /** The canonical kit as last fetched / committed to the server. */
  baseKit: AppendixAKit | null;
  /** Local pending changes — never mutates baseKit directly. */
  diff: BuilderDiff;

  // ── Derived (computed inline by selectors below) ───────────────
  // isDirty, displayedKit — call the selector helpers, not stored state

  // ── Actions ───────────────────────────────────────────────────
  setBaseKit: (kit: AppendixAKit) => void;
  clearDiff: () => void;

  // Brief
  editBrief: (fields: { summary?: string; what_they_do?: string }) => void;

  // Questions
  updateQuestion: (qid: string, fields: Partial<GeneratedQuestion>) => void;
  addNewQuestion: (draft: NewQuestionDraft) => void;
  removeNewQuestion: (tempId: string) => void;
  markQuestionDeleted: (qid: string) => void;
  setQuestionPin: (qid: string, pinned: boolean) => void;
  setQuestionReorder: (category: QuestionCategory, order: string[]) => void;

  // Flashcards
  updateFlashcard: (fid: string, fields: Partial<GeneratedFlashcard>) => void;
  addNewFlashcard: (draft: NewFlashcardDraft) => void;
  removeNewFlashcard: (tempId: string) => void;
  markFlashcardDeleted: (fid: string) => void;
  setFlashcardPin: (fid: string, pinned: boolean) => void;
  setFlashcardReorder: (order: string[]) => void;
}

// ─── Empty diff factory ───────────────────────────────────────────────────────

function emptyDiff(): BuilderDiff {
  return {
    brief: undefined,
    questions: {
      updates: {},
      creates: [],
      deletes: [],
      reorders: {} as Record<QuestionCategory, string[]>,
      pins: {},
    },
    flashcards: {
      updates: {},
      creates: [],
      deletes: [],
      reorders: [],
      pins: {},
    },
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBuilderStore = create<BuilderState>((set) => ({
  baseKit: null,
  diff: emptyDiff(),

  setBaseKit: (kit) => set({ baseKit: kit, diff: emptyDiff() }),
  clearDiff: () => set({ diff: emptyDiff() }),

  // Brief
  editBrief: (fields) =>
    set((s) => ({
      diff: { ...s.diff, brief: { ...s.diff.brief, ...fields } },
    })),

  // Questions
  updateQuestion: (qid, fields) =>
    set((s) => ({
      diff: {
        ...s.diff,
        questions: {
          ...s.diff.questions,
          updates: {
            ...s.diff.questions.updates,
            [qid]: { ...s.diff.questions.updates[qid], ...fields },
          },
        },
      },
    })),

  addNewQuestion: (draft) =>
    set((s) => ({
      diff: {
        ...s.diff,
        questions: {
          ...s.diff.questions,
          creates: [...s.diff.questions.creates, draft],
        },
      },
    })),

  removeNewQuestion: (tempId) =>
    set((s) => ({
      diff: {
        ...s.diff,
        questions: {
          ...s.diff.questions,
          creates: s.diff.questions.creates.filter((c) => c._tempId !== tempId),
        },
      },
    })),

  markQuestionDeleted: (qid) =>
    set((s) => ({
      diff: {
        ...s.diff,
        questions: {
          ...s.diff.questions,
          deletes: s.diff.questions.deletes.includes(qid)
            ? s.diff.questions.deletes
            : [...s.diff.questions.deletes, qid],
        },
      },
    })),

  setQuestionPin: (qid, pinned) =>
    set((s) => ({
      diff: {
        ...s.diff,
        questions: {
          ...s.diff.questions,
          pins: { ...s.diff.questions.pins, [qid]: pinned },
        },
      },
    })),

  setQuestionReorder: (category, order) =>
    set((s) => ({
      diff: {
        ...s.diff,
        questions: {
          ...s.diff.questions,
          reorders: { ...s.diff.questions.reorders, [category]: order },
        },
      },
    })),

  // Flashcards
  updateFlashcard: (fid, fields) =>
    set((s) => ({
      diff: {
        ...s.diff,
        flashcards: {
          ...s.diff.flashcards,
          updates: {
            ...s.diff.flashcards.updates,
            [fid]: { ...s.diff.flashcards.updates[fid], ...fields },
          },
        },
      },
    })),

  addNewFlashcard: (draft) =>
    set((s) => ({
      diff: {
        ...s.diff,
        flashcards: {
          ...s.diff.flashcards,
          creates: [...s.diff.flashcards.creates, draft],
        },
      },
    })),

  removeNewFlashcard: (tempId) =>
    set((s) => ({
      diff: {
        ...s.diff,
        flashcards: {
          ...s.diff.flashcards,
          creates: s.diff.flashcards.creates.filter((c) => c._tempId !== tempId),
        },
      },
    })),

  markFlashcardDeleted: (fid) =>
    set((s) => ({
      diff: {
        ...s.diff,
        flashcards: {
          ...s.diff.flashcards,
          deletes: s.diff.flashcards.deletes.includes(fid)
            ? s.diff.flashcards.deletes
            : [...s.diff.flashcards.deletes, fid],
        },
      },
    })),

  setFlashcardPin: (fid, pinned) =>
    set((s) => ({
      diff: {
        ...s.diff,
        flashcards: {
          ...s.diff.flashcards,
          pins: { ...s.diff.flashcards.pins, [fid]: pinned },
        },
      },
    })),

  setFlashcardReorder: (order) =>
    set((s) => ({
      diff: {
        ...s.diff,
        flashcards: { ...s.diff.flashcards, reorders: order },
      },
    })),
}));

// ─── Selectors (computed outside store to stay cheap) ─────────────────────────

export function selectIsDirty(state: BuilderState): boolean {
  const { diff } = state;
  return !!(
    diff.brief ||
    Object.keys(diff.questions.updates).length > 0 ||
    diff.questions.creates.length > 0 ||
    diff.questions.deletes.length > 0 ||
    Object.keys(diff.questions.reorders).length > 0 ||
    Object.keys(diff.questions.pins).length > 0 ||
    Object.keys(diff.flashcards.updates).length > 0 ||
    diff.flashcards.creates.length > 0 ||
    diff.flashcards.deletes.length > 0 ||
    diff.flashcards.reorders.length > 0 ||
    Object.keys(diff.flashcards.pins).length > 0
  );
}

export function selectDisplayedKit(state: BuilderState): AppendixAKit | null {
  const { baseKit, diff } = state;
  if (!baseKit) return null;

  // Merge brief
  const company_brief = diff.brief
    ? {
        ...baseKit.company_brief,
        summary: diff.brief.summary ?? baseKit.company_brief.summary,
        what_they_do: diff.brief.what_they_do ?? baseKit.company_brief.what_they_do,
      }
    : baseKit.company_brief;

  // Merge questions
  let questions = baseKit.questions
    .filter((q) => !diff.questions.deletes.includes(q.id))
    .map((q) => {
      const hasUpdate = !!diff.questions.updates[q.id];
      const pinState = diff.questions.pins[q.id];
      let state = q.state;
      if (pinState !== undefined) {
        state = pinState ? ("PINNED" as const) : (hasUpdate || q.state === "EDITED" ? ("EDITED" as const) : ("GENERATED" as const));
      } else if (hasUpdate && q.state !== "PINNED") {
        state = "EDITED" as const;
      }
      return {
        ...q,
        ...(diff.questions.updates[q.id] ?? {}),
        state,
      };
    });

  // Apply reorders per category
  const allCategories: QuestionCategory[] = ["technical", "behavioural", "system-design", "company-fit"];
  const reordered: GeneratedQuestion[] = [];
  for (const cat of allCategories) {
    const catQs = questions.filter((q) => q.category === cat);
    const order = diff.questions.reorders[cat];
    if (order && order.length > 0) {
      const mapped = order
        .map((id) => catQs.find((q) => q.id === id))
        .filter(Boolean) as GeneratedQuestion[];
      // Append any not in order list (shouldn't happen, safety net)
      const inOrder = new Set(order);
      const rest = catQs.filter((q) => !inOrder.has(q.id));
      reordered.push(...mapped, ...rest);
    } else {
      reordered.push(...catQs);
    }
  }

  // Append creates with temp IDs
  const tempQuestions: GeneratedQuestion[] = diff.questions.creates.map((c) => ({
    id: c._tempId,
    requirement_ids: c.requirementIds,
    category: c.category,
    prompt: c.prompt,
    answer_outline: c.answer_outline,
    difficulty: c.difficulty,
    state: "EDITED" as const,
    orderIndex: 9999,
  }));

  // Merge flashcards
  let flashcards = baseKit.flashcards
    .filter((f) => !diff.flashcards.deletes.includes(f.id))
    .map((f) => {
      const hasUpdate = !!diff.flashcards.updates[f.id];
      const pinState = diff.flashcards.pins[f.id];
      let state = f.state;
      if (pinState !== undefined) {
        state = pinState ? ("PINNED" as const) : (hasUpdate || f.state === "EDITED" ? ("EDITED" as const) : ("GENERATED" as const));
      } else if (hasUpdate && f.state !== "PINNED") {
        state = "EDITED" as const;
      }
      return {
        ...f,
        ...(diff.flashcards.updates[f.id] ?? {}),
        state,
      };
    });

  const fcOrder = diff.flashcards.reorders;
  if (fcOrder.length > 0) {
    const mapped = fcOrder
      .map((id) => flashcards.find((f) => f.id === id))
      .filter(Boolean) as GeneratedFlashcard[];
    const inOrder = new Set(fcOrder);
    const rest = flashcards.filter((f) => !inOrder.has(f.id));
    flashcards = [...mapped, ...rest];
  }

  const tempFlashcards: GeneratedFlashcard[] = diff.flashcards.creates.map((c) => ({
    id: c._tempId,
    front: c.front,
    back: c.back,
    requirement_ids: c.requirementIds,
    state: "GENERATED" as const,
    orderIndex: 9999,
  }));

  return {
    ...baseKit,
    company_brief,
    questions: [...reordered, ...tempQuestions],
    flashcards: [...flashcards, ...tempFlashcards],
  };
}
