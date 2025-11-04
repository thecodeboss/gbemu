import type { VideoFrame } from "@gbemu/core";
import {
  DEFAULT_CANVAS_HEIGHT,
  DEFAULT_CANVAS_WIDTH,
} from "../constants.js";

export interface Canvas2DRendererOptions {
  smoothing?: boolean;
  width?: number;
  height?: number;
}

export class Canvas2DRenderer {
  readonly #canvas: HTMLCanvasElement;
  readonly #context: CanvasRenderingContext2D;
  #imageData: ImageData;

  constructor(canvas: HTMLCanvasElement, options: Canvas2DRendererOptions = {}) {
    const width = options.width ?? DEFAULT_CANVAS_WIDTH;
    const height = options.height ?? DEFAULT_CANVAS_HEIGHT;
    this.#canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas2DRenderer requires a 2D rendering context.");
    }
    this.#context = context;
    this.#context.imageSmoothingEnabled = options.smoothing ?? false;
    this.#canvas.width = width;
    this.#canvas.height = height;
    this.#imageData = this.#context.createImageData(width, height);
  }

  get canvas(): HTMLCanvasElement {
    return this.#canvas;
  }

  drawFrame(frame: VideoFrame): void {
    if (
      frame.width !== this.#imageData.width ||
      frame.height !== this.#imageData.height
    ) {
      this.resize(frame.width, frame.height);
    }

    this.#imageData.data.set(frame.buffer);
    this.#context.putImageData(this.#imageData, 0, 0);
  }

  resize(width: number, height: number): void {
    this.#canvas.width = width;
    this.#canvas.height = height;
    this.#imageData = this.#context.createImageData(width, height);
  }

  clear(color: string = "black"): void {
    this.#context.save();
    this.#context.fillStyle = color;
    this.#context.fillRect(0, 0, this.#canvas.width, this.#canvas.height);
    this.#context.restore();
  }
}
