# webtrack

A collection of media players for Tracker music used in Video Games.

Uses latest HTML5 Audio features:
- Audio Worklet Node to move processing off the main thread
- AudioBufferSourceNode for PCM playback

**Example Site:** https://webtrack.vercel.app/

## Currently Supports

### [@webtrack/mod](./packages/mod/)
Module file player (using [`micromod`](https://github.com/martincameron/micromod)). Supports the Noisetracker/Soundtracker/Protracker/Fasttracker Module Format (`*.mod`).

### [@webtrack/smp](./packages/sample/)
Sample file player. For raw PCM samples output from Protracker & Fasttracker (`*.raw` or `*.smp`).
