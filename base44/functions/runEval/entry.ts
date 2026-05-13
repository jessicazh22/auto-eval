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

  // Mark run as running
  await base44.asServiceRole.entities.EvalRun.update(eval_run_id, { status: 'running' });

  try {
    // Load run data
    const runs = await base44.asServiceRole.entities.EvalRun.filter({ id: eval_run_id });
    const run = runs[0];
    if (!run) throw new Error('Run not found');

    // Load prompt
    const prompts = await base44.asServiceRole.entities.Prompt.filter({ id: run.prompt_id });
    const prompt = prompts[0];
    if (!prompt) throw new Error('Prompt not found');

    // Load rubric and criteria
    const rubrics = await base44.asServiceRole.entities.Rubric.filter({ prompt_id: prompt.id });
    const rubric = rubrics[0];
    if (!rubric) throw new Error('Rubric not found');

    const criteria = await base44.asServiceRole.entities.RubricCriterion.filter({ rubric_id: rubric.id });
    if (criteria.length === 0) throw new Error('No criteria defined');

    // Calculate normalized weights
    const totalWeight = criteria.reduce((sum, c) => sum + (c.weight || 0), 0);
    const normalizedWeights = {};
    for (const c of criteria) {
      normalizedWeights[c.name] = totalWeight > 0 ? (c.weight || 0) / totalWeight : 1 / criteria.length;
    }

    // Load eval results (test inputs)
    const results = await base44.asServiceRole.entities.EvalResult.filter({ eval_run_id });

    const allScores = [];

    for (const result of results) {
      // Call 1: Generate output
      const generatePrompt = `You are completing a task. Follow the instructions in the prompt exactly.\n\n${prompt.prompt_text}\n\nInput: ${result.test_input}`;
      const rawOutput = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: generatePrompt,
      });

      // Call 2: Score output against all criteria
      const criteriaList = criteria.map(c => `- ${c.name}: ${c.description}`).join('\n');
      const scorePrompt = `You are an evaluator. Score the output below against each criterion listed. Return JSON only, no other text.

Prompt used: ${prompt.prompt_text}

Input: ${result.test_input}

Output to evaluate: ${rawOutput}

Criteria to score:
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

      // Save criterion scores
      const criterionScoreRecords = scores.map(s => ({
        eval_result_id: result.id,
        criterion_name: s.criterion_name,
        score: Math.min(10, Math.max(0, s.score)),
        reasoning: s.reasoning || '',
      }));

      if (criterionScoreRecords.length > 0) {
        await base44.asServiceRole.entities.CriterionScore.bulkCreate(criterionScoreRecords);
      }

      // Calculate weighted score (0-100)
      let overallScore = 0;
      for (const s of scores) {
        const weight = normalizedWeights[s.criterion_name] || 0;
        overallScore += Math.min(10, Math.max(0, s.score)) * weight;
      }
      overallScore = overallScore * 10; // Convert 0-10 to 0-100

      const flagged = overallScore < (rubric.passing_threshold || 70);

      await base44.asServiceRole.entities.EvalResult.update(result.id, {
        raw_output: rawOutput,
        overall_score: Math.round(overallScore * 10) / 10,
        flagged,
      });

      allScores.push(overallScore);
    }

    // Calculate run overall score
    const runOverallScore = allScores.length > 0
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length
      : 0;

    await base44.asServiceRole.entities.EvalRun.update(eval_run_id, {
      status: 'complete',
      overall_score: Math.round(runOverallScore * 10) / 10,
    });

    return Response.json({ success: true, overall_score: runOverallScore });
  } catch (error) {
    console.error('Eval run failed:', error.message);
    await base44.asServiceRole.entities.EvalRun.update(eval_run_id, { status: 'failed' });
    return Response.json({ error: error.message }, { status: 500 });
  }
});