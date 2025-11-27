import { InstructionOperand } from "../rom/types.js";

export function assertAccumulatorDestination(
  operand: InstructionOperand | undefined,
  mnemonic: string,
): void {
  if (!operand || operand.meta.name !== "A") {
    throw new Error(`${mnemonic} instruction expects accumulator destination`);
  }
}
