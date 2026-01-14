import { Link } from "react-router-dom";
import { Menu } from "lucide-react";

import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
} from "./ui/navigation-menu";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "./ui/sheet";

const links = [
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Roles", href: "#roles" },
    { label: "Get started", href: "#cta" },
];

function AnchorLink({ href, label }: { href: string; label: string }) {
    return (
        <a
            href={href}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
            {label}
        </a>
    );
}

export default function Header() {
    return (
        <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur">
            <div className="mx-auto flex h-16 items-center justify-between px-4">
                <div className="flex items-center gap-3">
                    <Link to="/" className="flex items-center gap-2">
                        <img
                            src="/logo.svg"
                            alt="WorkloadHub"
                            className="h-8 w-8"
                            draggable={false}
                        />
                        <span className="text-base font-semibold">WorkloadHub</span>
                    </Link>

                    <Separator orientation="vertical" className="hidden h-6 md:block" />

                    <div className="hidden md:block">
                        <NavigationMenu>
                            <NavigationMenuList className="gap-1">
                                {links.map((l) => (
                                    <NavigationMenuItem key={l.href}>
                                        <NavigationMenuLink asChild>
                                            <a
                                                href={l.href}
                                                className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                                            >
                                                {l.label}
                                            </a>
                                        </NavigationMenuLink>
                                    </NavigationMenuItem>
                                ))}
                            </NavigationMenuList>
                        </NavigationMenu>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button asChild variant="secondary" className="hidden md:inline-flex">
                        <Link to="/auth/login">Sign in</Link>
                    </Button>

                    <Button asChild className="hidden md:inline-flex">
                        <a href="#cta">Request demo</a>
                    </Button>

                    {/* Mobile */}
                    <div className="md:hidden">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="secondary" size="icon" aria-label="Open menu">
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-80">
                                <SheetHeader>
                                    <SheetTitle className="flex items-center gap-2">
                                        <img
                                            src="/logo.svg"
                                            alt="WorkloadHub"
                                            className="h-7 w-7"
                                            draggable={false}
                                        />
                                        WorkloadHub
                                    </SheetTitle>
                                </SheetHeader>

                                <div className="mt-6 grid gap-3">
                                    {links.map((l) => (
                                        <AnchorLink key={l.href} href={l.href} label={l.label} />
                                    ))}

                                    <Separator className="my-2" />

                                    <Button asChild variant="secondary">
                                        <Link to="/auth/login">Sign in</Link>
                                    </Button>
                                    <Button asChild>
                                        <a href="#cta">Request demo</a>
                                    </Button>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </div>
        </header>
    );
}
