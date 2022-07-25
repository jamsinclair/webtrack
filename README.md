# webtrack

A collection of media players for Tracker music used in Video Games.

Uses latest HTML5 Audio features:
- Audio Worklet Node to move processing off the main thread
- AudioBufferSourceNode for PCM playback

**Currently Supporting:**

- Module files (using [HxCMOD player](https://github.com/jfdelnero/HxCModPlayer)). Supports the Noisetracker/Soundtracker/Protracker/Fasttracker Module Format (`*.mod`)
  - See: [@webtrack/mod](./packages/mod/)
- Sample files. Raw PCM samples output from Protracker Fasttracker (`*.raw` or `*.smp`).
  - See: [@webtrack/smp](./packages/sample/)
