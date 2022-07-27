import type { ProcessorEvent } from "./events";
import type { HxcModPlayerModule } from "./hxcmod_player.js";
import HxcModPlayer from "./hxcmod_player.js";

class ModProcessor extends AudioWorkletProcessor {
  _bufferSize: number = 0;
  _sampleRate: number = 0;

  isPlaying = false;
  mod: Int8Array | null = null;

  wasmPromise: Promise<HxcModPlayerModule> | Promise<void> = Promise.resolve();
  wasmModule: HxcModPlayerModule | null = null;
  pointerToMod = 0;
  modCtx = 0;
  leftChannelPtr = 0;
  rightChannelPtr = 0;
  leftChannel = new Float32Array(0);
  rightChannel = new Float32Array(0);

  constructor() {
    super();

    this.port.onmessage = async (event: MessageEvent) => {
      const data: ProcessorEvent = event.data;

      if (data.command === "initWasm") {
        this.initWasm(data.file);
      }
      if (data.command === "loadData") {
        this.loadData(data.file, data.sampleRate);
      }
      if (data.command === "play") {
        await this.wasmPromise;
        this.play();
      }
      if (data.command === "pause") {
        this.pause();
      }
      if (data.command === "stop") {
        this.stop();
      }
    };
  }

  async initWasm(file: ArrayBuffer) {
    const instantiateWasm = async (
      imports: WebAssembly.Imports,
      callback: (inst: WebAssembly.Instance) => void
    ) => {
      const { instance } = await WebAssembly.instantiate(file, imports);
      callback(instance);
      return instance.exports;
    };
    this.wasmPromise = HxcModPlayer({ instantiateWasm });
    this.wasmModule = await this.wasmPromise;
  }

  configureWasm(bufferSize: number) {
    if (bufferSize === this._bufferSize) {
      return;
    }

    if (!this.wasmModule) {
      throw new Error("Wasm module is not initialized");
    }

    if (!this.mod) {
      throw new Error("Cannot configure wasm module without a mod file");
    }

    this._bufferSize = bufferSize;

    this.wasmModule._free(this.leftChannelPtr);
    this.leftChannelPtr = this.wasmModule._malloc(4 * this._bufferSize);
    this.wasmModule._free(this.rightChannelPtr);
    this.rightChannelPtr = this.wasmModule._malloc(4 * this._bufferSize);
    this.leftChannel = new Float32Array(
      this.wasmModule.HEAPF32.buffer,
      this.leftChannelPtr,
      this._bufferSize
    );
    this.rightChannel = new Float32Array(
      this.wasmModule.HEAPF32.buffer,
      this.rightChannelPtr,
      this._bufferSize
    );
  }

  play() {
    this.isPlaying = true;
  }

  pause() {
    this.isPlaying = false;
  }

  stop() {
    this.isPlaying = false;

    if (this.mod && this._sampleRate) {
      // Reload the mod file to start from the beginning
      this.loadData(this.mod, this._sampleRate);
    }
  }

  async loadData(data: ArrayBuffer | Int8Array, sampleRate: number) {
    if (!this.wasmModule) {
      await this.wasmPromise;
    }

    this.isPlaying = false;
    this.mod = data instanceof ArrayBuffer ? new Int8Array(data) : data;
    this._sampleRate = sampleRate;

    this.wasmModule?._free(this.pointerToMod);
    this.pointerToMod = this.wasmModule?._malloc(this.mod.byteLength) ?? 0;
    this.wasmModule?._free(this.modCtx);
    this.wasmModule?.HEAPU8.set(this.mod, this.pointerToMod);
    this.modCtx =
      this.wasmModule?._loadMod(
        this.pointerToMod,
        this.mod.byteLength,
        sampleRate
      ) ?? 0;
  }

  process(_inputs: any, outputs: any, _parameters: any) {
    if (
      outputs.length !== 2 ||
      !this.wasmModule ||
      !this.mod ||
      !this.isPlaying
    ) {
      return true;
    }

    const leftBuffer = outputs[0][0];
    const rightBuffer = outputs[1][0];
    const bufferSize = Math.min(leftBuffer.length, rightBuffer.length);

    this.configureWasm(bufferSize);
    this.wasmModule._getNextSoundData(
      this.modCtx,
      this.leftChannelPtr,
      this.rightChannelPtr,
      bufferSize
    );

    leftBuffer.set(this.leftChannel.subarray(0, bufferSize));
    rightBuffer.set(this.rightChannel.subarray(0, bufferSize));

    return true;
  }
}

registerProcessor("mod-processor", ModProcessor);
