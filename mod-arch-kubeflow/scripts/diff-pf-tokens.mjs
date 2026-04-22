import fs from 'fs';
import path from 'path';

const PF_64_DIR = process.argv[2];
const PF_65_DIR = process.argv[3];
const MUI_THEME_PATH = process.argv[4];
const SSOT_OUTPUT = process.argv[5];

if (!PF_64_DIR || !PF_65_DIR || !MUI_THEME_PATH) {
  console.error('Usage: node diff-pf-tokens.mjs <pf-6.4-react-styles> <pf-6.5-react-styles> <mui-theme.scss> [ssot-output-path]');
  process.exit(1);
}

function parseDeclarationsFromCSS(cssContent) {
  const tokens = {};
  const declRegex = /(--pf-(?:v6|t)-[a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = declRegex.exec(cssContent)) !== null) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

function buildSSOTFromReactStyles(reactStylesDir) {
  const ssot = { global: {}, components: {} };
  const componentsDir = path.join(reactStylesDir, 'css', 'components');

  if (!fs.existsSync(componentsDir)) {
    console.error(`  Components dir not found: ${componentsDir}`);
    return ssot;
  }

  const componentDirs = fs.readdirSync(componentsDir, { withFileTypes: true });
  for (const dir of componentDirs) {
    if (!dir.isDirectory()) continue;
    const dirPath = path.join(componentsDir, dir.name);
    const cssFiles = fs.readdirSync(dirPath).filter(f => f.endsWith('.css'));

    for (const cssFile of cssFiles) {
      const cssPath = path.join(dirPath, cssFile);
      const content = fs.readFileSync(cssPath, 'utf-8');
      const tokens = parseDeclarationsFromCSS(content);
      const key = cssFile.replace('.css', '');

      if (Object.keys(tokens).length > 0) {
        for (const [token, value] of Object.entries(tokens)) {
          if (token.startsWith('--pf-v6-global-') || token.startsWith('--pf-t--global')) {
            ssot.global[token] = value;
          } else {
            if (!ssot.components[key]) ssot.components[key] = {};
            ssot.components[key][token] = value;
          }
        }
      }
    }
  }

  const baseDir = path.join(reactStylesDir, 'css', 'base');
  if (fs.existsSync(baseDir)) {
    const baseCSSFiles = fs.readdirSync(baseDir, { recursive: true })
      .filter(f => f.endsWith('.css'));
    for (const cssFile of baseCSSFiles) {
      const content = fs.readFileSync(path.join(baseDir, cssFile), 'utf-8');
      const tokens = parseDeclarationsFromCSS(content);
      for (const [token, value] of Object.entries(tokens)) {
        ssot.global[token] = value;
      }
    }
  }

  return ssot;
}

function flattenSSO(ssot) {
  const all = new Set();
  Object.keys(ssot.global).forEach(k => all.add(k));
  Object.values(ssot.components).forEach(comp =>
    Object.keys(comp).forEach(k => all.add(k))
  );
  return all;
}

function extractTokensFromSCSS(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const tokens = new Set();
  const regex = /--pf-(?:v6|t)-[a-zA-Z0-9_-]+/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    tokens.add(match[0]);
  }
  return tokens;
}

function extractThemedComponentsFromSCSS(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const components = new Set();
  const selectorRegex = /\.pf-v6-c-([a-zA-Z0-9-]+)/g;
  let match;
  while ((match = selectorRegex.exec(content)) !== null) {
    components.add(match[1]);
  }
  return components;
}

console.log('='.repeat(80));
console.log('PatternFly 6.4 → 6.5 Token Diff Report');
console.log('Source: @patternfly/react-styles/css/components/');
console.log('='.repeat(80));

console.log('\n📦 Building SSOT from PF 6.4 react-styles...');
const ssot64 = buildSSOTFromReactStyles(PF_64_DIR);
const tokens64 = flattenSSO(ssot64);
console.log(`   ${tokens64.size} tokens (${Object.keys(ssot64.global).length} global, ${Object.keys(ssot64.components).length} components)`);

console.log('\n📦 Building SSOT from PF 6.5 react-styles...');
const ssot65 = buildSSOTFromReactStyles(PF_65_DIR);
const tokens65 = flattenSSO(ssot65);
console.log(`   ${tokens65.size} tokens (${Object.keys(ssot65.global).length} global, ${Object.keys(ssot65.components).length} components)`);

console.log('\n🎨 Extracting MUI-theme.scss token references...');
const muiTokens = extractTokensFromSCSS(MUI_THEME_PATH);
console.log(`   ${muiTokens.size} token references`);

const removed = [...tokens64].filter(t => !tokens65.has(t));
const added = [...tokens65].filter(t => !tokens64.has(t));

console.log('\n' + '─'.repeat(80));
console.log('REMOVED TOKENS (in 6.4, not in 6.5)');
console.log('─'.repeat(80));
if (removed.length === 0) {
  console.log('  ✅ None');
} else {
  console.log(`  ⚠️  ${removed.length} tokens removed:\n`);
  removed.sort().forEach(t => console.log(`  - ${t}`));
}

console.log('\n' + '─'.repeat(80));
console.log('ADDED TOKENS (in 6.5, not in 6.4)');
console.log('─'.repeat(80));
if (added.length === 0) {
  console.log('  No new tokens');
} else {
  console.log(`  ${added.length} new tokens:\n`);
  added.sort().forEach(t => console.log(`  + ${t}`));
}

