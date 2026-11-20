"use client"

import * as React from "react"
import { Menu as BaseMenu } from "@base-ui/react/menu"

import { cn } from "@/lib/utils"

// Thin styled wrappers over Base UI Menu (replaces the Radix dropdown-menu).
const Menu = BaseMenu.Root
const MenuTrigger = BaseMenu.Trigger

type MenuContentProps = React.ComponentPropsWithoutRef<typeof BaseMenu.Popup> & {
  align?: "start" | "center" | "end"
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
}

const MenuContent = React.forwardRef<HTMLDivElement, MenuContentProps>(
  ({ className, align = "center", side = "bottom", sideOffset = 8, ...props }, ref) => (
    <BaseMenu.Portal>
      <BaseMenu.Positioner align={align} side={side} sideOffset={sideOffset} className="z-50">
        <BaseMenu.Popup
          ref={ref}
          className={cn(
            "min-w-[8rem] overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none",
            "origin-[var(--transform-origin)] transition-[opacity,transform] duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
            className as string
          )}
          {...props}
        />
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  )
)
MenuContent.displayName = "MenuContent"

const MenuItem = React.forwardRef<
  HTMLElement,
  React.ComponentPropsWithoutRef<typeof BaseMenu.Item>
>(({ className, ...props }, ref) => (
  <BaseMenu.Item
    ref={ref}
    className={cn(
      "flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none",
      "data-[highlighted]:bg-accent/15",
      className as string
    )}
    {...props}
  />
))
MenuItem.displayName = "MenuItem"

const MenuLabel = ({ className, ...props }: React.ComponentPropsWithoutRef<"div">) => (
  <div className={cn("px-3 py-1.5 text-xs font-medium text-muted-foreground", className)} {...props} />
)

export { Menu, MenuTrigger, MenuContent, MenuItem, MenuLabel }
