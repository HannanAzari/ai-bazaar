import { notFound } from "next/navigation";
import { Shapes } from "lucide-react";
import { AssetsClient } from "@/components/assets-client";
import { Footer } from "@/components/footer";
import { flags } from "@/lib/flags";

export const metadata = { title: "Asset catalog", robots: { index: false } };

export default function AssetsPage() {
  if (!flags.assetCatalog) notFound();

  return (
    <>
      <section className="shell py-12">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-ink/5 text-ink/60"><Shapes size={24} /></span>
          <div>
            <p className="eyebrow text-terracotta">Internal · catalog</p>
            <h1 className="display text-4xl sm:text-5xl">Asset catalog</h1>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-ink/55">
          A metadata foundation for future decorations and structures. Read-only sample
          records — no marketplace, payments, or uploads yet.
        </p>
        <AssetsClient />
      </section>
      <Footer />
    </>
  );
}
