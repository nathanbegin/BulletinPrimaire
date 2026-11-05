import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AppData, Evaluation, Group, Mark, Settings, Student, Subject, Term } from './types';
import { emptyData, uid } from './lib/defaults';

interface UIState {
  groupId: string | null;
  termId: string | null;
  subjectFilter: string | null; // null = toutes
}

interface Store {
  data: AppData;
  ui: UIState;
  setUI: (p: Partial<UIState>) => void;
  replaceData: (d: AppData) => void;

  updateSettings: (p: Partial<Settings>) => void;
  setTerms: (t: Term[]) => void;

  addGroup: (g: Omit<Group, 'id'>) => string;
  updateGroup: (id: string, p: Partial<Group>) => void;
  deleteGroup: (id: string) => void;

  addStudents: (groupId: string, list: { firstName: string; lastName: string }[]) => void;
  updateStudent: (id: string, p: Partial<Student>) => void;
  deleteStudent: (id: string) => void;

  addSubject: (s: Omit<Subject, 'id' | 'order'> & { id?: string }) => void;
  updateSubject: (id: string, p: Partial<Subject>) => void;
  deleteSubject: (id: string) => void;
  moveSubject: (id: string, dir: -1 | 1) => void;

  addEvaluation: (e: Omit<Evaluation, 'id'>) => string;
  updateEvaluation: (id: string, p: Partial<Evaluation>) => void;
  deleteEvaluation: (id: string) => void;

