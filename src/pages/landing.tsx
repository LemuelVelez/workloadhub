import Header from "../components/Header"
import Hero from "../components/Hero"
import Features from "../components/Features"
import HowItWorks from "../components/HowItWorks"
import CTA from "../components/CTA"
import Footer from "../components/Footer"

export default function LandingPage() {
    return (
        <div
            className="min-h-screen w-full bg-background text-foreground"
            style={{
                backgroundColor: "var(--background)",
                color: "var(--foreground)",
            }}
        >
            <Header />
            <main className="w-full">
                <Hero />
                <Features />
                <HowItWorks />
                <CTA />
            </main>
            <Footer />
        </div>
    )
}
