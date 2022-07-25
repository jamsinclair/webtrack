/*
    JavaScript ProTracker Replay (c)2017 mumart@gmail.com

    Typescript and ES port by github.com/jamsinclair, 2022
*/
export class Micromod {
  #module: Module;
  #samplingRate: number;
  #interpolation = false;
  #mixBuf: Float32Array;
  #rampBuf = new Float32Array(64 * 2);
  #mixIdx = 0;
  #mixLen = 0;
  #seqPos = 0;
  #breakSeqPos = 0;
  #row = 0;
  #nextRow = 0;
  #tick = 0;
  #speed = 0;
  #tempo = 0;
  #plCount = 0;
  #plChannel = 0;
  #channels: Channel[];

  constructor(module: Module, samplingRate: number) {
    this.#module = module;
    this.#samplingRate = samplingRate;
    this.#mixBuf = new Float32Array(
      (this.#calculateTickLen(32, 128000) + 65) * 4
    );
    this.#channels = new Array(module.numChannels);

    this.setSamplingRate(samplingRate);
    this.setSequencePos(0);
  }

  /* Return a String representing the version of the replay. */
  getVersion() {
    return "20171013 (c)2017 mumart@gmail.com";
  }

  /* Return the sampling rate of playback. */
  getSamplingRate() {
    return this.#samplingRate;
  }

  /* Set the sampling rate of playback. */
  setSamplingRate(rate: number) {
    /* Use with Module.c2Rate to adjust the tempo of playback. */
    /* To play at half speed, multiply both the samplingRate and Module.c2Rate by 2. */
    if (rate < 8000 || rate > 128000) {
      throw "Unsupported sampling rate!";
    }
    this.#samplingRate = rate;
  }

  /* Enable or disable the linear interpolation filter. */
  setInterpolation(interp: boolean) {
    this.#interpolation = interp;
  }

  /* Get the current row position. */
  getRow() {
    return this.#row;
  }

  /* Get the current pattern position in the sequence. */
  getSequencePos() {
    return this.#seqPos;
  }

  /* Set the pattern in the sequence to play.
       The tempo is reset to the default. */
  setSequencePos(pos: number) {
    if (pos >= this.#module.sequenceLength) {
      pos = 0;
    }
    this.#breakSeqPos = pos;
    this.#nextRow = 0;
    this.#tick = 1;
    this.#speed = 6;
    this.#tempo = 125;
    this.#plCount = this.#plChannel = -1;
    for (let idx = 0; idx < this.#module.numChannels; idx++) {
      this.#channels[idx] = new Channel(this.#module, idx);
    }
    for (let idx = 0; idx < 128; idx++) {
      this.#rampBuf[idx] = 0;
    }
    this.#mixIdx = this.#mixLen = 0;
    this.#seqTick();
  }

  /* Returns the song duration in samples at the current sampling rate. */
  calculateSongDuration() {
    let duration = 0;
    this.setSequencePos(0);
    let songEnd = false;
    while (!songEnd) {
      duration += this.#calculateTickLen(this.#tempo, this.#samplingRate);
      songEnd = this.#seqTick();
    }
    this.setSequencePos(0);
    return duration;
  }

