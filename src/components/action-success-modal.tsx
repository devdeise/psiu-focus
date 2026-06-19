import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type ActionSuccessModalProps = {
  title: string;
  description?: string;
  details?: Array<{ label: string; value?: ReactNode }>;
  onClose: () => void;
};

export function ActionSuccessModal({
  title,
  description,
  details = [],
  onClose,
}: ActionSuccessModalProps) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="glass-card w-full max-w-lg border-primary/30 p-5 shadow-[0_0_36px_rgba(34,211,238,0.18)]">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-success/15 text-success shadow-[0_0_22px_rgba(34,197,94,0.22)]">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>

        {details.length > 0 && (
          <div className="mt-5 grid gap-2 rounded-lg border border-border bg-card/40 p-4 text-sm">
            {details.map((detail) => (
              <div key={detail.label} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{detail.label}</span>
                <span className="text-right font-semibold">{detail.value ?? "-"}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <Button onClick={onClose}>Entendi</Button>
        </div>
      </div>
    </div>
  );
}
