import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const ANNOTATION_DATA = {
  __version: 2,
  mode: "examples",
  general: {
    commonFailure: "Stories reference terms the reader has never heard of (Strait of Hormuz, cost-base indexation, Farrer by-election, Hawke-Keating 1985) with no explanation — reader skips the whole section. Also: geopolitical stories (Iran/US clash, US jobs report) give no context for why it matters to an Australian reader.",
    successDescription: "A one-to-two sentence story intro that any non-expert Australian can understand at a glance. All jargon explained inline with a bracket or short clause. Workflow stories include a concrete tip the reader can steal today. Conversation topics are surprising and positive — not morbid. Culture/strange stories connect to something the reader already knows (e.g. a documentary, a concept they've heard of).",
    feedbackText: ""
  },
  examples: [
    {
      text: "🛢️ The Strait of Hormuz is still mostly closed, and the budget has a $10B fuel reserve in it. Pre-conflict, around 3,000 vessels used the strait each month — that's now at roughly 5% of normal, per the UK House of Commons Library briefing on 17 May. Chalmers's budget contains $10B to lift Australia's national fuel stockpile from 20-32 days to 37 days (50 days for jet fuel and diesel), plus a government-owned reserve of one billion litres of emergency diesel and aviation fuel. What to wonder: the Iran war has actually been a fiscal windfall — $10.9B over five years in extra tax receipts, mostly from gas company tax — even as it slows growth from 2.25% to 1.75% this year.",
      annotation: "I don't know what the Strait of Hormuz is. I skimmed the whole section because I had no idea what the paragraph was talking about. No context was given for why I should care.",
      label: "bad",
      fileName: null,
      fileUrl: null
    },
    {
      text: "💰 Anthropic bought Stainless for ~$300M last Monday — the company that powers OpenAI's developer SDKs too. Stainless (founded 2022, ex-Stripe engineer Alex Rattray) converts API specs into the SDKs and MCP servers developers and AI agents use to call APIs. It already generated every official Anthropic SDK; it also served OpenAI, Google and Cloudflare. Anthropic is winding down all hosted Stainless products — including the SDK generator — and absorbing the team. What to wonder: this is Anthropic's fourth acquisition in six months (Bun, Vercept, Coefficient Bio, Stainless) and TechCrunch's framing is that buying Stainless \"takes a key infrastructure supplier out of the hands of Anthropic's competitors.\" Anthropic is also reportedly raising at an ~$850B valuation.",
      annotation: "\"Converts API specs into the SDKs and MCP servers developers and AI agents use to call APIs\" — I don't understand this and skimmed the rest. Too much jargon with no plain-language explanation.",
      label: "bad",
      fileName: null,
      fileUrl: null
    },
    {
      text: "🗳️ Farrer is voting today — first by-election of Albanese's second term, and a test of Angus Taylor's new Liberal leadership. The seat covers ~126,000 km² of NSW's southwest (Albury, Griffith, Hay) and was held by former opposition leader Sussan Ley since 2001 until her resignation. It's the fifth by-election under Albanese, the first under Angus Taylor as Liberal leader, and the first under Matt Canavan as Nationals leader. Eight candidates running. What to wonder: the Liberals have held Farrer for 25 years, but a strong Independent or National swing here would be the first sign Taylor's leadership isn't landing in the regions — exactly the demographic he was elected to win back.",
      annotation: "I don't understand this at all. I don't know what a by-election is, who Angus Taylor is, or why I should care about Farrer. No context given.",
      label: "bad",
      fileName: null,
      fileUrl: null
    },
    {
      text: "🛠️ Addy Osmani — spec-first AI coding with a spec.md and prompt-plan file. The core insight: most people throw vague prompts at coding AIs and get jumbled output. Osmani treats every project like a 15-minute waterfall — spec, plan, then code in tiny chunks. 1. Brainstorm a spec, don't code — prompts: \"Iteratively ask me questions until we've fleshed out requirements and edge cases.\" 2. Generate a prompt plan — feeds spec.md into a reasoning model, breaks into bite-sized tasks. 3. Pack context aggressively — uses gitingest or repo2txt, tells the model explicitly what not to focus on to save tokens. 4. Swap models when one gets stuck — \"model musical chairs.\" What changed: Anthropic's own engineers now have ~90% of Claude Code written by Claude Code.",
      annotation: "Great workflow. Ex-Google engineer so I trust the source. Tells me tips I can actually use — generating a spec first, what not to focus on to save tokens, packing context aggressively. Aligns with what I already know.",
      label: "good",
      fileName: null,
      fileUrl: null
    },
    {
      text: "🎓 Canvas, the learning platform thousands of US schools and universities use, was offline Thursday after a cyberattack by hacking group ShinyHunters during finals week. Back online Friday.",
      annotation: "Great — one sentence is all I need. I understand it instantly and know whether it affects me.",
      label: "good",
      fileName: null,
      fileUrl: null
    },
    {
      text: "🌍 Lenny Rachitsky's research workflow. He has a Claude Project called \"Lenny Editor\" with instructions: \"You are my editor. Push back on weak claims. Flag where I'm being lazy. Suggest sharper openings. Don't compliment me.\" Project knowledge contains 5-10 of his best past posts and his stylebook. He pastes the draft and asks: \"Read this as my editor. What's weak?\" Then iterates 2-3 rounds. What changed: his hit rate on viral posts roughly doubled — the bottleneck wasn't writing more, it was getting honest feedback fast.",
      annotation: "I like this workflow. The instructions are quotable and I can paste them directly into my own setup. Real quote from the article, not rephrased.",
      label: "good",
      fileName: null,
      fileUrl: null
    },
    {
      text: "🛢️ The Strait of Hormuz is still mostly closed, and the budget has a $10B fuel reserve in it. Pre-conflict, around 3,000 vessels used the strait each month — that's now at roughly 5% of normal, per the UK House of Commons Library briefing on 17 May. Chalmers's budget contains $10B to lift Australia's national fuel stockpile from 20-32 days to 37 days (50 days for jet fuel and diesel), plus a government-owned reserve of one billion litres of emergency diesel and aviation fuel. What to wonder: the Iran war has actually been a fiscal windfall — $10.9B over five years in extra tax receipts, mostly from gas company tax — even as it slows growth from 2.25% to 1.75% this year.",
      annotation: "No context given for what the Strait of Hormuz is — I almost skipped it entirely. With one sentence explaining it's a waterway that 20% of the world's oil passes through, I would have read further. I understood the $10B fuel reserve. But I got lost again at \"fiscal windfall\", \"gas company tax\", and the growth figures — no explanation of why those numbers matter or what they mean for me. Half the story is accessible, half isn't.",
      label: "middle",
      fileName: null,
      fileUrl: null
    }
  ]
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { prompt_name } = await req.json();
  if (!prompt_name) return Response.json({ error: 'prompt_name required' }, { status: 400 });

  const allPrompts = await base44.asServiceRole.entities.Prompt.list();
  const prompt = allPrompts.find((p: any) =>
    p.name?.toLowerCase().includes(prompt_name.toLowerCase())
  );
  if (!prompt) return Response.json({ error: `No prompt found matching "${prompt_name}"` }, { status: 404 });

  const rubrics = await base44.asServiceRole.entities.Rubric.filter({ prompt_id: prompt.id });
  const rubric = rubrics[0];
  if (!rubric) return Response.json({ error: 'No rubric found for this prompt' }, { status: 404 });

  await base44.asServiceRole.entities.Rubric.update(rubric.id, {
    annotation_text: JSON.stringify(ANNOTATION_DATA),
  });

  return Response.json({ success: true, prompt: prompt.name, rubric_id: rubric.id });
});
