/**
 * AllureObservabilityReporter
 * Writes observability data as a proper Allure result entry using
 * allure-js-commons v2 (AllureRuntime + FileSystemAllureWriter).
 *
 * Each scenario produces:
 *   - allure-results/<uuid>-result.json   — the test result with parameters
 *   - allure-results/<uuid>-container.json
 *   - allure-results/<uuid>-attachment.json × 3  (summary / details / features)
 *   - allure-results/<uuid>-attachment.html       (custom HTML table report)
 */

import * as path from 'path';
import {
  AllureRuntime,
  AllureTest,
  ContentType,
  LabelName,
  Stage,
  Status,
} from 'allure-js-commons';
import { FailureFeaturesV1 } from './types';
import { ObservabilityCollector } from './ObservabilityCollector';
import { FrameworkEnv } from '../utils/EnvLoader';

export class AllureObservabilityReporter {
  constructor(
    private readonly obs: ObservabilityCollector,
    private readonly env: FrameworkEnv,
  ) {}

  async attachAll(features: FailureFeaturesV1): Promise<void> {
    if (!this.env.observabilityAttachAllure) return;

    // Create a fresh AllureRuntime for this test result
    const resultsDir = path.resolve(process.cwd(), this.env.allureResultsDir);
    const rt = new AllureRuntime({ resultsDir });

    const group = rt.startGroup(features.spec);
    const test  = group.startTest(features.test);

    // ─── Labels ───────────────────────────────────────────────────────────────
    test.addLabel(LabelName.SUITE,   features.module);
    test.addLabel(LabelName.FEATURE, features.spec);
    test.fullName = `${features.spec} > ${features.test}`;

    // ─── Status ───────────────────────────────────────────────────────────────
    test.status = features.testStatus === 'failed' ? Status.FAILED : Status.PASSED;
    test.stage  = Stage.FINISHED;

    if (features.isFailure) {
      test.statusDetails = {
        message: features.failureSignature || 'Test failed',
        trace:   '',
      };
    }

    // ─── Parameters ───────────────────────────────────────────────────────────
    this.addParameters(test, features);

    // ─── Attachments ──────────────────────────────────────────────────────────
    this.addAttachments(rt, test, features);

    test.endTest();
    group.endGroup();
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private addParameters(test: AllureTest, f: FailureFeaturesV1): void {
    const params: [string, string][] = [
      ['obs.severity',           f.observabilitySeverity],
      ['obs.score',              String(f.observabilityScore)],
      ['obs.networkFailures',    String(f.networkFailureCount)],
      ['obs.consoleErrors',      String(f.consoleErrorCount)],
      ['obs.consoleWarnings',    String(f.consoleWarnCount)],
      ['obs.uncaughtExceptions', String(f.uncaughtExceptionCount)],
      ['obs.slowApiCalls',       String(f.slowApiCallCount)],
      ['obs.apiCalls',           String(f.apiCallCount)],
      ['obs.duplicateApiCalls',  String(f.duplicateApiCallCount)],
      ['obs.http4xx',            String(f.http4xxCount)],
      ['obs.http5xx',            String(f.http5xxCount)],
      ['obs.p95ApiMs',           String(f.p95ApiDuration)],
      ['obs.maxApiMs',           String(f.maxApiDuration)],
    ];

    if (f.isFailure) {
      params.push(
        ['failure.signature',     f.failureSignature],
        ['failure.bucket',        f.failureBucketHint],
        ['failure.category',      f.suspectedCategoryRule],
        ['failure.categoryScore', String(f.suspectedCategoryScore)],
      );
    }

    for (const [name, value] of params) {
      test.addParameter(name, value);
    }
  }

  private addAttachments(rt: AllureRuntime, test: AllureTest, f: FailureFeaturesV1): void {
    // 1. Summary JSON
    const summary = {
      spec:                  f.spec,
      test:                  f.test,
      module:                f.module,
      observabilitySeverity: f.observabilitySeverity,
      observabilityScore:    f.observabilityScore,
      observabilityReasons:  f.observabilityReasons,
      consoleErrorCount:     f.consoleErrorCount,
      consoleWarnCount:      f.consoleWarnCount,
      uncaughtExceptionCount: f.uncaughtExceptionCount,
      networkFailureCount:   f.networkFailureCount,
      apiCallCount:          f.apiCallCount,
      slowApiCallCount:      f.slowApiCallCount,
      duplicateApiCallCount: f.duplicateApiCallCount,
      http4xxCount:          f.http4xxCount,
      http5xxCount:          f.http5xxCount,
      p95ApiDuration:        f.p95ApiDuration,
      maxApiDuration:        f.maxApiDuration,
      topFailingEndpoint:    f.topFailingEndpoint,
      suspectedCategoryRule:  f.suspectedCategoryRule,
      suspectedCategoryScore: f.suspectedCategoryScore,
    };
    const summaryFile = rt.writeAttachment(JSON.stringify(summary, null, 2), { contentType: ContentType.JSON });
    test.addAttachment('observability-summary', { contentType: ContentType.JSON }, summaryFile);

    // 2. Full details JSON
    const edges    = this.obs.buildApiDependencyEdges().slice(0, this.env.obsDetailLimit);
    const consoles = this.obs.getConsoleSignals().slice(0, this.env.obsDetailLimit);
    const networks = this.obs.getNetworkFailures().slice(0, this.env.obsDetailLimit);
    const details  = { failureFeatures: f, dependencyEdges: edges, consoleSignals: consoles, networkFailures: networks };
    const detailsFile = rt.writeAttachment(JSON.stringify(details, null, 2), { contentType: ContentType.JSON });
    test.addAttachment('observability-details', { contentType: ContentType.JSON }, detailsFile);

    // 3. Raw failure features JSON
    const featuresFile = rt.writeAttachment(JSON.stringify(f, null, 2), { contentType: ContentType.JSON });
    test.addAttachment('failure-features-v1', { contentType: ContentType.JSON }, featuresFile);

    // 4. Custom HTML report
    const html      = this.buildHtml(f);
    const htmlFile  = rt.writeAttachment(html, { contentType: ContentType.HTML });
    test.addAttachment('observability-custom-report', { contentType: ContentType.HTML }, htmlFile);
  }

  // ─── HTML builder ─────────────────────────────────────────────────────────

  private buildHtml(f: FailureFeaturesV1): string {
    const consoleRows = this.obs.getConsoleSignals()
      .slice(0, 50)
      .map(s => [new Date(s.timestamp).toISOString(), s.level, s.type, esc(s.message).slice(0, 240)]);

    const networkRows = this.obs.getNetworkFailures()
      .slice(0, 50)
      .map(n => [new Date(n.timestamp).toISOString(), n.method, String(n.status), `${n.duration}ms`, n.type, esc(n.url).slice(0, 180)]);

    const edgeRows = this.obs.buildApiDependencyEdges()
      .slice(0, 30)
      .map(e => [e.page, e.method, esc(e.endpoint).slice(0, 180), String(e.calls), String(e.failures), `${e.avgDuration}ms`, `${e.maxDuration}ms`, String(e.slowCalls), e.isDuplicate ? '⚠ YES' : 'No']);

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333;margin:16px}
h1{font-size:18px;margin:0 0 12px}h2{font-size:15px;margin:20px 0 8px}
table{border-collapse:collapse;width:100%;margin-bottom:16px}
th,td{border:1px solid #ddd;padding:5px 9px;text-align:left;font-size:11.5px}
th{background:#f5f5f5;font-weight:700}tr:nth-child(even){background:#fafafa}
.sev-HIGH{color:#c62828;font-weight:700}.sev-MEDIUM{color:#e65100;font-weight:700}
.sev-LOW{color:#2e7d32}.sev-NONE{color:#777}
ul{margin:4px 0 10px;padding-left:18px}li{margin:2px 0}
</style></head><body>
<h1>🔭 Observability Report — ${esc(f.test)}</h1>
<ul>
  <li><strong>Spec:</strong> ${esc(f.spec)}</li>
  <li><strong>Module:</strong> ${esc(f.module)}</li>
  <li><strong>Status:</strong> ${f.testStatus}</li>
  <li><strong>Severity:</strong> <span class="sev-${f.observabilitySeverity}">${f.observabilitySeverity} (score: ${f.observabilityScore})</span></li>
  <li><strong>Suspected Category:</strong> ${esc(f.suspectedCategoryRule)} (${f.suspectedCategoryScore})</li>
  <li><strong>Reasons:</strong> ${f.observabilityReasons.join('; ')}</li>
</ul>

<h2>📡 API Dependency Map (${edgeRows.length} edges)</h2>
${htmlTable(['Page', 'Method', 'Endpoint', 'Calls', 'Failures', 'Avg', 'Max', 'Slow', 'Duplicate?'], edgeRows)}

<h2>🖥 Console Signals (${consoleRows.length})</h2>
${htmlTable(['Timestamp', 'Level', 'Type', 'Message'], consoleRows)}

<h2>🌐 Network Failures (${networkRows.length})</h2>
${htmlTable(['Timestamp', 'Method', 'Status', 'Duration', 'Type', 'URL'], networkRows)}

</body></html>`;
  }
}

// ─── Module-level helpers ─────────────────────────────────────────────────────

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, ' ').trim();
}

function htmlTable(headers: string[], rows: string[][]): string {
  const thead = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
  if (!rows.length) {
    return `<table>${thead}<tbody><tr><td colspan="${headers.length}"><em>No data</em></td></tr></tbody></table>`;
  }
  const tbody = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `<table>${thead}<tbody>${tbody}</tbody></table>`;
}
