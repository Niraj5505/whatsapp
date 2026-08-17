const cp = require('child_process');
const path = require('path');

const testSuites = [
  { name: 'Auth & Multi-Tenancy', file: 'unitAuth.test.js' },
  { name: 'Meta WhatsApp Cloud API v21.0', file: 'testWhatsAppService.test.js' },
  { name: 'Outbound Message Dispatch', file: 'testMessageEndpoint.test.js' },
  { name: 'Webhook Verification & HMAC', file: 'testWebhookFlow.test.js' },
  { name: 'Contact CRM & CSV Import/Export', file: 'testContactsSuite.test.js' },
  { name: 'Real-Time 3-Column Live Inbox', file: 'testConversationSuite.test.js' },
  { name: 'Automation Engine Triggers & Loop Guard', file: 'testAutomationEngineSuite.test.js' },
  { name: 'Visual Flow Builder & Validation', file: 'testBuilderSuite.test.js' },
  { name: 'Meta Template Management & Sync', file: 'testTemplateSuite.test.js' },
  { name: 'Broadcast Campaigns & Recipient Tracker', file: 'testCampaignSuite.test.js' },
  { name: 'MongoDB Aggregation Analytics Dashboard', file: 'testAnalyticsSuite.test.js' },
  { name: 'Enterprise Security Audit & Workspace Isolation', file: 'testSecurityAuditSuite.test.js' },
  { name: 'Complete WhatsApp Flow & Automation', file: 'testCompleteWhatsAppFlow.test.js' },
];

console.log('======================================================================');
console.log('🚀 NEXAFLOW COMPREHENSIVE END-TO-END TEST RUNNER');
console.log('======================================================================\n');

let passedCount = 0;
let failedCount = 0;
const results = [];

for (const suite of testSuites) {
  const filePath = path.join(__dirname, suite.file);
  console.log(`\n▶️ Running Suite: ${suite.name} (${suite.file})...`);
  try {
    cp.execSync(`node "${filePath}"`, { stdio: 'inherit' });
    passedCount++;
    results.push({ name: suite.name, status: 'PASSED' });
  } catch (err) {
    failedCount++;
    results.push({ name: suite.name, status: 'FAILED' });
  }
}

console.log('\n======================================================================');
console.log('📊 FINAL TEST EXECUTION SUMMARY');
console.log('======================================================================');

for (const res of results) {
  const symbol = res.status === 'PASSED' ? '✅' : '❌';
  console.log(`  ${symbol} ${res.name.padEnd(50)} [${res.status}]`);
}

console.log('======================================================================');
console.log(`  Total Suites: ${testSuites.length} | Passed: ${passedCount} | Failed: ${failedCount}`);

if (failedCount > 0) {
  console.error(`\n❌ ERROR: ${failedCount} test suite(s) failed.`);
  process.exit(1);
} else {
  console.log('\n🎉 ALL 12 TEST SUITES PASSED WITH 100% SUCCESS!');
  process.exit(0);
}
