# @webtrack/mod

Uses Web Audio API to playback `*.mod` files in the browser.

Supports the Noisetracker/Soundtracker/Protracker/Fasttracker Module Format (`*.mod`).

Powered by the wasm [`HxCMod Player`](https://github.com/jfdelnero/HxCModPlayer).

## Usage

```shell
npm install -S @webtrack/mod
# yarn add @webtrack/mod
# pnpm add @webtrack/mod
```

You'll need to load a mod file into the browser. Likely fetching from a remote resource:
```js
import { Mod } from '@webtrack/mod';

const modFile = await fetch('/cool-music.mod').then(res => res.arrayBuffer());

const player = new Mod({ src: modFile });
await player.play();
```

A working example can be found in [the example app](../../examples/).

A live version is hosted at <todo>

## API

### Constructor `new Mod(options?: { src?: ArrayBuffer | Int8Array, wasmBuffer?: ArrayBuffer })`
- Optional `src`: The mod file to play. Can be either an ArrayBuffer or Int8Array.
- Optional `wasmBuffer`: If the wasm module can't be instantiated automatically, you can manually pass this in. You'll need to fetch the wasm file yourself as an ArrayBuffer. It is bundled with the module at `@webtrack/mod/dist/hxcmod_player.wasm`.

### `.loadData({ src: ArrayBuffer | Int8Array }): Promise<void>`

Load a mod file in preparation to play

### `.play(): Promise<void>`

Play/resume the currently loaded mod file

### `.pause(): Promise<void>`

Pauses playback of the current mod file

### `.stop(): Promise<void>`

Stops playback of the current mod file. Playing again will resume from the start.
