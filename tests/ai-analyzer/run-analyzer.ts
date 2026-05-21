/**
 * Entry point: npm run ai:analyze
 * Reads RUN_ID from env, fetches all failed tests from DB,
 * runs Claude analysis, and generates the HTML report.
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { AIAnalyzer } from './AIAnalyzer';
import { AnalyzerReportGenerator } from './AnalyzerReportGenerator';
import { closePool } from '../db/DatabaseClient';
import { logger } from '../utils/Logger';

async function main(): Promise<void> {
  const runId = process.env.RUN_ID ?? `run_${Date.now()}`;
  logger.info(`Starting AI Analyzer for runId=${runId}`);

  const analyzer  = new AIAnalyzer();
  const generator = new AnalyzerReportGenerator();

  const results = await analyzer.analyzeRunBatch(runId);
  if (results.length > 0) {
    generator.generate(results, runId);
  }

  await closePool();
  logger.info('AI Analyzer complete ✓');
}

main().catch((err) => {
  logger.error('AI Analyzer failed', { error: (err as Error).message });
  process.exit(1);
});
