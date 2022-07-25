import {
  initWasmEvent,
  loadDataEvent,
  pauseEvent,
  playEvent,
  stopEvent,
} from "./events";

const PROCESSOR_MODULE_NAME = "mod-processor";
const NUM_OF_INPUTS = 0;
const NUM_OF_OUTPUTS = 2;
const DEFAULT_SAMPLE_RATE = 48000;

type ModOptions = {
  src?: ArrayBuffer | Int8Array;
  wasmBuffer?: ArrayBuffer;
};

let _fetchedWasmBuffer: ArrayBuffer | null = null;

/**
 * This class is the newer approach that uses an AudioWorkletProcessor.
 *
 * There is currently an issue with the `micromod` library and playing back with a smaller buffer size.
 * The AudioWorkletProcessor calls the process method with a small buffer size of 128 samples.
 * This is a known issue and will be fixed in the future.
 */
export class Mod {
  context: AudioContext;
  node: AudioWorkletNode | null = null;
  data: ArrayBuffer | Int8Array | null = null;
  loadProcessorPromise: Promise<void>;
  loadWasmPromise: Promise<void>;
  wasmBuffer: ArrayBuffer | null = null;

  constructor({ src, wasmBuffer }: ModOptions = {}) {
    this.context = new AudioContext();
    this.loadProcessorPromise = this.context.audioWorklet.addModule(
      new URL("mod-processor.js", import.meta.url)
    );
    this.loadWasmPromise = Promise.resolve();
    this.wasmBuffer = wasmBuffer || _fetchedWasmBuffer;

    if (!wasmBuffer && !_fetchedWasmBuffer) {
      this.loadWasmPromise = fetch(
        new URL("hxcmod_player.wasm", import.meta.url)
      )
        .then((response) => response.arrayBuffer())
        .then((buffer) => {
          // Cache the wasm buffer globally to save on fetching it again.
          _fetchedWasmBuffer = buffer;
          this.wasmBuffer = _fetchedWasmBuffer;
        });
    }

    if (src) {
      this.loadData(src);
    }
  }

  async init() {
    await this.loadProcessorPromise;
    await this.loadWasmPromise;
  }

  #createNode() {
    const node = new AudioWorkletNode(this.context, PROCESSOR_MODULE_NAME, {
      numberOfInputs: NUM_OF_INPUTS,
      numberOfOutputs: NUM_OF_OUTPUTS,
    });
    if (!this.wasmBuffer) {
      throw new Error(
        "Cannot instantiate player audio worklet node without a wasm buffer"
      );
    }
    // We need to send an array buffer of the wasm module to the audio worklet node.
    // This is because the audio worklet node is not able to fetch a wasm module from a URL.
    node.port.postMessage(initWasmEvent(this.wasmBuffer));
    return node;
  }

  getSamplingRate() {
    return this.context?.sampleRate || DEFAULT_SAMPLE_RATE;
  }

  async loadData(data: ArrayBuffer | Int8Array) {
    await this.init();
    if (!this.node) {
      this.node = this.#createNode();
    }
    this.data = data;
    this.node.port.postMessage(loadDataEvent(data, this.getSamplingRate()));
  }

  async play() {
    await this.init();
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
    if (!this.node) {
      this.node = this.#createNode();

      //  Reload data if present
      if (this.data) {
        await this.loadData(this.data);
      }
    }
    this.node.connect(this.context.destination);
    this.node.port.postMessage(playEvent());
  }

  async pause() {
    await this.init();
    this.node?.port.postMessage(pauseEvent());
  }

  async stop() {
    if (!this.node) {
      return;
    }

    await this.init();
    this.node.disconnect(this.context.destination);
    this.node.port.postMessage(stopEvent());
    this.node = null;
    await this.context.suspend();
  }
}
