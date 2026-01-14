import * as React from "react";
import { Separator } from "./ui/separator";

type SectionProps = {
    id?: string;
    eyebrow?: string;
    title?: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
    containerClassName?: string;
    showSeparator?: boolean;
};

function cx(...parts: Array<string | undefined | null | false>) {
    return parts.filter(Boolean).join(" ");
}

export default function Section({
    id,
    eyebrow,
    title,
    description,
    actions,
    children,
    className,
    containerClassName,
    showSeparator = false,
}: SectionProps) {
    return (
        <section id={id} className={cx("scroll-mt-24", className)}>
            <div className={cx("mx-auto w-full max-w-6xl px-4", containerClassName)}>
                {(eyebrow || title || description || actions) ? (
                    <div className="mb-8 space-y-3">
                        {eyebrow ? (
                            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                {eyebrow}
                            </div>
                        ) : null}

                        {title ? (
                            <div className="text-3xl font-semibold leading-tight md:text-4xl">
                                {title}
                            </div>
                        ) : null}

                        {description ? (
                            <div className="max-w-3xl text-muted-foreground">
                                {description}
                            </div>
                        ) : null}

                        {actions ? <div className="pt-2">{actions}</div> : null}

                        {showSeparator ? <Separator className="mt-6" /> : null}
                    </div>
                ) : null}

                {children}
            </div>
        </section>
    );
}
