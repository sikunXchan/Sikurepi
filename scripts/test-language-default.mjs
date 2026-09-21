import assert from 'node:assert/strict';
import { DEFAULT_LANGUAGE, parseStoredLanguage } from '../src/lib/i18n/config.ts';

assert.equal(DEFAULT_LANGUAGE, 'en');
assert.equal(parseStoredLanguage(null), null);
assert.equal(parseStoredLanguage(''), null);
assert.equal(parseStoredLanguage('fr'), null);
assert.equal(parseStoredLanguage('en'), 'en');
assert.equal(parseStoredLanguage('ja'), 'ja');
console.log('Language default: English first launch with saved English/Japanese preference preserved.');
