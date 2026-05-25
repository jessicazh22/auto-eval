import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const STRATEGIES = ['rule', 'example', 'restructure'] as const;
type Strategy = typeof STRATEGIES[number];

const STRATEGY_INSTRUCTIONS: Record<Strategy, string> = {
  rule: 'Add or refine ONE rule or constraint in the prompt. Do not add examples or restructure.',
  example: 'Add ONE concrete example of correct behavior. Do not add rules or restructure.',
  restructure: 'Reorder or restructure existing instructions for clarity. Do not add new rules or examples.',
};

const STRUCTURAL_CONSTRAINT = `
IMPORTANT — only make STRUCTURAL changes: rules, instructions, tone guidelines, or examples.
NEVER add domain-specific vocabulary, phrases, or proper nouns from the reference documents.
Bad: "Always consider oil production context."
Good: "Use plain language. Define technical terms on first use."
`.trim();

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  // Phase 2: user approved a variant — fire full eval
  if (body.approve_variant_id) {
    return handleApproval(base44, body.approve_variant_id);
  }

  // Phase 1: generate 3 variants + sample outputs
  const { eval_run_id, annotations } = body;
  if (!eval_run_id) return Response.json({ error: 'eval_run_id required' }, { status: 400 });
  return handleGenerate(base44, eval_run_id, annotations || []);
});

// ─── Phase 1: Generate ───────────────────────────────────────────────────────

