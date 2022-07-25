import { Micromod, Module } from "./micromod";

const DEFAULT_SAMPLE_RATE = 48000;
const DEFAULT_BUFFER_SIZE = 4096;

type ModOptions = {
  src?: ArrayBuffer | Int8Array;
};

/**
 * This is the legacy approach that relies on the now deprecated ScriptProcessorNode.
 * This is the default class used for the mod library due to issues with newer AudioWorkletProcessor
 */
export class Mod {
  context: AudioContext;
  isPlaying: boolean = false;
  module: Module | null = null;
  source: Micromod | null = null;
  node: ScriptProcessorNode | null = null;

  constructor({ src }: ModOptions = {}) {
    this.context = new AudioContext();

    if (src) {
      this.loadData(src);
    }
  }

  getSamplingRate() {
    return this.context?.sampleRate || DEFAULT_SAMPLE_RATE;
  }

  loadData(data: ArrayBuffer | Int8Array) {
    this.module = new Module(
      data instanceof ArrayBuffer ? new Int8Array(data) : data
    );
    this.source = new Micromod(this.module, this.getSamplingRate());
    this.node = this.context.createScriptProcessor(DEFAULT_BUFFER_SIZE, 0, 2);
  }

  process(event: AudioProcessingEvent) {
    if (!this.isPlaying) {
      return;
    }

    const leftBuf = event.outputBuffer.getChannelData(0);
    const rightBuf = event.outputBuffer.getChannelData(1);
    this.source?.getAudio(leftBuf, rightBuf, event.outputBuffer.length);
  }

  async play() {
    if (!this.node || !this.source) {
      return;
    }
    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    this.node.onaudioprocess = this.process.bind(this);
    this.node.connect(this.context.destination);
    this.isPlaying = true;
  }

  async pause() {
    this.isPlaying = false;
  }

  async stop() {
    if (!this.node?.onaudioprocess) {
      return;
    }

    this.node.onaudioprocess = null;
    this.node.disconnect();
    await this.context.suspend();
  }
}
