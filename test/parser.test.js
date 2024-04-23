import QUnit from 'qunit';
// import testDataExpected from 'data-files!expecteds';
// import testDataManifests from 'data-files!manifests';
import {Parser} from '../src';

QUnit.module('m3u8s', function(hooks) {
  hooks.beforeEach(function() {
    this.parser = new Parser();
    QUnit.dump.maxDepth = 8;
  });

  QUnit.module('general');

  QUnit.test('can be constructed', function(assert) {
    assert.notStrictEqual(this.parser, 'undefined', 'parser is defined');
  });

  QUnit.test('can set custom parsers', function(assert) {
    const manifest = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-TARGETDURATION:10',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-PROGRAM-DATE-TIME:2017-07-31T20:35:35.053+00:00',
      '#VOD-STARTTIMESTAMP:1501533337573',
      '#VOD-TOTALDELETEDDURATION:0.0',
      '#VOD-FRAMERATE:29.97',
      ''
    ].join('\n');

    this.parser.addParser({
      expression: /^#VOD-STARTTIMESTAMP/,
      customType: 'startTimestamp'
    });
    this.parser.addParser({
      expression: /^#VOD-TOTALDELETEDDURATION/,
      customType: 'totalDeleteDuration'
    });
    this.parser.addParser({
      expression: /^#VOD-FRAMERATE/,
      customType: 'framerate',
      dataParser: (line) => (line.split(':')[1])
    });

    this.parser.push(manifest);
    this.parser.end();
    assert.strictEqual(
      this.parser.manifest.custom.startTimestamp,
      '#VOD-STARTTIMESTAMP:1501533337573',
      'sets custom timestamp line'
    );

    assert.strictEqual(
      this.parser.manifest.custom.totalDeleteDuration,
      '#VOD-TOTALDELETEDDURATION:0.0',
      'sets custom delete duration'
    );

    assert.strictEqual(this.parser.manifest.custom.framerate, '29.97', 'sets framerate');
  });

  QUnit.test('segment level custom data', function(assert) {
    const manifest = [
      '#EXTM3U',
      '#VOD-TIMING:1511816599485',
      '#COMMENT',
      '#EXTINF:8.0,',
      'ex1.ts',
      '#VOD-TIMING',
      '#EXTINF:8.0,',
      'ex2.ts',
      '#VOD-TIMING:1511816615485',
      '#EXT-UNKNOWN',
      '#EXTINF:8.0,',
      'ex3.ts',
      '#VOD-TIMING:1511816623485',
      '#EXTINF:8.0,',
      'ex3.ts',
      '#EXT-X-ENDLIST'
    ].join('\n');

    this.parser.addParser({
      expression: /^#VOD-TIMING/,
      customType: 'vodTiming',
      segment: true
    });

    this.parser.push(manifest);
    this.parser.end();
    assert.equal(
      this.parser.manifest.segments[0].custom.vodTiming,
      '#VOD-TIMING:1511816599485',
      'parser attached segment level custom data'
    );
    assert.equal(
      this.parser.manifest.segments[1].custom.vodTiming,
      '#VOD-TIMING',
      'parser got segment level custom data without :'
    );
  });

  QUnit.test('attaches cue-out data to segment', function(assert) {
    const manifest = [
      '#EXTM3U',
      '#EXTINF:5,',
      '#COMMENT',
      'ex1.ts',
      '#EXT-X-CUE-OUT:10',
      '#EXTINF:5,',
      'ex2.ts',
      '#EXT-X-CUE-OUT15',
      '#EXT-UKNOWN-TAG',
      '#EXTINF:5,',
      'ex3.ts',
      '#EXT-X-CUE-OUT',
      '#EXTINF:5,',
      'ex3.ts',
      '#EXT-X-ENDLIST'
    ].join('\n');

    this.parser.push(manifest);
    this.parser.end();

    assert.equal(this.parser.manifest.segments[1].cueOut, '10', 'parser attached cue out tag');
    assert.equal(this.parser.manifest.segments[2].cueOut, '15', 'cue out without : seperator');
    assert.equal(this.parser.manifest.segments[3].cueOut, '', 'cue out without data');
  });

  QUnit.test('attaches cue-out-cont data to segment', function(assert) {
    const manifest = [
      '#EXTM3U',
      '#EXTINF:5,',
      '#COMMENT',
      'ex1.ts',
      '#EXT-X-CUE-OUT-CONT:10/60',
      '#EXTINF:5,',
      'ex2.ts',
      '#EXT-X-CUE-OUT-CONT15/30',
      '#EXT-UKNOWN-TAG',
      '#EXTINF:5,',
      'ex3.ts',
      '#EXT-X-CUE-OUT-CONT',
      '#EXTINF:5,',
      'ex3.ts',
      '#EXT-X-ENDLIST'
    ].join('\n');

    this.parser.push(manifest);
    this.parser.end();

    assert.equal(
      this.parser.manifest.segments[1].cueOutCont, '10/60',
      'parser attached cue out cont tag'
    );
    assert.equal(
      this.parser.manifest.segments[2].cueOutCont, '15/30',
      'cue out cont without : seperator'
    );
    assert.equal(this.parser.manifest.segments[3].cueOutCont, '', 'cue out cont without data');
  });

  QUnit.test('attaches cue-in data to segment', function(assert) {
    const manifest = [
      '#EXTM3U',
      '#EXTINF:5,',
      '#COMMENT',
      'ex1.ts',
      '#EXT-X-CUE-IN',
      '#EXTINF:5,',
      'ex2.ts',
      '#EXT-X-CUE-IN:15',
      '#EXT-UKNOWN-TAG',
      '#EXTINF:5,',
      'ex3.ts',
      '#EXT-X-CUE-IN=abc',
      '#EXTINF:5,',
      'ex3.ts',
      '#EXT-X-ENDLIST'
    ].join('\n');

    this.parser.push(manifest);
    this.parser.end();

    assert.equal(this.parser.manifest.segments[1].cueIn, '', 'parser attached cue in tag');
    assert.equal(this.parser.manifest.segments[2].cueIn, '15', 'cue in with data');
    assert.equal(
      this.parser.manifest.segments[3].cueIn, '=abc',
      'cue in without colon seperator'
    );
  });

  QUnit.test('parses characteristics attribute', function(assert) {
    const manifest = [
      '#EXTM3U',
      '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",CHARACTERISTICS="char",NAME="test"',
      '#EXT-X-STREAM-INF:BANDWIDTH=1,CODECS="mp4a.40.2, avc1.4d400d",SUBTITLES="subs"',
      'index.m3u8'
    ].join('\n');

    this.parser.push(manifest);
    this.parser.end();

    assert.equal(
      this.parser.manifest.mediaGroups.SUBTITLES.subs.test.characteristics,
      'char',
      'parsed CHARACTERISTICS attribute'
    );
  });

  QUnit.test('parses FORCED attribute', function(assert) {
    const manifest = [
      '#EXTM3U',
      '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="subs",CHARACTERISTICS="char",NAME="test",FORCED=YES',
      '#EXT-X-STREAM-INF:BANDWIDTH=1,CODECS="mp4a.40.2, avc1.4d400d",SUBTITLES="subs"',
      'index.m3u8'
    ].join('\n');

    this.parser.push(manifest);
    this.parser.end();

    assert.ok(
      this.parser.manifest.mediaGroups.SUBTITLES.subs.test.forced,
      'parsed FORCED attribute'
    );
  });

  QUnit.test('parses Widevine #EXT-X-KEY attributes and attaches to manifest', function(assert) {
    const manifest = [
      '#EXTM3U',
      '#EXT-X-KEY:METHOD=SAMPLE-AES-CTR,' +
      'URI="data:text/plain;base64,AAAAPnBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB4iFnN' +
      'oYWthX2NlYzJmNjRhYTc4OTBhMTFI49yVmwY=",KEYID=0x800AACAA522958AE888062B5695DB6BF,' +
      'KEYFORMATVERSIONS="1",KEYFORMAT="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"',
      '#EXTINF:5,',
      'ex1.ts',
      '#EXT-X-ENDLIST'
    ].join('\n');

    this.parser.push(manifest);
    this.parser.end();

    assert.ok(this.parser.manifest.contentProtection, 'contentProtection property added');
    assert.equal(
      this.parser.manifest.contentProtection['com.widevine.alpha'].attributes.schemeIdUri,
      'urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed',
      'schemeIdUri set correctly'
    );
    assert.equal(
      this.parser.manifest.contentProtection['com.widevine.alpha'].attributes.keyId,
      '800AACAA522958AE888062B5695DB6BF',
      'keyId set correctly'
    );
    assert.equal(
      this.parser.manifest.contentProtection['com.widevine.alpha'].pssh.byteLength,
      62,
      'base64 URI decoded to TypedArray'
    );
  });

  QUnit.test('Widevine #EXT-X-KEY attributes not attached to manifest if METHOD is invalid', function(assert) {
    const manifest = [
      '#EXTM3U',
      '#EXT-X-KEY:METHOD=NONE,' +
      'URI="data:text/plain;base64,AAAAPnBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB4iFnN' +
      'oYWthX2NlYzJmNjRhYTc4OTBhMTFI49yVmwY=",KEYID=0x800AACAA522958AE888062B5695DB6BF,' +
      'KEYFORMATVERSIONS="1",KEYFORMAT="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"',
      '#EXTINF:5,',
      'ex1.ts',
      '#EXT-X-ENDLIST'
    ].join('\n');

    this.parser.push(manifest);
    this.parser.end();

    assert.notOk(this.parser.manifest.contentProtection, 'contentProtection not added');
  });

  QUnit.test('Widevine #EXT-X-KEY attributes not attached to manifest if URI is invalid', function(assert) {
    const manifest = [
      '#EXTM3U',
      '#EXT-X-KEY:METHOD=SAMPLE-AES-CTR,' +
      'URI="AAAAPnBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB4iFnN' +
      'oYWthX2NlYzJmNjRhYTc4OTBhMTFI49yVmwY=",KEYID=0x800AACAA522958AE888062B5695DB6BF,' +
      'KEYFORMATVERSIONS="1",KEYFORMAT="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"',
      '#EXTINF:5,',
      'ex1.ts',
      '#EXT-X-ENDLIST'
    ].join('\n');

    this.parser.push(manifest);
    this.parser.end();

    assert.notOk(this.parser.manifest.contentProtection, 'contentProtection not added');
  });

  QUnit.test('Widevine #EXT-X-KEY attributes not attached to manifest if KEYID is invalid', function(assert) {
    const manifest = [
      '#EXTM3U',
      '#EXT-X-KEY:METHOD=SAMPLE-AES-CTR,' +
      'URI="data:text/plain;base64,AAAAPnBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB4iFnN' +
      'oYWthX2NlYzJmNjRhYTc4OTBhMTFI49yVmwY=",KEYID=800AACAA522958AE888062B5695DB6BF,' +
      'KEYFORMATVERSIONS="1",KEYFORMAT="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"',
      '#EXTINF:5,',
      'ex1.ts',
      '#EXT-X-ENDLIST'
    ].join('\n');

    this.parser.push(manifest);
    this.parser.end();

    assert.notOk(this.parser.manifest.contentProtection, 'contentProtection not added');
  });

  QUnit.test('Widevine #EXT-X-KEY attributes not attached to manifest if KEYFORMAT is not Widevine UUID', function(assert) {
    const manifest = [
      '#EXTM3U',
      '#EXT-X-KEY:METHOD=SAMPLE-AES-CTR,' +
      'URI="data:text/plain;base64,AAAAPnBzc2gAAAAA7e+LqXnWSs6jyCfc1R0h7QAAAB4iFnN' +
      'oYWthX2NlYzJmNjRhYTc4OTBhMTFI49yVmwY=",KEYID=0x800AACAA522958AE888062B5695DB6BF,' +
      'KEYFORMATVERSIONS="1",KEYFORMAT="invalid-keyformat"',
      '#EXTINF:5,',
      'ex1.ts',
      '#EXT-X-ENDLIST'
    ].join('\n');

    this.parser.push(manifest);
    this.parser.end();

    assert.notOk(this.parser.manifest.contentProtection, 'contentProtection not added');
  });

  QUnit.test('byterange offset defaults to next byte', function(assert) {
    const manifest = [
      '#EXTM3U',
      '#EXTINF:5,',
      '#EXT-X-BYTERANGE:10@5',
      'segment.ts',
      '#EXTINF:5,',
      '#EXT-X-BYTERANGE:20',
      'segment.ts',
      '#EXTINF:5,',
      '#EXT-X-BYTERANGE:30',
      'segment.ts',
      '#EXTINF:5,',
      'segment2.ts',
      '#EXT-X-BYTERANGE:15@100',
      'segment.ts',
      '#EXT-X-BYTERANGE:17',
      'segment.ts',
      '#EXT-X-ENDLIST'
    ].join('\n');

    this.parser.push(manifest);
    this.parser.end();

    assert.deepEqual(
      this.parser.manifest.segments[0].byterange,
      { length: 10, offset: 5 },
      'first segment has correct byterange'
    );
    assert.deepEqual(
      this.parser.manifest.segments[1].byterange,
      { length: 20, offset: 15 },
      'second segment has correct byterange'
    );
    assert.deepEqual(
      this.parser.manifest.segments[2].byterange,
      { length: 30, offset: 35 },
      'third segment has correct byterange'
    );
    assert.notOk(this.parser.manifest.segments[3].byterange, 'fourth segment has no byterange');
    assert.deepEqual(
      this.parser.manifest.segments[4].byterange,
      { length: 15, offset: 100 },
      'fifth segment has correct byterange'
    );
    // not tested is a segment with no offset coming after a segment that isn't a sub range,
    // as the spec requires that a byterange without an offset must follow a segment that
    // is a sub range of the same media resource
    assert.deepEqual(
      this.parser.manifest.segments[5].byterange,
      { length: 17, offset: 115 },
      'sixth segment has correct byterange'
    );
  });

  QUnit.module('warn/info', {
    beforeEach() {
      this.warnings = [];
      this.infos = [];

      this.parser.on('warn', (warn) => this.warnings.push(warn.message));
      this.parser.on('info', (info) => this.infos.push(info.message));

    }
  });
  QUnit.test('warn when #EXT-X-TARGETDURATION is invalid', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXT-X-TARGETDURATION:foo',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST'
    ].join('\n'));
    this.parser.end();

    const warnings = [
      'ignoring invalid target duration: undefined'
    ];

    assert.deepEqual(
      this.warnings,
      warnings,
      'warnings as expected'
    );

    assert.deepEqual(
      this.infos,
      [],
      'info as expected'
    );
  });

  QUnit.test('warns when #EXT-X-START missing TIME-OFFSET attribute', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXT-X-TARGETDURATION:10',
      '#EXT-X-START:PRECISE=YES',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST'
    ].join('\n'));
    this.parser.end();

    assert.deepEqual(
      this.warnings,
      ['ignoring start declaration without appropriate attribute list'],
      'warnings as expected'
    );

    assert.deepEqual(
      this.infos,
      [],
      'info as expected'
    );

    assert.strictEqual(typeof this.parser.manifest.start, 'undefined', 'does not parse start');
  });

  QUnit.test('warning when #EXT-X-SKIP missing SKIPPED-SEGMENTS attribute', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXT-X-TARGETDURATION:10',
      '#EXT-X-SKIP:foo=bar',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST'
    ].join('\n'));
    this.parser.end();

    assert.deepEqual(
      this.warnings,
      ['#EXT-X-SKIP lacks required attribute(s): SKIPPED-SEGMENTS'],
      'warnings as expected'
    );

    assert.deepEqual(
      this.infos,
      [],
      'info as expected'
    );
  });

  QUnit.test('warns when #EXT-X-PART missing URI/DURATION attributes', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXT-X-TARGETDURATION:10',
      '#EXT-X-PART:DURATION=1',
      '#EXT-X-PART:URI=2',
      '#EXT-X-PART:foo=bar',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST'
    ].join('\n'));
    this.parser.end();

    const warnings = [
      '#EXT-X-PART #0 for segment #0 lacks required attribute(s): URI',
      '#EXT-X-PART #1 for segment #0 lacks required attribute(s): DURATION',
      '#EXT-X-PART #2 for segment #0 lacks required attribute(s): URI, DURATION'
    ];

    assert.deepEqual(
      this.warnings,
      warnings,
      'warnings as expected'
    );

    assert.deepEqual(
      this.infos,
      [],
      'info as expected'
    );
  });

  QUnit.test('warns when #EXT-X-PRELOAD-HINT missing TYPE/URI attribute', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXT-X-TARGETDURATION:10',
      '#EXT-X-PRELOAD-HINT:TYPE=foo',
      '#EXT-X-PRELOAD-HINT:URI=foo',
      '#EXT-X-PRELOAD-HINT:foo=bar',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST'
    ].join('\n'));
    this.parser.end();

    const warnings = [
      '#EXT-X-PRELOAD-HINT #0 for segment #0 lacks required attribute(s): URI',
      '#EXT-X-PRELOAD-HINT #1 for segment #0 lacks required attribute(s): TYPE',
      '#EXT-X-PRELOAD-HINT #2 for segment #0 lacks required attribute(s): TYPE, URI'
    ];

    assert.deepEqual(
      this.warnings,
      warnings,
      'warnings as expected'
    );

    assert.deepEqual(
      this.infos,
      [],
      'info as expected'
    );
  });

  QUnit.test('warns when we get #EXT-X-PRELOAD-HINT with the same TYPE', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXT-X-TARGETDURATION:10',
      '#EXT-X-PRELOAD-HINT:TYPE=foo,URI=foo1',
      '#EXT-X-PRELOAD-HINT:TYPE=foo,URI=foo2',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST'
    ].join('\n'));
    this.parser.end();

    const warnings = [
      '#EXT-X-PRELOAD-HINT #1 for segment #0 has the same TYPE foo as preload hint #0'
    ];

    assert.deepEqual(
      this.warnings,
      warnings,
      'warnings as expected'
    );

    assert.deepEqual(
      this.infos,
      [],
      'info as expected'
    );
  });

  QUnit.test('warn when #EXT-X-RENDITION-REPORT missing LAST-MSN/URI attribute', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXT-X-TARGETDURATION:10',
      '#EXT-X-RENDITION-REPORT:URI=foo',
      '#EXT-X-RENDITION-REPORT:LAST-MSN=2',
      '#EXT-X-RENDITION-REPORT:foo=bar',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST'
    ].join('\n'));
    this.parser.end();

    const warnings = [
      '#EXT-X-RENDITION-REPORT #0 lacks required attribute(s): LAST-MSN',
      '#EXT-X-RENDITION-REPORT #1 lacks required attribute(s): URI',
      '#EXT-X-RENDITION-REPORT #2 lacks required attribute(s): LAST-MSN, URI'
    ];

    assert.deepEqual(
      this.warnings,
      warnings,
      'warnings as expected'
    );

    assert.deepEqual(
      this.infos,
      [],
      'info as expected'
    );
  });

  QUnit.test('warns when #EXT-X-RENDITION-REPORT missing LAST-PART attribute with parts', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXT-X-TARGETDURATION:10',
      '#EXT-X-RENDITION-REPORT:URI=foo,LAST-MSN=4',
      '#EXT-X-PART:URI=foo,DURATION=10',
      '#EXT-X-RENDITION-REPORT:URI=foo,LAST-MSN=4',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST'
    ].join('\n'));
    this.parser.end();

    const warnings = [
      '#EXT-X-RENDITION-REPORT #0 lacks required attribute(s): LAST-PART',
      '#EXT-X-RENDITION-REPORT #1 lacks required attribute(s): LAST-PART'
    ];

    assert.deepEqual(
      this.warnings,
      warnings,
      'warnings as expected'
    );

    assert.deepEqual(
      this.infos,
      [],
      'info as expected'
    );
  });

  QUnit.test('warns when #EXT-X-PART-INF missing PART-TARGET attribute', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXT-X-TARGETDURATION:10',
      '#EXT-X-PART-INF:URI=foo',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST'
    ].join('\n'));
    this.parser.end();

    const warnings = [
      '#EXT-X-PART-INF lacks required attribute(s): PART-TARGET'
    ];

    assert.deepEqual(
      this.warnings,
      warnings,
      'warnings as expected'
    );

    assert.deepEqual(
      this.infos,
      [],
      'info as expected'
    );
  });

  QUnit.test('warns when #EXT-X-SERVER-CONTROL missing CAN-SKIP-UNTIL with CAN-SKIP-DATERANGES attribute', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXT-X-TARGETDURATION:10',
      '#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=NO,HOLD-BACK=30,CAN-SKIP-DATERANGES=YES',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST'
    ].join('\n'));
    this.parser.end();

    const warnings = [
      '#EXT-X-SERVER-CONTROL lacks required attribute CAN-SKIP-UNTIL which is required when CAN-SKIP-DATERANGES is set'
    ];

    assert.deepEqual(
      this.warnings,
      warnings,
      'warnings as expected'
    );

    assert.deepEqual(
      this.infos,
      [],
      'info as expected'
    );
  });

  QUnit.test('warn when #EXT-X-SERVER-CONTROL HOLD-BACK and PART-HOLD-BACK too low', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXT-X-TARGETDURATION:10',
      '#EXT-X-PART-INF:PART-TARGET=1',
      '#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,HOLD-BACK=1,PART-HOLD-BACK=0.5',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST'
    ].join('\n'));
    this.parser.end();

    const warnings = [
      '#EXT-X-SERVER-CONTROL clamping HOLD-BACK (1) to targetDuration * 3 (30)',
      '#EXT-X-SERVER-CONTROL clamping PART-HOLD-BACK (0.5) to partTargetDuration * 2 (2).'
    ];

    assert.deepEqual(
      this.warnings,
      warnings,
      'warnings as expected'
    );

    assert.deepEqual(
      this.infos,
      [],
      'info as expected'
    );
  });

  QUnit.test('warn when #EXT-X-SERVER-CONTROL before target durations HOLD-BACK/PART-HOLD-BACK too low', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,HOLD-BACK=1,PART-HOLD-BACK=0.5',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXT-X-TARGETDURATION:10',
      '#EXT-X-PART-INF:PART-TARGET=1',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST'
    ].join('\n'));
    this.parser.end();

    const warnings = [
      '#EXT-X-SERVER-CONTROL clamping HOLD-BACK (1) to targetDuration * 3 (30)',
      '#EXT-X-SERVER-CONTROL clamping PART-HOLD-BACK (0.5) to partTargetDuration * 2 (2).'
    ];

    assert.deepEqual(
      this.warnings,
      warnings,
      'warnings as expected'
    );

    assert.deepEqual(
      this.infos,
      [],
      'info as expected'
    );
  });

  QUnit.test('info when #EXT-X-SERVER-CONTROL sets defaults', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXT-X-TARGETDURATION:10',
      '#EXT-X-PART-INF:PART-TARGET=1',
      '#EXT-X-SERVER-CONTROL:foo=bar',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST'
    ].join('\n'));
    this.parser.end();

    const infos = [
      '#EXT-X-SERVER-CONTROL defaulting CAN-BLOCK-RELOAD to false',
      '#EXT-X-SERVER-CONTROL defaulting HOLD-BACK to targetDuration * 3 (30).',
      '#EXT-X-SERVER-CONTROL defaulting PART-HOLD-BACK to partTargetDuration * 3 (3).'
    ];

    assert.deepEqual(
      this.warnings,
      [],
      'warnings as expected'
    );

    assert.deepEqual(
      this.infos,
      infos,
      'info as expected'
    );
  });

  QUnit.test('info when #EXT-X-SERVER-CONTROL before target durations and sets defaults', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXT-X-SERVER-CONTROL:foo=bar',
      '#EXT-X-TARGETDURATION:10',
      '#EXT-X-PART-INF:PART-TARGET=1',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST'
    ].join('\n'));
    this.parser.end();

    const infos = [
      '#EXT-X-SERVER-CONTROL defaulting CAN-BLOCK-RELOAD to false',
      '#EXT-X-SERVER-CONTROL defaulting HOLD-BACK to targetDuration * 3 (30).',
      '#EXT-X-SERVER-CONTROL defaulting PART-HOLD-BACK to partTargetDuration * 3 (3).'
    ];

    assert.deepEqual(
      this.warnings,
      [],
      'warnings as expected'
    );

    assert.deepEqual(
      this.infos,
      infos,
      'info as expected'
    );
  });

  QUnit.test('Can understand widevine/fairplay/playready drm ext-x-key', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXT-X-TARGETDURATION:10',
      '#EXT-X-PART-INF:PART-TARGET=1',
      '#EXT-X-SERVER-CONTROL:foo=bar',
      '#EXT-X-KEY:METHOD=SAMPLE-AES,URI="data:text/plain;base64,foo",KEYID=0x555777,IV=1234567890abcdef1234567890abcdef,KEYFORMATVERSIONS="1",KEYFORMAT="urn:uuid:edef8ba9-79d6-4ace-a3c8-27dcd51d21ed"',
      '#EXT-X-KEY:METHOD=SAMPLE-AES,URI="skd://foo",KEYFORMATVERSIONS="1",KEYFORMAT="com.apple.streamingkeydelivery"',
      '#EXT-X-KEY:METHOD=SAMPLE-AES,URI="http://example.com",KEYFORMATVERSIONS="1",KEYFORMAT="com.microsoft.playready"',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST'
    ].join('\n'));
    this.parser.end();

    assert.deepEqual(
      Object.keys(this.parser.manifest.contentProtection),
      ['com.widevine.alpha', 'com.apple.fps.1_0', 'com.microsoft.playready'],
      'info as expected'
    );
  });

  QUnit.test('PDT value is assigned to segments with explicit #EXT-X-PROGRAM-DATE-TIME tags', function(assert) {
    this.parser.push([
      '#EXTM3U',
      '#EXT-X-VERSION:6',
      '#EXT-X-TARGETDURATION:8',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXTINF:8.0',
      '#EXT-X-PROGRAM-DATE-TIME:2017-07-31T20:35:35.053+00:00',
      'https://example.com/playlist1.m3u8',
      '#EXTINF:8.0,',
      '#EXT-X-PROGRAM-DATE-TIME:2017-07-31T22:14:10.053+00:00',
      'https://example.com/playlist2.m3u8',
      '#EXT-X-ENDLIST'
    ].join('\n'));
    this.parser.end();
    assert.equal(this.parser.manifest.segments[0].programDateTime, new Date('2017-07-31T20:35:35.053+00:00').getTime());
    assert.equal(this.parser.manifest.segments[1].programDateTime, new Date('2017-07-31T22:14:10.053+00:00').getTime());
  });

  QUnit.test('backfill PDT values when the first EXT-X-PROGRAM-DATE-TIME tag appears after one or more Media Segment URIs', function(assert) {
    this.parser.push([
      '#EXTM3U',
      '#EXT-X-VERSION:6',
      '#EXT-X-TARGETDURATION:8',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXTINF:8.0',
      'https://example.com/playlist1.m3u8',
      '#EXTINF:8.0,',
      'https://example.com/playlist2.m3u8',
      '#EXTINF:8.0',
      '#EXT-X-PROGRAM-DATE-TIME:2017-07-31T20:35:35.053+00:00',
      'https://example.com/playlist3.m3u8',
      '#EXT-X-ENDLIST'
    ].join('\n'));
    this.parser.end();
    const segments = this.parser.manifest.segments;

    assert.equal(segments[2].programDateTime, new Date('2017-07-31T20:35:35.053+00:00').getTime());
    assert.equal(segments[1].programDateTime, segments[2].programDateTime - (segments[1].duration * 1000));
    assert.equal(segments[0].programDateTime, segments[1].programDateTime - (segments[0].duration * 1000));
  });

  QUnit.test('extrapolates forward when subsequent fragments do not have explicit PDT tags', function(assert) {
    this.parser.push([
      '#EXTM3U',
      '#EXT-X-VERSION:6',
      '#EXT-X-TARGETDURATION:8',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXTINF:8.0',
      '#EXT-X-PROGRAM-DATE-TIME:2017-07-31T20:35:35.053+00:00',
      'https://example.com/playlist1.m3u8',
      '#EXTINF:8.0,',
      'https://example.com/playlist2.m3u8',
      '#EXTINF:8.0',
      'https://example.com/playlist3.m3u8',
      '#EXT-X-ENDLIST'
    ].join('\n'));
    this.parser.end();
    const segments = this.parser.manifest.segments;

    assert.equal(segments[0].programDateTime, new Date('2017-07-31T20:35:35.053+00:00').getTime());
    assert.equal(segments[1].programDateTime, segments[0].programDateTime + segments[1].duration * 1000);
    assert.equal(segments[2].programDateTime, segments[1].programDateTime + segments[2].duration * 1000);
  });

  QUnit.test('warns when #EXT-X-DATERANGE missing attribute', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST',
      '#EXT-X-PROGRAM-DATE-TIME:2017-07-31T20:35:35.053+00:00',
      '#EXT-X-DATERANGE:ID="12345"'
    ].join('\n'));
    this.parser.end();

    const warnings = [
      '#EXT-X-DATERANGE #0 lacks required attribute(s): START-DATE'
    ];

    assert.deepEqual(
      this.warnings,
      warnings,
      'warnings as expected'
    );
  });

  QUnit.test('warns when #EXT-X-DATERANGE end date attribute is less than start date', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST',
      '#EXT-X-PROGRAM-DATE-TIME:2017-07-31T20:35:35.053+00:00',
      '#EXT-X-DATERANGE:ID="12345",START-DATE="2023-04-13T18:16:15.840000Z",END-DATE="2023-04-13T15:15:15.840000Z"'
    ].join('\n'));
    this.parser.end();

    const warnings = [
      'EXT-X-DATERANGE END-DATE must be equal to or later than the value of the START-DATE'
    ];

    assert.deepEqual(
      this.warnings,
      warnings,
      'warnings as expected'
    );
  });

  QUnit.test('warns when #EXT-X-DATERANGE duration or planned duration attribute is negative', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST',
      '#EXT-X-PROGRAM-DATE-TIME:2017-07-31T20:35:35.053+00:00',
      '#EXT-X-DATERANGE:ID="12345",START-DATE="2023-04-13T18:16:15.840000Z",PLANNED-DURATION=-38.4,DURATION=-15.5'
    ].join('\n'));
    this.parser.end();

    const warnings = [
      'EXT-X-DATERANGE DURATION must not be negative',
      'EXT-X-DATERANGE PLANNED-DURATION must not be negative'
    ];

    assert.deepEqual(
      this.warnings,
      warnings,
      'warnings as expected'
    );
  });

  QUnit.test('warns when #EXT-X-DATERANGE has a END-ON-NEXT=YES attribute and a DURATION or END-DATE attribute', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST',
      '#EXT-X-PROGRAM-DATE-TIME:2017-07-31T20:35:35.053+00:00',
      '#EXT-X-DATERANGE:ID="12345",START-DATE="2023-04-13T15:15:15.840000Z",END-ON-NEXT=YES, END-DATE="2023-04-13T18:16:15.840000Z",CLASS="CLASSATTRIBUTE"'
    ].join('\n'));
    this.parser.end();

    const warnings = [
      'EXT-X-DATERANGE with an END-ON-NEXT=YES attribute must not contain DURATION or END-DATE attributes'
    ];

    assert.deepEqual(
      this.warnings,
      warnings,
      'warnings as expected'
    );
  });

  QUnit.test('warns when #EXT-X-DATERANGE has a END-ON-NEXT=YES attribute but not a CLASS attribute', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST',
      '#EXT-X-PROGRAM-DATE-TIME:2017-07-31T20:35:35.053+00:00',
      '#EXT-X-DATERANGE:ID="12345",START-DATE="2023-04-13T18:16:15.840000Z",END-ON-NEXT=YES'
    ].join('\n'));
    this.parser.end();

    const warnings = [
      'EXT-X-DATERANGE with an END-ON-NEXT=YES attribute must have a CLASS attribute'
    ];

    assert.deepEqual(
      this.warnings,
      warnings,
      'warnings as expected'
    );
  });

  QUnit.test('warns when playlist has multiple #EXT-X-DATERANGE tag same ID but different attribute values', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST',
      '#EXT-X-PROGRAM-DATE-TIME:2017-07-31T20:35:35.053+00:00',
      '#EXT-X-DATERANGE:ID="12345",START-DATE="2023-04-13T18:16:15.840000Z",END-ON-NEXT=YES,CLASS="CLASSATTRIBUTE"',
      '#EXT-X-DATERANGE:ID="12345",START-DATE="2023-04-13T18:16:15.840000Z",CLASS="CLASSATTRIBUTE1"'
    ].join('\n'));
    this.parser.end();

    const warnings = [
      'EXT-X-DATERANGE tags with the same ID in a playlist must have the same attributes values'
    ];

    assert.deepEqual(
      this.warnings,
      warnings,
      'warnings as expected'
    );
  });

  QUnit.test('when #EXT-X-DATERANGE has both DURATION and END-DATE attributes, value of the END-DATE attribute must be START-DATE + DURATION', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST',
      '#EXT-X-PROGRAM-DATE-TIME:2017-07-31T20:35:35.053+00:00',
      '#EXT-X-DATERANGE:ID="12345",START-DATE="2023-04-13T15:16:15.840000Z",DURATION=14.0,END-DATE="2023-04-13T18:15:15.840000Z"'
    ].join('\n'));
    this.parser.end();

    assert.deepEqual(this.parser.manifest.dateRanges[0].endDate, new Date('2023-04-13T15:16:29.840000Z'));
  });

  QUnit.test('warns when playlist contains #EXT-X-DATERANGE tag but no #EXT-X-PROGRAM-DATE-TIME', function(assert) {
    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST',
      '#EXT-X-DATERANGE:ID="12345",START-DATE="2023-04-13T18:16:15.840000Z",END-ON-NEXT=YES,CLASS="sampleClassAttrib"'
    ].join('\n'));
    this.parser.end();

    const warnings = [
      'A playlist with EXT-X-DATERANGE tag must contain atleast one EXT-X-PROGRAM-DATE-TIME tag'
    ];

    assert.deepEqual(
      this.warnings,
      warnings,
      'warnings as expected'
    );
  });

  QUnit.test('playlist with multiple ext-x-daterange with same ID but no conflicting attributes', function(assert) {
    const expectedDateRange = {
      id: '12345',
      scte35In: '0xFC30200FFF2',
      scte35Out: '0xFC30200FFF2',
      startDate: new Date('2023-04-13T18:16:15.840000Z'),
      class: 'CLASSATTRIBUTE'
    };

    this.parser.push([
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-DISCONTINUITY-SEQUENCE:0',
      '#EXTINF:10,',
      'media-00001.ts',
      '#EXT-X-ENDLIST',
      '#EXT-X-PROGRAM-DATE-TIME:2017-07-31T20:35:35.053+00:00',
      '#EXT-X-DATERANGE:ID="12345",SCTE35-IN=0xFC30200FFF2,START-DATE="2023-04-13T18:16:15.840000Z",CLASS="CLASSATTRIBUTE"',
      '#EXT-X-DATERANGE:ID="12345",SCTE35-OUT=0xFC30200FFF2,START-DATE="2023-04-13T18:16:15.840000Z"'
    ].join('\n'));
    this.parser.end();
    assert.equal(this.parser.manifest.dateRanges.length, 1, 'two dateranges with same ID are merged');
    assert.deepEqual(this.parser.manifest.dateRanges[0], expectedDateRange);

  });

  QUnit.test('playlist with multiple ext-x-daterange ', function(assert) {
    this.parser.push([
      ' #EXTM3U',
      '#EXT-X-VERSION:6',
      '#EXT-X-TARGETDURATION:8',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-PROGRAM-DATE-TIME:2017-07-31T20:35:35.053+00:00',
      '#EXT-X-DATERANGE:ID="event1",START-DATE="2023-04-20T10:00:00Z",DURATION=30.0,END-DATE="2023-04-20T10:00:30Z",X-CUSTOM-KEY="value"',
      '#EXTINF:8.0',
      'https://example.com/playlist1.m3u8',
      '#EXT-SCTE35-IN:0xFC002F0000000000FF000014056FFFFFFF065870697070657220506F6F7200',
      '#EXT-X-DATERANGE:ID="event2",START-DATE="2023-04-20T11:00:00Z",DURATION=60.0,END-DATE="2023-04-20T11:01:00Z",X-CUSTOM-KEY="value"',
      '#EXTINF:8.0,',
      'https://example.com/playlist2.m3u8',
      '#EXT-SCTE35-OUT:0xFC002F0000000000FF000014056FFFFFFF065870697070657220506F6F7200',
      '#EXT-X-DATERANGE:ID="event3",START-DATE="2023-04-20T12:00:00Z",DURATION=120.0,END-DATE="2023-04-20T12:02:00Z",X-CUSTOM-KEY="value"',
      '#EXTINF:8.0',
      'https://example.com/playlist3.m3u8',
      '#EXT-SCTE35-IN:0xFC002F0000000000FF000014056FFFFFFF065870697070657220506F6F7200',
      '#EXT-SCTE35-OUT:0xFC002F0000000000FF000014056FFFFFFF065870697070657220506F6F7200',
      '#EXT-X-ENDLIST'
    ].join('\n'));
    this.parser.end();
    assert.equal(this.parser.manifest.dateRanges.length, 3);
  });

  QUnit.test('parses #EXT-X-INDEPENDENT-SEGMENTS', function(assert) {
    this.parser.push([
      '#EXTM3U',
      '#EXT-X-VERSION:6',
      '#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,PART-HOLD-BACK=3.252,CAN-SKIP-UNTIL=42.0',
      '#EXT-X-INDEPENDENT-SEGMENTS'
    ].join('\n'));
    this.parser.end();
    assert.equal(this.parser.manifest.independentSegments, true);
  });

  QUnit.test('parses #EXT-X-CONTENT-STEERING', function(assert) {
    const expectedContentSteeringObject = {
      serverUri: '/foo?bar=00012',
      pathwayId: 'CDN-A'
    };

    this.parser.push('#EXT-X-CONTENT-STEERING:SERVER-URI="/foo?bar=00012",PATHWAY-ID="CDN-A"');
    this.parser.end();
    assert.deepEqual(this.parser.manifest.contentSteering, expectedContentSteeringObject);
  });

  QUnit.test('parses #EXT-X-CONTENT-STEERING without PATHWAY-ID', function(assert) {
    const expectedContentSteeringObject = {
      serverUri: '/bar?foo=00012'
    };

    this.parser.push('#EXT-X-CONTENT-STEERING:SERVER-URI="/bar?foo=00012"');
    this.parser.end();
    assert.deepEqual(this.parser.manifest.contentSteering, expectedContentSteeringObject);
  });

  QUnit.test('warns on #EXT-X-CONTENT-STEERING missing SERVER-URI', function(assert) {
    const warning = ['#EXT-X-CONTENT-STEERING lacks required attribute(s): SERVER-URI'];

    this.parser.push('#EXT-X-CONTENT-STEERING:PATHWAY-ID="CDN-A"');
    this.parser.end();
    assert.deepEqual(this.warnings, warning, 'warnings as expected');
  });

  QUnit.test('playlist line numbers ', function(assert) {
    this.parser.push([
      '#EXTM3U',
      '#EXT-X-VERSION:7',
      '#EXT-X-TARGETDURATION:4',
      '#EXT-X-MEDIA-SEQUENCE:2421',
      '#EXT-X-MAP:URI="init.mp4"',
      '#EXTINF:3.989333,',
      '#EXT-X-PROGRAM-DATE-TIME:2024-04-17T09:43:19.871-0700',
      'stream2421.m4s',
      '#EXTINF:4.010667,',
      '#EXT-X-PROGRAM-DATE-TIME:2024-04-17T09:43:23.860-0700',
      'stream2422.m4s',
      '#EXTINF:3.989333,',
      '#EXT-X-PROGRAM-DATE-TIME:2024-04-17T09:43:27.871-0700',
      'stream2423.m4s',
      '#EXTINF:4.010667,',
      '#EXT-X-PROGRAM-DATE-TIME:2024-04-17T09:43:31.860-0700',
      'stream2424.m4s',
      '#EXTINF:3.989333,',
      '#EXT-X-PROGRAM-DATE-TIME:2024-04-17T09:43:35.871-0700',
      'stream2425.m4s',
      '#EXTINF:4.010667,',
      '#EXT-X-PROGRAM-DATE-TIME:2024-04-17T09:43:39.860-0700',
      'stream2426.m4s',
      '#EXTINF:3.989333,',
      '#EXT-X-PROGRAM-DATE-TIME:2024-04-17T09:43:43.871-0700',
      'stream2427.m4s',
      '#EXTINF:4.010667,',
      '#EXT-X-PROGRAM-DATE-TIME:2024-04-17T09:43:47.860-0700',
      'stream2428.m4s',
      '#EXTINF:3.989333,',
      '#EXT-X-PROGRAM-DATE-TIME:2024-04-17T09:43:51.871-0700',
      'stream2429.m4s',
      '#EXTINF:4.010667,',
      '#EXT-X-PROGRAM-DATE-TIME:2024-04-17T09:43:55.860-0700',
      'stream2430.m4s`'
    ].join('\n'));
    this.parser.end();
    assert.equal(this.parser.manifest.segments[2].lineNumberStart, 12);
    assert.equal(this.parser.manifest.segments[2].lineNumberEnd, 14);
  });

  QUnit.module('integration');

  /*
  for (const key in testDataExpected) {
    if (!testDataManifests[key]) {
      throw new Error(`${key}.js does not have an equivelent m3u8 manifest to test against`);
    }
  }

  for (const key in testDataManifests) {
    if (!testDataExpected[key]) {
      throw new Error(`${key}.m3u8 does not have an equivelent expected js file to test against`);
    }
    QUnit.test(`parses ${key}.m3u8 as expected in ${key}.js`, function(assert) {
      this.parser.push(testDataManifests[key]());
      this.parser.end();

      assert.deepEqual(
        this.parser.manifest,
        testDataExpected[key](),
        key + '.m3u8 was parsed correctly'
      );
    });
  }
  */

});