async function handleGenerate(base44: any, eval_run_id: string, annotations: string[]) {
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

  // Fetch 3 worst EvalResults with their criterion score reasoning (traces)
  const tracesText = await fetchTraces(base44, eval_run_id, weakestCriterion);

  // OPRO: fetch last 3 variants for this prompt to avoid repeating failed attempts
  const priorVariants = await base44.asServiceRole.entities.PromptVariant.filter({ prompt_id: prompt.id });
  const recentPrior = priorVariants
    .sort((a: any, b: any) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime())
    .slice(0, 3);
  const priorHistoryText = recentPrior.length > 0
    ? `Prior attempts on this prompt (do not repeat):\n${recentPrior.map((v: any) =>
        `- [${v.strategy || 'unknown'}] "${v.change_summary}" → ${v.target_criterion} ${v.score_delta >= 0 ? '+' : ''}${v.score_delta ?? '?'}, status: ${v.status}`
      ).join('\n')}`
    : '';

  // Annotation context (if "Improve with Feedback" flow)
  const annotationText = annotations.length > 0
    ? `USER ANNOTATIONS on failing outputs:\n${annotations.join('\n')}`
    : '';

  // Worst test input for sample output preview
  const allResults = await base44.asServiceRole.entities.EvalResult.filter({ eval_run_id });
  const sortedResults = allResults.sort((a: any, b: any) => (a.overall_score || 0) - (b.overall_score || 0));
  const worstResult = sortedResults[0];
  let worstDocContent = '';
  if (worstResult?.test_input && prompt.attached_files?.length > 0) {
    const matchedFile = prompt.attached_files.find((f: any) => worstResult.test_input.startsWith(f.name));
    if (matchedFile?.url) {
      try {
        const docRes = await fetch(matchedFile.url);
        worstDocContent = await docRes.text();
      } catch (_) { /* proceed without doc */ }
    }
  }

  // Generate 3 variants in parallel
  const variantResults = await Promise.all(
    STRATEGIES.map(strategy => generateVariant(base44, {
      originalText,
      weakestCriterion,
      tracesText,
      priorHistoryText,
      annotationText,
      strategy,
    }))
  );

  // Run 1 sample output per variant in parallel
  const sampleOutputs = await Promise.all(
    variantResults.map(v => runSampleOutput(base44, v.improved_prompt, worstDocContent))
  );

  // Upload improved prompt texts as files + create PromptVariant records
  const encoder = new TextEncoder();
  const variantRecords = await Promise.all(
    variantResults.map(async (v, i) => {
      const blob = new Blob([encoder.encode(v.improved_prompt)], { type: 'text/plain' });
      const file = new File([blob], 'prompt.txt', { type: 'text/plain' });
      const { file_url: improvedUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

      return base44.asServiceRole.entities.PromptVariant.create({
        prompt_id: prompt.id,
        parent_eval_run_id: eval_run_id,
        original_prompt_text: prompt.prompt_text || '',
        improved_prompt_text: improvedUrl,
        change_summary: v.change_summary,
        target_criterion: v.target_criterion,
        why_this_helps: v.why_this_helps,
        strategy: STRATEGIES[i],
        sample_output: sampleOutputs[i],
        improvement_batch_id,
        original_score: run.overall_score || 0,
        status: 'pending_approval',
        source: 'annotations',
      });
    })
  );

  return Response.json({
    batch_id: improvement_batch_id,
    variants: variantRecords.map(v => ({ id: v.id, strategy: v.strategy })),
  });
}

// ─── Phase 2: Approve ────────────────────────────────────────────────────────

async function handleApproval(base44: any, approve_variant_id: string) {
  const variants = await base44.asServiceRole.entities.PromptVariant.filter({ id: approve_variant_id });
  const variant = variants[0];
  if (!variant) return Response.json({ error: 'Variant not found' }, { status: 404 });

  // Reject all other variants in the same batch
  if (variant.improvement_batch_id) {
    const batchVariants = await base44.asServiceRole.entities.PromptVariant.filter({
      improvement_batch_id: variant.improvement_batch_id,
    });
    await Promise.all(
      batchVariants
        .filter((v: any) => v.id !== approve_variant_id)
        .map((v: any) => base44.asServiceRole.entities.PromptVariant.update(v.id, { status: 'rejected' }))
    );
  }

  // Resolve improved prompt text from file URL
  let improvedText = variant.improved_prompt_text || '';
  if (improvedText.startsWith('http')) {
    const res = await fetch(improvedText);
    improvedText = await res.text();
  }

  // Create EvalRun for full eval
  const prompt = (await base44.asServiceRole.entities.Prompt.filter({ id: variant.prompt_id }))[0];
  const variantRun = await base44.asServiceRole.entities.EvalRun.create({
    prompt_id: variant.prompt_id,
    status: 'pending',
    test_inputs_count: (prompt?.attached_files || []).length || 1,
  });

  await base44.asServiceRole.entities.PromptVariant.update(approve_variant_id, {
    variant_eval_run_id: variantRun.id,
    status: 'running',
  });

  // Fire eval asynchronously
  base44.asServiceRole.functions.invoke('runEval', {
    eval_run_id: variantRun.id,
    prompt_text_override: improvedText,
  });

  return Response.json({ variant_eval_run_id: variantRun.id });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchTraces(base44: any, eval_run_id: string, targetCriterion: string): Promise<string> {
  try {
    const allResults = await base44.asServiceRole.entities.EvalResult.filter({ eval_run_id });
    const worst3 = allResults
      .sort((a: any, b: any) => (a.overall_score || 0) - (b.overall_score || 0))
      .slice(0, 3);

    const traceLines: string[] = [];
    for (const result of worst3) {
      const criterionScores = await base44.asServiceRole.entities.CriterionScore.filter({
        eval_result_id: result.id,
      });
      const targetScore = criterionScores.find((s: any) => s.criterion_name === targetCriterion);
      const otherScores = criterionScores
        .filter((s: any) => s.criterion_name !== targetCriterion)
        .map((s: any) => `${s.criterion_name}: ${s.score}/10`)
        .join(', ');

      traceLines.push(
        `--- Failing output (score: ${result.overall_score?.toFixed(1) ?? '?'}/100) ---\n` +
        `Output: ${(result.raw_output || '').slice(0, 600)}\n` +
        `${targetCriterion} score: ${targetScore?.score ?? '?'}/10 — Judge: "${targetScore?.reasoning || 'no reasoning'}"\n` +
        `Other scores: ${otherScores}`
      );
    }
    return traceLines.join('\n\n');
  } catch (_) {
    return '(Could not fetch failing traces)';
  }
}

async function generateVariant(
  base44: any,
  ctx: {
    originalText: string;
    weakestCriterion: string;
    tracesText: string;
    priorHistoryText: string;
    annotationText: string;
    strategy: Strategy;
  }
): Promise<{ improved_prompt: string; change_summary: string; target_criterion: string; why_this_helps: string }> {
  const { originalText, weakestCriterion, tracesText, priorHistoryText, annotationText, strategy } = ctx;

  const improvementPrompt = `You are a prompt engineer. Make exactly ONE targeted improvement to the prompt below.

STRATEGY: ${STRATEGY_INSTRUCTIONS[strategy]}

CURRENT PROMPT:
${originalText}

WEAKEST CRITERION: ${weakestCriterion}

FAILING OUTPUTS WITH JUDGE REASONING:
${tracesText}

${annotationText ? annotationText + '\n\n' : ''}${priorHistoryText ? priorHistoryText + '\n\n' : ''}${STRUCTURAL_CONSTRAINT}

Return JSON with:
- improved_prompt: the full prompt with exactly one change applied
- change_summary: one sentence describing what you changed and why (e.g. "Added explicit rule to define technical terms on first use to improve Clarity")
- target_criterion: the criterion name this targets
- why_this_helps: exactly 2 sentences linking this specific change to the specific failures above`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
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

  return result;
}

async function runSampleOutput(base44: any, improvedPrompt: string, docContent: string): Promise<string> {
  try {
    const samplePrompt = docContent
      ? `<system>\n${improvedPrompt}\n</system>\n\n<user>\n${docContent}\n</user>`
      : improvedPrompt;
    const output = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt: samplePrompt });
    return typeof output === 'string' ? output.slice(0, 800) : '';
  } catch (_) {
    return '(Sample output unavailable)';
  }
}
