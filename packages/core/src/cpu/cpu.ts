import { OpcodeInstruction } from "../rom/types.js";
import { ArithmeticCpu } from "./instructions/arithmetic.js";

export class Cpu extends ArithmeticCpu {
  protected executeInstruction(
    instruction: OpcodeInstruction,
    currentPc: number,
  ): void {
    const nextPc = (currentPc + instruction.length) & 0xffff;

    switch (instruction.mnemonic) {
      case "nop":
        this.setProgramCounter(nextPc);
        return;
      case "daa":
        this.executeDaa(nextPc);
        return;
      case "di":
        this.executeDi(nextPc);
        return;
      case "ei":
        this.executeEi(nextPc);
        return;
      case "halt":
        this.executeHalt(nextPc);
        return;
      case "ld":
      case "ldh":
        this.executeLd(instruction, nextPc);
        return;
      case "and":
        this.executeAnd(instruction, nextPc);
        return;
      case "add":
        this.executeAdd(instruction, nextPc);
        return;
      case "adc":
        this.executeAdc(instruction, nextPc);
        return;
      case "sub":
        this.executeSub(instruction, nextPc);
        return;
      case "sbc":
        this.executeSbc(instruction, nextPc);
        return;
      case "cp":
        this.executeCp(instruction, nextPc);
        return;
      case "cpl":
        this.executeCpl(nextPc);
        return;
      case "or":
        this.executeOr(instruction, nextPc);
        return;
      case "xor":
        this.executeXor(instruction, nextPc);
        return;
      case "inc":
        this.executeInc(instruction, nextPc);
        return;
      case "dec":
        this.executeDec(instruction, nextPc);
        return;
      case "bit":
        this.executeBit(instruction, nextPc);
        return;
      case "res":
        this.executeRes(instruction, nextPc);
        return;
      case "set":
        this.executeSet(instruction, nextPc);
        return;
      case "rl":
        this.executeRl(instruction, nextPc);
        return;
      case "rlc":
        this.executeRlc(instruction, nextPc);
        return;
      case "rla":
        this.executeRla(nextPc);
        return;
      case "rlca":
        this.executeRlca(nextPc);
        return;
      case "rr":
        this.executeRr(instruction, nextPc);
        return;
      case "rrc":
        this.executeRrc(instruction, nextPc);
        return;
      case "rra":
        this.executeRra(nextPc);
        return;
      case "rrca":
        this.executeRrca(nextPc);
        return;
      case "sla":
        this.executeSla(instruction, nextPc);
        return;
      case "sra":
        this.executeSra(instruction, nextPc);
        return;
      case "srl":
        this.executeSrl(instruction, nextPc);
        return;
      case "swap":
        this.executeSwap(instruction, nextPc);
        return;
      case "call":
        this.executeCall(instruction, nextPc);
        return;
      case "jp":
        this.executeJump(instruction, nextPc);
        return;
      case "jr":
        this.executeRelativeJump(instruction, nextPc);
        return;
      case "ret":
        this.executeReturn(instruction, nextPc);
        return;
      case "reti":
        this.executeReti();
        return;
      case "rst":
        this.executeRst(instruction, nextPc);
        return;
      case "stop":
        this.executeStop(nextPc);
        return;
      case "pop":
        this.executePop(instruction, nextPc);
        return;
      case "push":
        this.executePush(instruction, nextPc);
        return;
      default:
        throw new Error(
          `Instruction ${instruction.mnemonic} (0x${instruction.opcode.toString(16)}) not implemented`,
        );
    }
  }
}
