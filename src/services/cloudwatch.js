const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

let cw;

async function publishMetrics(repo, stats) {
  if (process.env.DISABLE_AWS === 'true') return;
  cw = cw || new CloudWatchClient({ region: process.env.AWS_REGION });
  const Dimensions = [{ Name: 'Repository', Value: repo }];

  await cw.send(
    new PutMetricDataCommand({
      Namespace: 'PipelinePulse',
      MetricData: [
        { MetricName: 'PipelineFailures', Dimensions, Value: stats.failures, Unit: 'Count' },
        { MetricName: 'SuccessRate', Dimensions, Value: stats.successRate ?? 0, Unit: 'Percent' },
        { MetricName: 'AvgBuildDuration', Dimensions, Value: stats.avgDurationSec, Unit: 'Seconds' },
      ],
    })
  );
}

module.exports = { publishMetrics };
