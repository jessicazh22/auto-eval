import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const STRATEGIES = ['rule', 'example', 'restructure'] as const;
type Strategy = typeof STRATEGIES[number];

const STRATEGY_INSTRUCTIONS: Record<Strategy, string> = {
  rule: 'Add or refine ONE rule or constraint that directly addresses the missing instruction identified above. Do not add examples or restructure.',
  example: 'Add ONE concrete example of correct behavior that illustrates the missing instruction identified above. Do not add rules or restructure.',
  restructure: 'Reorder or restructure existing instructions so the missing instruction is more prominent or clearly expressed. Do not add new content.',
};

const STRUCTURAL_CONSTRAINT = `
IMPORTANT — only make STRUCTURAL changes: rules, instructions, tone guidelines, or examples.
NEVER add domain-specific vocabulary, phrases, or proper nouns from the reference documents.
Bad: "Always consider oil production context."
Good: "Use plain language. Define technical terms on first use."
`.trim();

const GOLD_MARKER = '__gold_standard__';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { eval_run_id, annotations } = await req.json();
  if (!eval_run_id) return Response.json({ error: 'eval_run_id required' }, { status: 400 });

  const runs = await base44.asServiceRole.entities.EvalRun.filter({ id: eval_run_id });
  const run = runs[0];
  if (!run) return Response.json({ error: 'Run not found' }, { status: 404 });

  const prompts = await base44.asServiceRole.entities.Prompt.filter({ id: run.prompt_id });
  const prompt = prompts[0];
  if (!prompt) return Response.json({ error: 'Prompt not found' }, { status: 404 });

  // Resolve original prompt text
  let originalText = prompt.prompt_text || '';
  if (originalText.startsWith('http')) {
    const res = await fetch(originalText);
    originalText = await res.text();
  }

  const weakestCriterion = run.weakest_criterion || 'overall quality';
  const improvement_batch_id = crypto.randomUUID();

  // Fetch all context in parallel
  const [tracesText, criteriaText, goldStandardText, priorHistoryText] = await Promise.all([
    fetchTraces(base44, eval_run_id, weakestCriterion),
    fetchRubricCriteria(base44, prompt.id),
    fetchGoldStandard(prompt),
    fetchPriorHistory(base44, prompt.id),
  ]);

  const annotationText = (annotations || []).length > 0
    ? `USER ANNOTATIONS on failing outputs:\n${annotations.join('\n')}`
    : '';

  // ProTeGi diagnostic step — identify the specific missing instruction before generating variants
  const diagnosis = await runDiagnosis(base44, {
    originalText,
    weakestCriterion,
    tracesText,
    criteriaText,
    goldStandardText,
    annotationText,
  });

  // Generate 3 variants in parallel (one per strategy), all grounded in the diagnosis
  const variantResults = await Promise.all(
    STRATEGIES.map(strategy => generateVariant(base44, {
      originalText,
      weakestCriterion,
      tracesText,
      criteriaText,
      goldStandardText,
      priorHistoryText,
      annotationText,
      diagnosis,
      strategy,
    }))
  );

  // Upload improved prompts + create variant records + fire evals — all in parallel
  const encoder = new TextEncoder();
  await Promise.all(
    variantResults.map(async (v, i) => {
      const blob = new Blob([encoder.encode(v.improved_prompt)], { type: 'text/plain' });
      const file = new File([blob], 'prompt.txt', { type: 'text/plain' });
      const { file_url: improvedUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

      const variant = await base44.asServiceRole.entities.PromptVariant.create({
        prompt_id: prompt.id,
        parent_eval_run_id: eval_run_id,
        original_prompt_text: prompt.prompt_text || '',
        improved_prompt_text: improvedUrl,
        diagnosis: diagnosis.missing_instruction,
        change_summary: v.change_summary,
        target_criterion: v.target_criterion,
        why_this_helps: v.why_this_helps,
        strategy: STRATEGIES[i],
        improvement_batch_id,
        original_score: run.overall_score || 0,
        status: 'running',
        source: 'annotations',
      });

      const variantRun = await base44.asServiceRole.entities.EvalRun.create({
        prompt_id: prompt.id,
        status: 'pending',
        test_inputs_count: (prompt.attached_files || []).filter((f: any) => f.name !== GOLD_MARKER).length || 1,
      });

      await base44.asServiceRole.entities.PromptVariant.update(variant.id, {
        variant_eval_run_id: variantRun.id,
      });

      base44.asServiceRole.functions.invoke('runEval', {
        eval_run_id: variantRun.id,
        prompt_text_override: v.improved_prompt,
      });
    })
  );

  return Response.json({ success: true, batch_id: improvement_batch_id });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchTraces(base44: any, eval_run_id: string, targetCriterion: string): Promise<string> {
  try {
    const allResults = await base44.asServiceRole.entities.EvalResult.filter({ eval_run_id });
    const worst3 = allResults
      .sort((a: any, b: any) => (a.overall_score || 0) - (b.overall_score || 0))
      .slice(0, 3);

    const traceLines: string[] = [];
    for (const result of worst3) {
      const criterionScores = await base44.asServiceRole.entities.CriterionScore.filter({ eval_result_id: result.id });
      const targetScore = criterionScores.find((s: any) => s.criterion_name === targetCriterion);
      const otherScores = criterionScores
        .filter((s: any) => s.criterion_name !== targetCriterion)
        .map((s: any) => `${s.criterion_name}: ${s.score}/10`)
        .join(', ');

      traceLines.push(
        `--- Failing output (score: ${result.overall_score?.toFixed(1) ?? '?'}/100) ---\n` +
        `Output: ${(result.raw_output || '').slice(0, 800)}\n` +
        `${targetCriterion} score: ${targetScore?.score ?? '?'}/10 — Judge: "${targetScore?.reasoning || 'no reasoning'}"\n` +
        `Other scores: ${otherScores}`
      );
    }
    return traceLines.join('\n\n');
  } catch (_) {
    return '(Could not fetch failing traces)';
  }
}

async function fetchRubricCriteria(base44: any, promptId: string): Promise<string> {
  try {
    const rubrics = await base44.asServiceRole.entities.Rubric.filter({ prompt_id: promptId });
    if (!rubrics[0]) return '';
    const criteria = await base44.asServiceRole.entities.RubricCriterion.filter({ rubric_id: rubrics[0].id });
    return criteria
      .map((c: any) => `- ${c.name} (weight ${c.weight}): ${c.description}`)
      .join('\n');
  } catch (_) {
    return '';
  }
}

async function fetchGoldStandard(prompt: any): Promise<string> {
  try {
    const goldEntry = (prompt.attached_files || []).find((f: any) => f.name === GOLD_MARKER);
    if (!goldEntry?.url) return '';
    const res = await fetch(goldEntry.url);
    return await res.text();
  } catch (_) {
    return '';
  }
}

async function fetchPriorHistory(base44: any, promptId: string): Promise<string> {
  try {
    const priorVariants = await base44.asServiceRole.entities.PromptVariant.filter({ prompt_id: promptId });
    const recent = priorVariants
      .sort((a: any, b: any) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())
      .slice(0, 3);
    if (recent.length === 0) return '';
    return `Prior attempts (do not repeat):\n${recent.map((v: any) =>
      `- [${v.strategy || 'unknown'}] "${v.change_summary}" → ${v.target_criterion} ${v.score_delta >= 0 ? '+' : ''}${v.score_delta ?? '?'}`
    ).join('\n')}`;
  } catch (_) {
    return '';
  }
}

async function runDiagnosis(
  base44: any,
  ctx: {
    originalText: string;
    weakestCriterion: string;
    tracesText: string;
    criteriaText: string;
    goldStandardText: string;
    annotationText: string;
  }
): Promise<{ missing_instruction: string; evidence: string; gold_standard_contrast: string }> {
  const { originalText, weakestCriterion, tracesText, criteriaText, goldStandardText, annotationText } = ctx;

  const prompt = `You are a prompt quality analyst. Identify the single most important instruction missing from this prompt.

CURRENT PROMPT:
${originalText}

RUBRIC CRITERIA (what a good output must achieve):
${criteriaText || '(none provided)'}

WEAKEST CRITERION: ${weakestCriterion}

FAILING OUTPUTS WITH JUDGE REASONING:
${tracesText}

${goldStandardText ? `GOLD STANDARD OUTPUT (ideal — use this to see what good looks like):\n${goldStandardText.slice(0, 2000)}\n` : ''}
${annotationText ? annotationText + '\n' : ''}
What specific instruction is MISSING from the current prompt that would close the gap between the failing outputs and the gold standard? Be concrete — name the exact behaviour that is absent, not a vague quality like "be clearer".

Return JSON:
- missing_instruction: one sentence naming the specific gap (e.g. "The prompt does not instruct the model to define technical terms on first use")
- evidence: a short quote from a failing output that shows the gap
- gold_standard_contrast: a short quote from the gold standard showing what good looks like`;

  try {
    return await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          missing_instruction: { type: 'string' },
          evidence: { type: 'string' },
          gold_standard_contrast: { type: 'string' },
        },
        required: ['missing_instruction', 'evidence', 'gold_standard_contrast'],
      },
    });
  } catch (_) {
    return { missing_instruction: `Improve ${weakestCriterion}`, evidence: '', gold_standard_contrast: '' };
  }
}

