/**
 * Helpers for building DRM initialization data (PSSH boxes, WidevinePsshData
 * and PlayReady Objects) with freshly generated key IDs inside tests.
 */
import window from 'global/window';

export const WIDEVINE_SYSTEM_ID = 'EDEF8BA979D64ACEA3C827DCD51D21ED';
export const PLAYREADY_SYSTEM_ID = '9A04F07998404286AB92E65BE0885F95';

const concat = (...parts) => {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;

  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });

  return result;
};

const uint32 = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const uint16le = (n) => [n & 0xff, (n >>> 8) & 0xff];
const uint32le = (n) => uint16le(n).concat(uint16le(n >>> 16));
const ascii = (str) => Array.prototype.map.call(str, (c) => c.charCodeAt(0));
const utf16le = (str) => Array.prototype.reduce.call(str, (bytes, c) => bytes.concat(uint16le(c.charCodeAt(0))), []);

export const randomBytes = (length) => {
  const bytes = new Uint8Array(length);

  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }

  return bytes;
};

export const toHex = (bytes) => Array.prototype.map.call(bytes, (b) => ('0' + b.toString(16)).slice(-2))
  .join('')
  .toUpperCase();

export const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((b) => parseInt(b, 16)));

export const toBase64 = (bytes) => Buffer.from(String.fromCharCode.apply(null, bytes), 'binary').toString('base64');

/**
 * Generate a key ID and IV for a test.
 *
 * @return {Object} `keyId` bytes plus `keyIdHex` and `ivHex` uppercase hex strings
 */
export const generateKey = () => {
  const keyId = randomBytes(16);

  return {
    keyId,
    keyIdHex: toHex(keyId),
    ivHex: toHex(randomBytes(16))
  };
};

/**
 * Build WidevinePsshData protobuf bytes. A varint and a provider string are
 * written ahead of `key_id` so parsing has to skip other fields.
 *
 * @param {Uint8Array} keyId the 16 byte key ID
 * @return {Uint8Array} the protobuf bytes
 */
export const widevinePsshData = (keyId) => concat(
  // algorithm = AESCTR
  [0x08, 0x01],
  // provider
  [0x1a, 0x07], ascii('testing'),
  // key_id
  [0x12, 0x10], keyId,
  // content_id
  [0x22, 0x10], keyId
);

/**
 * Build a PSSH box.
 *
 * @param {Object} options the box contents
 * @param {string} options.systemId the DRM system ID as hex
 * @param {Uint8Array[]} [options.keyIds] key IDs; when given a version 1 box is built
 * @param {Uint8Array} [options.data] the system specific data
 * @param {boolean} [options.largeSize] write a 64-bit largesize header
 * @return {Uint8Array} the PSSH box bytes
 */
export const psshBox = ({ systemId, keyIds, data = new Uint8Array(0), largeSize = false }) => {
  const version = keyIds ? 1 : 0;
  const kidList = keyIds ? concat(uint32(keyIds.length), ...keyIds) : new Uint8Array(0);
  const body = concat([version, 0, 0, 0], fromHex(systemId), kidList, uint32(data.length), data);

  if (largeSize) {
    return concat(uint32(1), ascii('pssh'), uint32(0), uint32(16 + body.length), body);
  }

  return concat(uint32(8 + body.length), ascii('pssh'), body);
};

/**
 * Encode a key ID as a base64 PlayReady KID, which is a little-endian GUID.
 *
 * @param {Uint8Array} keyId the 16 byte big-endian key ID
 * @return {string} the base64 KID
 */
export const playReadyKid = (keyId) => toBase64(concat(
  [keyId[3], keyId[2], keyId[1], keyId[0], keyId[5], keyId[4], keyId[7], keyId[6]],
  keyId.subarray(8)
));

/**
 * Build a PlayReady Header XML string.
 *
 * @param {string} kid the base64 KID
 * @param {string} [version] `4.0.0.0` for a `<KID>` element, otherwise a
 *        `<KID VALUE="...">` attribute is used
 * @return {string} the header XML
 */
export const playReadyHeader = (kid, version = '4.0.0.0') => {
  const xmlns = 'http://schemas.microsoft.com/DRM/2007/03/PlayReadyHeader';
  const protectInfo = version === '4.0.0.0' ?
    `<PROTECTINFO><KEYLEN>16</KEYLEN><ALGID>AESCTR</ALGID></PROTECTINFO><KID>${kid}</KID>` :
    `<PROTECTINFO><KIDS><KID ALGID="AESCBC" VALUE="${kid}"></KID></KIDS></PROTECTINFO>`;

  return `<WRMHEADER xmlns="${xmlns}" version="${version}"><DATA>${protectInfo}</DATA></WRMHEADER>`;
};

/**
 * Build a PlayReady Object holding a single PlayReady Header record.
 *
 * @param {string} xml the PlayReady Header XML
 * @return {Uint8Array} the PlayReady Object bytes
 */
export const playReadyObject = (xml) => {
  const record = utf16le(xml);

  return concat(uint32le(10 + record.length), uint16le(1), uint16le(1), uint16le(record.length), record);
};
