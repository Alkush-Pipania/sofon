"use client";

import { useEffect, useState } from "react";
import { get, patch, post } from "@/service/api";
import { ENDPOINTS } from "@/service/endpoints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { AxiosError } from "axios";

interface Profile {
    id: string;
    name: string;
    email: string;
}

interface ApiResponse<T> {
    data: T;
    message: string;
}

export default function ProfilePage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);

    // General
    const [name, setName] = useState("");
    const [savingName, setSavingName] = useState(false);
    const [nameMsg, setNameMsg] = useState<{ text: string; error: boolean } | null>(null);

    // Password
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [savingPassword, setSavingPassword] = useState(false);
    const [passwordMsg, setPasswordMsg] = useState<{ text: string; error: boolean } | null>(null);

    useEffect(() => {
        get<ApiResponse<Profile>>(ENDPOINTS.USERS.ME)
            .then((res) => {
                setProfile(res.data);
                setName(res.data.name);
            })
            .finally(() => setLoadingProfile(false));
    }, []);

    async function handleSaveName(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim() || name === profile?.name) return;
        setSavingName(true);
        setNameMsg(null);
        try {
            await patch(ENDPOINTS.USERS.UPDATE_PROFILE, { name: name.trim() });
            setProfile((p) => (p ? { ...p, name: name.trim() } : p));
            setNameMsg({ text: "Name updated.", error: false });
        } catch (err) {
            const msg =
                (err as AxiosError<{ message: string }>)?.response?.data?.message ??
                "Failed to update name.";
            setNameMsg({ text: msg, error: true });
        } finally {
            setSavingName(false);
        }
    }

    async function handleChangePassword(e: React.FormEvent) {
        e.preventDefault();
        setPasswordMsg(null);
        if (newPassword !== confirmPassword) {
            setPasswordMsg({ text: "New passwords do not match.", error: true });
            return;
        }
        setSavingPassword(true);
        try {
            await post(ENDPOINTS.USERS.CHANGE_PASSWORD, {
                current_password: currentPassword,
                new_password: newPassword,
                confirm_password: confirmPassword,
            });
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setPasswordMsg({ text: "Password changed.", error: false });
        } catch (err) {
            const msg =
                (err as AxiosError<{ message: string }>)?.response?.data?.message ??
                "Failed to change password.";
            setPasswordMsg({ text: msg, error: true });
        } finally {
            setSavingPassword(false);
        }
    }

    if (loadingProfile) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="max-w-3xl space-y-10">
            {/* Page header */}
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
                <p className="text-sm text-muted-foreground mt-1">Your user profile settings.</p>
            </div>

            {/* ── General ─────────────────────────────── */}
            <form onSubmit={handleSaveName} className="space-y-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold">General</h2>
                    <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={savingName || !name.trim() || name === profile?.name}
                        className="h-7 px-3 text-xs"
                    >
                        {savingName ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                    </Button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                        <Label htmlFor="name" className="text-sm text-muted-foreground">
                            Name <span className="text-amber-500">*</span>
                        </Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                            minLength={2}
                            maxLength={100}
                            required
                            className="bg-background"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-sm text-muted-foreground">Email</Label>
                        <p className="h-10 flex items-center text-sm text-muted-foreground px-0.5">
                            {profile?.email}
                        </p>
                    </div>
                </div>

                {nameMsg && (
                    <p className={`text-sm ${nameMsg.error ? "text-destructive" : "text-green-500"}`}>
                        {nameMsg.text}
                    </p>
                )}
            </form>

            {/* ── Change Password ──────────────────────── */}
            <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-bold">Change Password</h2>
                    <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                        className="h-7 px-3 text-xs"
                    >
                        {savingPassword ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                    </Button>
                </div>

                <p className="text-sm font-medium text-amber-500">
                    Resetting the password will logout all sessions.
                </p>

                <div className="space-y-1.5">
                    <Label htmlFor="current-password" className="text-sm text-muted-foreground">
                        Current Password <span className="text-amber-500">*</span>
                    </Label>
                    <Input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        className="bg-background"
                    />
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                        <Label htmlFor="new-password" className="text-sm text-muted-foreground">
                            New Password <span className="text-amber-500">*</span>
                        </Label>
                        <div className="relative">
                            <Input
                                id="new-password"
                                type={showNew ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                minLength={8}
                                required
                                className="bg-background pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowNew((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="confirm-password" className="text-sm text-muted-foreground">
                            New Password Again <span className="text-amber-500">*</span>
                        </Label>
                        <div className="relative">
                            <Input
                                id="confirm-password"
                                type={showConfirm ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                minLength={8}
                                required
                                className="bg-background pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirm((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                </div>

                {passwordMsg && (
                    <p className={`text-sm ${passwordMsg.error ? "text-destructive" : "text-green-500"}`}>
                        {passwordMsg.text}
                    </p>
                )}
            </form>
        </div>
    );
}
