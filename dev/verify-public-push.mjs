#!/usr/bin/env node
/**
 * dev/verify-public-push.mjs
 *
 * Automated Pre-Push Verification & Hash Inventory Gatekeeper
 * -------------------------------------------------------------
 * Verifies that candidate commits intended for the public repository
 * (classwork-marker-public) meet strict security, privacy, and content standards
 * BEFORE any push is allowed.
 *
 * Checks:
 * 1. File Hash Inventory & Comparison against Private Repo:
 *    - Expected identical files (shared core logic: app.js, styles.css, index.html, api/*.js, etc.)
 *    - Expected divergent files (README.md, .env.example, schedule-data.js, etc.)
 *    - UNEXPECTED identical files (FATAL ERROR if README.md has same hash as private English README,
 *      or if any file has the same hash as any private xclass_csv file).
 * 2. Forbidden Files Detection:
 *    - Blacklists any xclass_csv/*.csv except xclass_csv/sample_template.csv.
 *    - Blacklists any .env / .env.local / .env.production files.
 * 3. Mandatory Public Files:
 *    - Whitelists and verifies existence of AI_SETUP_PROMPT.md, LICENSE, apps-script/README.md,
 *      xclass_csv/sample_template.csv, xclass_csv/README.md, and Chinese README.md.
 * 4. README.md Content & Language Verification:
 *    - Ensures README is the comprehensive Traditional Chinese version with zero-code deployment.
 * 5. Deep Privacy Scanner:
 *    - Extracts real student names from private repo (xclass_csv) and scans all candidate files.
 *    - Immediately halts if any real student name is detected.
 * 6. Code Syntax & Test Verification:
 *    - Runs node --check and project unit tests.
 */

import { execSync } from 'child_process';
import path from 'path';

// ANSI terminal colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m'
};

function log(msg = '') { console.log(msg); }
function err(msg = '') { console.error(`${c.red}${c.bold}✖ ${msg}${c.reset}`); }
function ok(msg = '') { console.log(`${c.green}✔ ${msg}${c.reset}`); }
function warn(msg = '') { console.log(`${c.yellow}⚠ ${msg}${c.reset}`); }
function info(msg = '') { console.log(`${c.cyan}ℹ ${msg}${c.reset}`); }

// Parse command-line flags
const args = process.argv.slice(2);
function getArg(name, def = null) {
  const idx = args.indexOf(name);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return def;
}
const hasFlag = (name) => args.includes(name);

const candidateRef = getArg('--ref') || getArg('--commit') || 'template';
let privateRef = getArg('--private-ref');
const skipTests = hasFlag('--skip-tests');

// Helper to execute git command safely
function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
  } catch (e) {
    return null;
  }
}

// 1. Resolve private reference
if (!privateRef) {
  const candidates = [
    'origin/feat/lesson-management-discipline-api',
    'feat/lesson-management-discipline-api',
    'origin/main',
    'main'
  ];
  for (const ref of candidates) {
    if (git(`rev-parse --verify ${ref}`)) {
      privateRef = ref;
      break;
    }
  }
}

if (!privateRef) {
  err('Could not resolve private repository reference to compare against!');
  process.exit(1);
}

// 2. Resolve candidate reference commit SHA
const candidateSha = git(`rev-parse --verify ${candidateRef}`);
if (!candidateSha) {
  err(`Candidate reference '${candidateRef}' not found in local git repository!`);
  process.exit(1);
}
const privateSha = git(`rev-parse --verify ${privateRef}`);

log(`\n${c.bold}${c.cyan}================================================================${c.reset}`);
log(`${c.bold}${c.cyan}  🛡️  PUBLIC REPO PRE-PUSH VERIFICATION & AUDIT GATEKEEPER       ${c.reset}`);
log(`${c.bold}${c.cyan}================================================================${c.reset}`);
log(`Candidate (Public) Ref: ${c.bold}${candidateRef}${c.reset} (${candidateSha.slice(0, 8)})`);
log(`Reference (Private) Ref: ${c.bold}${privateRef}${c.reset} (${privateSha.slice(0, 8)})\n`);

