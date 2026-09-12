import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TallerBinaria · Software para talleres de reparación" },
      {
        name: "description",
        content:
          "Consola para talleres de reparación de computadoras: órdenes por estado, clientes, inventario de piezas y cobros. Cada taller con su propio espacio.",
      },
      { property: "og:title", content: "TallerBinaria · Software para talleres de reparación" },
      {
        property: "og:description",
        content:
          "Órdenes por estado, clientes, inventario de piezas y cobros para tu taller de computadoras.",
      },
    ],
  }),
  component: Landing,
});

const BULLETS = [
  {
    label: "Órdenes",
    text: "Ingreso, diagnóstico, en progreso, listo y entregado, con técnico asignado.",
  },
  { label: "Clientes", text: "Ficha con teléfono, correo e historial de equipos atendidos." },
  { label: "Piezas", text: "Stock con mínimos y aviso cuando falta repuesto." },
  { label: "Dinero", text: "Cotización por orden, anticipos y pagos registrados." },
];

function Landing() {
  return (
    <div className="workfloor min-h-screen bg-paper font-body text-ink">
      <header className="flex items-center justify-between border-b border-line bg-surface/85 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center bg-safety font-display font-extrabold text-safety-foreground">
            TB
          </span>
          <span className="font-display text-[15px] font-bold tracking-tight uppercase">
            TallerBinaria
          </span>
        </div>
        <Link
          to="/auth"
          className="snap-ui rounded-md bg-ink px-3 py-2 text-xs font-semibold text-ink-foreground hover:bg-ink/90"
        >
          Entrar
        </Link>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-16">
        <p className="label-mono">Consola de taller</p>
        <h1 className="mt-3 max-w-2xl font-display text-4xl font-extrabold tracking-tight text-balance">
          El taller de computadoras, ordenado como una mesa de trabajo.
        </h1>
        <p className="mt-4 max-w-xl text-sm text-muted-foreground">
          Registra cada equipo que entra, sigue su estado, cobra lo que corresponde y controla las
          piezas. Cada taller trabaja en su propio espacio, con propietario, recepción y técnicos.
        </p>
        <Link
          to="/auth"
          className="snap-ui mt-6 inline-flex rounded-md bg-safety px-4 py-2.5 text-xs font-semibold text-safety-foreground hover:bg-safety/90"
        >
          Crear mi taller
        </Link>

        <section className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BULLETS.map((b) => (
            <div key={b.label} className="rounded-lg bg-surface p-4 ring-1 ring-black/5">
              <div className="label-mono">{b.label}</div>
              <p className="mt-2 text-[13px] leading-snug">{b.text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
