import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { selectRevenueCatApiKey } from '../src/lib/premium/revenueCatConfig.ts';

// Exercise the real purchases entry points with a recording SDK. No store/network calls.
const purchasesSource = readFileSync(new URL('../src/lib/purchases.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(purchasesSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function loadPurchases(platform, env = {}, debug = false) {
  const calls = [];
  const customerInfo = { entitlements: { active: {} } };
  const Purchases = new Proxy({}, {
    get: (_, method) => async (options) => {
      calls.push({ method, options });
      switch (method) {
        case 'isConfigured': return { isConfigured: false };
        case 'getCustomerInfo': return { customerInfo };
        case 'getOfferings': return { current: null };
        case 'addCustomerInfoUpdateListener': return 'listener';
        default: return undefined;
      }
    },
  });
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, window: {}, process: { env }, console,
    require: (id) => {
      if (id === '@capacitor/core') return { Capacitor: {
        DEBUG: debug, getPlatform: () => platform, isNativePlatform: () => platform !== 'web',
      } };
      if (id === '@revenuecat/purchases-capacitor') return {
        Purchases, ENTITLEMENT_VERIFICATION_MODE: { INFORMATIONAL: 'INFORMATIONAL' },
        VERIFICATION_RESULT: { FAILED: 'FAILED' }, PACKAGE_TYPE: {}, PURCHASES_ERROR_CODE: {},
      };
      if (id === '@/lib/user') return { getOrCreateClientUserId: () => 'test-client' };
      if (id === '@/lib/premium/revenueCatConfig') return { selectRevenueCatApiKey };
      throw new Error('Unexpected module: ' + id);
    },
  });
  return { api: exports, calls };
}

for (const platform of ['ios', 'android']) {
  const debug = loadPurchases(platform, {
    NODE_ENV: 'production', NEXT_PUBLIC_REVENUECAT_TEST_API_KEY: 'test_showcase',
  }, true);
  assert.equal(debug.api.hasRevenueCatConfiguration(), true);
  await debug.api.getPremiumSnapshot();
  assert.equal(debug.calls.find(call => call.method === 'configure')?.options.apiKey, 'test_showcase');

  const release = loadPurchases(platform, {
    NODE_ENV: 'production', NEXT_PUBLIC_REVENUECAT_TEST_API_KEY: 'test_showcase',
  }, false);
  assert.equal(release.api.hasRevenueCatConfiguration(), false);
  assert.equal(release.calls.length, 0, `${platform}: Release must never configure Test Store`);
}

for (const platform of ['ios', 'android']) {
  const envName = platform === 'ios' ? 'NEXT_PUBLIC_REVENUECAT_IOS_API_KEY' : 'NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY';
  const otherKey = platform === 'ios' ? 'goog_example' : 'appl_example';
  for (const badKey of [undefined, '', 'test_example', otherKey, 'sk_example', 'appl_XXXXX', 'goog_XXXXX']) {
    const { api, calls } = loadPurchases(platform, {
      NODE_ENV: 'production', NEXT_PUBLIC_REVENUECAT_TEST_API_KEY: 'test_example', [envName]: badKey,
    });
    assert.equal(api.hasRevenueCatConfiguration(), false);
    const snapshot = await api.getPremiumSnapshot();
    assert.equal(snapshot.availability, 'unconfigured');
    assert.equal(snapshot.isPremium, false);
    assert.equal((await api.purchasePremium()).status, 'unavailable');
    assert.equal((await api.restorePremiumPurchases()).status, 'unavailable');
    (await api.subscribeToPremiumStatus(() => {}))();
    await api.trackPremiumPaywallImpression();
    assert.equal(calls.length, 0, `${platform}: invalid/test key must never reach native SDK`);
  }
  const platformKey = platform === 'ios' ? 'appl_example' : 'goog_example';
  const { api, calls } = loadPurchases(platform, { NODE_ENV: 'production', [envName]: ' ' + platformKey + ' ' });
  await Promise.all([api.getPremiumSnapshot(), api.subscribeToPremiumStatus(() => {})]);
  const configured = calls.filter(call => call.method === 'configure');
  assert.equal(configured.length, 1, 'concurrent startup must configure only once');
  assert.equal(configured[0].options.apiKey, platformKey);
}
const web = loadPurchases('web', { NEXT_PUBLIC_REVENUECAT_IOS_API_KEY: 'appl_example' });
assert.equal((await web.api.getPremiumSnapshot()).availability, 'web');
assert.equal(web.calls.length, 0);
console.log('Native purchase startup: Test Store is Debug-only; Release rejects test/wrong/missing keys; platform keys configure once.');
