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
import { Mod } from "@webtrack/mod";

const modFile = await fetch("/cool-music.mod").then((res) => res.arrayBuffer());

const player = new Mod({ src: modFile });
await player.play();
```

A working example can be found in [the example app](../../examples/).

A live version is hosted at https://webtrack.vercel.app/

### With Vite

Vite seems to have issues bundling third party modules that use URLs with `import.meta.url`. To bypass this issue we can pass the necessary resources to the constructor. We will manually [import the files statically with Vite](https://vitejs.dev/guide/assets.html) and pass those assets URLs to the constructor.

```js
import { Mod } from "@webtrack/mod";
// The following assets are statically imported via the `?url` prefix.
// The resolved import will be a string of the location of the asset.
import audioWorkletUrl from "@webtrack/mod/dist/mod-processor.js?url";
import wasmUrl from "@webtrack/mod/dist/hxcmod_player.wasm?url";

const modFile = await fetch("/cool-music.mod").then((res) => res.arrayBuffer());
const mod = new Mod({
  src: modFile,
  audioWorkletUrl,
  wasmUrl,
});
```

## API

### Constructor `new Mod(options?: { src?: ArrayBuffer | Int8Array, wasmBuffer?: ArrayBuffer })`

- Optional `src`: The mod file to play. Can be either an ArrayBuffer or Int8Array.
- Optional `wasmBuffer`: If the wasm module can't be instantiated automatically, you can manually pass this in. You'll need to fetch the wasm file yourself as an ArrayBuffer. It is bundled with the module at `@webtrack/mod/dist/hxcmod_player.wasm`.
- Optional `audioWorkletUrl`: An asset url for the audio worklet. Useful workaround for bundlers that can't process third party URLs with `import.meta.url`.
- Optional `wasmUrl`: An asset url for the wasm module. Useful workaround for bundlers that can't process third party URLs with `import.meta.url`.

### `.loadData({ src: ArrayBuffer | Int8Array }): Promise<void>`

Load a mod file in preparation to play

### `.play(): Promise<void>`

Play/resume the currently loaded mod file

### `.pause(): Promise<void>`

Pauses playback of the current mod file

### `.stop(): Promise<void>`

Stops playback of the current mod file. Playing again will resume from the start.
