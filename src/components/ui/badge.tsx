import * as React from "react"
import { cn } from "../../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "secondary" | "destructive" | "outline" | "success"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
    return (
        <div
            className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                variant === "default" && "border-transparent bg-slate-900 text-slate-50 hover:bg-slate-900/80",
                variant === "secondary" && "border-transparent bg-slate-100 text-slate-900 hover:bg-slate-100/80",
                variant === "destructive" && "border-transparent bg-red-500 text-slate-50 hover:bg-red-500/80",
                variant === "success" && "border-transparent bg-emerald-500 text-white hover:bg-emerald-500/80",
                variant === "outline" && "text-slate-950",
                className
            )}
            {...props}
        />
    )
}

export { Badge }
