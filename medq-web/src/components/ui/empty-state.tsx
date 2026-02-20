import Link from "next/link";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 mb-3">
        <Icon className="h-5 w-5 text-muted-foreground/40" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-[13px] text-muted-foreground max-w-xs">{description}</p>
      {action && (
        action.href ? (
          <Link href={action.href}>
            <Button variant="outline" size="sm" className="mt-4">
              {action.label}
            </Button>
          </Link>
        ) : action.onClick ? (
          <Button variant="outline" size="sm" className="mt-4" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : null
      )}
    </div>
  );
}
