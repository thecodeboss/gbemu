import { OpcodeMeta, OpcodeOperandMeta } from "../cpu/opcodes.js";

export interface EmulatorRomInfo {
  readonly title: string;
  readonly cartridgeType: number;
  readonly romSize: number;
  readonly ramSize: number;
  readonly cgbFlag: number;
  readonly sgbFlag: number;
  readonly destinationCode: number;
}

export type Instruction =
  | OpcodeInstruction
  | DataInstruction
  | HeaderInstruction
  | AnnotationInstruction;

export interface OpcodeInstruction {
  readonly type: "opcode";
  readonly length: number;
  readonly opcode: number;
  readonly prefixed: boolean;
  readonly mnemonic: string;
  readonly meta: OpcodeMeta;
  readonly operands: InstructionOperand[];
  readonly bytes: Uint8Array;
}

export interface DataInstruction {
  readonly type: "data";
  readonly length: 1;
  readonly value: number;
}

export type HeaderDataType = "string" | "bytes";

export interface HeaderInstruction {
  readonly type: "header";
  readonly length: number;
  readonly bytes: Uint8Array;
  readonly dataType: HeaderDataType;
  readonly description: string;
  readonly detail: string | null;
}

export interface HeaderField {
  readonly start: number;
  readonly end: number;
  readonly type: HeaderDataType;
  readonly description: string;
  readonly detail?: (bytes: Uint8Array) => string | null;
}

export interface AnnotationInstruction {
  readonly type: "annotation";
  readonly length: 0;
  readonly description: string;
}

export interface InstructionOperand {
  readonly meta: OpcodeOperandMeta;
  readonly rawValue: number | null;
  readonly signedValue?: number;
  readonly relativeTarget?: number;
}
