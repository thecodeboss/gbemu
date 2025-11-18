import { type RuntimeClient } from "@gbemu/runtime";

export type CpuDebugSnapshot = Awaited<ReturnType<RuntimeClient["getCpuState"]>>;

export type RomInfo = Awaited<ReturnType<RuntimeClient["getRomInfo"]>>;
