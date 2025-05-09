import Navbar from "@/components/public/navbar";
import Hero from "@/components/public/hero";
import About from "@/components/public/about";
import VisionMission from "@/components/public/vision-mission";
import Structure from "@/components/public/structure";
import Articles from "@/components/public/articles";
import Library from "@/components/public/library";
import Footer from "@/components/public/footer";
import AIChat from "@/components/public/ai-chat";
import { useState, useEffect } from "react";

export default function Home() {
  const [activeSection, setActiveSection] = useState("home");
  
  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Update active section based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      const sections = ["home", "about", "vision-mission", "structure", "articles", "library"];
      const currentPosition = window.scrollY + 200;

      for (const section of sections) {
        const element = document.getElementById(section);
        if (!element) continue;

        const offsetTop = element.offsetTop;
        const offsetHeight = element.offsetHeight;

        if (
          currentPosition >= offsetTop &&
          currentPosition < offsetTop + offsetHeight
        ) {
          setActiveSection(section);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div>
      <Navbar activeSection={activeSection} scrollToSection={scrollToSection} />
      <Hero scrollToSection={scrollToSection} />
      <About />
      <VisionMission />
      <Structure />
      <Articles />
      <Library />
      <Footer />
      <AIChat />
    </div>
  );
}
