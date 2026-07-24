"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Status = "checking" | "valid" | "invalid" | "success";

export default function ResetPasswordPage() {
  const t = useTranslations("PasswordRecovery");
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/password-reset", { cache: "no-store" })
      .then((response) => {
        if (active) setStatus(response.ok ? "valid" : "invalid");
      })
      .catch(() => {
        if (active) setStatus("invalid");
      });
    return () => { active = false; };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password !== confirmation) {
      setError(t("passwordsDoNotMatch"));
      return;
    }
    setLoading(true);
    const response = await fetch("/api/auth/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    setLoading(false);
    if (!response.ok) {
      setError(payload?.message ?? t("resetError"));
      if (response.status === 401) setStatus("invalid");
      return;
    }
    setStatus("success");
  };

  const icon = status === "success" ? CheckCircle : KeyRound;
  const Icon = icon;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl text-foreground">
            {status === "success" ? t("successTitle") : t("resetTitle")}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {status === "checking" && t("checkingLink")}
            {status === "valid" && t("resetDescription")}
            {status === "invalid" && t("invalidLink")}
            {status === "success" && t("successDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "valid" && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && (
                <div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">{t("newPassword")}</Label>
                <Input id="password" type="password" autoComplete="new-password" minLength={8}
                  value={password} onChange={(event) => setPassword(event.target.value)} required />
                <p className="text-xs text-muted-foreground">{t("passwordHint")}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmation">{t("confirmPassword")}</Label>
                <Input id="confirmation" type="password" autoComplete="new-password" minLength={8}
                  value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? t("saving") : t("savePassword")}
              </Button>
            </form>
          )}
          {(status === "invalid" || status === "success") && (
            <div className="flex flex-col gap-3">
              {status === "invalid" && (
                <Link href="/forgot-password">
                  <Button className="w-full">{t("requestNewLink")}</Button>
                </Link>
              )}
              <Link href="/login">
                <Button className="w-full" variant={status === "invalid" ? "outline" : "default"}>
                  {t("backToLogin")}
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
