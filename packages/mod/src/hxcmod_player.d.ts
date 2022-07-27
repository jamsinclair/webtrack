export interface HxcModPlayerModule extends EmscriptenWasm.Module {
  _loadMod(modFilePointer: number, bytes: number, sampleRate: number): number;
  _getNextSoundData(
    modCtx: number,
    leftChannelPtr: number,
    rightChannelPtr: number,
    bufferSize: number
  ): void;
}

declare var moduleFactory: EmscriptenWasm.ModuleFactory<HxcModPlayerModule>;

export default moduleFactory;
