import QUnit from 'qunit';
import { getKeyIdFromPssh, getKeyIdsFromPssh } from '../src/pssh';
import {
  PLAYREADY_SYSTEM_ID,
  WIDEVINE_SYSTEM_ID,
  generateKey,
  playReadyHeader,
  playReadyKid,
  playReadyObject,
  psshBox,
  randomBytes,
  toBase64,
  widevinePsshData
} from './helpers/drm';

QUnit.module('getKeyIdFromPssh');

QUnit.test('reads the first KID from a version 1 PSSH box', function(assert) {
  const { keyId, keyIdHex } = generateKey();
  const pssh = psshBox({ systemId: WIDEVINE_SYSTEM_ID, keyIds: [keyId, randomBytes(16)] });

  assert.equal(getKeyIdFromPssh(pssh, 'com.widevine.alpha'), keyIdHex, 'KID read from KID list');
});

QUnit.test('reads a PSSH box with a 64-bit largesize header', function(assert) {
  const { keyId, keyIdHex } = generateKey();
  const pssh = psshBox({ systemId: WIDEVINE_SYSTEM_ID, data: widevinePsshData(keyId), largeSize: true });

  assert.equal(getKeyIdFromPssh(pssh, 'com.widevine.alpha'), keyIdHex, 'KID read from WidevinePsshData');
});

QUnit.test('reads a bare PlayReady Object only for PlayReady', function(assert) {
  const { keyId, keyIdHex } = generateKey();
  const pro = playReadyObject(playReadyHeader(playReadyKid(keyId)));

  assert.equal(getKeyIdFromPssh(pro, 'com.microsoft.playready'), keyIdHex, 'KID read for PlayReady');
  assert.notOk(getKeyIdFromPssh(pro, 'com.widevine.alpha'), 'no KID for Widevine');
});

QUnit.test('returns undefined for malformed or short PlayReady KIDs', function(assert) {
  assert.notOk(
    getKeyIdFromPssh(playReadyObject(playReadyHeader('***')), 'com.microsoft.playready'),
    'invalid base64 KID ignored'
  );
  assert.notOk(
    getKeyIdFromPssh(playReadyObject(playReadyHeader(toBase64(randomBytes(4)))), 'com.microsoft.playready'),
    'KID that is not 16 bytes ignored'
  );
});

QUnit.test('returns undefined for truncated boxes', function(assert) {
  const { keyId } = generateKey();
  const pssh = psshBox({ systemId: WIDEVINE_SYSTEM_ID, keyIds: [keyId] });

  assert.notOk(getKeyIdFromPssh(pssh.subarray(0, 40), 'com.widevine.alpha'), 'truncated KID list');
  assert.notOk(getKeyIdFromPssh(pssh.subarray(0, 20), 'com.widevine.alpha'), 'truncated header');
  assert.notOk(getKeyIdFromPssh(new Uint8Array(0), 'com.widevine.alpha'), 'empty data');
});

QUnit.module('getKeyIdsFromPssh');

QUnit.test('lists every KID in a version 1 PSSH box', function(assert) {
  const first = generateKey();
  const second = generateKey();
  const pssh = psshBox({ systemId: WIDEVINE_SYSTEM_ID, keyIds: [first.keyId, second.keyId, first.keyId] });

  assert.deepEqual(
    getKeyIdsFromPssh(pssh, 'com.widevine.alpha'),
    [first.keyIdHex, second.keyIdHex],
    'KIDs listed in order without duplicates'
  );
});

QUnit.test('lists every key_id in WidevinePsshData', function(assert) {
  const first = generateKey();
  const second = generateKey();
  const pssh = psshBox({ systemId: WIDEVINE_SYSTEM_ID, data: widevinePsshData([first.keyId, second.keyId]) });

  assert.deepEqual(getKeyIdsFromPssh(pssh, 'com.widevine.alpha'), [first.keyIdHex, second.keyIdHex], 'both key_ids listed');
});

QUnit.test('lists every KID in a PlayReady header KIDS list', function(assert) {
  const first = generateKey();
  const second = generateKey();
  const pro = playReadyObject(playReadyHeader([playReadyKid(first.keyId), '***', playReadyKid(second.keyId)], '4.3.0.0'));

  assert.deepEqual(
    getKeyIdsFromPssh(psshBox({ systemId: PLAYREADY_SYSTEM_ID, data: pro }), 'com.microsoft.playready'),
    [first.keyIdHex, second.keyIdHex],
    'valid KIDs listed, malformed KID skipped'
  );
});

QUnit.test('returns an empty list when no KID is found', function(assert) {
  assert.deepEqual(getKeyIdsFromPssh(new Uint8Array(0), 'com.widevine.alpha'), [], 'empty data');
  assert.deepEqual(
    getKeyIdsFromPssh(psshBox({ systemId: WIDEVINE_SYSTEM_ID, data: new Uint8Array([0x08, 0x01]) }), 'com.widevine.alpha'),
    [],
    'WidevinePsshData without key_id'
  );
});
