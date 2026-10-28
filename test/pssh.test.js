import QUnit from 'qunit';
import { getKeyIdFromPssh } from '../src/pssh';
import {
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
