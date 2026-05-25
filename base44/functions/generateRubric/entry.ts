import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { prompt_id, feedback_text, file_urls } = await req.json();
  if (!prompt_id) {
    return Response.json({ error: 'prompt_id required' }, { status: 400 });
  }

  // Load prompt
  const prompts = await base44.asServiceRole.entities.Prompt.filter({ id: prompt_id });
  const prompt = prompts[0];
  if (!prompt) {
    return Response.json({ error: 'Prompt not found' }, { status: 404 });
  }

  // Fetch prompt text (stored as file URL)
  let promptText = prompt.prompt_text || '';
  if (promptText.startsWith('http')) {
    const res = await fetch(promptText);
    promptText = await res.text();
  }

  const hasExamples = file_urls && file_urls.length > 0;
  const hasFeedback = feedback_text && feedback_text.trim().length > 0;

  const aiPrompt = `You are an expert evaluator designing a scoring rubric for an LLM prompt.

SYSTEM PROMPT being evaluated:
"""
${promptText}
"""

${hasFeedback ? `USER FEEDBACK AND ANNOTATED EXAMPLES:
"""
${feedback_text}
"""

${hasExamples ? `The attached files contain the actual LLM outputs referenced above. Read them carefully to identify concrete patterns that distinguish good from bad outputs for this specific task.` : ''}` : `No feedback provided. Infer sensible criteria from the prompt's purpose.`}

YOUR TASK:
Generate 3-6 evaluation criteria. For each criterion, write a description that includes:
1. A one-sentence definition of what it measures
2. Score 1-3 anchor: what a bad output looks like — use specific language patterns or failure modes from the examples if available
3. Score 4-7 anchor: what an acceptable but imperfect output looks like
4. Score 8-10 anchor: what an excellent output looks like — use specific language patterns from the examples if available

Format each description exactly like this:
"Measures whether [what it evaluates]. Score 1-3: [concrete bad anchor]. Score 4-7: [concrete mid anchor]. Score 8-10: [concrete good anchor]."

RULES:
- Each criterion is UNIDIMENSIONAL: it measures exactly ONE aspect. If two criteria would always move together (e.g. "Clarity" and "Readability"), merge them into one.
- Anchors must be concrete and observable. Never use vague words like "good" or "clear" without defining what they mean in this context.
- If annotated examples are provided, ground your anchors in actual output patterns you observe — quote short phrases where helpful.
- Weights reflect importance to the prompt's core purpose. The most critical criterion gets the highest weight.
- Names: 2-4 words maximum.
- Weights must sum to exactly 1.0, each between 0.05 and 0.5.

Return JSON: { "criteria": [{ "name": "...", "description": "...", "weight": 0.0 }] }`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: aiPrompt,
    ...(file_urls && file_urls.length > 0 ? { file_urls } : {}),
    response_json_schema: {
      type: 'object',
      properties: {
        criteria: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              weight: { type: 'number' }
            }
          }
        }
      }
    }
  });

  return Response.json({ criteria: result.criteria || [] });
});