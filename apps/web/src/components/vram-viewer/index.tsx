import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { BgTab } from "./bg-tab";
import { OamTab } from "./oam-tab";
import { PalettesTab } from "./palettes-tab";
import { TilesTab } from "./tiles-tab";

interface VramViewerCardProps {
  hidden: boolean;
  memorySnapshot: Uint8Array | null;
}

export function VramViewerCard({
  hidden,
  memorySnapshot,
}: VramViewerCardProps) {
  return (
    <Card hidden={hidden} className="self-start">
      <CardHeader>
        <CardTitle>VRAM Viewer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="tiles" className="w-full">
          <TabsList className="mb-2 grid w-full grid-cols-4">
            <TabsTrigger value="bg">BG</TabsTrigger>
            <TabsTrigger value="tiles">Tiles</TabsTrigger>
            <TabsTrigger value="oam">OAM</TabsTrigger>
            <TabsTrigger value="palettes">Palettes</TabsTrigger>
          </TabsList>

          <TabsContent value="bg" className="text-sm text-muted-foreground">
            <BgTab />
          </TabsContent>
          <TabsContent value="tiles" className="space-y-4">
            <TilesTab memorySnapshot={memorySnapshot} />
          </TabsContent>
          <TabsContent value="oam" className="text-sm text-muted-foreground">
            <OamTab />
          </TabsContent>
          <TabsContent
            value="palettes"
            className="text-sm text-muted-foreground"
          >
            <PalettesTab />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
