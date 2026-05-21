"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { mergeOllamaModels, type AppSettings } from "@/lib/types";
import { getSettings, saveAIConfig, listOllamaModels } from "@/lib/api";
import { OllamaModelStatus } from "./ollama-model-status";
import { SectionShell, SettingCard } from "./section-shell";
import { toast } from "sonner";

export function AISection() {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: getSettings,
  });
  if (!settings) {
    return (
      <SectionShell title="AI ואוטומציה">
        <SettingCard>
          <div className="text-sm text-muted-foreground">טוען...</div>
        </SettingCard>
      </SectionShell>
    );
  }
  return (
    <SectionShell
      title="AI ואוטומציה"
      description="כיצד Spent מארגן עסקאות חדשות. החלף בכל עת — הסיווגים הקיימים שלך נשמרים."
    >
      <AIForm key={settings.aiProvider} settings={settings} />
    </SectionShell>
  );
}

function AIForm({ settings }: { settings: AppSettings }) {
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<AppSettings["aiProvider"]>(
    settings.aiProvider
  );
  const [apiKey, setApiKey] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState(settings.ollamaUrl);
  const [ollamaModel, setOllamaModel] = useState(settings.ollamaModel);
  const { data: ollamaData } = useQuery({
    queryKey: ["ollamaModels", ollamaUrl],
    queryFn: () => listOllamaModels(ollamaUrl),
    enabled: provider === "ollama",
    staleTime: 30_000,
  });
  const allOllamaModels = mergeOllamaModels(ollamaData?.models ?? []);

  const mutation = useMutation({
    mutationFn: () =>
      saveAIConfig({
        provider,
        apiKey: provider === "claude" && apiKey ? apiKey : undefined,
        ollamaUrl: provider === "ollama" ? ollamaUrl : undefined,
        ollamaModel: provider === "ollama" ? ollamaModel : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("הגדרות AI נשמרו");
      setApiKey("");
    },
  });

  return (
    <>
      <SettingCard
        title="ספק AI"
        description="החלף בכל עת. הסיווגים הקיימים שלך נשמרים."
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              {
                id: "claude",
                title: "Claude (Anthropic)",
                desc: "מהיר ומדויק. API בתשלום. הבא את מפתח ה-API שלך.",
              },
              {
                id: "ollama",
                title: "Ollama (מקומי)",
                desc: "חינמי, פרטי, פועל על המכשיר שלך. דורש הורדת מודל.",
              },
              {
                id: "none",
                title: "ידני",
                desc: "דלג על סיווג. הקצה קטגוריות ידנית.",
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setProvider(opt.id)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                provider === opt.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="font-medium">{opt.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {opt.desc}
              </div>
            </button>
          ))}
        </div>
      </SettingCard>

      {provider === "claude" && (
        <SettingCard
          title="מפתח Claude API"
          description="הדבק את המפתח שלך מ-console.anthropic.com. הוא מוצפן עם AES-256-GCM."
        >
          <div className="space-y-2">
            <Label htmlFor="claude-key">מפתח API</Label>
            <Input
              id="claude-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
            />
            <p className="text-xs text-muted-foreground">
              השאר ריק לשמירת המפתח הקיים שלך.
            </p>
          </div>
        </SettingCard>
      )}

      {provider === "ollama" && (
        <SettingCard
          title="הגדרת Ollama"
          description="Spent מפעיל Ollama אוטומטית אם הוא מותקן אך לא פועל."
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ollama-url">Ollama URL</Label>
              <Input
                id="ollama-url"
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://localhost:11434"
              />
            </div>
            <div className="space-y-2">
              <Label>מודל</Label>
              <Select
                value={ollamaModel}
                onValueChange={(v) => v && setOllamaModel(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allOllamaModels.map((m) => (
                    <SelectItem key={m.name} value={m.name}>
                      <div className="flex items-center gap-2">
                        <span>{m.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {m.sizeGb > 0 ? `${m.sizeGb} GB` : "לוקלי"}
                        </span>
                        {m.recommended && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                            מומלץ
                          </span>
                        )}
                        {m.isInstalled && !m.recommended && (
                          <span className="rounded-full bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-700 dark:text-green-400">
                            מותקן
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {allOllamaModels.find((m) => m.name === ollamaModel)?.description}
              </p>
            </div>
            <OllamaModelStatus ollamaUrl={ollamaUrl} model={ollamaModel} />
          </div>
        </SettingCard>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "שומר..." : "שמור הגדרות AI"}
        </Button>
      </div>
    </>
  );
}
