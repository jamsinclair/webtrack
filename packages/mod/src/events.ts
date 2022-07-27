type LoadDataEvent = {
  command: "loadData";
  file: ArrayBuffer | Int8Array;
  sampleRate: number;
};
export const loadDataEvent = (
  file: ArrayBuffer | Int8Array,
  sampleRate: number
): LoadDataEvent => ({
  command: "loadData",
  file,
  sampleRate,
});

type PlayEvent = {
  command: "play";
};
export const playEvent = (): PlayEvent => ({ command: "play" });

type PauseEvent = {
  command: "pause";
};
export const pauseEvent = (): PauseEvent => ({ command: "pause" });

type StopEvent = {
  command: "stop";
};
export const stopEvent = (): StopEvent => ({ command: "stop" });

export type ProcessorEvent = LoadDataEvent | PlayEvent | PauseEvent | StopEvent;
