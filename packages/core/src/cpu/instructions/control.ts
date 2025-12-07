import { Cpu } from "../cpu.js";
import { OpcodeInstruction } from "../../rom/types.js";

export function executeDi(
  cpu: Cpu,
  _instruction: OpcodeInstruction,
  nextPc: number,
): void {
  cpu.state.ime = false;
  cpu.imeEnableDelay = 0;
  cpu.setProgramCounter(nextPc);
}

export function executeEi(
  cpu: Cpu,
  _instruction: OpcodeInstruction,
  nextPc: number,
): void {
  // Only schedule IME enable if one isn't already pending; repeated EI
  // instructions should not keep pushing the enable window forward.
  if (cpu.imeEnableDelay === 0) {
    cpu.imeEnableDelay = 2;
  }
  cpu.setProgramCounter(nextPc);
}

export function executeHalt(
  cpu: Cpu,
  _instruction: OpcodeInstruction,
  nextPc: number,
): void {
  cpu.state.halted = true;
  cpu.state.stopped = false;
  cpu.setProgramCounter(nextPc);
}

export function executeStop(
  cpu: Cpu,
  _instruction: OpcodeInstruction,
  nextPc: number,
): void {
  cpu.handleStop(nextPc);
}
