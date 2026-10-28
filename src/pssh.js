/**
 * @file m3u8/pssh.js
 *
 * Helpers for reading key IDs out of DRM initialization data (PSSH boxes and
 * PlayReady Objects) carried in `#EXT-X-KEY` data URIs.
 */
import window from 'global/window';
import decodeB64ToUint8Array from '@videojs/vhs-utils/es/decode-b64-to-uint8-array.js';
import { toHexString } from '@videojs/vhs-utils/es/byte-helpers.js';

const WIDEVINE_SYSTEM_ID = 'EDEF8BA979D64ACEA3C827DCD51D21ED';
const PLAYREADY_SYSTEM_ID = '9A04F07998404286AB92E65BE0885F95';

const toHex = (bytes) => toHexString(bytes).toUpperCase();

const decodeUtf16le = function(bytes) {
  if (window.TextDecoder) {
    return new window.TextDecoder('utf-16le').decode(bytes);
  }

  let str = '';

  for (let i = 0; i + 1 < bytes.length; i += 2) {
    str += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
  }

  return str;
};

/**
 * Read the `key_id` (field 2) from WidevinePsshData protobuf bytes.
 *
 * @param {Uint8Array} data the WidevinePsshData bytes
 * @return {string|undefined} the key ID as an uppercase hex string
 */
const getWidevineKeyId = function(data) {
  let offset = 0;

  const readVarint = () => {
    let value = 0;
    let shift = 0;
    let byte;

    do {
      byte = data[offset++];
      value += (byte & 0x7f) * Math.pow(2, shift);
      shift += 7;
    } while (byte & 0x80 && offset < data.length);

    return value;
  };

  while (offset < data.length) {
    const tag = readVarint();
    const field = Math.floor(tag / 8);
    const wireType = tag & 0x7;

    if (wireType === 0) {
      readVarint();
    } else if (wireType === 1) {
      offset += 8;
    } else if (wireType === 5) {
      offset += 4;
    } else if (wireType === 2) {
      const length = readVarint();

      if (field === 2 && length === 16 && offset + 16 <= data.length) {
        return toHex(data.subarray(offset, offset + 16));
      }
      offset += length;
    } else {
      return;
    }
  }
};

/**
 * Read the first KID from a PlayReady Object's PlayReady Header record.
 *
 * Supports both `<KID>base64</KID>` (header v4.0) and
 * `<KID VALUE="base64" ...>` (header v4.1+). PlayReady stores KIDs as
 * little-endian GUIDs, so the first three groups are byte-swapped to produce
 * the same big-endian form used by Widevine and CENC.
 *
 * @param {Uint8Array} data the PlayReady Object bytes
 * @return {string|undefined} the key ID as an uppercase hex string
 */
const getPlayReadyKeyId = function(data) {
  if (data.length < 6) {
    return;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const recordCount = view.getUint16(4, true);
  let offset = 6;

  for (let i = 0; i < recordCount && offset + 4 <= data.length; i++) {
    const type = view.getUint16(offset, true);
    const length = view.getUint16(offset + 2, true);
    const end = Math.min(offset + 4 + length, data.length);

    offset += 4;

    if (type === 1) {
      const xml = decodeUtf16le(data.subarray(offset, end));
      const match = (/<KID\s[^>]*VALUE="([^"]+)"/i).exec(xml) || (/<KID>([^<]+)<\/KID>/i).exec(xml);

      if (!match) {
        return;
      }

      let kid;

      try {
        kid = decodeB64ToUint8Array(match[1].trim());
      } catch (e) {
        return;
      }

      if (kid.length !== 16) {
        return;
      }

      return toHex([kid[3], kid[2], kid[1], kid[0], kid[5], kid[4], kid[7], kid[6]]) +
        toHex(kid.subarray(8));
    }

    offset = end;
  }
};

/**
 * Extract the first key ID from a PSSH box, or from a bare PlayReady Object
 * when the key system is PlayReady.
 *
 * Version 1 boxes list key IDs directly after the system ID. For version 0
 * boxes the key ID is read from the system specific data: the
 * WidevinePsshData protobuf for Widevine, or the PlayReady Header XML for
 * PlayReady.
 *
 * @param {Uint8Array} bytes the PSSH box (or PlayReady Object) bytes
 * @param {string} keySystem the key system the data belongs to, e.g.
 *        `com.widevine.alpha` or `com.microsoft.playready`
 * @return {string|undefined} the key ID as an uppercase hex string
 */
export const getKeyIdFromPssh = function(bytes, keySystem) {
  if (!bytes || bytes.length < 8) {
    return;
  }

  if (String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]) !== 'pssh') {
    return keySystem === 'com.microsoft.playready' ? getPlayReadyKeyId(bytes) : undefined;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const size = view.getUint32(0);
  let boxEnd = bytes.length;
  let offset = 8;

  if (size === 1) {
    if (bytes.length < 16) {
      return;
    }
    boxEnd = Math.min(view.getUint32(8) * 0x100000000 + view.getUint32(12), bytes.length);
    offset = 16;
  } else if (size !== 0) {
    boxEnd = Math.min(size, bytes.length);
  }

  // full box header (4) + system ID (16) + KID count or data size (4)
  if (offset + 24 > boxEnd) {
    return;
  }

  const version = bytes[offset];
  const systemId = toHex(bytes.subarray(offset + 4, offset + 20));

  offset += 20;

  if (version > 0) {
    const kidCount = view.getUint32(offset);

    offset += 4;
    if (kidCount > 0) {
      return offset + 16 <= boxEnd ? toHex(bytes.subarray(offset, offset + 16)) : undefined;
    }
  }

  if (offset + 4 > boxEnd) {
    return;
  }

  const dataEnd = Math.min(offset + 4 + view.getUint32(offset), boxEnd);
  const data = bytes.subarray(offset + 4, dataEnd);

  if (systemId === WIDEVINE_SYSTEM_ID) {
    return getWidevineKeyId(data);
  }

  if (systemId === PLAYREADY_SYSTEM_ID) {
    return getPlayReadyKeyId(data);
  }
};
