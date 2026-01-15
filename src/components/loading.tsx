import * as React from "react"
import { Loader2 } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type LoadingProps = {
    title?: string
    message?: string
    /**
     * If true, renders full-screen centered loader.
     * If false, renders a compact loader block.
     */
    fullscreen?: boolean
}

export default function Loading({
    title = "Loading…",
    message = "Please wait a moment.",
    fullscreen = true,
}: LoadingProps) {
    const Wrapper = fullscreen ? "div" : React.Fragment

    const wrapperProps = fullscreen
        ? { className: "min-h-screen w-full bg-background" }
        : {}

    return (
        <Wrapper {...wrapperProps}>
            <div
                className={
                    fullscreen
                        ? "mx-auto flex min-h-screen max-w-md items-center px-4 py-10"
                        : "w-full"
                }
            >
                <Card className={fullscreen ? "w-full" : "w-full"}>
                    <CardHeader className="space-y-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <img
                                src="/logo.svg"
                                alt="WorkloadHub"
                                className="h-7 w-7"
                                draggable={false}
                            />
                            <span>{title}</span>
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3 rounded-lg border border-border/70 p-4">
                            <Loader2 className="h-5 w-5 animate-spin opacity-80" />
                            <div className="text-sm text-muted-foreground">{message}</div>
                        </div>

                        <div className="text-xs text-muted-foreground">
                            If this takes too long, refresh the page or check your connection.
                        </div>
                    </CardContent>
                </Card>
            </div>
        </Wrapper>
    )
}
