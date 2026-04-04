import Header from "../components/Header"
import Hero from "../components/Hero"
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
            </main>
            <Footer />
        </div>
    )
}
