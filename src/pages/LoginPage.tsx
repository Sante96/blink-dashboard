import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlinkLogo } from "@/components/BlinkLogo";
import { API_BASE } from "@/lib/api";
import { useT } from "@/lib/i18n";

interface LoginPageProps {
  onLogin: (email: string) => void;
}

function formatCountdown(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0 && m === 0) return `${h}h`;
  if (h > 0) return `${h}h ${m} min`;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s}s`;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const t = useT();
  const [requiresPin, setRequiresPin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryAfter, setRetryAfter] = useState(0);

  // Countdown del rate limit 2FA
  useEffect(() => {
    if (retryAfter <= 0) return;
    const id = setInterval(() => {
      setRetryAfter((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [retryAfter]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        // Rate limit 2FA: detail è un oggetto con retry_after_secs
        if (res.status === 429 && data.detail?.retry_after_secs) {
          setRetryAfter(data.detail.retry_after_secs);
          throw new Error(data.detail.message || "Troppi tentativi 2FA.");
        }
        throw new Error(
          typeof data.detail === "string" ? data.detail : t("login.loginFailed")
        );
      }

      const data = await res.json();
      if (data.requires_pin) {
        setRequiresPin(true);
      } else {
        onLogin(email);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.connectionError"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/auth/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || t("login.invalidPin"));
      }

      onLogin(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.connectionError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1">
      {/* Colonna sinistra — form */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Brand mobile */}
          <div className="mb-8 text-center lg:hidden">
            <h1 className="text-2xl font-bold tracking-tight">Blink Dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("login.brandSubtitle")}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {requiresPin ? t("login.verify2fa") : t("login.signIn")}
              </CardTitle>
              <CardDescription>
                {requiresPin
                  ? t("login.enterPin")
                  : t("login.useCredentials")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!requiresPin ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                      {t("login.email")}
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="nome@esempio.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium">
                      {t("login.password")}
                    </label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  {error && (
                    <div className="space-y-1">
                      <p className="text-sm text-destructive">{error}</p>
                      {retryAfter > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {t("login.retryIn")}{" "}
                          <span className="font-mono font-medium text-foreground">
                            {formatCountdown(retryAfter)}
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading || retryAfter > 0}
                  >
                    {loading
                      ? t("login.connecting")
                      : retryAfter > 0
                        ? t("login.wait", { time: formatCountdown(retryAfter) })
                        : t("login.signIn")}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyPin} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="pin" className="text-sm font-medium">
                      {t("login.pin")}
                    </label>
                    <Input
                      id="pin"
                      type="text"
                      placeholder="123456"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      maxLength={6}
                      required
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t("login.verifying") : t("login.confirmPin")}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Colonna destra — illustrazione */}
      <div className="hidden flex-1 flex-col items-center justify-center lg:flex">
        <div className="flex flex-col items-center gap-6 px-12">
          <BlinkLogo className="h-32 w-auto text-primary" />
          <p className="text-center text-muted-foreground">
            {t("login.tagline")}
          </p>
        </div>
      </div>
    </div>
  );
}