async function generateVariant(
  base44: any,
  ctx: {
    originalText: string;
    weakestCriterion: string;
    tracesText: string;
    criteriaText: string;
    goldStandardText: string;
    priorHistoryText: string;
    annotationText: string;
    diagnosis: { missing_instruction: string; evidence: string; gold_standard_contrast: string };
    strategy: Strategy;
  }
): Promise<{ improved_prompt: string; change_summary: string; target_criterion: string; why_this_helps: string }> {
  const { originalText, weakestCriterion, tracesText, criteriaText, goldStandardText, priorHistoryText, annotationText, diagnosis, strategy } = ctx;

  const improvementPrompt = `You are a prompt engineer. Make exactly ONE targeted improvement to the prompt below.

DIAGNOSIS — what is missing:
${diagnosis.missing_instruction}
Evidence from failing output: "${diagnosis.evidence}"
${diagnosis.gold_standard_contrast ? `Gold standard shows: "${diagnosis.gold_standard_contrast}"` : ''}

STRATEGY: ${STRATEGY_INSTRUCTIONS[strategy]}

CURRENT PROMPT:
${originalText}

RUBRIC CRITERIA (what a good output must achieve):
${criteriaText || '(none provided)'}

WEAKEST CRITERION: ${weakestCriterion}

FAILING OUTPUTS WITH JUDGE REASONING:
${tracesText}

${goldStandardText ? `GOLD STANDARD OUTPUT (ideal output to target):\n${goldStandardText.slice(0, 1500)}\n\n` : ''}${annotationText ? annotationText + '\n\n' : ''}${priorHistoryText ? priorHistoryText + '\n\n' : ''}${STRUCTURAL_CONSTRAINT}

Your change must directly address the missing instruction identified in the diagnosis above.

Return JSON:
- improved_prompt: the full prompt with exactly one change applied
- change_summary: one sentence describing what you changed and why
- target_criterion: the criterion name this targets
- why_this_helps: exactly 2 sentences linking this specific change to the diagnosis and failing outputs above`;

  return await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: improvementPrompt,
    response_json_schema: {
      type: 'object',
      properties: {
        improved_prompt: { type: 'string' },
        change_summary: { type: 'string' },
        target_criterion: { type: 'string' },
        why_this_helps: { type: 'string' },
      },
      required: ['improved_prompt', 'change_summary', 'target_criterion', 'why_this_helps'],
    },
  });
}
