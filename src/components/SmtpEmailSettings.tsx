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
import { Mail, Loader2, CheckCircle2, Send } from "lucide-react";

export function SmtpEmailSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [form, setForm] = useState({
    host: "",
    port: "587",
    username: "",
    password: "",
    from_email: "",
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
      .eq("integration_name", "smtp_email")
      .maybeSingle();

    if (data) {
      const s = data.settings as Record<string, string>;
      setForm({
        host: s?.host || "",
        port: s?.port || "587",
        username: s?.username || "",
        password: s?.password || "",
        from_email: s?.from_email || "",
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
          integration_name: "smtp_email",
          settings: { ...form },
          enabled,
        },
        { onConflict: "user_id,integration_name" }
      );

    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "SMTP settings saved",
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
            client_email: form.from_email, // Send test to self
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

      toast({ title: "Test email sent!", description: `Check ${form.from_email} for the test email.` });
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

  const isConfigured = form.host && form.port && form.username && form.password && form.from_email;

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
              <CardTitle className="text-base">SMTP Email</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Send meeting confirmations and reminders to clients
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="smtp-host" className="text-xs font-medium">SMTP Host</Label>
            <Input
              id="smtp-host"
              placeholder="smtp.gmail.com"
              value={form.host}
              onChange={(e) => updateField("host", e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-port" className="text-xs font-medium">Port</Label>
            <Input
              id="smtp-port"
              placeholder="587"
              value={form.port}
              onChange={(e) => updateField("port", e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-username" className="text-xs font-medium">Username</Label>
            <Input
              id="smtp-username"
              placeholder="your@email.com"
              value={form.username}
              onChange={(e) => updateField("username", e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="smtp-password" className="text-xs font-medium">Password</Label>
            <Input
              id="smtp-password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => updateField("password", e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="smtp-from" className="text-xs font-medium">From Email</Label>
          <Input
            id="smtp-from"
            type="email"
            placeholder="noreply@yourcompany.com"
            value={form.from_email}
            onChange={(e) => updateField("from_email", e.target.value)}
            className="h-9 text-xs"
          />
          <p className="text-xs text-muted-foreground">
            The email address that clients will see as the sender
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
          <div>
            <p className="text-sm font-medium">Enable email notifications</p>
            <p className="text-xs text-muted-foreground">Send confirmations & reminders to clients</p>
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
