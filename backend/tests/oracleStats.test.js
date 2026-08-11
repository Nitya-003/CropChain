const oracleService = require('../services/oracleService');

describe('Oracle Service Telemetry Stats', () => {
  beforeEach(() => {
    oracleService.stats = {
      totalProcessed: 0,
      totalSuccess: 0,
      totalFailed: 0,
      totalResponseTimeMs: 0,
    };
  });

  it('returns N/A and 0 count when no requests have been recorded', () => {
    const stats = oracleService.getPerformanceStats();

    expect(stats.totalProcessed).toBe(0);
    expect(stats.averageResponseTime).toBe('N/A');
    expect(stats.successRate).toBe('N/A');
  });

  it('calculates average response time and success rate accurately when requests are recorded', () => {
    oracleService.recordRequest(2000, true);
    oracleService.recordRequest(3000, true);
    oracleService.recordRequest(1000, false);

    const stats = oracleService.getPerformanceStats();

    expect(stats.totalProcessed).toBe(3);
    expect(stats.totalSuccess).toBe(2);
    expect(stats.totalFailed).toBe(1);
    expect(stats.averageResponseTime).toBe('2.0s'); // 6000ms / 3 = 2000ms -> 2.0s
    expect(stats.successRate).toBe('66.7%'); // 2/3 = 66.7%
  });
});
