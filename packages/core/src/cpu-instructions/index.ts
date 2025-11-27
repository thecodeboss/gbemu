import { Cpu } from "../cpu.js";
import { OpcodeInstruction } from "../rom/types.js";
import * as arithmetic from "./arithmetic.js";
import * as bitwise from "./bitwise.js";
import * as control from "./control.js";
import * as jumps from "./jumps.js";
import * as load from "./load.js";

export const executeFns: Record<
  string,
  (c: Cpu, o: OpcodeInstruction, n: number) => void
> = {
  adc: arithmetic.executeAdc,
  add: arithmetic.executeAdd,
  and: bitwise.executeAnd,
  bit: bitwise.executeBit,
  call: jumps.executeCall,
  ccf: bitwise.executeCcf,
  cp: arithmetic.executeCp,
  cpl: bitwise.executeCpl,
  daa: arithmetic.executeDaa,
  dec: arithmetic.executeDec,
  di: control.executeDi,
  ei: control.executeEi,
  halt: control.executeHalt,
  inc: arithmetic.executeInc,
  jp: jumps.executeJump,
  jr: jumps.executeRelativeJump,
  ld: load.executeLd,
  ldh: load.executeLd,
  or: bitwise.executeOr,
  pop: load.executePop,
  push: load.executePush,
  res: bitwise.executeRes,
  ret: jumps.executeReturn,
  reti: jumps.executeReti,
  rl: bitwise.executeRl,
  rla: bitwise.executeRla,
  rlc: bitwise.executeRlc,
  rlca: bitwise.executeRlca,
  rr: bitwise.executeRr,
  rra: bitwise.executeRra,
  rrc: bitwise.executeRrc,
  rrca: bitwise.executeRrca,
  rst: jumps.executeRst,
  sbc: arithmetic.executeSbc,
  scf: bitwise.executeScf,
  set: bitwise.executeSet,
  sla: bitwise.executeSla,
  sra: bitwise.executeSra,
  srl: bitwise.executeSrl,
  stop: control.executeStop,
  sub: arithmetic.executeSub,
  swap: bitwise.executeSwap,
  xor: bitwise.executeXor,
};
