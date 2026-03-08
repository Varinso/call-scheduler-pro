import { Settings, Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GoogleCalendarSync } from "@/components/GoogleCalendarSync";
import { DiscordWebhookSettings } from "@/components/DiscordWebhookSettings";
import { SmtpEmailSettings } from "@/components/SmtpEmailSettings";

const integrations = [
  {
    title: "GoHighLevel CRM",
    description: "Fetch additional client data from your GoHighLevel account.",
    icon: Globe,
    status: "Not configured",
  },
];

export default function IntegrationSettings() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integration Settings</h1>
        <p className="text-muted-foreground mt-1">Configure automations and third-party services</p>
      </div>

      <div className="space-y-4">
        <GoogleCalendarSync />
        <DiscordWebhookSettings />
        <SmtpEmailSettings />

        {integrations.map((item) => (
          <Card key={item.title} className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-accent p-2">
                    <item.icon className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{item.title}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">{item.description}</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {item.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configuration will be available once API keys are added via Cloud secrets.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/50 shadow-sm bg-accent/30">
        <CardContent className="flex items-start gap-3 p-4">
          <Settings className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium">Need to configure integrations?</p>
            <p className="text-xs text-muted-foreground mt-1">
              API keys for Discord, SMTP, and GoHighLevel are stored securely as Cloud secrets.
              Ask the admin to set them up in the Cloud settings panel.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
