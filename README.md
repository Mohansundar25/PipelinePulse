# PipelinePulse — AI-Powered CI/CD Monitoring Dashboard

PipelinePulse is a Node.js dashboard that monitors **GitHub Actions** pipelines in real time. It tracks success rates and build durations, publishes metrics to **AWS CloudWatch**, sends **SNS** alerts on failures, and uses an **LLM (Groq API)** to explain *why* a build failed and how to fix it.

## 🤖 How AI Is Used

### In the product

| AI feature | What it does |
|---|---|
| **AI failure analysis** | When a run fails, the failed job names, failed steps and the tail of the job log are sent to an LLM, which returns a plain-English summary, the likely root cause, a suggested fix and a severity level |
| **AI-enriched alerts** | The SNS alert email includes the AI analysis, so you know what broke before opening GitHub |
| **Explain with AI button** | Any failed run on the dashboard can be analysed on demand |
| **JSON-mode prompting** | Structured prompts force JSON output so AI responses are reliable to display |

### In development

This project was built with **AI-assisted development**. AI coding agents were used to speed up implementation, debugging and refactoring, while I owned the architecture, AWS setup, prompt design, code review and deployment.

## Features

- Live status of recent GitHub Actions runs across multiple repositories
- Success rate, failure count and average build duration per repo
- Custom CloudWatch metrics (`PipelineFailures`, `SuccessRate`, `AvgBuildDuration`)
- SNS email alerts for new failures, enriched with AI analysis
- Dockerised and deployable on AWS EC2 with least-privilege IAM
- CI workflow with GitHub Actions

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express |
| Data source | GitHub Actions REST API |
| AI / LLM | Groq API (Llama 3.3 70B) |
| Monitoring | AWS CloudWatch (custom metrics + alarms) |
| Alerts | AWS SNS |
| Containerisation | Docker |
| Hosting | AWS EC2 |
| CI | GitHub Actions |

## Architecture

```
GitHub Actions API
        │  (poll every 60s)
        ▼
Node.js server (Docker on EC2)
        ├── Dashboard UI + /api/status
        ├── Custom metrics ──► AWS CloudWatch ──► Alarm
        └── New failure detected
                 │
                 ├── 🤖 Groq LLM: summary, root cause, fix, severity
                 └── AWS SNS ──► Email alert (with AI analysis)
```

## Project Structure

```
PipelinePulse/
├── src/
│   ├── server.js            # Express app, polling loop, API routes
│   ├── services/
│   │   ├── github.js        # GitHub Actions API client
│   │   ├── ai.js            # 🤖 LLM failure analysis (Groq)
│   │   ├── cloudwatch.js    # Custom CloudWatch metrics
│   │   └── alerts.js        # SNS alerts
│   └── public/index.html    # Dashboard UI
├── Dockerfile
├── .github/workflows/ci.yml
├── .env.example
└── package.json
```

## Getting Started

### Prerequisites

- Node.js 18+
- A GitHub personal access token (read access to Actions)
- A free Groq API key from https://console.groq.com
- An AWS account (optional for local testing — set `DISABLE_AWS=true`)

### Run locally

```bash
npm install
cp .env.example .env   # fill in your values
npm start
```

Open http://localhost:3000

### Run with Docker

```bash
docker build -t pipelinepulse .
docker run -p 3000:3000 --env-file .env pipelinepulse
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/status` | Latest runs and stats for all repos |
| GET | `/api/repos/:repo/runs/:runId/analysis` | 🤖 AI analysis of a failed run |
| GET | `/api/health` | Health check |

## AWS Setup

1. **SNS:** create a topic (e.g. `pipeline-alerts`) and subscribe your email.
2. **CloudWatch:** create an alarm on `PipelinePulse › PipelineFailures` (> 0) that notifies the SNS topic.
3. **IAM:** attach a role to the EC2 instance with only `cloudwatch:PutMetricData` and `sns:Publish`.
4. **EC2:** install Docker, then run the container with your `.env`.
5. **Security group:** allow port 22 from your IP only and port 3000/80 for the dashboard.

## Future Improvements

- AI trend reports (e.g. flaky tests detected across runs)
- Slack / Microsoft Teams alerts
- Build-time charts
- GitLab CI and Jenkins support

## Author

**Mohana Sundaram B** · GitHub: [Mohansundar25](https://github.com/Mohansundar25)
