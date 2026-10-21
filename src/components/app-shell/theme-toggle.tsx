"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle({
  withLabel = false,
  onClick,
  ...props
}: { withLabel?: boolean } & Omit<React.ComponentProps<typeof Button>, "variant" | "size">) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      type="button"
      variant="ghost"
      size={withLabel ? "default" : "icon"}
      aria-label="테마 전환"
      className={withLabel ? "w-full justify-start gap-3" : undefined}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
      }}
    >
      <Sun className="size-4 dark:hidden" aria-hidden />
      <Moon className="hidden size-4 dark:block" aria-hidden />
      {withLabel && <span>테마 전환</span>}
    </Button>
  );
}
