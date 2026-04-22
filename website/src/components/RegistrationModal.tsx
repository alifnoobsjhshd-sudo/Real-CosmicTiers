import { useState } from "react";
import { useAuth } from "./AuthContext";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { SiDiscord as DiscordIcon } from "react-icons/si";

const REGIONS = [
  { value: "NA", label: "🌎 North America (NA)" },
  { value: "EU", label: "🌍 Europe (EU)" },
  { value: "AS", label: "🌏 Asia (AS)" },
  { value: "SA", label: "🌎 South America (SA)" },
  { value: "OC", label: "🌏 Oceania (OC)" },
  { value: "AF", label: "🌍 Africa (AF)" },
  { value: "AN", label: "❄️ Antarctica (AN)" },
];

interface RegistrationModalProps {
  open: boolean;
  onClose: () => void;
}

export default function RegistrationModal({ open, onClose }: RegistrationModalProps) {
  const { user, refetch } = useAuth();
  const { toast } = useToast();
  const [mcUsername, setMcUsername] = useState("");
  const [region, setRegion] = useState("");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"form" | "success">("form");

  async function handleRegister() {
    if (!mcUsername.trim() || !region) return;
    setSaving(true);
    try {
      await apiRequest("POST", "/api/auth/register", { mcUsername: mcUsername.trim(), region });
      await refetch();
      setStep("success");
    } catch (err: any) {
      toast({
        title: "Registration failed",
        description: err?.message ?? "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && step === "success") onClose(); }}>
      <DialogContent className="bg-[#1a1f2e] border border-white/10 text-white max-w-md" onInteractOutside={e => e.preventDefault()}>
        {step === "form" ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <DiscordIcon className="w-6 h-6 text-[#5865F2]" />
                <DialogTitle className="text-white">Complete Registration</DialogTitle>
              </div>
              <DialogDescription className="text-white/50">
                Welcome, <span className="text-white font-semibold">{user?.discordUsername ?? "Player"}</span>! Link your Minecraft account to finish setting up your profile.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reg-mc-username" className="text-white/80">
                  Minecraft Username <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="reg-mc-username"
                  data-testid="input-reg-mc-username"
                  value={mcUsername}
                  onChange={e => setMcUsername(e.target.value)}
                  placeholder="e.g. Notch"
                  maxLength={16}
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/30 focus:border-indigo-500"
                />
                {mcUsername && !/^[a-zA-Z0-9_]{3,16}$/.test(mcUsername) && (
                  <p className="text-xs text-red-400">3-16 characters, letters, numbers, and underscores only.</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reg-region" className="text-white/80">
                  Region <span className="text-red-400">*</span>
                </Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger
                    id="reg-region"
                    data-testid="select-reg-region"
                    className="bg-white/5 border-white/20 text-white"
                  >
                    <SelectValue placeholder="Select your region…" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1f2e] border-white/10 text-white">
                    {REGIONS.map(r => (
                      <SelectItem key={r.value} value={r.value} className="hover:bg-white/10 focus:bg-white/10">
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="text-white/50 hover:bg-white/10 hover:text-white"
                  data-testid="button-reg-skip"
                >
                  Skip for now
                </Button>
                <Button
                  onClick={handleRegister}
                  disabled={saving || !mcUsername.trim() || !/^[a-zA-Z0-9_]{3,16}$/.test(mcUsername) || !region}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white"
                  data-testid="button-reg-submit"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Register"}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-white text-center text-2xl">🎉 Welcome to CosmicTiers!</DialogTitle>
              <DialogDescription className="text-white/60 text-center">
                Your account has been created. You're now part of the CosmicTiers community!
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center mt-4">
              <Button
                onClick={onClose}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-8"
                data-testid="button-reg-done"
              >
                Let's Go!
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
