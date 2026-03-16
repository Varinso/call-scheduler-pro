import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Webhook, Loader2, CheckCircle2, Send } from "lucide-react";

export function DiscordWebhookSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (user) loadSettings();
  }, [user]);

  async function loadSettings() {
    setLoading(true);
    const { data } = await supabase
      .from("company_settings")
      .select("settings, enabled")
      .eq("integration_name", "discord_webhook")
      .maybeSingle();

    if (data) {
      const settings = data.settings as Record<string, string>;
      setWebhookUrl(settings?.webhook_url || "");
      setEnabled(data.enabled);
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("company_settings")
      .upsert(
        {
          integration_name: "discord_webhook",
          settings: { webhook_url: webhookUrl.trim() },
          enabled,
          updated_by: user.id,
        },
        { onConflict: "integration_name" }
      );

    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Discord webhook saved", description: enabled ? "Notifications are active." : "Webhook saved but disabled." });
    }
    setSaving(false);
  }

  async function handleTest() {
    if (!user) return;
    setTesting(true);

    try {
      const { data, error } = await supabase.functions.invoke("discord-webhook", {
        body: {
          meeting: {
            client_name: "Test Client",
            client_email: "test@example.com",
            company_name: "Test Company",
            meeting_date: new Date().toISOString(),
            google_meet_link: "https://meet.google.com/test",
            notes: "This is a test notification from CallMeet.",
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Test sent!", description: "Check your Discord channel for the notification." });
    } catch (err) {
      toast({
        title: "Test failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  }

  const isValidUrl = webhookUrl.startsWith("https://discord.com/api/webhooks/") || webhookUrl.startsWith("https://discordapp.com/api/webhooks/");

  if (loading) {
    return (
      <Card className="border-border/50 shadow-sm">
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-accent p-2">
              <Webhook className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Discord Webhook</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Post meeting details to a Discord channel automatically
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={enabled && isValidUrl
              ? "text-xs text-primary border-primary/20 bg-primary/5"
              : "text-xs text-muted-foreground"
            }
          >
            {enabled && isValidUrl ? "Active" : "Not configured"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="discord-webhook-url" className="text-xs font-medium">
            Webhook URL
          </Label>
          <Input
            id="discord-webhook-url"
            type="url"
            placeholder="https://discord.com/api/webhooks/..."
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="h-9 font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Create a webhook in your Discord server: Server Settings → Integrations → Webhooks → New Webhook
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
          <div>
            <p className="text-sm font-medium">Enable notifications</p>
            <p className="text-xs text-muted-foreground">Post to Discord when meetings are scheduled</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || !enabled || !isValidUrl}
            className="gap-2"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {testing ? "Sending..." : "Send Test"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
