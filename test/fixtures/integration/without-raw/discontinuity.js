module.exports = {
  allowCache: true,
  mediaSequence: 0,
  discontinuitySequence: 0,
  segments: [
    {
      duration: 10,
      raw: undefined,
      timeline: 0,
      uri: '001.ts'
    },
    {
      duration: 19,
      raw: undefined,
      timeline: 0,
      uri: '002.ts'
    },
    {
      discontinuity: true,
      duration: 10,
      raw: undefined,
      timeline: 1,
      uri: '003.ts'
    },
    {
      duration: 11,
      raw: undefined,
      timeline: 1,
      uri: '004.ts'
    },
    {
      discontinuity: true,
      duration: 10,
      raw: undefined,
      timeline: 2,
      uri: '005.ts'
    },
    {
      duration: 10,
      raw: undefined,
      timeline: 2,
      uri: '006.ts'
    },
    {
      duration: 10,
      raw: undefined,
      timeline: 2,
      uri: '007.ts'
    },
    {
      discontinuity: true,
      duration: 10,
      raw: undefined,
      timeline: 3,
      uri: '008.ts'
    },
    {
      duration: 16,
      raw: undefined,
      timeline: 3,
      uri: '009.ts'
    }
  ],
  targetDuration: 19,
  endList: true,
  discontinuityStarts: [2, 4, 7],
  version: 3
};
