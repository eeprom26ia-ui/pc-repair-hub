import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · TallerBinaria" },
      {
        name: "description",
        content:
          "Accede a la consola de tu taller de reparación de computadoras: órdenes, clientes, piezas y cobros.",
      },
      { property: "og:title", content: "Entrar · TallerBinaria" },
      {
        property: "og:description",
        content: "Consola de taller para órdenes de reparación, clientes, piezas y cobros.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/ordenes", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          return;
        }
        navigate({ to: "/ordenes", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/ordenes", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo continuar");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("No se pudo entrar con Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/ordenes", replace: true });
  }

  return (
    <div className="workfloor grid min-h-screen place-items-center bg-paper px-4 font-body text-ink">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 flex items-center gap-2.5">
          <span className="grid size-8 place-items-center bg-safety font-display font-extrabold text-safety-foreground">
            TB
          </span>
          <span className="font-display text-[15px] font-bold tracking-tight uppercase">
            TallerBinaria
          </span>
        </Link>

        {sent ? (
          <div className="rounded-lg bg-surface p-6 ring-1 ring-black/5">
            <h1 className="font-display text-lg font-bold tracking-tight">Revisa tu correo</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Te enviamos un enlace a {email} para confirmar la cuenta. Al confirmarlo podrás crear
              tu taller.
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-surface ring-1 ring-black/5">
            <div className="border-b border-line px-6 py-4">
              <h1 className="font-display text-lg font-bold tracking-tight">
                {mode === "login" ? "Entrar al taller" : "Crear cuenta"}
              </h1>
              <p className="label-mono mt-1">Consola de reparaciones</p>
            </div>
            <form onSubmit={onSubmit} className="space-y-3 px-6 py-5">
              {mode === "signup" && (
                <div>
                  <label className="label-mono">Tu nombre</label>
                  <input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-safety"
                    placeholder="Marco Ruiz"
                  />
                </div>
              )}
              <div>
                <label className="label-mono">Correo</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-safety"
                  placeholder="tu@taller.com"
                />
              </div>
              <div>
                <label className="label-mono">Contraseña</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-safety"
                  placeholder="••••••••"
                />
              </div>
              <button
                disabled={loading}
                className="snap-ui w-full rounded-md bg-ink py-2.5 text-xs font-semibold text-ink-foreground hover:bg-ink/90 disabled:opacity-60"
              >
                {loading ? "Procesando…" : mode === "login" ? "Entrar" : "Crear cuenta y taller"}
              </button>
              <button
                type="button"
                onClick={google}
                className="snap-ui w-full rounded-md border border-line bg-surface py-2.5 text-xs font-medium hover:bg-ink/5"
              >
                Continuar con Google
              </button>
            </form>
            <div className="border-t border-line px-6 py-3 text-center text-xs text-muted-foreground">
              {mode === "login" ? "¿Aún no tienes taller? " : "¿Ya tienes cuenta? "}
              <button
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
                className="font-medium text-ink underline"
              >
                {mode === "login" ? "Regístrate" : "Entrar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
