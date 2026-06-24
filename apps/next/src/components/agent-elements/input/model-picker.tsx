"use client";

import { memo, useCallback, useMemo, useState } from "react";
import {
  IconCheck,
  IconChevronDown,
  IconPin,
  IconPinFilled,
  IconSearch,
} from "@tabler/icons-react";
import { ScrollShadow } from "@heroui/react";
import type { ModelOption } from "../types";
import { cn } from "../utils/cn";
import { Popover } from "./popover";

export type ModelPickerProps = {
  models: ModelOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (modelId: string) => void;
  placeholder?: string;
  className?: string;
  /** Show a search box that filters the list by name/version. Off by default (small lists). */
  searchable?: boolean;
  /** Ids pinned to the top of the list (order preserved within pinned / unpinned groups). */
  pinnedIds?: string[];
  /** Toggle a model's pin. When provided, every pinnable row shows a pin button. */
  onTogglePin?: (id: string) => void;
  /** Whether a given option can be pinned (e.g. exclude the `Auto` pseudo-option). Default: all. */
  canPin?: (model: ModelOption) => boolean;
  /** Quick-pick preset chips ("Best for coding", "Cheapest", …) rendered above the list. Each `id`
   *  is a model-option id; clicking selects it. Resolved/mapped by the caller (legacy parity). */
  presets?: { id: string; label: string }[];
  /** Search-box placeholder (default "Search models"). Lets the picker be reused for other lists. */
  searchPlaceholder?: string;
  /** Empty-results label (default "No models match"). */
  emptyLabel?: string;
};

export const ModelPicker = memo(function ModelPicker({
  models,
  value,
  defaultValue,
  onChange,
  placeholder = "Auto",
  className,
  searchable = false,
  pinnedIds,
  onTogglePin,
  canPin,
  presets,
  searchPlaceholder = "Search models",
  emptyLabel = "No models match",
}: ModelPickerProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeId = isControlled ? value : internalValue;
  const activeModel = models.find((m) => m.id === activeId) ?? models[0];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const handleSelect = useCallback(
    (id: string) => {
      if (!isControlled) setInternalValue(id);
      onChange?.(id);
      setOpen(false);
    },
    [isControlled, onChange],
  );

  const pinnedSet = useMemo(() => new Set(pinnedIds ?? []), [pinnedIds]);
  const isPinnable = useCallback(
    (m: ModelOption) => (canPin ? canPin(m) : true),
    [canPin],
  );

  // Filter by query, then float pinned models to the top. A non-pinnable option (e.g. Auto) ranks
  // above everything so it stays first; pinned next; the rest last. Array.sort is stable, so original
  // catalog order is preserved within each rank.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? models.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            (m.version ?? "").toLowerCase().includes(q),
        )
      : models.slice();
    const rank = (m: ModelOption) =>
      !isPinnable(m) ? 0 : pinnedSet.has(m.id) ? 1 : 2;
    return matched.sort((a, b) => rank(a) - rank(b));
  }, [models, query, pinnedSet, isPinnable]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
      side="top"
      align="start"
      trigger={
        <button
          type="button"
          className={cn(
            "inline-flex h-7 max-w-[200px] items-center gap-1 overflow-hidden rounded-[6px] px-2 text-[12px] leading-4 text-foreground/40 transition-colors hover:bg-foreground/6 cursor-pointer",
            className,
          )}
          aria-label="Select model"
        >
          {activeModel?.icon && (
            <activeModel.icon className="size-3.5 shrink-0 text-foreground/60" />
          )}
          <span className="truncate font-medium">
            {activeModel?.name ?? placeholder}
          </span>
          {activeModel?.version && (
            <span className="shrink-0 font-normal text-foreground/25">
              {activeModel.version}
            </span>
          )}
          <IconChevronDown className="size-3 shrink-0 text-foreground/40" />
        </button>
      }
    >
      <div className="flex flex-col gap-1">
        {presets && presets.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1 pb-0.5">
            {presets.map((p) => {
              const active = p.id === activeModel?.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelect(p.id)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] leading-4 transition-colors cursor-pointer",
                    active
                      ? "border-transparent bg-foreground/10 text-an-foreground"
                      : "border-border text-foreground/50 hover:bg-foreground/6 hover:text-an-foreground",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        )}
        {searchable && (
          <div className="flex items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-an-foreground">
            <IconSearch className="size-3.5 shrink-0 text-foreground/40" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full min-w-0 bg-transparent text-[12px] leading-4 outline-none placeholder:text-foreground/30"
            />
          </div>
        )}
        {/* The catalog can be large (~80 models) and would otherwise overflow the popover and break
            the composer layout. Cap the height and scroll inside, with a HeroUI ScrollShadow for the
            top/bottom fade affordance (native scrollbars are hidden island-wide). */}
        <ScrollShadow className="flex max-h-[300px] flex-col gap-0.5" hideScrollBar>
          {visible.length === 0 ? (
            <div className="px-2 py-1.5 text-[12px] leading-4 text-foreground/40">
              {emptyLabel}
            </div>
          ) : (
            visible.map((model) => {
              const isActive = model.id === activeModel?.id;
              const pinned = pinnedSet.has(model.id);
              const showPin = Boolean(onTogglePin) && isPinnable(model);
              return (
                <div
                  key={model.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-[6px] pr-1 transition-colors hover:bg-foreground/6",
                    isActive && "bg-foreground/6",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleSelect(model.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-[12px] leading-4 text-an-foreground cursor-pointer"
                  >
                    {model.icon && (
                      <model.icon className="size-3.5 shrink-0 text-foreground/50" />
                    )}
                    <span className="flex-1 truncate">
                      {model.name}
                      {model.version && (
                        <span className="ml-1 text-foreground/40">
                          {model.version}
                        </span>
                      )}
                    </span>
                    {isActive && (
                      <IconCheck className="size-3.5 shrink-0 text-foreground/60" />
                    )}
                  </button>
                  {showPin && (
                    <button
                      type="button"
                      aria-label={pinned ? "Unpin model" : "Pin model"}
                      aria-pressed={pinned}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin?.(model.id);
                      }}
                      className={cn(
                        "shrink-0 rounded-[4px] p-1 transition-opacity cursor-pointer hover:bg-foreground/6",
                        pinned
                          ? "text-foreground/60 opacity-100"
                          : "text-foreground/40 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                      )}
                    >
                      {pinned ? (
                        <IconPinFilled className="size-3.5" />
                      ) : (
                        <IconPin className="size-3.5" />
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </ScrollShadow>
      </div>
    </Popover>
  );
});

export type ModelBadgeProps = {
  models: ModelOption[];
  value?: string;
  placeholder?: string;
  className?: string;
};

export const ModelBadge = memo(function ModelBadge({
  models,
  value,
  placeholder = "Auto",
  className,
}: ModelBadgeProps) {
  const activeModel = models.find((m) => m.id === value) ?? models[0];
  return (
    <div
      className={cn(
        "inline-flex h-7 items-center px-2 text-[12px] leading-4 text-foreground/30",
        className,
      )}
    >
      <span className="font-medium">{activeModel?.name ?? placeholder}</span>
      {activeModel?.version && (
        <span className="ml-0.5 font-normal text-foreground/20">
          {activeModel.version}
        </span>
      )}
    </div>
  );
});
