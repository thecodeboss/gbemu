import {
  AUDIO_WORKLET_OUTPUT_CHANNELS,
  AUDIO_WORKLET_PROCESSOR_ID,
} from "../constants.js";

interface AudioSampleMessage {
  type: "push";
  frames: Float32Array;
  sampleRate: number;
}

interface FlushMessage {
  type: "flush";
}

type WorkletInboundMessage = AudioSampleMessage | FlushMessage;

const ZERO_FRAME = new Float32Array(AUDIO_WORKLET_OUTPUT_CHANNELS);
const MAX_QUEUE_SECONDS = 0.05;

class EmulatorAudioWorkletProcessor extends AudioWorkletProcessor {
  #queue: Float32Array[] = [];
  #readIndex = 0;
  #contextSampleRate = sampleRate;

  constructor() {
    super();

    this.port.onmessage = (event: MessageEvent<WorkletInboundMessage>) => {
      const message = event.data;
      if (!message) {
        return;
      }

      switch (message.type) {
        case "push": {
          this.#queue.push(message.frames);
          this.#truncateQueue();
          break;
        }

        case "flush": {
          this.#queue.length = 0;
          this.#readIndex = 0;
          break;
        }
      }
    };
  }

  process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>,
  ): boolean {
    const output = outputs[0];
    if (!output) {
      return true;
    }

    const left = output[0] ?? ZERO_FRAME;
    const right = output[1] ?? ZERO_FRAME;

    for (let i = 0; i < left.length; i += 1) {
      const sample = this.#dequeueSample();
      left[i] = sample[0];
      right[i] = sample[1];
    }

    return true;
  }

  #truncateQueue(): void {
    if (this.#queue.length === 0) {
      return;
    }

    const availableHeadFrames = Math.max(
      0,
      (this.#queue[0].length - this.#readIndex) / AUDIO_WORKLET_OUTPUT_CHANNELS,
    );
    const queuedFrames =
      availableHeadFrames +
      this.#queue.reduce((sum, frames, index) => {
        if (index === 0) {
          return sum;
        }
        return sum + frames.length / AUDIO_WORKLET_OUTPUT_CHANNELS;
      }, 0);

    const maxFrames = Math.max(
      1,
      Math.floor(this.#contextSampleRate * MAX_QUEUE_SECONDS),
    );
    if (queuedFrames <= maxFrames) {
      return;
    }

    let framesToDrop = queuedFrames - maxFrames;

    if (this.#queue.length > 0) {
      const dropHeadFrames = Math.min(framesToDrop, availableHeadFrames);
      const dropSamples = dropHeadFrames * AUDIO_WORKLET_OUTPUT_CHANNELS;
      this.#readIndex += dropSamples;
      framesToDrop -= dropHeadFrames;
      if (this.#readIndex >= this.#queue[0].length) {
        this.#queue.shift();
        this.#readIndex = 0;
      }
    }

    while (framesToDrop > 0 && this.#queue.length > 0) {
      const head = this.#queue[0];
      const headFrames = head.length / AUDIO_WORKLET_OUTPUT_CHANNELS;
      if (framesToDrop >= headFrames) {
        framesToDrop -= headFrames;
        this.#queue.shift();
        this.#readIndex = 0;
        continue;
      }
      this.#readIndex = framesToDrop * AUDIO_WORKLET_OUTPUT_CHANNELS;
      framesToDrop = 0;
    }
  }

  #dequeueSample(): [number, number] {
    while (this.#queue.length > 0) {
      const frame = this.#queue[0];
      if (this.#readIndex + AUDIO_WORKLET_OUTPUT_CHANNELS > frame.length) {
        this.#queue.shift();
        this.#readIndex = 0;
        continue;
      }

      const left = frame[this.#readIndex] ?? 0;
      const right = frame[this.#readIndex + 1] ?? 0;
      this.#readIndex += AUDIO_WORKLET_OUTPUT_CHANNELS;
      return [left, right];
    }

    return ZERO_FRAME as unknown as [number, number];
  }
}

registerProcessor(AUDIO_WORKLET_PROCESSOR_ID, EmulatorAudioWorkletProcessor);

export {};
