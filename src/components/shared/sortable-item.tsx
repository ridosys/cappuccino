"use client";

import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export function SortableItem({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: (dragHandle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dragHandle = (
    <button
      type="button"
      className="cursor-grab touch-none text-muted-foreground outline-none hover:text-foreground active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(className, isDragging && "relative z-10 opacity-50")}
    >
      {children(dragHandle)}
    </div>
  );
}
