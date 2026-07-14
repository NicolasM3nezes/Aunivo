"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from '@/lib/auth/user-message';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LEGAL_DOCUMENTS } from '@/config/legal';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sparkles, CheckCircle, UsersRound } from "lucide-react";

// `useSearchParams` opts the component out of static prerendering
// unless wrapped in Suspense — same pattern as /login.
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const searchParams = useSearchParams();
  // When the user lands here from `/join/<token>` we carry the
  // invite token in the query so it survives the signup → email
  // verification → redirect round-trip. `emailRedirectTo` below
  // points back at /join/<token> so the user lands on the redeem
  // step after verifying instead of being dropped on /dashboard.
  const inviteToken = searchParams.get("invite");
  const selectedPlan = searchParams.get("plan") === "pro" ? "pro" : searchParams.get("plan") === "free" ? "free" : null;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (!legalAccepted) {
      setError("Aceite os Termos de Uso e confirme a leitura da Política de Privacidade.");
      return;
    }

    setLoading(true);

    // If we have an invite token, point Supabase's verification
    // email back at the join page so the user can accept after
    // verifying. Without a token, Supabase uses its default
    // redirect (the app root).
    const emailRedirectTo = inviteToken
      ? `${window.location.origin}/join/${encodeURIComponent(inviteToken)}`
      : selectedPlan
        ? `${window.location.origin}/login?plan=${selectedPlan}`
        : undefined;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          legal_terms_accepted: true,
          legal_privacy_accepted: true,
          terms_version: LEGAL_DOCUMENTS.termsOfUse.version,
          privacy_version: LEGAL_DOCUMENTS.privacyPolicy.version,
        },
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    });

    if (error) {
      setError(authErrorMessage(error.message, 'signup'));
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-border bg-card">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <CheckCircle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl text-foreground">
              Verifique seu e-mail
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Enviamos um link de confirmação para{" "}
              <span className="text-foreground">{email}</span>. Abra sua caixa de
              entrada e clique no link para confirmar a conta.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={
                inviteToken
                  ? `/login?invite=${encodeURIComponent(inviteToken)}`
                  : selectedPlan ? `/login?plan=${selectedPlan}` : "/login"
              }
            >
              <Button
                variant="outline"
                className="w-full border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Voltar para entrar
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            {inviteToken ? (
              <UsersRound className="h-6 w-6 text-primary" />
            ) : (
              <Sparkles className="h-6 w-6 text-primary" />
            )}
          </div>
          {!inviteToken && <p className="text-sm font-semibold text-primary">Aunivo</p>}
          <CardTitle className="text-xl text-foreground">
            {inviteToken ? "Criar conta e participar" : "Crie sua conta no Aunivo"}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {inviteToken
              ? "Confirme seu e-mail e aceite o convite para participar da equipe."
              : "Comece agora a organizar seu atendimento e suas vendas"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            {error && (
              <div id="signup-error" role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="fullName" className="text-muted-foreground">
                Nome completo
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Maria Silva"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-muted-foreground">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Pelo menos 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword" className="text-muted-foreground">
                Confirmar senha
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Repita sua senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <div className="space-y-4" aria-describedby={error ? "signup-error" : undefined}>
              <label className="flex items-start gap-3 text-sm leading-6">
                <Checkbox checked={legalAccepted} onCheckedChange={(checked) => setLegalAccepted(checked === true)} aria-label="Aceitar Termos de Uso e confirmar leitura da Política de Privacidade" />
                <span>Declaro que li e aceito os <Link className="text-primary underline" href={LEGAL_DOCUMENTS.termsOfUse.route} target="_blank" rel="noopener noreferrer">Termos de Uso</Link> e confirmo que li a <Link className="text-primary underline" href={LEGAL_DOCUMENTS.privacyPolicy.route} target="_blank" rel="noopener noreferrer">Política de Privacidade</Link>.</span>
              </label>
            </div>

            <Button
              type="submit"
              disabled={loading || !legalAccepted}
              className="mt-2 h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Criando conta..." : "Criar conta"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Já possui uma conta?{" "}
            <Link
              href={
                inviteToken
                  ? `/login?invite=${encodeURIComponent(inviteToken)}`
                  : selectedPlan ? `/login?plan=${selectedPlan}` : "/login"
              }
              className="text-primary hover:text-primary/80"
            >
              Entrar
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
