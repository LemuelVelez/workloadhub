/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { authApi } from "@/api/auth";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function errorToText(err: any) {
    return err?.message || "Request failed. Please try again.";
}

export default function ForgotPasswordPage() {
    const [email, setEmail] = React.useState("");
    const [loading, setLoading] = React.useState(false);

    const [error, setError] = React.useState<string | null>(null);
    const [sent, setSent] = React.useState(false);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSent(false);
        setLoading(true);

        try {
            await authApi.forgotPassword(email);
            setSent(true);
            toast.success("Recovery email sent (if the account exists).");
        } catch (err: any) {
            setError(errorToText(err));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen w-full bg-background">
            <div className="mx-auto flex min-h-screen max-w-md items-center px-4 py-10">
                <Card className="w-full">
                    <CardHeader className="space-y-2">
                        <CardTitle className="text-2xl">Forgot password</CardTitle>
                        <CardDescription>
                            Enter your email and we’ll send a recovery link.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {error ? (
                            <Alert variant="destructive">
                                <AlertTitle>Couldn’t send email</AlertTitle>
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        ) : null}

                        {sent ? (
                            <Alert>
                                <AlertTitle>Check your inbox</AlertTitle>
                                <AlertDescription>
                                    If an account exists for <span className="font-medium">{email}</span>, you’ll receive a reset link.
                                </AlertDescription>
                            </Alert>
                        ) : null}

                        <form onSubmit={onSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 opacity-60" />
                                    <Input
                                        id="email"
                                        type="email"
                                        autoComplete="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e: { target: { value: React.SetStateAction<string>; }; }) => setEmail(e.target.value)}
                                        className="pl-9"
                                        disabled={loading}
                                        required
                                    />
                                </div>
                            </div>

                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending…
                                    </>
                                ) : (
                                    "Send recovery link"
                                )}
                            </Button>
                        </form>
                    </CardContent>

                    <CardFooter className="flex items-center justify-between">
                        <Link to="/auth/login" className="text-sm underline-offset-4 hover:underline">
                            Back to sign in
                        </Link>
                        <Link to="/" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
                            Home
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
