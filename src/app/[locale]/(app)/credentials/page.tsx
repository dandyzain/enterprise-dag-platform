import React from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/patterns/page-container";
import { listCredentialsAction } from "@/lib/actions/credential-actions";
import { CredentialsVaultClient } from "./credentials-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("vault");
  return { title: t("metaTitle") };
}

export default async function CredentialsPage() {
  const credentials = await listCredentialsAction();

  return (
    <PageContainer>
      <CredentialsVaultClient initialCredentials={credentials} />
    </PageContainer>
  );
}
