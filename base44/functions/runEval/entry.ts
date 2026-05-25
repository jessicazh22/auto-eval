import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eval_run_id } = await req.json();
  if (!eval_run_id) {
    return Response.json({ error: 'eval_run_id required' }, { status: 400 });
  }

  await base44.asServiceRole.entities.EvalRun.update(eval_run_id, { status: 'running' });

  try {
    const runs = await base44.asServiceRole.entities.EvalRun.filter({ id: eval_run_id });
    const run = runs[0];
    if (!run) throw new Error('Run not found');

    const prompts = await base44.asServiceRole.entities.Prompt.filter({ id: run.prompt_id });
    const prompt = prompts[0];
    if (!prompt) throw new Error('Prompt not found');

    // Fetch prompt text (stored as file URL)
    let promptText = prompt.prompt_text || '';
    if (promptText.startsWith('http')) {
      const res = await fetch(promptText);
      promptText = await res.text();
    }

    const attachedFiles = prompt.attached_files || [];

    const rubrics = await base44.asServiceRole.entities.Rubric.filter({ prompt_id: prompt.id });
    const rubric = rubrics[0];
    if (!rubric) throw new Error('Rubric not found');

    const criteria = await base44.asServiceRole.entities.RubricCriterion.filter({ rubric_id: rubric.id });
    if (criteria.length === 0) throw new Error('No criteria defined');

    const totalWeight = criteria.reduce((sum, c) => sum + (c.weight || 0), 0);
    const normalizedWeights = {};
    for (const c of criteria) {
      normalizedWeights[c.name] = totalWeight > 0 ? (c.weight || 0) / totalWeight : 1 / criteria.length;
    }

    const allScores = [];
    // criterionTotals: { [criterionName]: { total: number, count: number } }
    const criterionTotals = {};
    for (const c of criteria) {
      criterionTotals[c.name] = { total: 0, count: 0 };
    }

    const RUNS_PER_DOC = 3;

    // Each attached file is one test input, run RUNS_PER_DOC times each
    const testFiles = attachedFiles.length > 0 ? attachedFiles : [{ name: 'default', url: null }];

    // Expand: each file × RUNS_PER_DOC
    const testInputs = testFiles.flatMap(file =>
      Array.from({ length: RUNS_PER_DOC }, (_, i) => ({ file, runIndex: i + 1 }))
    );

    // Create EvalResult records for each test input
    const evalResults = await Promise.all(
      testInputs.map(async ({ file, runIndex }) => {
        const label = testFiles.length > 1 || RUNS_PER_DOC > 1
          ? `${file.name} (run ${runIndex}/${RUNS_PER_DOC})`
          : file.name;
        const result = await base44.asServiceRole.entities.EvalResult.create({
          eval_run_id,
          test_input: label,
        });
        return { result, file };
      })
    );

    for (const { result, file } of evalResults) {
      // Fetch reference doc content if available
      let docContent = '';
      if (file.url) {
        try {
          const docRes = await fetch(file.url);
          docContent = await docRes.text();
        } catch (_) {
          docContent = `[Could not load: ${file.name}]`;
        }
      }

      // Generate output: system prompt defines the task, reference doc is the input
      const generatePrompt = docContent
        ? `${promptText}\n\n---\n\n${docContent}`
        : promptText;
      const rawOutput = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: generatePrompt,
        add_context_from_internet: true,
      });

      // Score output against all criteria
      const criteriaList = criteria.map(c => `- ${c.name}: ${c.description}`).join('\n');
      const scorePrompt = `You are an evaluator. Score the output below against each criterion. Each score is 0-10.

SYSTEM PROMPT used:
${promptText}

${docContent ? `REFERENCE DOCUMENT (${file.name}):\n${docContent}\n` : ''}
OUTPUT to evaluate:
${rawOutput}

CRITERIA:
${criteriaList}`;

      const scoreResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: scorePrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            scores: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  criterion_name: { type: 'string' },
                  score: { type: 'number' },
                  reasoning: { type: 'string' }
                }
              }
            }
          }
        },
      });

      const scores = scoreResult.scores || [];

      const criterionScoreRecords = scores.map(s => ({
        eval_result_id: result.id,
        criterion_name: s.criterion_name,
        score: Math.min(10, Math.max(0, s.score)),
        reasoning: s.reasoning || '',
      }));

      if (criterionScoreRecords.length > 0) {
        await base44.asServiceRole.entities.CriterionScore.bulkCreate(criterionScoreRecords);
      }

      // Accumulate per-criterion totals
      for (const s of scores) {
        if (criterionTotals[s.criterion_name]) {
          criterionTotals[s.criterion_name].total += Math.min(10, Math.max(0, s.score));
          criterionTotals[s.criterion_name].count += 1;
        }
      }

      // Weighted overall score (0-100)
      let overallScore = 0;
      for (const s of scores) {
        const weight = normalizedWeights[s.criterion_name] || 0;
        overallScore += Math.min(10, Math.max(0, s.score)) * weight;
      }
      overallScore = overallScore * 10;

      const flagged = overallScore < (rubric.passing_threshold || 70);

      await base44.asServiceRole.entities.EvalResult.update(result.id, {
        raw_output: rawOutput,
        overall_score: Math.round(overallScore * 10) / 10,
        flagged,
      });

      allScores.push(overallScore);
    }

    // Compute criterion averages
    const criterionAverages = {};
    for (const [name, { total, count }] of Object.entries(criterionTotals)) {
      criterionAverages[name] = count > 0 ? Math.round((total / count) * 10) / 10 : 0;
    }

    // Find weakest criterion
    let weakestCriterion = null;
    let weakestScore = Infinity;
    for (const [name, avg] of Object.entries(criterionAverages)) {
      if (avg < weakestScore) {
        weakestScore = avg;
        weakestCriterion = name;
      }
    }

    const runOverallScore = allScores.length > 0
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length
      : 0;

    await base44.asServiceRole.entities.EvalRun.update(eval_run_id, {
      status: 'complete',
      overall_score: Math.round(runOverallScore * 10) / 10,
      test_inputs_count: testFiles.length,
      weakest_criterion: weakestCriterion,
      weakest_criterion_score: weakestScore === Infinity ? null : weakestScore,
      criterion_averages: criterionAverages,
    });

    return Response.json({ success: true, overall_score: runOverallScore });
  } catch (error) {
    console.error('Eval run failed:', error.message);
    await base44.asServiceRole.entities.EvalRun.update(eval_run_id, { status: 'failed' });
    return Response.json({ error: error.message }, { status: 500 });
  }
});