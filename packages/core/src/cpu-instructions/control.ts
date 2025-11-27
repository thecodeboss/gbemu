import { Cpu } from "../cpu.js";
import { OpcodeInstruction } from "../rom/types.js";

export function executeDi(
  cpu: Cpu,
  _instruction: OpcodeInstruction,
  nextPc: number,
): void {
  cpu.state.ime = false;
  cpu.setImeEnableDelay(0);
  cpu.setProgramCounter(nextPc);
}

export function executeEi(
  cpu: Cpu,
  _instruction: OpcodeInstruction,
  nextPc: number,
): void {
  cpu.setImeEnableDelay(2);
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
  cpu.state.stopped = true;
  cpu.state.halted = true;
  cpu.setProgramCounter(nextPc);
}
