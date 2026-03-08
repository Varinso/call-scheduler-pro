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
import { Mail, Loader2, CheckCircle2, Send, ExternalLink } from "lucide-react";

export function SmtpEmailSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [form, setForm] = useState({
    gmail_address: "",
    client_id: "",
    client_secret: "",
    refresh_token: "",
  });

  useEffect(() => {
    if (user) loadSettings();
  }, [user]);

  async function loadSettings() {
    setLoading(true);
    const { data } = await supabase
      .from("integration_settings")
      .select("settings, enabled")
      .eq("user_id", user!.id)
      .eq("integration_name", "gmail_email")
      .maybeSingle();

    if (data) {
      const s = data.settings as Record<string, string>;
      setForm({
        gmail_address: s?.gmail_address || "",
        client_id: s?.client_id || "",
        client_secret: s?.client_secret || "",
        refresh_token: s?.refresh_token || "",
      });
      setEnabled(data.enabled);
    }
    setLoading(false);
  }

  const updateField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function handleSave() {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("integration_settings")
      .upsert(
        {
          user_id: user.id,
          integration_name: "gmail_email",
          settings: { ...form },
          enabled,
        },
        { onConflict: "user_id,integration_name" }
      );

    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Gmail settings saved",
        description: enabled ? "Email notifications are active." : "Settings saved but disabled.",
      });
    }
    setSaving(false);
  }

  async function handleTest() {
    if (!user) return;
    setTesting(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-smtp-email", {
        body: {
          meeting: {
            client_name: "Test Client",
            client_email: form.gmail_address,
            company_name: "Test Company",
            meeting_date: new Date().toISOString(),
            google_meet_link: "https://meet.google.com/test",
            notes: "This is a test email from CallMeet.",
          },
          email_type: "confirmation",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Test email sent!", description: `Check ${form.gmail_address} for the test email.` });
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

  const isConfigured = form.gmail_address && form.client_id && form.client_secret && form.refresh_token;

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
              <Mail className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Gmail Email Notifications</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Send meeting confirmations & reminders from your Gmail account
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={enabled && isConfigured
              ? "text-xs text-primary border-primary/20 bg-primary/5"
              : "text-xs text-muted-foreground"
            }
          >
            {enabled && isConfigured ? "Active" : "Not configured"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/50 bg-accent/30 p-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Setup guide:</strong> You need a Google Cloud OAuth2 credential to send emails from your Gmail.{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline text-primary"
            >
              Google Cloud Console <ExternalLink className="h-3 w-3" />
            </a>
            <br />
            1. Create an OAuth2 Client ID (Desktop app type)
            <br />
            2. Enable the Gmail API
            <br />
            3. Use the{" "}
            <a
              href="https://developers.google.com/oauthplayground/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-primary"
            >
              OAuth Playground
            </a>{" "}
            to generate a refresh token with scope <code className="text-[10px] bg-muted px-1 rounded">https://www.googleapis.com/auth/gmail.send</code>
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gmail-address" className="text-xs font-medium">Gmail Address</Label>
          <Input
            id="gmail-address"
            type="email"
            placeholder="you@gmail.com"
            value={form.gmail_address}
            onChange={(e) => updateField("gmail_address", e.target.value)}
            className="h-9 text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gmail-client-id" className="text-xs font-medium">OAuth2 Client ID</Label>
          <Input
            id="gmail-client-id"
            type="text"
            placeholder="123456789-abc.apps.googleusercontent.com"
            value={form.client_id}
            onChange={(e) => updateField("client_id", e.target.value)}
            className="h-9 font-mono text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gmail-client-secret" className="text-xs font-medium">OAuth2 Client Secret</Label>
          <Input
            id="gmail-client-secret"
            type="password"
            placeholder="GOCSPX-..."
            value={form.client_secret}
            onChange={(e) => updateField("client_secret", e.target.value)}
            className="h-9 font-mono text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gmail-refresh-token" className="text-xs font-medium">Refresh Token</Label>
          <Input
            id="gmail-refresh-token"
            type="password"
            placeholder="1//0abc..."
            value={form.refresh_token}
            onChange={(e) => updateField("refresh_token", e.target.value)}
            className="h-9 font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Generate via{" "}
            <a
              href="https://developers.google.com/oauthplayground/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-primary"
            >
              OAuth Playground
            </a>{" "}
            — use your Client ID/Secret and the <code className="text-[10px] bg-muted px-1 rounded">gmail.send</code> scope
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
          <div>
            <p className="text-sm font-medium">Enable email notifications</p>
            <p className="text-xs text-muted-foreground">Send confirmations & reminders to clients from your Gmail</p>
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
            disabled={testing || !enabled || !isConfigured}
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