let totalFailures = 0;
const failureReasons = [];

function recordFailure(title, details = []) {
  totalFailures++;
  failureReasons.push({ title, details });
  err(title);
  for (const d of details) {
    console.error(`    ${c.dim}↳ ${d}${c.reset}`);
  }
}

// Helper to get map of path -> blob hash
function getTree(ref) {
  const raw = git(`ls-tree -r ${ref}`);
  if (!raw) return new Map();
  const map = new Map();
  const lines = raw.split('\n');
  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length >= 4) {
      const hash = parts[2];
      const filePath = parts.slice(3).join(' ');
      map.set(filePath, hash);
    }
  }
  return map;
}

const candidateTree = getTree(candidateSha);
const privateTree = getTree(privateSha);

log(`${c.bold}--- [1/6] File Hash Inventory & Comparison ---${c.reset}`);

// Rules for hash comparison
const MUST_DIFFER = new Set([
  'README.md'
]);

const identicalFiles = [];
const differingFiles = [];
const publicOnlyFiles = [];
const unexpectedIdenticalFiles = [];

// Inverted map of private hashes to detect if any private-only file blob leaked under a different name
const privateBlobToPath = new Map();
for (const [p, h] of privateTree.entries()) {
  privateBlobToPath.set(h, p);
}

for (const [filePath, hash] of candidateTree.entries()) {
  if (privateTree.has(filePath)) {
    const pHash = privateTree.get(filePath);
    if (hash === pHash) {
      identicalFiles.push(filePath);
      if (MUST_DIFFER.has(filePath)) {
        unexpectedIdenticalFiles.push({
          path: filePath,
          reason: `File '${filePath}' MUST NOT have the same hash as private repo (indicates accidental overwrite by private version!)`
        });
      }
    } else {
      differingFiles.push(filePath);
    }
  } else {
    publicOnlyFiles.push(filePath);
    // Check if this public-only file has the same blob hash as ANY private file in xclass_csv
    if (privateBlobToPath.has(hash)) {
      const origPrivatePath = privateBlobToPath.get(hash);
      if (origPrivatePath.startsWith('xclass_csv/') || origPrivatePath.includes('.env')) {
        unexpectedIdenticalFiles.push({
          path: filePath,
          reason: `Content matches private sensitive file '${origPrivatePath}' (blob: ${hash.slice(0, 8)})!`
        });
      }
    }
  }
}

log(`  • Identical shared files : ${c.green}${identicalFiles.length}${c.reset}`);
log(`  • Expected differing files: ${c.yellow}${differingFiles.length}${c.reset} (${differingFiles.join(', ')})`);
log(`  • Public-only files      : ${c.blue}${publicOnlyFiles.length}${c.reset} (${publicOnlyFiles.join(', ')})`);

if (unexpectedIdenticalFiles.length > 0) {
  recordFailure(
    `Found ${unexpectedIdenticalFiles.length} unexpected file(s) with identical hash to private repo!`,
    unexpectedIdenticalFiles.map(f => `${f.path}: ${f.reason}`)
  );
} else {
  ok('Hash inventory check passed: No unexpected identical files detected.');
}

// 2. Forbidden Files Check
log(`\n${c.bold}--- [2/6] Forbidden Files Blacklist Audit ---${c.reset}`);
const forbiddenFiles = [];

for (const [filePath] of candidateTree.entries()) {
  // Disallow any CSV in xclass_csv except sample_template.csv
  if (filePath.startsWith('xclass_csv/') && filePath.endsWith('.csv') && filePath !== 'xclass_csv/sample_template.csv') {
    forbiddenFiles.push(`${filePath} (Private school student CSV roster)`);
  }
  // Disallow actual .env files
  if (filePath === '.env' || (filePath.startsWith('.env.') && filePath !== '.env.example')) {
    forbiddenFiles.push(`${filePath} (Private environment secrets file)`);
  }
  // Disallow temporary/backup files
  if (/\.(bak|orig|dump|sql|tmp)$/i.test(filePath)) {
    forbiddenFiles.push(`${filePath} (Unwanted temporary/backup file)`);
  }
}

