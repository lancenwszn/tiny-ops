import { brandingUrl } from "@/lib/env";
import { cn, initials } from "@/lib/utils";

export function WorkspaceAvatar({
  name,
  logoPath,
  className,
}: {
  name: string;
  logoPath: string | null;
  className?: string;
}) {
  const url = brandingUrl(logoPath);
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-[13px] font-bold text-primary-foreground",
        className,
      )}
      aria-hidden
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo
        <img src={url} alt="" className="size-full bg-white object-cover" />
      ) : (
        initials(name, "W")
      )}
    </span>
  );
}
