import type { ProcessorEvent } from "./events";
import { Module, Micromod } from "./micromod";

class ModProcessor extends AudioWorkletProcessor {
  module: Module | null = null;
  audioSource: Micromod | null = null;
  isPlaying = false;

  constructor() {
    super();

    this.port.onmessage = (event: MessageEvent) => {
      const data: ProcessorEvent = event.data;

      if (data.command === "loadData") {
        this.loadData(data.file, data.sampleRate);
      }
      if (data.command === "play") {
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

  play() {
    this.isPlaying = true;
  }

  pause() {
    this.isPlaying = false;
  }

  stop() {
    this.isPlaying = false;
    if (!this.audioSource) {
      return;
    }
    this.audioSource.seek(0);
  }

  loadData(data: ArrayBuffer | Int8Array, sampleRate: number) {
    this.isPlaying = false;
    this.module = new Module(data);
    this.audioSource = new Micromod(this.module, sampleRate);
  }

  process(_inputs: any, outputs: any, _parameters: any) {
    if (
      outputs.length !== 2 ||
      !this.audioSource ||
      !this.module ||
      !this.isPlaying
    ) {
      return true;
    }

    const leftBuf = outputs[0][0];
    const rightBuf = outputs[1][0];
    const bufferSize = Math.min(leftBuf.length, rightBuf.length);
    this.audioSource.getAudio(leftBuf, rightBuf, bufferSize);

    return true;
  }
}

registerProcessor("mod-processor", ModProcessor);
