# @webtrack/smp

Uses Web Audio API to playback `*.smp`/`*.raw` PCM files in the browser.

Intends to support samples created with Protracker, Fasttracker II etc.

## Usage

```shell
npm install -S @webtrack/smp
# yarn add @webtrack/smp
# pnpm add @webtrack/smp
```

You'll need to load a sample file into the browser. Likely fetching from a remote resource:

```js
import { Smp } from "@webtrack/smp";

const source = await fetch("/cool-sound.smp").then((res) => res.arrayBuffer());

const sample = new Smp({ src: source });
sample.play();
```

A working example can be found in [the example app](../../examples/).

A live version is hosted at https://webtrack.vercel.app/

## API

### Constructor `new Smp(options?)`

Options:

- `src`: A typed array or ArrayBuffer of the sample file
- `bitDepth`: (Default, `'8'`) The bit depth of the sample. Either 8, 16, 32 or 32 Float. Indicative of the typed array. An 8 bit depth PCM sample data would be stored in an Int8Array.
- `sampleRate`: (Default, `11025`) The sample rate the sample should be played back with. Altering this will affect the speed and pitch of playback.
- `loop`: (Default, `false`) Whether the sample should loop or not.

### `.loadData(options)`

Load a sample file in preparation to play

Options:

- `src`: A typed array or ArrayBuffer of the sample file
- `bitDepth`: (Default, `'8'`) The bit depth of the sample. Either 8, 16, 32 or 32 Float. Indicative of the typed array. An 8 bit depth PCM sample data would be stored in an Int8Array.
- `sampleRate`: (Default, `11025`) The sample rate the sample should be played back with. Altering this will affect the speed and pitch of playback.
- `loop`: (Default, `false`) Whether the sample should loop or not.

### `.play()`

Play/resume the currently loaded sample

### `.pause()`

Pauses playback of the sample

### `.stop()`

Stops playback of the current sample. Playing again will resume from the start.

### `.setVolume(volume)`

Sets the current volume of the sample. The value is between `1` and `0`. `1` being 100%, `0.5` being `50%` etc.
