import { IslandBackdrop } from "@/components/landing/island-backdrop";
import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { HowItWorks, Novelties, Personas } from "@/components/landing/sections";
import { Proof, ValueCreation, CTA, Footer } from "@/components/landing/closing";

export default function Home() {
  return (
    <>
      <IslandBackdrop />
      <main className="relative z-10">
        <Nav />
        <Hero />
        <HowItWorks />
        <Novelties />
        <Personas />
        <Proof />
        <ValueCreation />
        <CTA />
        <Footer />
      </main>
    </>
  );
}
