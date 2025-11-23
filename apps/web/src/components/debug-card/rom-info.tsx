import { RomInfo } from "@/types/runtime";
import { formatByteSize, formatHexByte } from "@/components/debug-card/utils";

interface RomInfoProps {
  romInfo: RomInfo | null;
}

export function RomInfo({ romInfo }: RomInfoProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">ROM Metadata</h3>
      {romInfo ? (
        <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-4 gap-y-2 text-sm">
          <dt className="font-medium text-muted-foreground">Title</dt>
          <dd>{romInfo.title}</dd>
          <dt className="font-medium text-muted-foreground">Cartridge Type</dt>
          <dd>{formatHexByte(romInfo.cartridgeType)}</dd>
          <dt className="font-medium text-muted-foreground">ROM Size</dt>
          <dd>{formatByteSize(romInfo.romSize)}</dd>
          <dt className="font-medium text-muted-foreground">RAM Size</dt>
          <dd>{formatByteSize(romInfo.ramSize)}</dd>
          <dt className="font-medium text-muted-foreground">CGB Flag</dt>
          <dd>{formatHexByte(romInfo.cgbFlag)}</dd>
          <dt className="font-medium text-muted-foreground">SGB Flag</dt>
          <dd>{formatHexByte(romInfo.sgbFlag)}</dd>
          <dt className="font-medium text-muted-foreground">
            Destination Code
          </dt>
          <dd>{formatHexByte(romInfo.destinationCode)}</dd>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          ROM metadata unavailable.
        </p>
      )}
    </div>
  );
}
