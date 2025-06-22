# WordWise – Final Sprint Playbook (v1.0)
# not too bad!

> **Goal:** Achieve fully-functional MVP, pass grading rubric, and ship to production **today**.

---

## 🟢 A. Absolute Sanity Checks (must be green before work)

| Item | Status |
|------|--------|
| `npm run build` succeeds locally | ☐ |
| Latest commit pushed to **main** | ☐ |
| Firebase Auth + Firestore work on localhost | ☐ |
| `vercel --prod` builds green | ☐ |
| Vercel domain added to **Auth → Authorized Domains** | ☐ |
| Firebase rules deployed (firebase deploy firestore:rules) | ☐ |


---

## 🛠️ B. Functional Gaps & Fix Plan

| ID | Gap | Action | Owner | Status |
|----|-----|--------|------|--------|
| G-1 | **Autosave** missing | Debounce 2 s; update Firestore `documents/{id}` | dev | ✅ Done |
| G-2 | **Grammar engine weak (OR hard-coded fallbacks)** | Docker LanguageTool (`8010`); if down → GPT-4 fallback | dev | ✅ Done |
| G-3 | **Inline highlight faint** | Add `.bg-red-300/20 underline decoration-red-400` | design | ✅ Done |
| G-4 | **Toolbar incomplete** | Add Undo, Redo, Underline, Strike icons via Lucide; bind TipTap cmds | dev | ☐ |
| G-5 | **Dark text visibility** | White canvas (`bg-slate-50`) inside dark gradient frame | design | ✅ Done |
| G-6 | **Suggestion card UX** | Show accept/dismiss hover effects, keyboard shortcuts (A / X) | dev | ✅ Done |
| G-7 | **Export label** | Rename Publish→Export; call `/api/export?fmt=pdf` | dev | ✅ Done |

### New Priority Items

| ID | Gap | Action | Owner | Status |
|----|-----|--------|------|--------|
| G-8 | **Keyboard shortcuts** | Add keyboard shortcuts for common actions (Cmd+S for save, etc.) | dev | ☐ |
| G-9 | **Loading states** | Add loading spinners/skeletons for grammar check and save operations | dev | ☐ |
| G-10 | **Error handling** | Improve error messages and recovery for API failures | dev | ☐ |
| G-11 | **Performance optimization** | Optimize grammar check debounce and decoration rendering | dev | ☐ |

---

## 🎨 C. Visual Differentiation (already in progress)

* Radial-to-linear gradient `#0A1224 → #1C2450 → #1B1B33`.  
* Glass cards (`bg-white/5 backdrop-blur-md shadow-lg rounded-2xl`).  
* Sidebar replaced by top dropdown + mobile bottom-sheet.  
* Floating BubbleMenu for formatting (Notion-style).

---

## 🧪 D. Test Suite

### 1. Suggestion Accuracy (15 rules)

*File:* `tests/suggestionAccuracy.test.ts`  
*Assets:* `tests/sampleText.txt` (220 words, all errors)  
**Pass criteria:** ≥ 15 suggestions, each rule type appears once.

### 2. Autosave Unit

*File:* `tests/autosave.test.ts`  
Mock Firestore; expect `updateDoc` called after 2 s idle.

### 3. End-to-end Smoke (Playwright)

1. Log in.
2. Paste sample text → suggestions pop.
3. Accept 3, dismiss 2.
4. Reload page → edits persist.
5. Click **Export** → PDF downloads within 5 s.

### 4. Lighthouse a11y & perf audit ≥ 90

---

## 🚀 E. Deployment

### Vercel CLI

```bash
npm i -g vercel
vercel env add NEXT_PUBLIC_FIREBASE_API_KEY <key>
# repeat for all vars
vercel --prod          # get URL e.g. https://wordwise.vercel.app
``` 