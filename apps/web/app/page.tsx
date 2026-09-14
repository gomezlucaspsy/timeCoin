import Link from "next/link";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="flex items-center justify-between border-b border-black/[.08] px-6 py-4 dark:border-white/[.08]">
        <span className="text-lg font-semibold tracking-tight">TimeCoin</span>
        <div className="flex items-center gap-3">
          <Show when="signed-out">
            <SignInButton>
              <button className="rounded-full px-4 py-2 text-sm font-medium hover:bg-black/[.04] dark:hover:bg-white/[.08]">
                Ingresar
              </button>
            </SignInButton>
            <SignUpButton>
              <button className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]">
                Crear cuenta
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Un marketplace donde tu tiempo también es moneda
        </h1>
        <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          Publicá y vendé directo a otros usuarios. Cobrá con pesos o con
          horas TimeCoin verificadas — vos elegís qué aceptar.
        </p>
        <div className="flex flex-col gap-4 pt-4 sm:flex-row">
          <Link
            href="/sell"
            className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Publicar un artículo
          </Link>
          <Link
            href="/wallet"
            className="flex h-12 items-center justify-center rounded-full border border-black/[.08] px-6 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            Ver mi wallet TimeCoin
          </Link>
        </div>
      </main>
    </div>
  );
}
