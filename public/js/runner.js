// ═══════════════════════════════════════════════════════════════════════
// RUNNER: Hidden iframe runner (runner.html)
// ═══════════════════════════════════════════════════════════════════════

import { extractCodeParam, decodeWTPCode } from './utils.js';
import { WTPRunner } from './wtp-runner.js';

let consoleOutput = '';
let hasError = false;
let projectId = null;
let wtpRunner = null;

const wtpIframe = document.getElementById('wtp-iframe');

// ═══════════════════════════════════════════════════════════════════════
// Message handler for parent page
// ═══════════════════════════════════════════════════════════════════════

window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'runner_run') {
    projectId = e.data.projectId;
    startRun(e.data.url);
  }
});

// ═══════════════════════════════════════════════════════════════════════
// Run function
// ═══════════════════════════════════════════════════════════════════════

function startRun(url) {
  consoleOutput = '';
  hasError = false;

  // Clean up old runner
  if (wtpRunner) {
    wtpRunner.destroy();
    wtpRunner = null;
  }

  // Extract files
  const files = decodeWTPCode(url);
  if (!files) {
    window.parent.postMessage({
      type: 'runner_done',
      projectId,
      consoleOutput: '(Code konnte nicht dekodiert werden)',
      hasError: true
    }, '*');
    return;
  }

  // Create runner
  wtpRunner = new WTPRunner(wtpIframe);

  wtpRunner
    .on('ready', () => {
      wtpRunner.sendCode(files);
    })
    .on('output', (text) => {
      consoleOutput += text;
    })
    .on('error', (text) => {
      hasError = true;
      consoleOutput += text;
    })
    .on('complete', (text) => {
      consoleOutput += text;
      window.parent.postMessage({
        type: 'runner_done',
        projectId,
        consoleOutput: consoleOutput.trim(),
        hasError
      }, '*');
    });

  wtpRunner.load();
}
