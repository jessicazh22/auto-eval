import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { eval_run_id, annotations, target_criterion_override } = await req.json();
  if (!eval_run_id) return Response.json({ error: 'eval_run_id required' }, { status: 400 });

  // Fetch the run and prompt
  const runs = await base44.asServiceRole.entities.EvalRun.filter({ id: eval_run_id });
  const run = runs[0];
  if (!run) return Response.json({ error: 'Run not found' }, { status: 404 });

  const prompts = await base44.asServiceRole.entities.Prompt.filter({ id: run.prompt_id });
  const prompt = prompts[0];
  if (!prompt) return Response.json({ error: 'Prompt not found' }, { status: 404 });

  // Fetch original prompt text
  let originalText = prompt.prompt_text || '';
  if (originalText.startsWith('http')) {
    const res = await fetch(originalText);
    originalText = await res.text();
  }

  // Build criterion context
  const criterionAverages = run.criterion_averages || {};
  const weakestCriterion = target_criterion_override || run.weakest_criterion || 'overall quality';
  const criterionSummary = Object.entries(criterionAverages)
    .sort((a, b) => a[1] - b[1])
    .map(([name, score]) => `- ${name}: ${score}/10`)
    .join('\n');

  // Build annotation context
  let annotationContext = '';
  if (annotations && annotations.length > 0) {
    const parts = annotations
      .filter(a => a.annotation && a.annotation.trim())
      .map((a, i) => {
        const content = a.file ? `[File: ${a.file.name}]` : (a.text || '').slice(0, 500);
        return `Example ${i + 1}:\nOutput: ${content}\nAnnotation: ${a.annotation}`;
      });
    if (parts.length > 0) {
      annotationContext = `\n\nHUMAN ANNOTATIONS ON REAL OUTPUTS:\n${parts.join('\n\n')}`;
    }
  }

  // Ask LLM to make ONE targeted change
  const improvementPrompt = `You are a prompt engineer improving an LLM system prompt by making exactly ONE targeted change.

  CURRENT PROMPT:
  ${originalText}

  EVALUATION SCORES (0-10 per criterion):
  ${criterionSummary}

  Weakest criterion: ${weakestCriterion}${annotationContext}

  Make the single most impactful change to improve "${weakestCriterion}". Do not restructure or rewrite the whole prompt — only one targeted change.

Return a JSON object with:
- improved_prompt: the full improved prompt text with only one targeted change applied (do NOT include any evaluation scores, task instructions, or meta-commentary in the prompt itself)
- change_summary: a single sentence describing exactly what you changed and why (e.g. "Added explicit instruction to use plain language to improve clarity")
- target_criterion: the criterion name this change targets`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: improvementPrompt,
    response_json_schema: {
      type: 'object',
      properties: {
        improved_prompt: { type: 'string' },
        change_summary: { type: 'string' },
        target_criterion: { type: 'string' }
      }
    }
  });

  const { improved_prompt, change_summary, target_criterion } = result;

  // Upload improved prompt as file
  const encoder = new TextEncoder();
  const blob = new Blob([encoder.encode(improved_prompt)], { type: 'text/plain' });
  const file = new File([blob], 'prompt.txt', { type: 'text/plain' });
  const { file_url: improvedUrl } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

  // Create the PromptVariant record
  const variant = await base44.asServiceRole.entities.PromptVariant.create({
    prompt_id: prompt.id,
    parent_eval_run_id: eval_run_id,
    original_prompt_text: prompt.prompt_text || '',
    improved_prompt_text: improvedUrl,
    change_summary,
    target_criterion,
    source: 'annotations',
    original_score: run.overall_score || 0,
    status: 'running',
  });

  // Create a new EvalRun for the variant — using the improved prompt temporarily
  // We'll run eval against the original attached files but with the new prompt text
  const variantRun = await base44.asServiceRole.entities.EvalRun.create({
    prompt_id: prompt.id,
    status: 'pending',
    test_inputs_count: (prompt.attached_files || []).length || 1,
  });

  // Update variant with the run id
  await base44.asServiceRole.entities.PromptVariant.update(variant.id, {
    variant_eval_run_id: variantRun.id,
  });

  // Kick off eval with override prompt text
  base44.asServiceRole.functions.invoke('runEval', {
    eval_run_id: variantRun.id,
    prompt_text_override: improved_prompt,
  });

  return Response.json({
    variant_id: variant.id,
    variant_eval_run_id: variantRun.id,
    change_summary,
    target_criterion,
  });
});