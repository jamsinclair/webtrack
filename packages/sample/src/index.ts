type TypedArrays = Int8Array | Int16Array | Int32Array | Float32Array;

const MaxValues = {
  "8": 128,
  "16": 32768,
  "32": 2147483648,
  "32f": 1,
} as const;

const BitDepthToTypedArray = {
  "8": Int8Array,
  "16": Int16Array,
  "32": Int32Array,
  "32f": Float32Array,
} as const;

const BitDepths = ["8", "16", "32", "32f"] as const;
type BitDepth = typeof BitDepths[number];

const DEFAULT_BITDEPTH: BitDepth = "8";
const DEFAULT_SAMPLE_RATE: number = 11025;

// I believe Fasttracker II uses mono samples?
// Let's keep channels at 1 for now
const NUM_OF_CHANNELS = 1;

const MAX_GAIN = 1;

const convertToFloat32Data = (src: TypedArrays, bitDepth: BitDepth) => {
  const dest = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) {
    dest[i] = src[i] / MaxValues[bitDepth];
  }
  return dest;
};

// Clamp the volume to a range between 0.01 and 1.
// We cannot use 0 because we can't ramp the gain to non-positive value.
const clampVolume = (volume: number) => Math.max(0.01, Math.min(volume, MAX_GAIN));

type SmpData = {
  src: TypedArrays | ArrayBuffer;
  bitDepth?: BitDepth;
  sampleRate?: number;
  loop?: boolean;
};

type SmpOptions = Omit<SmpData, "src"> & {
  src?: TypedArrays | ArrayBuffer;
};

export class Smp {
  context: AudioContext;
  gainNode: GainNode | null = null;
  sourceNode: AudioBufferSourceNode | null = null;
  data: ArrayBuffer | TypedArrays | null = null;
  sampleRate: number;
  bitDepth: BitDepth;
  volume = 1;
  loop = false;

  #nodes: Set<AudioBufferSourceNode> = new Set();

  constructor({ src, bitDepth, sampleRate }: SmpOptions = {}) {
    this.context = new AudioContext();
    this.bitDepth = bitDepth || DEFAULT_BITDEPTH;
    this.sampleRate = sampleRate || DEFAULT_SAMPLE_RATE;

    if (src) {
      this.loadData({ src });
    }
  }

  #getSourceNode(data: ArrayBuffer | TypedArrays) {
    const sourceNode = new AudioBufferSourceNode(this.context, {
      loop: this.loop,
    });
    const typedData = new BitDepthToTypedArray[this.bitDepth](data);
    const buffer = this.context.createBuffer(
      NUM_OF_CHANNELS,
      typedData.length,
      this.sampleRate
    );
    const channelData = convertToFloat32Data(typedData, this.bitDepth);
    buffer.copyToChannel(channelData, 0);
    sourceNode.buffer = buffer;
    return sourceNode;
  }

  loadData({ src, bitDepth, sampleRate, loop }: SmpData) {
    if (!this.sourceNode) {
      this.sourceNode = new AudioBufferSourceNode(this.context);
    }
    this.setLoop(Boolean(loop));
    this.setBitDepth(bitDepth || this.bitDepth);
    this.setSampleRate(sampleRate || this.sampleRate);
    this.data = src;
    this.sourceNode = this.#getSourceNode(src);
  }

  setLoop(loop: boolean) {
    this.loop = loop;
  }

  setBitDepth(bitDepth: BitDepth) {
    if (BitDepths.indexOf(bitDepth) === -1) {
      throw new Error(
        `Invalid bit depth, must be one of ${BitDepths.join(", ")}`
      );
    }

    this.bitDepth = bitDepth;
  }

  setSampleRate(sampleRate: number) {
    this.sampleRate = sampleRate;
  }

  setVolume(volume: number) {
    this.volume = clampVolume(volume);
    if (this.gainNode) {
      this.gainNode.gain.linearRampToValueAtTime(this.volume, this.context.currentTime + 0.01);
    }
  }

  stop() {
    for (const node of this.#nodes) {
      node?.stop();
      node?.disconnect();
    }
    this.sourceNode = null;

    if (this.gainNode) {
      this.gainNode.gain.value = 0;
      this.gainNode.disconnect();
      this.gainNode = null;
    }
  }

  play() {
    if (!this.data) {
      return;
    }

    if (this.gainNode === null) {
      this.gainNode = this.context.createGain();
      this.gainNode.gain.value = this.volume;
    }

    const currentNode = this.#getSourceNode(this.data);
    this.#nodes.add(currentNode);
    currentNode.onended = () => {
      currentNode.stop();
      currentNode.disconnect();
      this.#nodes.delete(currentNode);
    };

    this.gainNode.connect(this.context.destination);
    currentNode.connect(this.gainNode);
    currentNode.start(this.context.currentTime);
  }

  isPlaying() {
    return this.#nodes.size > 0;
  }
}