  /* Seek to approximately the specified sample position.
       The actual sample position reached is returned. */
  seek(samplePos: number) {
    this.setSequencePos(0);
    var currentPos = 0;
    var tickLen = this.#calculateTickLen(this.#tempo, this.#samplingRate);
    while (samplePos - currentPos >= tickLen) {
      for (var idx = 0; idx < this.#module.numChannels; idx++) {
        this.#channels[idx].updateSampleIdx(
          tickLen * 2,
          this.#samplingRate * 2
        );
      }
      currentPos += tickLen;
      this.#seqTick();
      tickLen = this.#calculateTickLen(this.#tempo, this.#samplingRate);
    }
    return currentPos;
  }

  /* Seek to the specified position and row in the sequence. */
  seekSequencePos(sequencePos: number, sequenceRow: number) {
    this.setSequencePos(0);
    if (sequencePos < 0 || sequencePos >= this.#module.sequenceLength) {
      sequencePos = 0;
    }
    if (sequenceRow >= 64) {
      sequenceRow = 0;
    }
    while (this.#seqPos < sequencePos || this.#row < sequenceRow) {
      var tickLen = this.#calculateTickLen(this.#tempo, this.#samplingRate);
      for (var idx = 0; idx < this.#module.numChannels; idx++) {
        this.#channels[idx].updateSampleIdx(
          tickLen * 2,
          this.#samplingRate * 2
        );
      }
      if (this.#seqTick()) {
        // Song end reached.
        this.setSequencePos(sequencePos);
        return;
      }
    }
  }

  /* Write count floating-point stereo samples into the specified buffers. */
  getAudio(leftBuf: Float32Array, rightBuf: Float32Array, count: number) {
    var outIdx = 0;
    while (outIdx < count) {
      if (this.#mixIdx >= this.#mixLen) {
        this.#mixLen = this.#mixAudio();
        this.#mixIdx = 0;
      }
      var remain = this.#mixLen - this.#mixIdx;
      if (outIdx + remain > count) {
        remain = count - outIdx;
      }
      for (var end = outIdx + remain; outIdx < end; outIdx++, this.#mixIdx++) {
        leftBuf[outIdx] = this.#mixBuf[this.#mixIdx * 2];
        rightBuf[outIdx] = this.#mixBuf[this.#mixIdx * 2 + 1];
      }
    }
  }

  #mixAudio() {
    // Generate audio. The number of samples produced is returned.
    var tickLen = this.#calculateTickLen(this.#tempo, this.#samplingRate);
    for (var idx = 0, end = (tickLen + 65) * 4; idx < end; idx++) {
      // Clear mix buffer.
      this.#mixBuf[idx] = 0;
    }
    for (var idx = 0; idx < this.#module.numChannels; idx++) {
      // Resample and mix each channel.
      var chan = this.#channels[idx];
      chan.resample(
        this.#mixBuf,
        0,
        (tickLen + 65) * 2,
        this.#samplingRate * 2,
        this.#interpolation
      );
      chan.updateSampleIdx(tickLen * 2, this.#samplingRate * 2);
    }
    this.#downsample(this.#mixBuf, tickLen + 64);
    this.#volumeRamp(tickLen);
    // Update the sequencer.
    this.#seqTick();
    return tickLen;
  }

  #calculateTickLen(tempo: number, sampleRate: number) {
    return ((sampleRate * 5) / (tempo * 2)) | 0;
  }

  #volumeRamp(tickLen: number) {
    var rampRate = 2048 / this.#samplingRate;
    for (var idx = 0, a1 = 0; a1 < 1; idx += 2, a1 += rampRate) {
      var a2 = 1 - a1;
      this.#mixBuf[idx] = this.#mixBuf[idx] * a1 + this.#rampBuf[idx] * a2;
      this.#mixBuf[idx + 1] =
        this.#mixBuf[idx + 1] * a1 + this.#rampBuf[idx + 1] * a2;
    }
    this.#rampBuf.set(this.#mixBuf.subarray(tickLen * 2, (tickLen + 64) * 2));
  }

  #downsample(buf: Float32Array, count: number) {
    // 2:1 downsampling with simple but effective anti-aliasing.
    // Buf must contain count * 2 + 1 stereo samples.
    var outLen = count * 2;
    for (let inIdx = 0, outIdx = 0; outIdx < outLen; inIdx += 4, outIdx += 2) {
      buf[outIdx] =
        buf[inIdx] * 0.25 + buf[inIdx + 2] * 0.5 + buf[inIdx + 4] * 0.25;
      buf[outIdx + 1] =
        buf[inIdx + 1] * 0.25 + buf[inIdx + 3] * 0.5 + buf[inIdx + 5] * 0.25;
    }
  }

  #seqTick() {
    var songEnd = false;
    if (--this.#tick <= 0) {
      this.#tick = this.#speed;
      songEnd = this.#seqRow();
    } else {
      for (var idx = 0; idx < this.#module.numChannels; idx++) {
        this.#channels[idx].tick();
      }
    }
    return songEnd;
  }

  #seqRow() {
    var songEnd = false;
    if (this.#nextRow < 0) {
      this.#breakSeqPos = this.#seqPos + 1;
      this.#nextRow = 0;
    }
    if (this.#breakSeqPos >= 0) {
      if (this.#breakSeqPos >= this.#module.sequenceLength) {
        this.#breakSeqPos = this.#nextRow = 0;
      }
      if (this.#breakSeqPos <= this.#seqPos) {
        songEnd = true;
      }
      this.#seqPos = this.#breakSeqPos;
      for (var idx = 0; idx < this.#module.numChannels; idx++) {
        this.#channels[idx].plRow = 0;
      }
      this.#breakSeqPos = -1;
    }
    this.#row = this.#nextRow;
    this.#nextRow = this.#row + 1;
    if (this.#nextRow >= 64) {
      this.#nextRow = -1;
    }
    var patOffset =
      (this.#module.sequence[this.#seqPos] * 64 + this.#row) *
      this.#module.numChannels *
      4;
    for (var chanIdx = 0; chanIdx < this.#module.numChannels; chanIdx++) {
      var channel = this.#channels[chanIdx];
      var key = this.#module.patterns[patOffset] & 0xff;
      var ins = this.#module.patterns[patOffset + 1] & 0xff;
      var effect = this.#module.patterns[patOffset + 2] & 0xff;
      var param = this.#module.patterns[patOffset + 3] & 0xff;
      patOffset += 4;
      if (effect == 0xe) {
        effect = 0x10 | (param >> 4);
        param &= 0xf;
      }
      if (effect == 0 && param > 0) {
        effect = 0xe;
      }
      channel.row(key, ins, effect, param);
      switch (effect) {
        case 0xb /* Pattern Jump.*/:
          if (this.#plCount < 0) {
            this.#breakSeqPos = param;
            this.#nextRow = 0;
          }
          break;
        case 0xd /* Pattern Break.*/:
          if (this.#plCount < 0) {
            if (this.#breakSeqPos < 0) {
              this.#breakSeqPos = this.#seqPos + 1;
            }
            this.#nextRow = (param >> 4) * 10 + (param & 0xf);
            if (this.#nextRow >= 64) {
              this.#nextRow = 0;
            }
          }
          break;
        case 0xf /* Set Speed.*/:
          if (param > 0) {
            if (param < 32) {
              this.#tick = this.#speed = param;
            } else {
              this.#tempo = param;
            }
          }
          break;
        case 0x16 /* Pattern Loop.*/:
          if (param == 0) {
            /* Set loop marker on this channel. */
            channel.plRow = this.#row;
          }
          if (channel.plRow < this.#row && this.#breakSeqPos < 0) {
            /* Marker valid. */
            if (this.#plCount < 0) {
              /* Not already looping, begin. */
              this.#plCount = param;
              this.#plChannel = chanIdx;
            }
            if (this.#plChannel == chanIdx) {
              /* Next Loop.*/
              if (this.#plCount == 0) {
                /* Loop finished. */
                /* Invalidate current marker. */
                channel.plRow = this.#row + 1;
              } else {
                /* Loop. */
                this.#nextRow = channel.plRow;
              }
              this.#plCount--;
            }
          }
          break;
        case 0x1e /* Pattern Delay.*/:
          this.#tick = this.#speed + this.#speed * param;
          break;
      }
    }
    return songEnd;
  }
}

