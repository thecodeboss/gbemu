import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ErrorCardProps {
  hidden: boolean;
  error: string | null;
  onReturnToMenu: () => void;
}

export function ErrorCard({ hidden, error, onReturnToMenu }: ErrorCardProps) {
  return (
    <Card hidden={hidden}>
      <CardHeader>
        <CardTitle>Something went wrong</CardTitle>
      </CardHeader>
      <CardContent>
        <p>
          {error
            ? error
            : "The ROM could not be loaded. Please verify the file and try again."}
        </p>
      </CardContent>
      <CardFooter className="justify-center">
        <Button type="button" variant="default" onClick={onReturnToMenu}>
          Back to menu
        </Button>
      </CardFooter>
    </Card>
  );
}
