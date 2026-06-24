"use client";

import type { ReactNode } from "react";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { cn } from "../utils/cn";

export type PopoverSide = "top" | "bottom" | "left" | "right";
export type PopoverAlign = "start" | "center" | "end";

export type PopoverProps = {
  trigger: ReactNode;
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: PopoverSide;
  align?: PopoverAlign;
  sideOffset?: number;
  className?: string;
};

export function Popover({
  trigger,
  children,
  open,
  defaultOpen,
  onOpenChange,
  side = "top",
  align = "start",
  sideOffset = 6,
  className,
}: PopoverProps) {
  return (
    <BasePopover.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange ? (next) => onOpenChange(next) : undefined}
    >
      {/* nativeButton={false}: the trigger renders a <span> wrapper (arbitrary content, not a real
          <button>), so we tell Base UI to apply non-native-button semantics and avoid the dev warning. */}
      <BasePopover.Trigger
        nativeButton={false}
        render={(props) => (
          <span {...props} className="inline-flex">
            {trigger}
          </span>
        )}
      />
      <BasePopover.Portal>
        {/* z-[100]: the popover is portaled but the host chat surfaces use up to z-50; without a
            higher z-index the open popup renders UNDER the message list / composer and looks dead. */}
        <BasePopover.Positioner className="z-[100]" side={side} align={align} sideOffset={sideOffset}>
          <BasePopover.Popup
            className={cn(
              "min-w-[180px] rounded-[10px] border border-an-border-color bg-an-background p-1 shadow-lg outline-none",
              "text-an-foreground",
              className,
            )}
          >
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}
