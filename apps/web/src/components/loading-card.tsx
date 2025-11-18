import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LoadingCardProps {
  hidden: boolean;
  romName: string | null;
}

export function LoadingCard({ hidden, romName }: LoadingCardProps) {
  return (
    <Card hidden={hidden}>
      <CardHeader>
        <CardTitle>Loading...</CardTitle>
      </CardHeader>
      <CardContent>
        <p>
          Preparing <span>{romName ?? "ROM"}</span>.
        </p>
      </CardContent>
    </Card>
  );
}
