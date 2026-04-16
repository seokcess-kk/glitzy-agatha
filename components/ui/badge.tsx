import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // 채널별 variant
        meta: "border-transparent bg-blue-100 text-blue-700 dark:bg-blue-500/25 dark:text-blue-300",
        google: "border-transparent bg-red-100 text-red-700 dark:bg-red-500/25 dark:text-red-300",
        tiktok: "border-transparent bg-pink-100 text-pink-700 dark:bg-pink-500/25 dark:text-pink-300",
        naver: "border-transparent bg-green-100 text-green-700 dark:bg-green-500/25 dark:text-green-300",
        kakao: "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-500/25 dark:text-yellow-300",
        dable: "border-transparent bg-indigo-100 text-indigo-700 dark:bg-indigo-500/25 dark:text-indigo-300",
        // 상태별 variant
        success: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/25 dark:text-emerald-300",
        warning: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/25 dark:text-amber-300",
        info: "border-transparent bg-sky-100 text-sky-700 dark:bg-sky-500/25 dark:text-sky-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
