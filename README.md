# EvalLoop

Iterative prompt evaluation — run structured evals, surface weaknesses, and test targeted improvements.

## Overview

EvalLoop closes the loop between running an LLM prompt and improving it. Define a rubric, run evals against test inputs, and let the system generate hypothesis-driven prompt variants targeting your weakest criterion.

## Features

- **Rubric-based scoring** — define named criteria, each scored 0–10, with a configurable passing threshold
- **Eval runs** — score a prompt against all test inputs; surfaces composite score and weakest criterion
- **Auto-improvement** — generates 3 variant prompts in parallel (rule / example / restructure strategies) targeting the weakest criterion
- **Variant approval** — preview sample output per variant before committing to a full eval
- **Score tracking** — criterion-by-criterion before/after comparison across runs

## Stack

- **Frontend** — React, React Query, Tailwind CSS, shadcn/ui
- **Backend** — base44 (entities + serverless functions)
- **Eval engine** — Deno/TypeScript + Claude API

## Getting Started

```bash
npm install
npm run dev
```

Set `VITE_BASE44_APP_ID` to your base44 app ID. Authentication is managed by base44.

## Project Structure

```
src/
  pages/          # Home, PromptDetail, EvalRunDetail, Experiments
  components/
    variant/      # CriterionComparison, DiagnosisBlock
    prompt/       # EvalRunsTable, RunEvalModal
    shared/       # ScoreBadge, StatusBadge
base44/
  entities/       # Prompt, EvalRun, PromptVariant, Rubric, ...
  functions/      # improvePrompt, runEval
```

## License

MIT