const brokenOverrides = removed.filter(t => muiTokens.has(t));
console.log('\n' + '═'.repeat(80));
console.log('🚨 CRITICAL: REMOVED TOKENS USED IN MUI-theme.scss');
console.log('═'.repeat(80));
if (brokenOverrides.length === 0) {
  console.log('  ✅ None — all MUI overrides are safe');
} else {
  console.log(`  🔴 ${brokenOverrides.length} broken overrides:\n`);
  brokenOverrides.sort().forEach(t => console.log(`  ❌ ${t}`));
}

const muiNotInNew = [...muiTokens].filter(t => !tokens65.has(t));
console.log('\n' + '─'.repeat(80));
console.log('⚠️  MUI-theme.scss tokens NOT FOUND in PF 6.5');
console.log('─'.repeat(80));
if (muiNotInNew.length === 0) {
  console.log('  ✅ All MUI token references exist in PF 6.5');
} else {
  console.log(`  ${muiNotInNew.length} orphaned references:\n`);
  muiNotInNew.sort().forEach(t => console.log(`  ⚠️  ${t}`));
}

const changedValues = [];
for (const [comp, tokens] of Object.entries(ssot64.components)) {
  if (!ssot65.components[comp]) continue;
  for (const [token, oldVal] of Object.entries(tokens)) {
    const newVal = ssot65.components[comp]?.[token];
    if (newVal && newVal !== oldVal && muiTokens.has(token)) {
      changedValues.push({ token, component: comp, oldVal, newVal });
    }
  }
}
for (const [token, oldVal] of Object.entries(ssot64.global)) {
  const newVal = ssot65.global[token];
  if (newVal && newVal !== oldVal && muiTokens.has(token)) {
    changedValues.push({ token, component: 'global', oldVal, newVal });
  }
}

console.log('\n' + '─'.repeat(80));
console.log('🔄 MUI-OVERRIDDEN TOKENS WITH CHANGED DEFAULT VALUES');
console.log('─'.repeat(80));
if (changedValues.length === 0) {
  console.log('  ✅ No value changes in MUI-overridden tokens');
} else {
  console.log(`  ${changedValues.length} tokens changed:\n`);
  changedValues.forEach(({ token, component, oldVal, newVal }) => {
    console.log(`  ${token} (${component})`);
    console.log(`    6.4: ${oldVal}`);
    console.log(`    6.5: ${newVal}`);
    console.log();
  });
}

console.log('\n🔍 Extracting MUI-themed PF component selectors...');
const muiThemedComponents = extractThemedComponentsFromSCSS(MUI_THEME_PATH);
console.log(`   ${muiThemedComponents.size} PF components themed`);

const newTokensOnThemedComponents = [];
for (const comp of muiThemedComponents) {
  const compTokens64 = ssot64.components[comp] || {};
  const compTokens65 = ssot65.components[comp] || {};
  const oldKeys = new Set(Object.keys(compTokens64));
  for (const [token, value] of Object.entries(compTokens65)) {
    if (!oldKeys.has(token)) {
      newTokensOnThemedComponents.push({ token, component: comp, value });
    }
  }
  for (const [key65, comp65Tokens] of Object.entries(ssot65.components)) {
    if (key65 === comp) continue;
    if (!key65.startsWith(comp)) continue;
    const comp64Tokens = ssot64.components[key65] || {};
    const oldSubKeys = new Set(Object.keys(comp64Tokens));
    for (const [token, value] of Object.entries(comp65Tokens)) {
      if (!oldSubKeys.has(token)) {
        newTokensOnThemedComponents.push({ token, component: key65, value });
      }
    }
  }
}

console.log('\n' + '─'.repeat(80));
console.log('🆕 NEW TOKENS ON MUI-THEMED COMPONENTS');
console.log('   (added in 6.5 to components MUI-theme.scss already overrides)');
console.log('─'.repeat(80));
if (newTokensOnThemedComponents.length === 0) {
  console.log('  ✅ No new tokens on themed components');
} else {
  console.log(`  ${newTokensOnThemedComponents.length} new tokens to review:\n`);
  const byComponent = {};
  for (const { token, component, value } of newTokensOnThemedComponents) {
    if (!byComponent[component]) byComponent[component] = [];
    byComponent[component].push({ token, value });
  }
  for (const [comp, entries] of Object.entries(byComponent).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  .pf-v6-c-${comp}  (${entries.length} new tokens)`);
    entries.sort((a, b) => a.token.localeCompare(b.token));
    for (const { token, value } of entries) {
      console.log(`    + ${token}: ${value}`);
    }
    console.log();
  }
}

console.log('\n' + '═'.repeat(80));
console.log('SUMMARY');
console.log('═'.repeat(80));
console.log(`  PF 6.4 tokens:              ${tokens64.size}`);
console.log(`  PF 6.5 tokens:              ${tokens65.size}`);
console.log(`  Removed:                    ${removed.length}`);
console.log(`  Added:                      ${added.length}`);
console.log(`  MUI overrides:              ${muiTokens.size}`);
console.log(`  Broken MUI overrides:       ${brokenOverrides.length}`);
console.log(`  Orphaned MUI refs:          ${muiNotInNew.length}`);
console.log(`  Changed MUI default values: ${changedValues.length}`);
console.log(`  New tokens on themed comps: ${newTokensOnThemedComponents.length}`);
console.log('');

if (SSOT_OUTPUT) {
  fs.writeFileSync(SSOT_OUTPUT, JSON.stringify(ssot65, null, 4));
  console.log(`📄 PF 6.5 SSOT written to: ${SSOT_OUTPUT}`);
}
