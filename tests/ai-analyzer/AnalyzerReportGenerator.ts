/**
 * AnalyzerReportGenerator
 * Generates the final AI Analyzer HTML report (attached to Allure
 * and saved as a standalone file in dist/ai-report/).
 */

import * as fs from 'fs';
import * as path from 'path';
import { AIAnalysisResult, FailureCategory } from '../observability/types';
import { logger } from '../utils/Logger';

const CATEGORY_COLORS: Record<FailureCategory, string> = {
  'Automation Script Issue':     '#7b1fa2',
  'Flaky Issue':                 '#f57c00',
  'Network / Infrastructure Issue': '#1565c0',
  'Product Issue':               '#c62828',
  'Test Data Issue':             '#2e7d32',
  'Unclassified':                '#757575',
};

export class AnalyzerReportGenerator {

  generate(results: AIAnalysisResult[], runId: string): string {
    const timestamp  = new Date().toISOString();
    const failures   = results.filter(r => r.failureCategory !== 'Unclassified');
    const byCategory = this.groupByCategory(results);
    const flaky      = results.filter(r => r.isFlaky);

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<title>AI Failure Analysis Report — ${runId}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#222;background:#f4f5f7;padding:20px}
  .container{max-width:1100px;margin:0 auto}
  h1{font-size:22px;margin-bottom:4px;color:#1a1a2e}
  .subtitle{color:#666;font-size:12px;margin-bottom:20px}
  .summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
  .summary-card{background:#fff;border-radius:8px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
  .summary-card .num{font-size:28px;font-weight:700;margin-bottom:2px}
  .summary-card .lbl{font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.05em}
  .section{background:#fff;border-radius:8px;padding:16px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
  .section h2{font-size:15px;margin-bottom:12px;color:#1a1a2e;border-bottom:1px solid #eee;padding-bottom:8px}
  .cat-bar{display:flex;align-items:center;gap:8px;margin-bottom:7px}
  .cat-label{font-size:12px;width:220px;flex-shrink:0}
  .cat-track{flex:1;height:14px;background:#eee;border-radius:7px;overflow:hidden}
  .cat-fill{height:100%;border-radius:7px;transition:width .3s}
  .cat-count{font-size:11px;color:#666;width:40px;text-align:right}
  table{width:100%;border-collapse:collapse}
  th,td{padding:7px 10px;text-align:left;border-bottom:1px solid #f0f0f0;font-size:12px}
  th{background:#f8f9fa;font-weight:600;color:#444;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
  tr:hover{background:#fafafa}
  .badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10.5px;font-weight:600;color:#fff}
  .conf-bar{height:8px;border-radius:4px;background:#e0e0e0;overflow:hidden;width:80px;display:inline-block;vertical-align:middle;margin-left:6px}
  .conf-fill{height:100%;background:#43a047;border-radius:4px}
  .suggestion{background:#f0f4ff;border-left:3px solid #3f51b5;padding:6px 10px;margin:4px 0;border-radius:0 4px 4px 0;font-size:11.5px}
  .flaky-badge{background:#ff6f00;color:#fff;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700;margin-left:5px}
  .footer{text-align:center;color:#999;font-size:11px;margin-top:20px}
</style></head><body>
<div class="container">
  <h1>🤖 AI Failure Analysis Report</h1>
  <div class="subtitle">Run ID: ${runId} &nbsp;|&nbsp; Generated: ${timestamp} &nbsp;|&nbsp; Model: Claude 3.5 Sonnet</div>

  <!-- Summary cards -->
  <div class="summary-grid">
    <div class="summary-card"><div class="num" style="color:#c62828">${results.length}</div><div class="lbl">Failures Analyzed</div></div>
    <div class="summary-card"><div class="num" style="color:#f57c00">${flaky.length}</div><div class="lbl">Flaky Tests</div></div>
    <div class="summary-card"><div class="num" style="color:#1565c0">${Object.keys(byCategory).length}</div><div class="lbl">Failure Categories</div></div>
    <div class="summary-card"><div class="num" style="color:#2e7d32">${this.avgConfidence(results)}%</div><div class="lbl">Avg Confidence</div></div>
  </div>

  <!-- Category distribution -->
  <div class="section">
    <h2>📊 Failure Category Distribution</h2>
    ${Object.entries(byCategory).map(([cat, items]) => `
      <div class="cat-bar">
        <span class="cat-label"><span class="badge" style="background:${CATEGORY_COLORS[cat as FailureCategory] ?? '#757575'}">${cat}</span></span>
        <div class="cat-track"><div class="cat-fill" style="width:${Math.round((items.length/results.length)*100)}%;background:${CATEGORY_COLORS[cat as FailureCategory] ?? '#757575'}"></div></div>
        <span class="cat-count">${items.length}</span>
      </div>`).join('')}
  </div>

  <!-- Detailed results -->
  <div class="section">
    <h2>🔍 Detailed Failure Analysis</h2>
    <table>
      <thead><tr><th>#</th><th>Test</th><th>Category</th><th>Confidence</th><th>Flaky?</th><th>Historical Failures</th></tr></thead>
      <tbody>
        ${results.map((r, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>
              <strong>${esc(r.test)}</strong><br>
              <span style="color:#888;font-size:11px">${esc(r.spec)}</span>
            </td>
            <td><span class="badge" style="background:${CATEGORY_COLORS[r.failureCategory] ?? '#757575'}">${r.failureCategory}</span></td>
            <td>
              ${Math.round(r.confidence * 100)}%
              <div class="conf-bar"><div class="conf-fill" style="width:${Math.round(r.confidence*100)}%"></div></div>
            </td>
            <td>${r.isFlaky ? '<span class="flaky-badge">FLAKY</span>' : '<span style="color:#999">No</span>'}</td>
            <td>${r.historicalFailureCount ?? '—'}</td>
          </tr>
          <tr><td colspan="6" style="padding:4px 10px 12px;background:#fafafa">
            <strong>Reasoning:</strong> ${esc(r.reasoning)}<br>
            ${r.suggestions.map(s => `<div class="suggestion">💡 ${esc(s)}</div>`).join('')}
          </td></tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">playgauge_framework — AI Analyzer | Powered by Anthropic Claude</div>
</div>
</body></html>`;

    // Save to disk
    const outDir  = path.resolve('dist/ai-report');
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `ai-analysis-${runId}.html`);
    fs.writeFileSync(outPath, html, 'utf-8');
    logger.info(`AI Analyzer report saved: ${outPath}`);

    return html;
  }

  private groupByCategory(results: AIAnalysisResult[]): Record<string, AIAnalysisResult[]> {
    return results.reduce((acc, r) => {
      acc[r.failureCategory] = acc[r.failureCategory] ?? [];
      acc[r.failureCategory].push(r);
      return acc;
    }, {} as Record<string, AIAnalysisResult[]>);
  }

  private avgConfidence(results: AIAnalysisResult[]): string {
    if (!results.length) return '0';
    return Math.round(results.reduce((s, r) => s + r.confidence, 0) / results.length * 100).toString();
  }
}

function esc(s: string): string {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').trim();
}