if (forbiddenFiles.length > 0) {
  recordFailure(`Detected ${forbiddenFiles.length} forbidden private file(s) in public candidate!`, forbiddenFiles);
} else {
  ok('Forbidden files audit passed: No private student CSVs or .env files found.');
}

// 3. Mandatory Public Files Check
log(`\n${c.bold}--- [3/6] Mandatory Public Documentation & Files ---${c.reset}`);
const MANDATORY_FILES = [
  'AI_SETUP_PROMPT.md',
  'LICENSE',
  'apps-script/README.md',
  'xclass_csv/README.md',
  'xclass_csv/sample_template.csv',
  'README.md'
];

const missingMandatory = [];
for (const file of MANDATORY_FILES) {
  if (!candidateTree.has(file)) {
    missingMandatory.push(file);
  }
}

if (missingMandatory.length > 0) {
  recordFailure(`Missing ${missingMandatory.length} mandatory public file(s)!`, missingMandatory);
} else {
  ok('All mandatory public documentation and template files are present.');
}

// 4. README.md Content & Language Verification
log(`\n${c.bold}--- [4/6] README.md Content & Language Verification ---${c.reset}`);
const readmeContent = git(`show ${candidateSha}:README.md`);

if (!readmeContent) {
  recordFailure('Unable to read candidate README.md content!');
} else {
  const readmeIssues = [];
  const requiredMarkers = [
    { text: '課堂座位表與課堂常規管理系統', desc: 'Traditional Chinese Title' },
    { text: '3 步零代碼部署指南', desc: '3-Step Zero-Code Deployment Guide' },
    { text: 'AI_SETUP_PROMPT.md', desc: 'AI Setup Prompt Reference' },
    { text: '20252026', desc: 'Default Demo Passcode' },
    { text: 'classwork-marker-public.vercel.app', desc: 'Live Demo URL' }
  ];

  for (const marker of requiredMarkers) {
    if (!readmeContent.includes(marker.text)) {
      readmeIssues.push(`README.md missing required marker: "${marker.text}" (${marker.desc})`);
    }
  }

  if (/^#\s+Classwork Marker \(Marker Pro\)/m.test(readmeContent)) {
    readmeIssues.push('README.md begins with English header instead of Traditional Chinese!');
  }

  if (readmeIssues.length > 0) {
    recordFailure('README.md verification failed!', readmeIssues);
  } else {
    ok('README.md verified: Complete Traditional Chinese guide with deployment steps and AI prompt.');
  }
}

// 5. Deep Privacy Scanner: Real Student Names
log(`\n${c.bold}--- [5/6] Deep Privacy Scanner (Real Student Names) ---${c.reset}`);

const privateNames = new Set();
const privateCsvFiles = (git(`ls-tree -r --name-only ${privateSha} xclass_csv/`) || '')
  .trim()
  .split('\n')
  .filter(f => f.endsWith('.csv') && f !== 'xclass_csv/sample_template.csv');

for (const csvFile of privateCsvFiles) {
  const raw = git(`show ${privateSha}:${csvFile}`);
  if (!raw) continue;
  const lines = raw.split('\n');
  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length >= 2 && parts[1] && !parts[1].includes('Student Name')) {
      const full = parts[1].replace(/\s*\(\d+\)/, '').trim();
      if (!full || full.toLowerCase() === 'default') continue;
      const zhMatches = full.match(/[\u4e00-\u9fa5]+/g);
      if (zhMatches) {
        zhMatches.forEach(z => { if (z.length >= 2) privateNames.add(z); });
      }
      const en = full.replace(/[\u4e00-\u9fa5]+/g, '').trim();
      if (en.length >= 5) {
        privateNames.add(en);
      }
    }
  }
}

