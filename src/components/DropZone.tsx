import { open } from '@tauri-apps/plugin-dialog';
import { FileText, Folder, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

interface DropZoneProps {
    label: string;
    accept?: string[];
    directory?: boolean;
    value?: string;
    onFileSelect: (path: string) => void;
    className?: string;
    status?: 'idle' | 'checking' | 'valid' | 'invalid';
}

export function DropZone({ label, accept, directory, value, onFileSelect, className, status = 'idle' }: DropZoneProps) {
    const handleOpen = async () => {
        const selected = await open({
            directory: directory,
            multiple: false,
            filters: accept ? [{ name: 'Allowed Files', extensions: accept }] : undefined,
        });
        if (selected && typeof selected === 'string') onFileSelect(selected);
    };

    const getBorderColor = () => {
        if (status === 'checking') return "border-orange-500/50";
        if (status === 'valid') return "border-emerald-500/50";
        if (status === 'invalid') return "border-red-500/50";
        if (value) return "border-emerald-500/30"; // Default legacy valid look if status not used
        return "border-zinc-800";
    };

    const getBgColor = () => {
        if (status === 'checking') return "bg-orange-500/5";
        if (status === 'valid') return "bg-emerald-500/5";
        if (status === 'invalid') return "bg-red-500/5";
        if (value) return "bg-emerald-500/5";
        return "bg-zinc-900/50";
    };

    const getIconColor = () => {
        if (status === 'checking') return "bg-orange-500/10 text-orange-500";
        if (status === 'valid') return "bg-emerald-500/10 text-emerald-500";
        if (status === 'invalid') return "bg-red-500/10 text-red-500";
        if (value) return "bg-emerald-500/10 text-emerald-500";
        return "bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700";
    };

    const getTextColor = () => {
        if (status === 'checking') return "text-orange-400";
        if (status === 'valid') return "text-emerald-400";
        if (status === 'invalid') return "text-red-400";
        if (value) return "text-emerald-400";
        return "text-zinc-300";
    };

    return (
        <motion.div
            onClick={handleOpen}
            whileHover={{ scale: 1.01, borderColor: status === 'idle' && !value ? "rgba(99, 102, 241, 0.5)" : undefined }}
            whileTap={{ scale: 0.99 }}
            className={cn(
                "relative cursor-pointer group flex items-center gap-4 p-4 rounded-xl border border-dashed transition-all duration-300",
                getBorderColor(),
                getBgColor(),
                className
            )}
        >
            <div className={cn(
                "w-12 h-12 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                getIconColor()
            )}>
                {status === 'checking' ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" /> :
                    status === 'invalid' ? <X className="w-6 h-6" /> :
                        (value || status === 'valid' ? <Check className="w-6 h-6" /> : (directory ? <Folder className="w-6 h-6" /> : <FileText className="w-6 h-6" />))}
            </div>

            <div className="flex-1 min-w-0 text-left">
                <p className={cn("text-sm font-medium transition-colors", getTextColor())}>
                    {value ? value.split(/[/\\]/).pop() : label}
                </p>
                <p className="text-xs text-zinc-500 truncate font-mono">
                    {value || (directory ? "Select folder..." : "Drop CSV file...")}
                </p>
            </div>

            {value && (
                <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={(e) => { e.stopPropagation(); onFileSelect(''); }}
                    className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-400 rounded-lg transition-colors"
                >
                    <X className="w-4 h-4" />
                </motion.button>
            )}
        </motion.div>
    );
}
