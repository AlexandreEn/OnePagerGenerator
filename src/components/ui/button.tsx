import * as React from "react"
import { cn } from "../../lib/utils"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'outline' | 'ghost' | 'destructive'
    size?: 'default' | 'sm' | 'lg' | 'icon'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'default', size = 'default', ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                    variant === 'default' && "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-900/20",
                    variant === 'destructive' && "bg-red-900/30 text-red-200 hover:bg-red-900/50 border border-red-900/50",
                    variant === 'outline' && "border border-zinc-800 bg-transparent hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all",
                    variant === 'ghost' && "hover:bg-zinc-800 hover:text-white text-zinc-400",
                    size === 'default' && "h-10 px-4 py-2",
                    size === 'sm' && "h-9 rounded-md px-3",
                    size === 'lg' && "h-11 rounded-md px-8",
                    size === 'icon' && "h-10 w-10",
                    className
                )}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