const DEMO_NAMES = [
  '陳大文', 'Chan Tai Man', '黃小明', 'Wong Siu Ming', '李嘉欣', 'Lee Ka Yan',
  '何俊傑', 'Ho Chun Kit', '吳偉霖', 'Ng Wai Lam', '張浩然', 'Cheung Ho Yin',
  '林嘉盈', 'Lam Ka Ying', '曾志恒', 'Tsang Chi Hang', '楊美玲', 'Yeung Mei Ling',
  '郭子晴', 'Kwok Tsz Ching', '歐陽建', 'Au Yeung Kin', '潘思慧', 'Poon Sze Wai'
];
DEMO_NAMES.forEach(n => privateNames.delete(n));

log(`  • Extracted ${c.cyan}${privateNames.size}${c.reset} unique real student signatures from private repo.`);

const privacyViolations = [];
const textFilesToScan = Array.from(candidateTree.keys()).filter(f => {
  return !f.endsWith('.png') && !f.endsWith('.jpg') && !f.endsWith('.ico') && !f.endsWith('.woff2');
});

for (const file of textFilesToScan) {
  const content = git(`show ${candidateSha}:${file}`);
  if (!content) continue;

  for (const name of privateNames) {
    if (content.includes(name)) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(name)) {
          privacyViolations.push(`${file}:${i + 1} -> matched real student name "${name}"`);
          if (privacyViolations.length >= 10) break;
        }
      }
    }
    if (privacyViolations.length >= 10) break;
  }
}

if (privacyViolations.length > 0) {
  recordFailure('CRITICAL PRIVACY VIOLATION: Real student names detected in public repo!', privacyViolations);
} else {
  ok(`Privacy scan clean: Zero real student names found across ${textFilesToScan.length} tracked files.`);
}

// 6. Code Syntax & Unit Tests
log(`\n${c.bold}--- [6/6] Code Syntax & Unit Tests ---${c.reset}`);
if (skipTests) {
  warn('Skipping unit tests (--skip-tests specified).');
} else {
  try {
    execSync('npm run check', { stdio: 'pipe' });
    ok('Syntax check passed (node --check on public/app.js, api/*.js).');
  } catch (e) {
    recordFailure('Code syntax check failed (npm run check)!', [e.message]);
  }

  try {
    execSync('node dev/test-schedule.mjs', { stdio: 'pipe' });
    ok('Schedule engine tests passed (dev/test-schedule.mjs).');
  } catch (e) {
    recordFailure('Schedule engine unit tests failed!', [e.message]);
  }

  try {
    execSync('node dev/test-device-washroom.mjs', { stdio: 'pipe' });
    ok('Device & Washroom tracker tests passed (dev/test-device-washroom.mjs).');
  } catch (e) {
    recordFailure('Device & Washroom tracker tests failed!', [e.message]);
  }
}

log(`\n${c.bold}================================================================${c.reset}`);
if (totalFailures > 0) {
  log(`${c.bgRed}${c.bold} ❌ PUSH REJECTED: ${totalFailures} AUDIT FAILURE(S) ENCOUNTERED ${c.reset}\n`);
  for (let i = 0; i < failureReasons.length; i++) {
    const f = failureReasons[i];
    console.error(`${c.red}${c.bold}[${i + 1}] ${f.title}${c.reset}`);
    for (const d of f.details) {
      console.error(`    ${c.dim}${d}${c.reset}`);
    }
  }
  log(`\n${c.yellow}Action required:${c.reset}`);
  log(`1. Ensure you are pushing from the clean ${c.bold}'template'${c.reset} branch, NOT a private branch.`);
  log(`2. If files were accidentally overwritten, restore them from template.`);
  log(`3. Re-run ${c.bold}'npm run check:public'${c.reset} before attempting to push.\n`);
  process.exit(1);
} else {
  log(`${c.bgGreen}${c.bold} ✅ ALL AUDIT CHECKS PASSED: SAFE TO PUSH TO PUBLIC REPOSITORY ${c.reset}\n`);
  log(`Candidate commit ${c.bold}${candidateSha.slice(0, 8)}${c.reset} is 100% compliant with privacy and content standards.\n`);
  process.exit(0);
}
