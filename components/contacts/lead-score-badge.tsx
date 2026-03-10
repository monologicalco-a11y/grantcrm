import { Flame, Snowflake, ThermometerSun, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface LeadScoreBadgeProps {
    score: number;
    reason?: string | null;
    className?: string;
    showLabel?: boolean;
}

export function LeadScoreBadge({ score, reason, className, showLabel = true }: LeadScoreBadgeProps) {
    if (score === null || score === undefined) return null;

    let icon = <ThermometerSun className="w-3 h-3 mr-1" />;
    let label = "Warm";
    let colors = "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800";

    if (score >= 67) {
        label = "Hot";
        icon = <Flame className="w-3 h-3 mr-1 text-red-500 fill-red-500" />;
        colors = "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
    } else if (score <= 33) {
        label = "Cold";
        icon = <Snowflake className="w-3 h-3 mr-1 text-blue-500" />;
        colors = "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
    }

    const badge = (
        <Badge variant="outline" className={cn("px-2 py-0.5 whitespace-nowrap cursor-help", colors, className)}>
            {icon}
            {showLabel ? `${label} (${score})` : score}
            {reason && <Info className="w-2.5 h-2.5 ml-1 opacity-50" />}
        </Badge>
    );

    if (reason) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        {badge}
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[250px] text-xs">
                        <p className="font-semibold mb-1">AI Reasoning:</p>
                        <p>{reason}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return badge;
}
