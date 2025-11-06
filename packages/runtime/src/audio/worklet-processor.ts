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

class EmulatorAudioWorkletProcessor extends AudioWorkletProcessor {
  #queue: Float32Array[] = [];
  #readIndex = 0;

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
