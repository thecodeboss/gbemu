import { RomInfo } from "@/types/runtime";
import { formatByteSize, formatHexByte } from "@/components/debug-card/utils";

interface RomInfoProps {
  romInfo: RomInfo | null;
}

export function RomInfoSection({ romInfo }: RomInfoProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide">
        ROM Metadata
      </h3>
      {romInfo ? (
        <div className="border-[3px] border-border bg-secondary px-3 py-3 shadow-[4px_4px_0_var(--color-accent)]">
          <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-2 text-xs">
            <dt className="font-semibold uppercase tracking-wide text-muted-foreground">
              Title
            </dt>
            <dd>{romInfo.title}</dd>
            <dt className="font-semibold uppercase tracking-wide text-muted-foreground">
              Cartridge Type
            </dt>
            <dd>{formatHexByte(romInfo.cartridgeType)}</dd>
            <dt className="font-semibold uppercase tracking-wide text-muted-foreground">
              ROM Size
            </dt>
            <dd>{formatByteSize(romInfo.romSize)}</dd>
            <dt className="font-semibold uppercase tracking-wide text-muted-foreground">
              RAM Size
            </dt>
            <dd>{formatByteSize(romInfo.ramSize)}</dd>
            <dt className="font-semibold uppercase tracking-wide text-muted-foreground">
              CGB Flag
            </dt>
            <dd>{formatHexByte(romInfo.cgbFlag)}</dd>
            <dt className="font-semibold uppercase tracking-wide text-muted-foreground">
              SGB Flag
            </dt>
            <dd>{formatHexByte(romInfo.sgbFlag)}</dd>
            <dt className="font-semibold uppercase tracking-wide text-muted-foreground">
              Destination Code
            </dt>
            <dd>{formatHexByte(romInfo.destinationCode)}</dd>
          </dl>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          ROM metadata unavailable.
        </p>
      )}
    </div>
  );
}
