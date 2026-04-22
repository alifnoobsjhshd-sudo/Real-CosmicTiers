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
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export default function EditProfileModal({ open, onClose }: EditProfileModalProps) {
  const { user, refetch } = useAuth();
  const { toast } = useToast();
  const [mcUsername, setMcUsername] = useState(user?.player?.mcUsername ?? "");
  const [region, setRegion] = useState(user?.player?.region ?? "");
  const [saving, setSaving] = useState(false);

  const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
  const canChangeUsername = !user?.player?.mcUsername ||
    user?.player?.usernameChangedAt == null ||
    Date.now() - (user.player.usernameChangedAt as number) > COOLDOWN_MS;

  async function handleSave() {
    setSaving(true);
    try {
      await apiRequest("POST", "/api/auth/update-profile", { mcUsername, region });
      await refetch();
      toast({ title: "Profile updated!", description: "Your changes have been saved." });
      onClose();
    } catch (err: any) {
      toast({
        title: "Failed to update",
        description: err?.message ?? "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="bg-[#1a1f2e] border border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription className="text-white/50">
            Update your Minecraft username and region.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mc-username" className="text-white/80">
              Minecraft Username
              {!canChangeUsername && (
                <span className="ml-2 text-xs text-yellow-400">(Change limited to once per 30 days)</span>
              )}
            </Label>
            <Input
              id="mc-username"
              data-testid="input-mc-username"
              value={mcUsername}
              onChange={e => setMcUsername(e.target.value)}
              disabled={!canChangeUsername}
              placeholder="e.g. Notch"
              className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="region" className="text-white/80">Region</Label>
            <Input
              id="region"
              data-testid="input-region"
              value={region}
              onChange={e => setRegion(e.target.value)}
              placeholder="e.g. NA, EU, AS"
              className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
            />
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-white/70 hover:bg-white/10"
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !mcUsername.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
              data-testid="button-save-profile"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