  setMark: (evalId: string, studentId: string, mark: Mark | undefined) => void;
  setMarks: (entries: { evalId: string; studentId: string; mark: Mark | undefined }[]) => void;
  setComment: (termId: string, studentId: string, text: string) => void;
}

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const patch = (fn: (d: AppData) => Partial<AppData>) => set((s) => ({ data: { ...s.data, ...fn(s.data) } }));
      const applyMarks = (d: AppData, entries: { evalId: string; studentId: string; mark: Mark | undefined }[]) => {
        const marks = { ...d.marks };
        for (const { evalId, studentId, mark } of entries) {
          const row = { ...(marks[evalId] ?? {}) };
          if (mark === undefined) delete row[studentId];
          else row[studentId] = mark;
          marks[evalId] = row;
        }
        return { marks };
      };
      return {
        data: emptyData(),
        ui: { groupId: null, termId: null, subjectFilter: null },
        setUI: (p) => set((s) => ({ ui: { ...s.ui, ...p } })),
        replaceData: (d) =>
          set({
            data: d,
            ui: { groupId: d.groups[0]?.id ?? null, termId: d.terms[0]?.id ?? null, subjectFilter: null },
          }),

        updateSettings: (p) => patch((d) => ({ settings: { ...d.settings, ...p } })),
        setTerms: (terms) => patch(() => ({ terms })),

        addGroup: (g) => {
          const id = uid();
          patch((d) => ({ groups: [...d.groups, { ...g, id }] }));
          get().setUI({ groupId: id });
          return id;
        },
        updateGroup: (id, p) => patch((d) => ({ groups: d.groups.map((g) => (g.id === id ? { ...g, ...p } : g)) })),
        deleteGroup: (id) => {
          patch((d) => {
            const evIds = new Set(d.evaluations.filter((e) => e.groupId === id).map((e) => e.id));
            const marks = Object.fromEntries(Object.entries(d.marks).filter(([k]) => !evIds.has(k)));
            return {
              groups: d.groups.filter((g) => g.id !== id),
              students: d.students.filter((s) => s.groupId !== id),
              subjects: d.subjects.filter((s) => s.groupId !== id),
              evaluations: d.evaluations.filter((e) => e.groupId !== id),
              marks,
            };
          });
          const { data, ui } = get();
          if (ui.groupId === id) get().setUI({ groupId: data.groups[0]?.id ?? null, subjectFilter: null });
        },

        addStudents: (groupId, list) =>
          patch((d) => ({
            students: [...d.students, ...list.map((s) => ({ ...s, id: uid(), groupId, active: true }))],
          })),
        updateStudent: (id, p) => patch((d) => ({ students: d.students.map((s) => (s.id === id ? { ...s, ...p } : s)) })),
        deleteStudent: (id) =>
          patch((d) => {
            const marks: AppData['marks'] = {};
            for (const [k, v] of Object.entries(d.marks)) {
              const { [id]: _drop, ...rest } = v;
              marks[k] = rest;
            }
            return { students: d.students.filter((s) => s.id !== id), marks };
          }),

        addSubject: (s) =>
          patch((d) => {
            const order = Math.max(-1, ...d.subjects.filter((x) => x.groupId === s.groupId).map((x) => x.order)) + 1;
            return { subjects: [...d.subjects, { ...s, id: s.id ?? uid(), order }] };
          }),
        updateSubject: (id, p) => patch((d) => ({ subjects: d.subjects.map((s) => (s.id === id ? { ...s, ...p } : s)) })),
        deleteSubject: (id) => {
          patch((d) => {
            const evIds = new Set(d.evaluations.filter((e) => e.subjectId === id).map((e) => e.id));
            return {
              subjects: d.subjects.filter((s) => s.id !== id),
              evaluations: d.evaluations.filter((e) => e.subjectId !== id),
              marks: Object.fromEntries(Object.entries(d.marks).filter(([k]) => !evIds.has(k))),
            };
          });
          if (get().ui.subjectFilter === id) get().setUI({ subjectFilter: null });
        },
        moveSubject: (id, dir) =>
          patch((d) => {
            const subj = d.subjects.find((s) => s.id === id);
            if (!subj) return {};
            const list = d.subjects.filter((s) => s.groupId === subj.groupId).sort((a, b) => a.order - b.order);
            const i = list.findIndex((s) => s.id === id);
            const j = i + dir;
            if (j < 0 || j >= list.length) return {};
            [list[i], list[j]] = [list[j], list[i]];
            const order = new Map(list.map((s, k) => [s.id, k]));
            return { subjects: d.subjects.map((s) => (order.has(s.id) ? { ...s, order: order.get(s.id)! } : s)) };
          }),

        addEvaluation: (e) => {
          const id = uid();
          patch((d) => ({ evaluations: [...d.evaluations, { ...e, id }] }));
          return id;
        },
        updateEvaluation: (id, p) =>
          patch((d) => ({ evaluations: d.evaluations.map((e) => (e.id === id ? { ...e, ...p } : e)) })),
        deleteEvaluation: (id) =>
          patch((d) => {
            const { [id]: _drop, ...marks } = d.marks;
            return { evaluations: d.evaluations.filter((e) => e.id !== id), marks };
          }),

        setMark: (evalId, studentId, mark) => patch((d) => applyMarks(d, [{ evalId, studentId, mark }])),
        setMarks: (entries) => patch((d) => applyMarks(d, entries)),
        setComment: (termId, studentId, text) =>
          patch((d) => ({
            comments: { ...d.comments, [termId]: { ...(d.comments[termId] ?? {}), [studentId]: text } },
          })),
      };
    },
    {
      name: 'bulletin-primaire',
      version: 1,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** Groupe actif (ou premier groupe). */
export function useActiveGroup() {
  const groups = useStore((s) => s.data.groups);
  const groupId = useStore((s) => s.ui.groupId);
  return groups.find((g) => g.id === groupId) ?? groups[0] ?? null;
}

export function useActiveTerm() {
  const terms = useStore((s) => s.data.terms);
  const termId = useStore((s) => s.ui.termId);
  return terms.find((t) => t.id === termId) ?? guessTerm(terms) ?? null;
}

function guessTerm(terms: Term[]): Term | undefined {
  const today = new Date().toISOString().slice(0, 10);
  return terms.find((t) => t.start <= today && today <= t.end) ?? terms[0];
}