class Channel {
  #module: Module;
  #fineTuning = new Int16Array([
    4340, 4308, 4277, 4247, 4216, 4186, 4156, 4126, 4096, 4067, 4037, 4008,
    3979, 3951, 3922, 3894,
  ]);

  #sineTable = new Int16Array([
    0, 24, 49, 74, 97, 120, 141, 161, 180, 197, 212, 224, 235, 244, 250, 253,
    255, 253, 250, 244, 235, 224, 212, 197, 180, 161, 141, 120, 97, 74, 49, 24,
  ]);

  // Private fields
  #noteKey = 0;
  #noteEffect = 0;
  #noteParam = 0;
  #noteIns = 0;
  #instrument = 0;
  #assigned = 0;
  #sampleOffset = 0;
  #sampleIdx = 0;
  #sampleFra = 0;
  #freq = 0;
  #volume = 0;
  #panning = 0;
  #fineTune = 0;
  #ampl = 0;
  #period = 0;
  #portaPeriod = 0;
  #portaSpeed = 0;
  #fxCount = 0;
  #vibratoType = 0;
  #vibratoPhase = 0;
  #vibratoSpeed = 0;
  #vibratoDepth = 0;
  #tremoloType = 0;
  #tremoloPhase = 0;
  #tremoloSpeed = 0;
  #tremoloDepth = 0;
  #tremoloAdd = 0;
  #vibratoAdd = 0;
  #arpeggioAdd = 0;
  #randomSeed: number;

  plRow = 0;

  constructor(module: Module, id: number) {
    this.#module = module;
    this.#randomSeed = (id + 1) * 0xabcdef;
    switch (id & 0x3) {
      case 0:
      case 3:
        this.#panning = 0;
        break;
      case 1:
      case 2:
        this.#panning = 127;
        break;
    }
  }

  resample(
    outBuf: Float32Array,
    offset: number,
    count: number,
    sampleRate: number,
    interpolate: boolean
  ) {
    let epos;
    let buf_idx = offset << 1;
    const buf_end = (offset + count) << 1;
    let outIdx = offset * 2;
    const outEnd = (offset + count) * 2;
    let samIdx = this.#sampleIdx;
    const step = this.#freq / sampleRate;
    const ins = this.#module.instruments[this.#instrument];
    const loopLen = ins.loopLength;
    const loopEnd = ins.loopStart + loopLen;
    const sampleData = ins.sampleData;

    if (this.#ampl <= 0) return;
    const lGain = (this.#ampl * this.#panning) / 32768;
    const rGain = (this.#ampl * (127 - this.#panning)) / 32768;

    if (interpolate) {
      while (outIdx < outEnd) {
        if (samIdx >= loopEnd) {
          if (loopLen <= 1) break;
          while (samIdx >= loopEnd) samIdx -= loopLen;
        }
        var x = samIdx | 0;
        var c = sampleData[x];
        var m = sampleData[x + 1] - c;
        var y = m * (samIdx - x) + c;
        outBuf[outIdx++] += y * lGain;
        outBuf[outIdx++] += y * rGain;
        samIdx += step;
      }
    } else {
      while (outIdx < outEnd) {
        if (samIdx >= loopEnd) {
          if (loopLen <= 1) break;
          while (samIdx >= loopEnd) samIdx -= loopLen;
        }
        var y = sampleData[samIdx | 0];
        outBuf[outIdx++] += y * lGain;
        outBuf[outIdx++] += y * rGain;
        samIdx += step;
      }
    }
  }

  updateSampleIdx(count: number, sampleRate: number) {
    this.#sampleIdx += (this.#freq / sampleRate) * count;
    const ins = this.#module.instruments[this.#instrument];
    if (this.#sampleIdx > ins.loopStart) {
      if (ins.loopLength > 1) {
        this.#sampleIdx =
          ins.loopStart + ((this.#sampleIdx - ins.loopStart) % ins.loopLength);
      } else {
        this.#sampleIdx = ins.loopStart;
      }
    }
  }

  row(key: number, ins: number, effect: number, param: number) {
    this.#noteKey = key;
    this.#noteIns = ins;
    this.#noteEffect = effect;
    this.#noteParam = param;
    this.#vibratoAdd = this.#tremoloAdd = this.#arpeggioAdd = this.#fxCount = 0;
    if (!(effect == 0x1d && param > 0)) {
      /* Not note delay. */
      this.#trigger();
    }
    switch (effect) {
      case 0x3 /* Tone Portamento.*/:
        if (param > 0) this.#portaSpeed = param;
        break;
      case 0x4 /* Vibrato.*/:
        if ((param & 0xf0) > 0) this.#vibratoSpeed = param >> 4;
        if ((param & 0x0f) > 0) this.#vibratoDepth = param & 0xf;
        this.#vibrato();
        break;
      case 0x6 /* Vibrato + Volume Slide.*/:
        this.#vibrato();
        break;
      case 0x7 /* Tremolo.*/:
        if ((param & 0xf0) > 0) this.#tremoloSpeed = param >> 4;
        if ((param & 0x0f) > 0) this.#tremoloDepth = param & 0xf;
        this.#tremolo();
        break;
      case 0x8 /* Set Panning (0-127). Not for 4-channel Protracker. */:
        if (this.#module.numChannels != 4) {
          this.#panning = param < 128 ? param : 127;
        }
        break;
      case 0xc /* Set Volume.*/:
        this.#volume = param > 64 ? 64 : param;
        break;
      case 0x11 /* Fine Portamento Up.*/:
        this.#period -= param;
        if (this.#period < 0) this.#period = 0;
        break;
      case 0x12 /* Fine Portamento Down.*/:
        this.#period += param;
        if (this.#period > 65535) this.#period = 65535;
        break;
      case 0x14 /* Set Vibrato Waveform.*/:
        if (param < 8) this.#vibratoType = param;
        break;
      case 0x17 /* Set Tremolo Waveform.*/:
        if (param < 8) this.#tremoloType = param;
        break;
      case 0x1a /* Fine Volume Up.*/:
        this.#volume += param;
        if (this.#volume > 64) this.#volume = 64;
        break;
      case 0x1b /* Fine Volume Down.*/:
        this.#volume -= param;
        if (this.#volume < 0) this.#volume = 0;
        break;
      case 0x1c /* Note Cut.*/:
        if (param <= 0) this.#volume = 0;
        break;
    }
    this.#updateFrequency();
  }

  tick() {
    this.#fxCount++;
    switch (this.#noteEffect) {
      case 0x1 /* Portamento Up.*/:
        this.#period -= this.#noteParam;
        if (this.#period < 0) this.#period = 0;
        break;
      case 0x2 /* Portamento Down.*/:
        this.#period += this.#noteParam;
        if (this.#period > 65535) this.#period = 65535;
        break;
      case 0x3 /* Tone Portamento.*/:
        this.#tonePortamento();
        break;
      case 0x4 /* Vibrato.*/:
        this.#vibratoPhase += this.#vibratoSpeed;
        this.#vibrato();
        break;
      case 0x5 /* Tone Porta + Volume Slide.*/:
        this.#tonePortamento();
        this.#volumeSlide(this.#noteParam);
        break;
      case 0x6 /* Vibrato + Volume Slide.*/:
        this.#vibratoPhase += this.#vibratoSpeed;
        this.#vibrato();
        this.#volumeSlide(this.#noteParam);
        break;
      case 0x7 /* Tremolo.*/:
        this.#tremoloPhase += this.#tremoloSpeed;
        this.#tremolo();
        break;
      case 0xa /* Volume Slide.*/:
        this.#volumeSlide(this.#noteParam);
        break;
      case 0xe /* Arpeggio.*/:
        if (this.#fxCount > 2) this.#fxCount = 0;
        if (this.#fxCount == 0) this.#arpeggioAdd = 0;
        if (this.#fxCount == 1) this.#arpeggioAdd = this.#noteParam >> 4;
        if (this.#fxCount == 2) this.#arpeggioAdd = this.#noteParam & 0xf;
        break;
      case 0x19 /* Retrig.*/:
        if (this.#fxCount >= this.#noteParam) {
          this.#fxCount = 0;
          this.#sampleIdx = this.#sampleFra = 0;
        }
        break;
      case 0x1c /* Note Cut.*/:
        if (this.#noteParam == this.#fxCount) this.#volume = 0;
        break;
      case 0x1d /* Note Delay.*/:
        if (this.#noteParam == this.#fxCount) this.#trigger();
        break;
    }
    if (this.#noteEffect > 0) this.#updateFrequency();
  }

  #updateFrequency() {
    var per = this.#period + this.#vibratoAdd;
    per =
      (per * this.#module.keyToPeriod[this.#arpeggioAdd]) /
      this.#module.keyToPeriod[0];
    if (per < 7) {
      per = 6848;
    }
    this.#freq = (this.#module.c2Rate * 428) / per;
    var vol = this.#volume + this.#tremoloAdd;
    if (vol > 64) vol = 64;
    if (vol < 0) vol = 0;
    this.#ampl = (vol * this.#module.gain) / 8192;
  }

  #trigger() {
    if (this.#noteIns > 0 && this.#noteIns <= this.#module.numInstruments) {
      this.#assigned = this.#noteIns;
      const assignedIns = this.#module.instruments[this.#assigned];
      this.#sampleOffset = 0;
      this.#fineTune = assignedIns.fineTune;
      this.#volume = assignedIns.volume >= 64 ? 64 : assignedIns.volume & 0x3f;
      if (assignedIns.loopLength > 0 && this.#instrument > 0)
        this.#instrument = this.#assigned;
    }
    if (this.#noteEffect == 0x09) {
      this.#sampleOffset = (this.#noteParam & 0xff) << 8;
    } else if (this.#noteEffect == 0x15) {
      this.#fineTune = this.#noteParam;
    }
    if (this.#noteKey > 0 && this.#noteKey <= 72) {
      var per =
        (this.#module.keyToPeriod[this.#noteKey] *
          this.#fineTuning[this.#fineTune & 0xf]) >>
        11;
      this.#portaPeriod = (per >> 1) + (per & 1);
      if (this.#noteEffect != 0x3 && this.#noteEffect != 0x5) {
        this.#instrument = this.#assigned;
        this.#period = this.#portaPeriod;
        this.#sampleIdx = this.#sampleOffset;
        this.#sampleFra = 0;
        if (this.#vibratoType < 4) this.#vibratoPhase = 0;
        if (this.#tremoloType < 4) this.#tremoloPhase = 0;
      }
    }
  }

  #volumeSlide(param: number) {
    var vol = this.#volume + (param >> 4) - (param & 0xf);
    if (vol > 64) vol = 64;
    if (vol < 0) vol = 0;
    this.#volume = vol;
  }

  #tonePortamento() {
    var src = this.#period;
    var dest = this.#portaPeriod;
    if (src < dest) {
      src += this.#portaSpeed;
      if (src > dest) src = dest;
    } else if (src > dest) {
      src -= this.#portaSpeed;
      if (src < dest) src = dest;
    }
    this.#period = src;
  }

  #vibrato() {
    this.#vibratoAdd =
      (this.#waveform(this.#vibratoPhase, this.#vibratoType) *
        this.#vibratoDepth) >>
      7;
  }

  #tremolo() {
    this.#tremoloAdd =
      (this.#waveform(this.#tremoloPhase, this.#tremoloType) *
        this.#tremoloDepth) >>
      6;
  }

  #waveform(phase: number, type: number) {
    var amplitude = 0;
    switch (type & 0x3) {
      case 0 /* Sine. */:
        amplitude = this.#sineTable[phase & 0x1f];
        if ((phase & 0x20) > 0) amplitude = -amplitude;
        break;
      case 1 /* Saw Down. */:
        amplitude = 255 - (((phase + 0x20) & 0x3f) << 3);
        break;
      case 2 /* Square. */:
        amplitude = (phase & 0x20) > 0 ? 255 : -255;
        break;
      case 3 /* Random. */:
        amplitude = (this.#randomSeed >> 20) - 255;
        this.#randomSeed = (this.#randomSeed * 65 + 17) & 0x1fffffff;
        break;
    }
    return amplitude;
  }
}

export class Instrument {
  instrumentName = "";
  volume = 0;
  fineTune = 8;
  loopStart = 0;
  loopLength = 0;
  sampleData = new Int8Array(0);
}

export class Module {
  songName = "Blank";
  numChannels = 4;
  numInstruments = 1;
  numPatterns = 1;
  sequenceLength = 1;
  restartPos = 0;
  c2Rate = 8287;
  gain = 64;
  patterns = new Int8Array(64 * 4 * this.numChannels);
  sequence = new Int8Array(1);
  instruments = new Array<Instrument>(this.numInstruments + 1);
  keyToPeriod = new Int16Array([
    1814,
    /*	 C-0   C#0   D-0   D#0   E-0   F-0   F#0   G-0   G#0   A-0  A#0  B-0 */
    1712, 1616, 1524, 1440, 1356, 1280, 1208, 1140, 1076, 1016, 960, 907, 856,
    808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453, 428, 404, 381, 360,
    339, 320, 302, 285, 269, 254, 240, 226, 214, 202, 190, 180, 170, 160, 151,
    143, 135, 127, 120, 113, 107, 101, 95, 90, 85, 80, 75, 71, 67, 63, 60, 56,
    53, 50, 47, 45, 42, 40, 37, 35, 33, 31, 30, 28,
  ]);

  constructor(module?: ArrayBuffer | Int8Array) {
    this.instruments[0] = this.instruments[1] = new Instrument();

    if (typeof module === "undefined") {
      return;
    }

    const moduleArr =
      module instanceof ArrayBuffer ? new Int8Array(module) : module;

    const ushortbe = function (buf: Int8Array, offset: number) {
      return ((buf[offset] & 0xff) << 8) | (buf[offset + 1] & 0xff);
    };
    const ascii = function (buf: Int8Array, offset: number, len: number) {
      let str = "";
      for (var idx = 0; idx < len; idx++) {
        const c = buf[offset + idx] & 0xff;
        str += c < 32 ? " " : String.fromCharCode(c);
      }
      return str;
    };
    this.songName = ascii(moduleArr, 0, 20);
    this.sequenceLength = moduleArr[950] & 0x7f;
    this.restartPos = moduleArr[951] & 0x7f;
    if (this.restartPos >= this.sequenceLength) {
      this.restartPos = 0;
    }
    this.numPatterns = 0;
    this.sequence = new Int8Array(128);
    for (var seqIdx = 0; seqIdx < 128; seqIdx++) {
      var patIdx = moduleArr[952 + seqIdx] & 0x7f;
      this.sequence[seqIdx] = patIdx;
      if (patIdx >= this.numPatterns) {
        this.numPatterns = patIdx + 1;
      }
    }
    switch (ushortbe(moduleArr, 1082)) {
      case 0x4b2e: /* M.K. */
      case 0x4b21: /* M!K! */
      case 0x5434 /* FLT4 */:
        this.numChannels = 4;
        this.c2Rate = 8287; /* PAL */
        this.gain = 64;
        break;
      case 0x484e /* xCHN */:
        this.numChannels = moduleArr[1080] - 48;
        this.c2Rate = 8363; /* NTSC */
        this.gain = 32;
        break;
      case 0x4348 /* xxCH */:
        this.numChannels = (moduleArr[1080] - 48) * 10;
        this.numChannels += moduleArr[1081] - 48;
        this.c2Rate = 8363; /* NTSC */
        this.gain = 32;
        break;
      default:
        throw "MOD Format not recognised!";
    }
    var numNotes = this.numPatterns * 64 * this.numChannels;
    this.patterns = new Int8Array(numNotes * 4);
    for (var patIdx = 0; patIdx < this.patterns.length; patIdx += 4) {
      var period = (moduleArr[1084 + patIdx] & 0xf) << 8;
      period = period | (moduleArr[1084 + patIdx + 1] & 0xff);
      if (period < 28) {
        this.patterns[patIdx] = 0;
      } else {
        /* Convert period to key. */
        var key = 0,
          oct = 0;
        while (period < 907) {
          period *= 2;
          oct++;
        }
        while (key < 12) {
          var d1 = this.keyToPeriod[key] - period;
          var d2 = period - this.keyToPeriod[key + 1];
          if (d2 >= 0) {
            if (d2 < d1) key++;
            break;
          }
          key++;
        }
        this.patterns[patIdx] = oct * 12 + key;
      }
      var ins = (moduleArr[1084 + patIdx + 2] & 0xf0) >> 4;
      this.patterns[patIdx + 1] = ins | (moduleArr[1084 + patIdx] & 0x10);
      this.patterns[patIdx + 2] = moduleArr[1084 + patIdx + 2] & 0xf;
      this.patterns[patIdx + 3] = moduleArr[1084 + patIdx + 3];
    }
    this.numInstruments = 31;
    this.instruments = new Array(this.numInstruments + 1);
    this.instruments[0] = new Instrument();
    var modIdx = 1084 + numNotes * 4;
    for (var instIdx = 1; instIdx <= this.numInstruments; instIdx++) {
      var inst = new Instrument();
      inst.instrumentName = ascii(moduleArr, instIdx * 30 - 10, 22);
      var sampleLength = ushortbe(moduleArr, instIdx * 30 + 12) * 2;
      var fineTune = moduleArr[instIdx * 30 + 14] & 0xf;
      inst.fineTune = (fineTune & 0x7) - (fineTune & 0x8) + 8;
      inst.volume = moduleArr[instIdx * 30 + 15] & 0x7f;
      if (inst.volume > 64) {
        inst.volume = 64;
      }
      inst.loopStart = ushortbe(moduleArr, instIdx * 30 + 16) * 2;
      inst.loopLength = ushortbe(moduleArr, instIdx * 30 + 18) * 2;
      if (inst.loopStart + inst.loopLength > sampleLength) {
        if (inst.loopStart / 2 + inst.loopLength <= sampleLength) {
          /* Some old modules have loop start in bytes. */
          inst.loopStart = inst.loopStart / 2;
        } else {
          inst.loopLength = sampleLength - inst.loopStart;
        }
      }
      if (inst.loopLength < 4) {
        inst.loopStart = sampleLength;
        inst.loopLength = 0;
      }
      inst.sampleData = new Int8Array(sampleLength + 1);
      if (modIdx + sampleLength > moduleArr.length) {
        sampleLength = moduleArr.length - modIdx;
      }
      inst.sampleData.set(moduleArr.subarray(modIdx, modIdx + sampleLength));
      inst.sampleData[inst.loopStart + inst.loopLength] =
        inst.sampleData[inst.loopStart];
      modIdx += sampleLength;
      this.instruments[instIdx] = inst;
    }
  }
}
