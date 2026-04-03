import { Link } from "react-router-dom";
import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCopy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { useLanguageStore } from "@/store/use-language-store";

export function NotFoundPage() {
  const language = useLanguageStore((state) => state.language);
  const copy = getCopy(language);

  return (
    <PageShell>
      <Card>
        <CardHeader>
          <CardTitle>{copy.notFound.title}</CardTitle>
          <CardDescription>{copy.notFound.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/dashboard" className={cn(buttonVariants({ variant: "secondary" }), "w-full")}>
            {copy.notFound.cta}
          </Link>
        </CardContent>
      </Card>
    </PageShell>
  );
}
