"use client";

import { useTheme } from "next-themes";
import { useIsHydrated } from "@/hooks/use-is-hydrated";
import { SectionShell, SettingCard } from "@/components/settings/section-shell";

const OPTIONS = [
  {
    value: "light" as const,
    label: "בהיר",
    description: "רקע בהיר, טקסט כהה",
  },
  {
    value: "dark" as const,
    label: "כהה",
    description: "רקע כהה חמים, טקסט בהיר",
  },
  {
    value: "system" as const,
    label: "מערכת",
    description: "עוקב אחר הגדרות מערכת ההפעלה שלך",
  },
];

export default function AppearanceSettingsPage() {
  const { theme, setTheme } = useTheme();
  const hydrated = useIsHydrated();
  const active = hydrated ? (theme ?? "system") : null;

  return (
    <SectionShell
      title="מראה"
      description="בחר כיצד Spent נראה. מערכת מתאימה להגדרות מערכת ההפעלה שלך ומתעדכנת אוטומטית."
    >
      <SettingCard title="ערכת נושא">
        <div className="grid gap-2 sm:grid-cols-3">
          {OPTIONS.map((o) => {
            const isActive = active === o.value;
            return (
              <button
                key={o.value}
                onClick={() => setTheme(o.value)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  isActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="font-medium">{o.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {o.description}
                </div>
              </button>
            );
          })}
        </div>
      </SettingCard>
    </SectionShell>
  );
}
