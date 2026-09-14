import Link from "next/link";
import NavTabs from "@/components/NavTabs";
import SellForm from "./SellForm";

export const metadata = {
  title: "Publicar artículo — TimeCoin",
};

export default function SellPage() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[.08] px-6 py-4 dark:border-white/[.08]">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          TimeCoin
        </Link>
        <NavTabs />
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-10">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">
          Publicá un artículo
        </h1>
        <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
          Completá los datos y elegí si cobrás en pesos, en horas TimeCoin, o
          ambas.
        </p>
        <SellForm />
      </main>
    </div>
  );
}
