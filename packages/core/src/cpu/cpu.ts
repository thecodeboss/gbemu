import { OpcodeInstruction } from "../rom/types.js";
import { CpuBase } from "./base.js";
import * as arithmetic from "./instructions/arithmetic.js";
import * as bit from "./instructions/bit.js";
import * as control from "./instructions/control.js";
import * as load from "./instructions/load.js";
import * as rotate from "./instructions/rotate.js";

export class Cpu extends CpuBase {
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
        arithmetic.executeDaa(this, nextPc);
        return;
      case "di":
        control.executeDi(this, nextPc);
        return;
      case "ei":
        control.executeEi(this, nextPc);
        return;
      case "halt":
        control.executeHalt(this, nextPc);
        return;
      case "ld":
      case "ldh":
        load.executeLd(this, instruction, nextPc);
        return;
      case "and":
        arithmetic.executeAnd(this, instruction, nextPc);
        return;
      case "add":
        arithmetic.executeAdd(this, instruction, nextPc);
        return;
      case "adc":
        arithmetic.executeAdc(this, instruction, nextPc);
        return;
      case "sub":
        arithmetic.executeSub(this, instruction, nextPc);
        return;
      case "sbc":
        arithmetic.executeSbc(this, instruction, nextPc);
        return;
      case "cp":
        arithmetic.executeCp(this, instruction, nextPc);
        return;
      case "cpl":
        arithmetic.executeCpl(this, nextPc);
        return;
      case "or":
        arithmetic.executeOr(this, instruction, nextPc);
        return;
      case "xor":
        arithmetic.executeXor(this, instruction, nextPc);
        return;
      case "inc":
        arithmetic.executeInc(this, instruction, nextPc);
        return;
      case "dec":
        arithmetic.executeDec(this, instruction, nextPc);
        return;
      case "bit":
        bit.executeBit(this, instruction, nextPc);
        return;
      case "res":
        bit.executeRes(this, instruction, nextPc);
        return;
      case "set":
        bit.executeSet(this, instruction, nextPc);
        return;
      case "rl":
        rotate.executeRl(this, instruction, nextPc);
        return;
      case "rlc":
        rotate.executeRlc(this, instruction, nextPc);
        return;
      case "rla":
        rotate.executeRla(this, nextPc);
        return;
      case "rlca":
        rotate.executeRlca(this, nextPc);
        return;
      case "rr":
        rotate.executeRr(this, instruction, nextPc);
        return;
      case "rrc":
        rotate.executeRrc(this, instruction, nextPc);
        return;
      case "rra":
        rotate.executeRra(this, nextPc);
        return;
      case "rrca":
        rotate.executeRrca(this, nextPc);
        return;
      case "sla":
        rotate.executeSla(this, instruction, nextPc);
        return;
      case "sra":
        rotate.executeSra(this, instruction, nextPc);
        return;
      case "srl":
        rotate.executeSrl(this, instruction, nextPc);
        return;
      case "swap":
        rotate.executeSwap(this, instruction, nextPc);
        return;
      case "call":
        control.executeCall(this, instruction, nextPc);
        return;
      case "jp":
        control.executeJump(this, instruction, nextPc);
        return;
      case "jr":
        control.executeRelativeJump(this, instruction, nextPc);
        return;
      case "ret":
        control.executeReturn(this, instruction, nextPc);
        return;
      case "reti":
        control.executeReti(this);
        return;
      case "rst":
        control.executeRst(this, instruction, nextPc);
        return;
      case "stop":
        control.executeStop(this, nextPc);
        return;
      case "pop":
        load.executePop(this, instruction, nextPc);
        return;
      case "push":
        load.executePush(this, instruction, nextPc);
        return;
      default:
        throw new Error(
          `Instruction ${instruction.mnemonic} (0x${instruction.opcode.toString(16)}) not implemented`,
        );
    }
  }
}
