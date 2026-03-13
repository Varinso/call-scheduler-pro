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
    from_name: "",
    from_email: "",
    api_key: "",
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
      .eq("integration_name", "email_settings")
      .maybeSingle();

    if (data) {
      const s = data.settings as Record<string, string>;
      setForm({
        from_name: s?.from_name || "",
        from_email: s?.from_email || "",
        api_key: s?.api_key || "",
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
          integration_name: "email_settings",
          settings: { ...form },
          enabled,
        },
        { onConflict: "user_id,integration_name" }
      );

    if (error) {
      toast({ title: "Error saving", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Email settings saved",
        description: enabled ? "Client confirmation emails are active." : "Settings saved but disabled.",
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
            client_email: form.from_email,
            company_name: "Test Company",
            meeting_date: new Date().toISOString(),
            google_meet_link: "https://meet.google.com/test",
            notes: "This is a test email from Call Scheduler.",
          },
          email_type: "confirmation",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Test email sent!", description: `Check ${form.from_email} inbox.` });
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

  const isConfigured = !!(form.from_email && form.api_key);

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
              <CardTitle className="text-base">Email Notifications</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Automatically send a confirmation email to clients when a meeting is booked
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
            <strong className="text-foreground">Quick setup (2 min):</strong>
            <br />
            1. Go to{" "}
            <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="underline text-primary">
              resend.com
            </a>{" "}
            — create a free account
            <br />
            2. Add your sending domain <span className="opacity-70">(or skip and use <code className="bg-muted px-1 rounded text-[10px]">onboarding@resend.dev</code> to test first)</span>
            <br />
            3. Go to <strong>API Keys</strong> → create a key → copy it
            <br />
            4. Paste the API key and your From Email below, then Save
            <br />
            <span className="text-[11px] opacity-60">Free plan: 100 emails/day · 3,000/month</span>
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="from-name" className="text-xs font-medium">Sender Name</Label>
          <Input
            id="from-name"
            type="text"
            placeholder="Your Business Name"
            value={form.from_name}
            onChange={(e) => updateField("from_name", e.target.value)}
            className="h-9 text-xs"
          />
          <p className="text-xs text-muted-foreground">Shown as the "From" name in the client's inbox</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="from-email" className="text-xs font-medium">From Email Address *</Label>
          <Input
            id="from-email"
            type="email"
            placeholder="you@yourdomain.com"
            value={form.from_email}
            onChange={(e) => updateField("from_email", e.target.value)}
            className="h-9 text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Must be a verified sender on Resend. Use{" "}
            <code className="bg-muted px-1 rounded text-[10px]">onboarding@resend.dev</code>{" "}
            for quick testing without domain verification.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="resend-api-key" className="text-xs font-medium">Resend API Key *</Label>
          <Input
            id="resend-api-key"
            type="password"
            placeholder="re_..."
            value={form.api_key}
            onChange={(e) => updateField("api_key", e.target.value)}
            className="h-9 font-mono text-xs"
          />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
          <div>
            <p className="text-sm font-medium">Enable email notifications</p>
            <p className="text-xs text-muted-foreground">Send a confirmation email to the client automatically on every booking</p>
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
