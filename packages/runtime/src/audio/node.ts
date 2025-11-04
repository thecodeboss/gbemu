import type { AudioBufferChunk } from "@gbemu/core";
import {
  AUDIO_WORKLET_OUTPUT_CHANNELS,
  AUDIO_WORKLET_PROCESSOR_ID,
} from "../constants.js";

export interface EmulatorAudioNode {
  node: AudioWorkletNode;
  context: BaseAudioContext;
  enqueue(chunk: AudioBufferChunk): void;
  flush(): void;
  connect(destinationNode?: AudioNode): void;
  disconnect(): void;
}

export interface EmulatorAudioNodeOptions {
  context: AudioContext;
  workletModuleUrl: string | URL;
  outputNode?: AudioNode;
}

export async function createEmulatorAudioNode(
  options: EmulatorAudioNodeOptions
): Promise<EmulatorAudioNode> {
  const { context, workletModuleUrl, outputNode } = options;
  await context.audioWorklet.addModule(workletModuleUrl);

  const node = new AudioWorkletNode(context, AUDIO_WORKLET_PROCESSOR_ID, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [AUDIO_WORKLET_OUTPUT_CHANNELS],
  });

  if (outputNode) {
    node.connect(outputNode);
  }

  return {
    node,
    context,
    enqueue(chunk) {
      const transferable = chunk.samples.buffer;
      node.port.postMessage(
        {
          type: "push",
          frames: chunk.samples,
          sampleRate: chunk.sampleRate,
        },
        [transferable]
      );
    },
    flush() {
      node.port.postMessage({ type: "flush" });
    },
    connect(destinationNode?: AudioNode) {
      node.connect(destinationNode ?? context.destination);
    },
    disconnect() {
      node.disconnect();
    },
  };
}
