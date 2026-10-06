const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

let sns;

async function sendFailureAlert({ repo, run, analysis }) {
  if (process.env.DISABLE_AWS === 'true' || !process.env.SNS_TOPIC_ARN) return;
  sns = sns || new SNSClient({ region: process.env.AWS_REGION });

  const message = [
    `Pipeline failed: ${repo} / ${run.name}`,
    `Branch: ${run.head_branch}`,
    `Run: ${run.html_url}`,
    '',
    'AI analysis',
    `Summary: ${analysis.summary || 'n/a'}`,
    `Likely cause: ${analysis.likelyCause || 'n/a'}`,
    `Suggested fix: ${analysis.suggestedFix || 'n/a'}`,
    `Severity: ${analysis.severity || 'n/a'}`,
  ].join('\n');

  await sns.send(
    new PublishCommand({
      TopicArn: process.env.SNS_TOPIC_ARN,
      Subject: `[PipelinePulse] ${repo} build failed`.slice(0, 99),
      Message: message,
    })
  );
}

module.exports = { sendFailureAlert };
