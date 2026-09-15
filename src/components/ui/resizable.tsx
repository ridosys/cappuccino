"use client";

import { GripVertical } from "lucide-react";
import {
  Group,
  Panel,
  Separator,
  type GroupProps,
  type PanelProps,
  type SeparatorProps,
} from "react-resizable-panels";

import { cn } from "@/lib/utils";

function ResizablePanelGroup({ className, ...props }: GroupProps) {
  return (
    <Group
      data-slot="resizable-panel-group"
      className={cn("flex h-full w-full", className)}
      {...props}
    />
  );
}

function ResizablePanel({ className, ...props }: PanelProps) {
  return (
    <Panel data-slot="resizable-panel" className={cn("h-full", className)} {...props} />
  );
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: SeparatorProps & { withHandle?: boolean }) {
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        "relative mx-1.5 flex w-px shrink-0 cursor-col-resize items-center justify-center rounded-full bg-border outline-none transition-colors hover:bg-primary/50 focus-visible:bg-primary data-[separator=active]:bg-primary",
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-8 w-3.5 items-center justify-center rounded-sm border bg-border">
          <GripVertical className="size-3" />
        </div>
      )}
    </Separator>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
