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

  const aiPrompt = `You are an expert evaluator helping to design rubric criteria for an LLM prompt.

Prompt being evaluated:
"""
${promptText}
"""

User feedback and expectations:
"""
${feedback_text || 'No specific feedback provided. Use the prompt content to infer sensible criteria.'}
"""

Based on the prompt and feedback above, generate a rubric with 3-6 evaluation criteria. Each criterion should be specific, measurable, and directly relevant to what makes the prompt's output good or bad.

Return a JSON object with this exact structure:
{
  "criteria": [
    {
      "name": "Short criterion name",
      "description": "Detailed description of what this criterion measures and how to evaluate it",
      "weight": 0.2
    }
  ]
}

Rules:
- Weights must sum to exactly 1.0
- Each weight should be between 0.05 and 0.5
- Names should be 2-4 words maximum
- Descriptions should be 1-2 sentences, clear and actionable
- Focus on what actually matters for this specific prompt's purpose`;

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