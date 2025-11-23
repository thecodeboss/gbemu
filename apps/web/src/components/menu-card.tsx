import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface MenuCardProps {
  hidden: boolean;
  onSelectRom: () => void;
}

export function MenuCard({ hidden, onSelectRom }: MenuCardProps) {
  return (
    <Card hidden={hidden}>
      <CardHeader>
        <CardTitle>Game Boy Emulator</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <p>
          Load a Game Boy or Game Boy Color ROM to boot the placeholder system.
        </p>
        <Button type="button" variant="default" onClick={onSelectRom}>
          Select ROM
        </Button>
      </CardContent>
    </Card>
  );
}
