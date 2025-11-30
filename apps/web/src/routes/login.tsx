import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import googleLogo from "@/assets/google.svg";
import discordLogo from "@/assets/discord.svg";
import { cn } from "@/lib/utils";
import { Link } from "react-router";

type SocialProvider = "google" | "discord";

export function LoginPage({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [error, setError] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<SocialProvider | null>(
    null,
  );

  const handleSocialLogin = useCallback(async (provider: SocialProvider) => {
    setLoadingProvider(provider);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
      });

      if (error) throw error;
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
      setLoadingProvider(null);
    }
  }, []);

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription>
            Signing in lets you sync your game saves across devices.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {error && <p className="text-sm text-destructive-500">{error}</p>}
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center gap-3"
            disabled={loadingProvider !== null}
            onClick={() => handleSocialLogin("google")}
          >
            <img
              src={googleLogo}
              alt=""
              className="size-6"
              aria-hidden="true"
            />
            {loadingProvider === "google"
              ? "Logging in..."
              : "Continue with Google"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center gap-3"
            disabled={loadingProvider !== null}
            onClick={() => handleSocialLogin("discord")}
          >
            <img
              src={discordLogo}
              alt=""
              className="size-6"
              aria-hidden="true"
            />
            {loadingProvider === "discord"
              ? "Logging in..."
              : "Continue with Discord"}
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">Back to Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
