const Groq = require('groq-sdk');

let client;

const SYSTEM_PROMPT =
  'You are a senior DevOps engineer. You receive details of a failed GitHub Actions run: workflow name, branch, ' +
  'commit message, failed jobs, failed steps and the tail of each job log. Respond ONLY with JSON using the keys ' +
  'summary (1-2 sentences in plain English), likelyCause, suggestedFix (concrete steps) and severity (low, medium or high).';

async function analyzeFailure(context) {
  if (!process.env.GROQ_API_KEY) {
    return { summary: 'AI analysis is disabled (GROQ_API_KEY not set).', likelyCause: null, suggestedFix: null, severity: null };
  }
  client = client || new Groq({ apiKey: process.env.GROQ_API_KEY });

  const response = await client.chat.completions.create({
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(context).slice(0, 12000) },
    ],
  });

  const data = JSON.parse(response.choices[0].message.content);
  return {
    summary: data.summary || '',
    likelyCause: data.likelyCause || '',
    suggestedFix: data.suggestedFix || '',
    severity: ['low', 'medium', 'high'].includes(data.severity) ? data.severity : 'medium',
  };
}

module.exports = { analyzeFailure };
