const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert(script.includes('function installCompleteDemoSuiteV321B()'), 'complete demo installer missing');
assert(script.includes('function deleteCompleteDemoSuiteV321B()'), 'complete demo deleter missing');
assert(script.includes('DEMO_SUITE_VERSION_V321B'), 'demo suite marker missing');
assert(script.includes('PLC-DEMO-'), 'demo account numbers missing');
assert(script.includes('INV-DEMO-'), 'demo invoice numbers missing');
assert(script.includes('Q-DEMO-'), 'demo quote numbers missing');
assert(script.includes('demoSuiteVersion'), 'safe demo marker missing');
assert(script.includes('MAINT_CALENDAR_KEY'), 'maintenance calendar coverage missing');
assert(script.includes('COMMUNICATION_USER_TEMPLATES_KEY_V321'), 'communication template coverage missing');
assert(script.includes('ACTIVITY_HISTORY_KEY_V320') || script.includes('activityHistoryV320'), 'history coverage missing');
assert(html.includes('Install Complete Demo Suite'), 'installer button label missing');
assert(html.includes('Delete Complete Demo Suite'), 'delete button label missing');
console.log('Complete demo suite focused checks passed.');
