import { loadDataEvent, pauseEvent, playEvent, stopEvent } from "./events";

const PROCESSOR_MODULE_NAME = "mod-processor";
const NUM_OF_INPUTS = 0;
const NUM_OF_OUTPUTS = 1;
const NUM_OF_CHANNELS = 2;
const DEFAULT_SAMPLE_RATE = 48000;

type ModOptions = {
  src?: ArrayBuffer | Int8Array;
};

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

  constructor({ src }: ModOptions = {}) {
    this.context = new AudioContext();
    this.loadProcessorPromise = this.context.audioWorklet.addModule(
      new URL("mod-processor.js", import.meta.url)
    );

    if (src) {
      this.loadData(src);
    }
  }

  async init() {
    await this.loadProcessorPromise;
  }

  #createNode() {
    return new AudioWorkletNode(this.context, PROCESSOR_MODULE_NAME, {
      numberOfInputs: NUM_OF_INPUTS,
      numberOfOutputs: NUM_OF_OUTPUTS,
      outputChannelCount: [NUM_OF_CHANNELS],
    });
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
