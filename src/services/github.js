const axios = require('axios');

let client;
function gh() {
  if (!client) {
    client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
  }
  return client;
}

const owner = () => process.env.GITHUB_OWNER;

async function getRecentRuns(repo, perPage = 20) {
  const { data } = await gh().get(`/repos/${owner()}/${repo}/actions/runs`, { params: { per_page: perPage } });
  return data.workflow_runs;
}

async function getRun(repo, runId) {
  const { data } = await gh().get(`/repos/${owner()}/${repo}/actions/runs/${runId}`);
  return data;
}

async function getJobLogTail(repo, jobId, maxChars = 3000) {
  try {
    const { data } = await gh().get(`/repos/${owner()}/${repo}/actions/jobs/${jobId}/logs`, { responseType: 'text' });
    return String(data).slice(-maxChars);
  } catch {
    return '';
  }
}

// Failed jobs with their failed steps and the end of each job log (used as AI context).
async function getFailedJobs(repo, runId) {
  const { data } = await gh().get(`/repos/${owner()}/${repo}/actions/runs/${runId}/jobs`);
  const failed = data.jobs.filter((j) => j.conclusion === 'failure');
  return Promise.all(
    failed.map(async (job) => ({
      job: job.name,
      failedSteps: (job.steps || []).filter((s) => s.conclusion === 'failure').map((s) => s.name),
      logTail: await getJobLogTail(repo, job.id),
    }))
  );
}

module.exports = { getRecentRuns, getRun, getFailedJobs };
