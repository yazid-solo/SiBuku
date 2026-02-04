import Link from "next/link";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";

export default function EmptyState({
  title,
  desc,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  desc?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <Card>
      <div className="font-semibold">{title}</div>
      {desc ? <div className="text-sm text-white/60 mt-1">{desc}</div> : null}
      {ctaLabel && ctaHref ? (
        <div className="mt-4">
          <Link href={ctaHref}>
            <Button>{ctaLabel}</Button>
          </Link>
        </div>
      ) : null}
    </Card>
  );
}