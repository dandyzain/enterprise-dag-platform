"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/patterns/empty-state";
import { PageContainer } from "@/components/patterns/page-container";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageContainer>
      <div className="rounded-2xl border border-line bg-surface">
        <EmptyState
          icon={AlertTriangle}
          title={t("errorTitle")}
          description={t("errorBody")}
          actions={
            <Button onClick={reset}>
              <RotateCcw aria-hidden /> {t("retry")}
            </Button>
          }
        />
      </div>
    </PageContainer>
  );
}
