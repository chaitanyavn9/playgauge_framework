/**
 * Gauge configuration for playgauge_framework.
 * Gauge reads this alongside env/<ENV>/default.properties.
 * Run: GAUGE_ENV=dev gauge run specs/
 */
module.exports = {
  // Gauge looks for step implementations under 'tests/'
  gauge_specs_dir: 'specs',
  gauge_reports_dir: 'dist/gauge-reports',
  screenshot_on_failure: true,
  logs_directory: 'dist/logs',
};
