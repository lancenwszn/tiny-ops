"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

const NOTICES: Record<string, string> = {
  "workspace-created": "Your workspace is ready.",
  "joined-workspace": "You've joined the workspace.",
  "password-updated": "Your password has been updated.",
};

/** Shows one-off confirmation toasts passed via ?notice= after redirects. */
export function NoticeToaster() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const notice = params.get("notice");

  useEffect(() => {
    if (!notice) return;
    const message = NOTICES[notice];
    if (message) toast.success(message);
    const rest = new URLSearchParams(params);
    rest.delete("notice");
    router.replace(rest.size ? `${pathname}?${rest}` : pathname, { scroll: false });
  }, [notice, params, pathname, router]);

  return null;
}
