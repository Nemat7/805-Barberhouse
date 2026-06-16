"use client";

import { useState, useEffect, useRef } from "react";
import { X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { sendOtp, verifyOtp, apiErrorMessage } from "@/lib/api";

interface AuthModalProps {
  onClose: () => void;
}

export function AuthModal({ onClose }: AuthModalProps) {
  const { t } = useLanguage();
  const { login } = useAuth();
  const ta = t.auth;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function handleSend() {
    setError("");
    setSending(true);
    try {
      await sendOtp(phone.trim());
      setOtpSent(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function handleVerify() {
    setError("");
    setVerifying(true);
    try {
      const res = await verifyOtp(phone.trim(), otp.trim(), name.trim());
      login(res.access, res.refresh, {
        id: res.user.id,
        full_name: res.user.full_name || name.trim(),
        phone: res.user.phone || phone.trim(),
        role: res.user.role ?? "client",
      });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  }

  const canSend = name.trim().length > 0 && phone.trim().length > 6;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-black px-6 py-5 flex items-center justify-between">
          <h2 className="font-display text-2xl text-white tracking-widest">
            {ta.title.toUpperCase()}
          </h2>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-7 space-y-5">
          {!otpSent ? (
            <>
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="auth-name">{ta.nameLabel}</Label>
                <Input
                  id="auth-name"
                  placeholder={ta.namePlaceholder}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="auth-phone">{ta.phoneLabel}</Label>
                <Input
                  id="auth-phone"
                  type="tel"
                  placeholder={ta.phonePlaceholder}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canSend) handleSend(); }}
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button
                className="w-full h-11 bg-black text-white hover:bg-zinc-800 tracking-widest uppercase text-xs font-semibold"
                disabled={!canSend || sending}
                onClick={handleSend}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  ta.sendCode
                )}
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-500">
                {ta.codeSentTo}{" "}
                <span className="font-medium text-zinc-900">{phone}</span>
              </p>

              {/* OTP */}
              <div className="space-y-2">
                <Label htmlFor="auth-otp">{ta.codeLabel}</Label>
                <Input
                  id="auth-otp"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="0000"
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => { if (e.key === "Enter" && otp.length === 4) handleVerify(); }}
                  autoFocus
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <Button
                className="w-full h-11 bg-black text-white hover:bg-zinc-800 tracking-widest uppercase text-xs font-semibold"
                disabled={otp.length !== 4 || verifying}
                onClick={handleVerify}
              >
                {verifying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  ta.verify
                )}
              </Button>

              <button
                onClick={() => { setOtpSent(false); setOtp(""); setError(""); }}
                className="w-full text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                ← {ta.back}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
