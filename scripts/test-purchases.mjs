import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { selectRevenueCatApiKey } from '../src/lib/premium/revenueCatConfig.ts';
import { verifyFilmingPassword } from '../src/lib/premium/filmingAccess.ts';

// Exercise the real purchases entry points with a recording SDK. No store/network calls.
const purchasesSource = readFileSync(new URL('../src/lib/purchases.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(purchasesSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function loadPurchases(platform, env = {}, debug = false, options = {}) {
  const calls = [];
  const customerInfo = options.customerInfo || { entitlements: { active: {} } };
  const Purchases = new Proxy({}, {
    get: (_, method) => async (methodOptions) => {
      calls.push({ method, options: methodOptions });
      if (options.errors?.[method]) throw options.errors[method];
      switch (method) {
        case 'isConfigured': return { isConfigured: false };
        case 'getCustomerInfo': return { customerInfo };
        case 'getOfferings': return options.offerings || { current: null, all: {} };
        case 'purchasePackage': return options.purchaseResult || { customerInfo, productIdentifier: 'test_plus_monthly' };
        case 'restorePurchases': return options.restoreResult || { customerInfo };
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
        VERIFICATION_RESULT: { FAILED: 'FAILED' }, PACKAGE_TYPE: {},
        PURCHASES_ERROR_CODE: { PURCHASE_CANCELLED_ERROR: 'CANCELLED', PAYMENT_PENDING_ERROR: 'PENDING' },
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

  const testEntitlement = {
    entitlements: {
      active: { automatically_created_test_access: { isActive: true, verification: 'VERIFIED' } },
      verification: 'VERIFIED',
    },
  };
  const debugEntitled = loadPurchases(platform, {
    NODE_ENV: 'production', NEXT_PUBLIC_REVENUECAT_TEST_API_KEY: 'test_showcase',
  }, true, {
    customerInfo: testEntitlement,
    offerings: { current: null, all: { test: { identifier: 'test', availablePackages: [] } } },
  });
  const debugSnapshot = await debugEntitled.api.getPremiumSnapshot();
  assert.equal(debugSnapshot.isPremium, true, 'Debug Test Store accepts an active test entitlement');
  assert.equal(debugSnapshot.offeringId, 'test', 'falls back to an existing offering when current is unset');

  const testPurchaseWithoutEntitlement = loadPurchases(platform, {
    NODE_ENV: 'production', NEXT_PUBLIC_REVENUECAT_TEST_API_KEY: 'test_showcase',
  }, true, {
    customerInfo: {
      entitlements: { active: {}, verification: 'VERIFIED' },
      activeSubscriptions: ['test_plus_monthly'],
      allPurchasedProductIdentifiers: ['test_plus_monthly'],
      nonSubscriptionTransactions: [],
    },
    offerings: {
      current: {
        identifier: 'test',
        availablePackages: [{ identifier: '$rc_monthly', packageType: 'MONTHLY', product: {
          identifier: 'test_plus_monthly', title: 'Plus', description: 'Plus', price: 1,
          priceString: '$1.00', pricePerMonthString: '$1.00', subscriptionPeriod: 'P1M',
        } }],
      },
      all: {},
    },
  });
  assert.equal((await testPurchaseWithoutEntitlement.api.getPremiumSnapshot()).isPremium, true,
    'Debug Test Store accepts a verified test purchase even when no entitlement is attached');
  assert.equal((await testPurchaseWithoutEntitlement.api.purchasePremium('$rc_monthly')).status, 'success',
    'a successful Test Store purchase immediately enables Plus');

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
assert.equal((await web.api.restorePremiumPurchases()).status, 'unavailable');
assert.equal(web.calls.length, 0);

for (const platform of ['ios', 'android']) {
  for (const debug of [false, true]) {
    const env = {
      NEXT_PUBLIC_REVENUECAT_TEST_API_KEY: 'test_showcase',
      NEXT_PUBLIC_REVENUECAT_IOS_API_KEY: 'appl_example',
      NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY: 'goog_example',
    };
    const active = { entitlements: {
      active: { premium: { isActive: true, verification: 'VERIFIED' } },
      verification: 'VERIFIED',
    } };
    const expired = {
      entitlements: { active: {}, verification: 'VERIFIED' },
      activeSubscriptions: [], allPurchasedProductIdentifiers: ['test_plus_monthly'],
      nonSubscriptionTransactions: [],
    };
    const cases = [
      ['active Plus', active, 'success'],
      ['no purchase', { entitlements: { active: {} } }, 'not-entitled'],
      ['expired purchase history', expired, 'not-entitled'],
      ['failed entitlement verification', { entitlements: {
        active: { premium: { isActive: true, verification: 'FAILED' } },
        verification: 'VERIFIED',
      } }, 'not-entitled'],
      ['failed CustomerInfo verification', { entitlements: {
        active: active.entitlements.active, verification: 'FAILED',
      } }, 'not-entitled'],
      ['active Test Store subscription without entitlement', {
        ...expired, activeSubscriptions: ['test_plus_monthly'],
      }, debug ? 'success' : 'not-entitled'],
    ];
    for (const [label, customerInfo, expectedStatus] of cases) {
      const { api, calls } = loadPurchases(platform, env, debug, { customerInfo });
      const result = await api.restorePremiumPurchases();
      assert.equal(result.status, expectedStatus, `${platform}/${debug}: restore ${label}`);
      assert.equal(result.isPremium, expectedStatus === 'success');
      assert.equal(calls.filter(call => call.method === 'restorePurchases').length, 1);
      assert.equal(calls.some(call => ['getOfferings', 'purchasePackage'].includes(call.method)), false,
        'restoring neither loads products nor starts a new purchase');
    }
    for (const [error, expectedStatus] of [
      [{ code: 'NETWORK_ERROR', message: 'Offline' }, 'error'],
      [{ code: 'CANCELLED', userCancelled: true }, 'cancelled'],
    ]) {
      const { api } = loadPurchases(platform, env, debug, { errors: { restorePurchases: error } });
      const result = await api.restorePremiumPurchases();
      assert.equal(result.status, expectedStatus);
      assert.equal(result.isPremium, false);
    }
    const { api } = loadPurchases(platform, env, debug, { customerInfo: expired });
    assert.equal((await api.getPremiumSnapshot()).isPremium, false,
      'refresh must not reactivate an expired subscription from historical purchases');
  }
}
assert.equal(verifyFilmingPassword('Hello Sikurepi'), true);
assert.equal(verifyFilmingPassword(' Hello Sikurepi '), true);
assert.equal(verifyFilmingPassword('hello sikurepi'), false);
console.log('Native purchase startup: Test Store is Debug-only; Release rejects test/wrong/missing keys; platform keys configure once.');
console.log('Restore: active access, missing/expired purchases, verification failures, cancellation, and network errors passed for iOS/Android and Test Store.');
