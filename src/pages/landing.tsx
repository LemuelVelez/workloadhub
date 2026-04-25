import Header from "../components/Header"
import Hero from "../components/Hero"
import Footer from "../components/Footer"

import backgroundImage from "@/assets/background.png"

export default function LandingPage() {
    return (
        <div className="relative min-h-screen w-full overflow-x-hidden text-white">
            <img
                src={backgroundImage}
                alt=""
                aria-hidden="true"
                className="pointer-events-none fixed inset-0 z-0 h-screen w-screen object-cover"
                draggable={false}
            />
            <div className="pointer-events-none fixed inset-0 z-0 bg-black/45" />

            <Header />

            <div className="relative z-10 flex min-h-screen flex-col pt-16">
                <main className="w-full flex-1">
                    <Hero />
                </main>
                <Footer />
            </div>
        </div>
    )
}