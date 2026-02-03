import { cn } from "@/lib/utils";

export default function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("glass rounded-2xl p-4", className)} {...props} />;
}
