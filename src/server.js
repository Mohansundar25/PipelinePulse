require('dotenv').config();
const express = require('express');
const path = require('path');
const { getRecentRuns, getRun, getFailedJobs } = require('./services/github');
const { analyzeFailure } = require('./services/ai');
const { publishMetrics } = require('./services/cloudwatch');
const { sendFailureAlert } = require('./services/alerts');

const app = express();
const PORT = process.env.PORT || 3000;
const POLL_MS = Number(process.env.POLL_INTERVAL_MS || 60000);
const REPOS = (process.env.GITHUB_REPOS || '').split(',').map((r) => r.trim()).filter(Boolean);

const startedAt = new Date();
const alerted = new Set();
const analysisCache = new Map();
let state = { updatedAt: null, repos: [] };

app.use(express.static(path.join(__dirname, 'public')));

const durationSec = (r) => Math.max(0, Math.round((new Date(r.updated_at) - new Date(r.run_started_at || r.created_at)) / 1000));

function summarize(runs) {
  const completed = runs.filter((r) => r.status === 'completed');
  const success = completed.filter((r) => r.conclusion === 'success').length;
  const failures = completed.filter((r) => r.conclusion === 'failure').length;
  const durations = completed.map(durationSec).filter((d) => d > 0);
  return {
    total: runs.length,
    success,
    failures,
    successRate: completed.length ? Math.round((100 * success) / completed.length) : null,
    avgDurationSec: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
  };
}

const toView = (r) => ({
  id: r.id,
  name: r.name,
  branch: r.head_branch,
  event: r.event,
  status: r.status,
  conclusion: r.conclusion,
  url: r.html_url,
  createdAt: r.created_at,
  durationSec: r.status === 'completed' ? durationSec(r) : null,
});

async function explainRun(repo, run) {
  if (analysisCache.has(run.id)) return analysisCache.get(run.id);
  const failedJobs = await getFailedJobs(repo, run.id);
  const analysis = await analyzeFailure({
    repo,
    workflow: run.name,
    branch: run.head_branch,
    commitMessage: run.head_commit?.message,
    failedJobs,
  });
  analysisCache.set(run.id, analysis);
  return analysis;
}

async function poll() {
  const repos = [];
  for (const repo of REPOS) {
    try {
      const runs = await getRecentRuns(repo);
      const stats = summarize(runs);
      repos.push({ repo, stats, runs: runs.map(toView) });

      publishMetrics(repo, stats).catch((err) => console.warn(`[cloudwatch] ${repo}: ${err.message}`));

      // Alert only on failures that happened after the server started.
      const newFailures = runs.filter(
        (r) => r.conclusion === 'failure' && new Date(r.created_at) > startedAt && !alerted.has(r.id)
      );
      for (const run of newFailures) {
        alerted.add(run.id);
        const analysis = await explainRun(repo, run).catch((err) => ({ summary: `AI analysis failed: ${err.message}` }));
        await sendFailureAlert({ repo, run, analysis }).catch((err) => console.warn(`[sns] ${err.message}`));
      }
    } catch (err) {
      repos.push({ repo, stats: null, runs: [], error: err.response?.data?.message || err.message });
    }
  }
  state = { updatedAt: new Date().toISOString(), repos };
}

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/status', (req, res) => res.json(state));

app.get('/api/repos/:repo/runs/:runId/analysis', async (req, res) => {
  const { repo, runId } = req.params;
  if (!REPOS.includes(repo)) return res.status(404).json({ message: 'Unknown repository' });
  try {
    const run = await getRun(repo, runId);
    if (run.conclusion !== 'failure') return res.status(400).json({ message: 'Only failed runs can be analysed' });
    res.json(await explainRun(repo, run));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`PipelinePulse running on http://localhost:${PORT} (watching: ${REPOS.join(', ') || 'no repos set'})`);
  poll();
  setInterval(poll, POLL_MS);
});
