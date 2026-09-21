import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';
import en from '../src/lib/i18n/locales/en.ts';
import ja from '../src/lib/i18n/locales/ja.ts';

// Exercise the actual paywall handlers and rendered element tree. No store calls.
const source = readFileSync(new URL('../src/components/PremiumPaywall.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function loadPaywall(t, { configured = true, initial = {}, restore } = {}) {
  const state = [];
  const timers = [];
  let cursor = 0;
  let activations = 0;
  let restores = 0;
  const premium = {
    availability: 'ready', isPremium: false, plans: [], busy: false,
    ...initial,
    restore: async () => {
      restores++;
      premium.busy = true;
      try {
        const result = await restore();
        if (result.status === 'success') premium.isPremium = true;
        return result;
      } finally { premium.busy = false; }
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    document: { body: {} },
    window: { setTimeout: (callback) => { timers.push(callback); } },
    require: (id) => {
      if (id === 'react/jsx-runtime') return jsxRuntime;
      if (id === 'react') return {
        useEffect: () => {},
        useMemo: (compute) => compute(),
        useState: (initialValue) => {
          const index = cursor++;
          if (!(index in state)) state[index] = initialValue;
          return [state[index], value => { state[index] = value; }];
        },
      };
      if (id === 'react-dom') return { createPortal: children => children };
      if (id === 'next/image') return { default: 'img' };
      if (id === 'framer-motion') return { AnimatePresence: 'fragment', motion: { div: 'div', section: 'section' } };
      if (id === 'lucide-react') return new Proxy({}, { get: () => 'svg' });
      if (id === '@/lib/i18n/LanguageContext') return { useLanguage: () => ({ t }) };
      if (id === '@/lib/premium/PremiumContext') return { usePremium: () => premium };
      if (id === '@/lib/purchases') return {
        hasRevenueCatConfiguration: () => configured, isRevenueCatTestStoreBuild: () => false,
      };
      if (id === './PremiumPaywall.module.css') return { default: new Proxy({}, { get: (_, key) => key }) };
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  return {
    render: () => {
      cursor = 0;
      return exports.default({ open: true, onClose: () => {}, onActivated: () => { activations++; } });
    },
    premium, timers,
    get activations() { return activations; },
    get restores() { return restores; },
  };
}

function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('');
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  return tree && typeof tree === 'object' ? text(tree.props?.children) : '';
}
const restoreButton = tree => nodes(tree).find(node => node.type === 'button' && node.props.className === 'restoreButton');

for (const t of [en, ja]) {
  for (const availability of ['ready', 'error']) {
    const page = loadPaywall(t, { initial: { availability } });
    assert.equal(restoreButton(page.render()).props.disabled, false,
      'restore remains available without products, including after loading fails');
  }
  assert.equal(restoreButton(loadPaywall(t, { initial: { availability: 'loading' } }).render()).props.disabled, true);
  assert.equal(restoreButton(loadPaywall(t, { configured: false }).render()).props.disabled, true);
  assert.equal(restoreButton(loadPaywall(t, { initial: { isPremium: true } }).render()), undefined,
    'Plus users do not see a restore button');

  let completeRestore;
  const page = loadPaywall(t, { restore: () => new Promise(resolve => { completeRestore = resolve; }) });
  const pending = restoreButton(page.render()).props.onClick();
  const restoring = restoreButton(page.render());
  assert.equal(restoring.props.disabled, true);
  assert.equal(text(restoring), t.premium.restoring);
  assert.equal(page.restores, 1);
  completeRestore({ status: 'success', isPremium: true });
  await pending;
  const success = page.render();
  assert.equal(restoreButton(success), undefined);
  assert.ok(nodes(success).some(node => node.props.role === 'status' && text(node) === t.premium.restoreSuccess),
    'restoration success stays visible after Plus becomes active');
  assert.equal(page.activations, 1);
  assert.equal(page.timers.length, 1);

  for (const [status, expected] of [
    ['not-entitled', t.premium.restoreNotFound],
    ['error', t.premium.restoreError],
    ['cancelled', null],
  ]) {
    const failed = loadPaywall(t, { restore: async () => ({ status, isPremium: false }) });
    await restoreButton(failed.render()).props.onClick();
    const result = failed.render();
    if (expected) assert.ok(nodes(result).some(node => node.props.role === 'status' && text(node) === expected));
    assert.equal(restoreButton(result).props.disabled, false, 'another attempt remains possible');
    assert.equal(failed.premium.isPremium, false);
    assert.equal(failed.activations, 0);
    assert.equal(failed.timers.length, 0);
  }
}
console.log('Paywall restore passed in English/Japanese: recovery after loading failure, progress, success, missing purchases, failure, cancellation, and hidden controls for Plus.');
