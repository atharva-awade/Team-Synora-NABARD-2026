import { Nav } from "@/components/landing/nav";
import { HeroStage } from "@/components/landing/hero-stage";
import { HowItWorks, Novelties, Personas } from "@/components/landing/sections";
import { Proof, ValueCreation, CTA, Footer } from "@/components/landing/closing";

export default function Home() {
  return (
    <main className="relative">
      <Nav />
      <HeroStage />
      <HowItWorks />
      <Novelties />
      <Personas />
      <Proof />
      <ValueCreation />
      <CTA />
      <Footer />
    </main>
  );
}
