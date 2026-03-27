import { Link } from "react-router-dom";
import { PageShell } from "@/components/layout/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function NotFoundPage() {
  return (
    <PageShell>
      <Card>
        <CardHeader>
          <CardTitle>Page introuvable</CardTitle>
          <CardDescription>Cette vue n'existe pas ou n'est pas encore branchee.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/dashboard" className={cn(buttonVariants({ variant: "secondary" }), "w-full")}>Retour au tableau de bord</Link>
        </CardContent>
      </Card>
    </PageShell>
  );
}
