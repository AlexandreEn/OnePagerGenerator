import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { DropZone } from "./components/DropZone";
import { Button } from "./components/ui/button";
import { Zap, Activity, CheckCircle2, AlertCircle, Settings, Plus, Trash2, X, Clock, FileText, BadgeCheck } from "lucide-react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "./lib/utils";



// Default Legacy Mappings
const DEFAULT_MAPPINGS = {
  "JJ/MM/AAAA": "<<[JJ/MM/AAAA]>>",
  "Nom du client": "<<NOM DU CLIENT>>",
  "#reviewsFlopPOI1": "<<#reviewsFlopPOINotes1>>",
  "#reviewsFlopPOI2": "<<#reviewsFlopPOINotes2>>",
  "#reviewsTopPOI1": "<<#reviewsTopPOINotes1>>",
  "#reviewsTopPOI2": "<<#reviewsTopPOINotes2>>",
};

interface GenStats {
  total_files: number;
  total_time_secs: number;
  success_count: number;
  error_count: number;
}

function App() {
  const [config, setConfig] = useState({
    standardCsv: "",
    prevYearCsv: "",
    templateDir: "",
    outputDir: "",
    languages: { fr: true, en: true, de: true, it: true, es: true },
  });

  const [mappings, setMappings] = useState<Record<string, string>>(DEFAULT_MAPPINGS);
  const [showMappings, setShowMappings] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const [logs, setLogs] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [stats, setStats] = useState<GenStats | null>(null);

  // Validation Statuses
  const [fileStatus, setFileStatus] = useState({
    standard: 'idle' as 'idle' | 'checking' | 'valid' | 'invalid',
    prevYear: 'idle' as 'idle' | 'checking' | 'valid' | 'invalid',
    template: 'idle' as 'idle' | 'checking' | 'valid' | 'invalid',
  });

  const [availableLangs, setAvailableLangs] = useState<string[]>([]);

  // Validate Standard CSV
  useEffect(() => {
    if (!config.standardCsv) { setFileStatus(prev => ({ ...prev, standard: 'idle' })); return; }
    setFileStatus(prev => ({ ...prev, standard: 'checking' }));
    invoke<boolean>('validate_csv_cmd', { path: config.standardCsv })
      .then(res => setFileStatus(prev => ({ ...prev, standard: res ? 'valid' : 'invalid' })))
      .catch(() => setFileStatus(prev => ({ ...prev, standard: 'invalid' })));
  }, [config.standardCsv]);

  // Validate PrevYear CSV
  useEffect(() => {
    if (!config.prevYearCsv) { setFileStatus(prev => ({ ...prev, prevYear: 'idle' })); return; }
    setFileStatus(prev => ({ ...prev, prevYear: 'checking' }));
    invoke<boolean>('validate_csv_cmd', { path: config.prevYearCsv })
      .then(res => setFileStatus(prev => ({ ...prev, prevYear: res ? 'valid' : 'invalid' })))
      .catch(() => setFileStatus(prev => ({ ...prev, prevYear: 'invalid' })));
  }, [config.prevYearCsv]);

  // Validate Templates & Sync
  // Validate Templates & Sync
  useEffect(() => {
    if (!config.templateDir) {
      setFileStatus(prev => ({ ...prev, template: 'idle' }));
      setAvailableLangs([]);
      return;
    }

    setFileStatus(prev => ({ ...prev, template: 'checking' }));
    invoke<string[]>('scan_template_structure_cmd', { path: config.templateDir })
      .then(langs => {
        if (langs.length === 0) {
          setFileStatus(prev => ({ ...prev, template: 'invalid' }));
          setAvailableLangs([]);
        } else {
          setFileStatus(prev => ({ ...prev, template: 'valid' }));
          setAvailableLangs(langs);

          // Sync Buttons
          const newLangs = { fr: false, en: false, de: false, it: false, es: false };
          langs.forEach(l => {
            const k = l.toLowerCase();
            if (k in newLangs) {
              // @ts-ignore
              newLangs[k] = true;
            }
          });
          setConfig(prev => ({ ...prev, languages: newLangs }));
        }
      })
      .catch(() => {
        setFileStatus(prev => ({ ...prev, template: 'invalid' }));
        setAvailableLangs([]);
      });
  }, [config.templateDir]);

  // Listeners & Logic
  useEffect(() => {
    let unlisten: () => void;
    async function setup() {
      // @ts-ignore
      unlisten = await listen<[number, string]>('progress', (e) => {
        setProgress(e.payload[0]);
        setLogs(prev => [e.payload[1], ...prev].slice(0, 10)); // Minimal logs
      });
    }
    setup();
    return () => { if (unlisten) unlisten() };
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true); setStatus("running"); setProgress(0); setStats(null);
    const langKeys = Object.entries(config.languages).filter(([_, v]) => v).map(([k]) => k.toUpperCase());

    try {
      const res = await invoke<GenStats>('generate_presentations_cmd', {
        config: {
          standard_csv: config.standardCsv || null,
          prev_year_csv: config.prevYearCsv || null,
          template_dir: config.templateDir,
          output_dir: config.outputDir,
          languages: langKeys,
          mappings: mappings
        }
      });
      setStats(res);
      setStatus("success"); setProgress(100);
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#a855f7', '#ec4899', '#ffffff']
      });
    } catch (e: any) {
      setStatus("error");
      setLogs(prev => [`Error: ${e}`, ...prev]);
    } finally { setIsGenerating(false); }
  };

  const isReady = (config.standardCsv || config.prevYearCsv) && config.templateDir && config.outputDir;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-indigo-500/30 flex items-center justify-center p-8 relative overflow-hidden">

      {/* Guide Modal */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pl-8"
            onClick={() => setShowGuide(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden ring-1 ring-white/10"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-8 border-b border-zinc-800 flex justify-between items-start bg-zinc-900/50 backdrop-blur-md">
                <div className="flex gap-6 items-center">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 p-2 shadow-lg">
                    <img src="/kawaii_icon.png" className="w-full h-full object-contain" alt="Guide" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">User Guide</h2>
                    <p className="text-zinc-500 font-medium">Mastering OnePager Gen.</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowGuide(false)} className="rounded-full hover:bg-zinc-800">
                  <X className="w-6 h-6 text-zinc-500" />
                </Button>
              </div>

              <div className="p-8 overflow-y-auto space-y-10 custom-scrollbar bg-zinc-950/30">
                {/* Section 1 */}
                <div className="grid grid-cols-1 md:grid-cols-[2rem_1fr] gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20">1</span>
                    <div className="w-px h-full bg-zinc-800 rounded-full" />
                  </div>
                  <div className="space-y-4 pb-8">
                    <h3 className="text-xl font-bold text-white">Select Your Sources</h3>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
                      <div className="flex gap-3 items-start">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0" />
                        <p className="text-zinc-400 text-sm leading-relaxed">
                          <strong className="text-zinc-200">Standard Data CSV:</strong> The primary dataset containing current year metrics.
                        </p>
                      </div>
                      <div className="flex gap-3 items-start">
                        <div className="w-2 h-2 rounded-full bg-indigo-500/50 mt-2 shrink-0" />
                        <p className="text-zinc-400 text-sm leading-relaxed">
                          <strong className="text-zinc-200">Previous Year CSV:</strong> (Optional) Required only if you are generating YoY comparisons.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2 */}
                <div className="grid grid-cols-1 md:grid-cols-[2rem_1fr] gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-fuchsia-500/10 text-fuchsia-400 font-bold border border-fuchsia-500/20">2</span>
                    <div className="w-px h-full bg-zinc-800 rounded-full" />
                  </div>
                  <div className="space-y-4 pb-8">
                    <h3 className="text-xl font-bold text-white">Configure & Output</h3>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
                      <div className="flex gap-3 items-start">
                        <div className="w-2 h-2 rounded-full bg-fuchsia-500 mt-2 shrink-0" />
                        <p className="text-zinc-400 text-sm leading-relaxed">
                          <strong className="text-zinc-200">Templates Directory:</strong> Must contain language folders (e.g., <code>/FR</code>, <code>/EN</code>) with your <code>.pptx</code> files inside.
                        </p>
                      </div>
                      <div className="flex gap-3 items-start">
                        <div className="w-2 h-2 rounded-full bg-fuchsia-500/50 mt-2 shrink-0" />
                        <p className="text-zinc-400 text-sm leading-relaxed">
                          <strong className="text-zinc-200">Output Directory:</strong> The destination folder where all generated items will be saved.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3 */}
                <div className="grid grid-cols-1 md:grid-cols-[2rem_1fr] gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">3</span>
                    <div className="w-px h-full bg-transparent rounded-full" />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-white">Special Mappings</h3>
                    <p className="text-zinc-400 text-sm">
                      Click the <span className="inline-flex items-center justify-center w-6 h-6 bg-zinc-800 rounded mx-1 align-middle"><Settings className="w-3.5 h-3.5" /></span> settings icon to configure advanced rules.
                    </p>
                    <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 overflow-hidden">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-zinc-500 uppercase bg-zinc-900/50 border-b border-zinc-800">
                          <tr>
                            <th className="px-4 py-3">CSV Column Name</th>
                            <th className="px-4 py-3 text-right">PowerPoint Tag</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50 text-zinc-400 font-mono text-xs">
                          <tr>
                            <td className="px-4 py-3 font-semibold text-zinc-300">Nom du client</td>
                            <td className="px-4 py-3 text-right text-emerald-500">&lt;&lt;NOM DU CLIENT&gt;&gt;</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 font-semibold text-zinc-300">JJ/MM/AAAA</td>
                            <td className="px-4 py-3 text-right text-emerald-500">&lt;&lt;[JJ/MM/AAAA]&gt;&gt;</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 italic opacity-50">Any Other Column</td>
                            <td className="px-4 py-3 text-right opacity-50">&lt;&lt;ColumnName&gt;&gt;</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 backdrop-blur-md flex justify-end">
                <Button onClick={() => setShowGuide(false)} className="bg-white text-black hover:bg-zinc-200">
                  Got it, let's start!
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mappings Modal */}
      <AnimatePresence>
        {showMappings && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowMappings(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-500" />
                  Special Mappings
                </h2>
                <Button variant="ghost" size="icon" onClick={() => setShowMappings(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar">
                <p className="text-sm text-zinc-400 mb-4">
                  Define specific rules to map CSV Columns (left) to PowerPoint Placeholders (right).
                  Standard placeholders <code>{'<<ColumnName>>'}</code> are handled automatically.
                </p>

                <div className="space-y-2">
                  {Object.entries(mappings).map(([key, val]) => (
                    <div key={key} className="flex gap-2">
                      <input
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-indigo-500 outline-none transition-colors"
                        value={key}
                        onChange={(e) => {
                          const newKey = e.target.value;
                          const newMappings = { ...mappings };
                          delete newMappings[key];
                          newMappings[newKey] = val;
                          setMappings(newMappings);
                        }}
                        placeholder="CSV Column"
                      />
                      <div className="flex items-center text-zinc-600">→</div>
                      <input
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-indigo-300 placeholder-zinc-600 focus:border-indigo-500 outline-none transition-colors font-mono text-xs"
                        value={val}
                        onChange={(e) => {
                          const newMappings = { ...mappings, [key]: e.target.value };
                          setMappings(newMappings);
                        }}
                        placeholder="<<TAG>>"
                      />
                      <Button
                        variant="ghost" size="icon"
                        className="text-zinc-500 hover:text-red-500 hover:bg-red-500/10"
                        onClick={() => {
                          const newMappings = { ...mappings };
                          delete newMappings[key];
                          setMappings(newMappings);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  className="w-full border-dashed border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-white"
                  onClick={() => setMappings({ ...mappings, "": "" })}
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Rule
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">

        {/* Left Panel: Configuration */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <img src="/kawaii_icon.png" alt="Icon" className="w-10 h-10 object-contain drop-shadow-lg" />
                <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">
                  OnePagerGenerator
                </h1>
              </div>
              <p className="text-zinc-500 text-sm">Supercharged Presentation Generator</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={() => setShowGuide(true)} className="rounded-full border-zinc-800 hover:bg-zinc-800 hover:text-white transition-all group relative overflow-hidden">
                <img src="/kawaii_icon.png" alt="Docs" className="w-8 h-8 object-contain scale-125 group-hover:scale-110 transition-transform" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setShowMappings(true)} className="rounded-full border-zinc-800 hover:bg-zinc-800 hover:text-white transition-all">
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pl-1 font-mono">Sources</label>
              <DropZone
                label="Standard Data CSV"
                accept={['csv']}
                value={config.standardCsv}
                status={fileStatus.standard}
                onFileSelect={p => setConfig({ ...config, standardCsv: p })}
              />
              <DropZone
                label="Previous Year CSV"
                accept={['csv']}
                value={config.prevYearCsv}
                status={fileStatus.prevYear}
                onFileSelect={p => setConfig({ ...config, prevYearCsv: p })}
              />
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pl-1 font-mono">Configuration</label>
              <div className="grid grid-cols-2 gap-3">
                <DropZone
                  directory
                  label="Templates"
                  value={config.templateDir}
                  status={fileStatus.template}
                  onFileSelect={p => setConfig({ ...config, templateDir: p })}
                />
                <DropZone
                  directory
                  label="Output"
                  value={config.outputDir}
                  onFileSelect={p => setConfig({ ...config, outputDir: p })}
                />
              </div>
            </div>

            {availableLangs.length > 0 && (
              <div className="space-y-3">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pl-1 font-mono">Languages (Detected)</label>
                <div className="flex gap-2 flex-wrap">
                  {availableLangs.map(lang => {
                    const key = lang.toLowerCase();
                    const isSelected = config.languages[key as keyof typeof config.languages];
                    return (
                      <button
                        key={key}
                        onClick={() => setConfig(prev => ({ ...prev, languages: { ...prev.languages, [key]: !prev.languages[key as keyof typeof prev.languages] } }))}
                        className={cn(
                          "px-4 py-2 rounded-lg text-sm font-bold transition-all border",
                          isSelected
                            ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20"
                            : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:bg-zinc-800"
                        )}
                      >
                        {lang}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <Button
            size="lg"
            disabled={!isReady || isGenerating}
            onClick={handleGenerate}
            className={cn(
              "w-full h-14 text-lg font-bold rounded-xl transition-all relative overflow-hidden",
              isReady
                ? "bg-white text-black hover:bg-zinc-200 shadow-xl shadow-white/5"
                : "bg-zinc-800 text-zinc-500"
            )}
          >
            {status === 'running' && <div className="absolute inset-0 bg-indigo-500/10 animate-pulse" />}
            <span className="relative z-10 flex items-center justify-center gap-2">
              {status === 'running' ? <Activity className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 fill-current" />}
              {status === 'running' ? 'Processing...' : 'Generate Presentations'}
            </span>
          </Button>
        </motion.div>

        {/* Right Panel: Status & Feedback */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:flex flex-col justify-center"
        >
          <div className="relative w-full aspect-square rounded-[2rem] bg-zinc-900/30 border border-zinc-800/50 backdrop-blur-xl flex flex-col items-center justify-center p-12 text-center ring-1 ring-white/5 shadow-2xl">

            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-purple-500/5 rounded-[2rem]" />

            {/* Status Indicator */}
            <div className="mb-8 relative z-10">
              <AnimatePresence mode="wait">
                {status === 'running' && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1.5, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                    className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full"
                  />
                )}
              </AnimatePresence>

              <motion.div
                key={status}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className={cn(
                  "w-24 h-24 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-xl border border-white/10",
                  status === 'idle' && "bg-zinc-800/80 text-zinc-600",
                  status === 'running' && "bg-indigo-600 text-white shadow-indigo-500/30",
                  status === 'success' && "bg-emerald-500 text-white shadow-emerald-500/30",
                  status === 'error' && "bg-red-500 text-white shadow-red-500/30",
                )}
              >
                {status === 'idle' && <Zap className="w-10 h-10" />}
                {status === 'running' && <Activity className="w-10 h-10 animate-spin" />}
                {status === 'success' && <CheckCircle2 className="w-10 h-10" />}
                {status === 'error' && <AlertCircle className="w-10 h-10" />}
              </motion.div>
            </div>

            <div className="space-y-4 max-w-sm relative z-10">
              <h2 className="text-3xl font-bold tracking-tight">
                {status === 'idle' && "Ready to Start"}
                {status === 'running' && "Generating..."}
                {status === 'success' && "Mission Complete"}
                {status === 'error' && "System Error"}
              </h2>
              <div className="h-16 flex items-center justify-center w-full">
                {status !== 'success' && (
                  <p className="text-zinc-500 leading-relaxed font-medium">
                    {status === 'idle' && "Configure your data sources and templates to begin the generation process."}
                    {status === 'running' && logs[0]}
                    {status === 'error' && (
                      <span className="text-red-400 font-bold">
                        {logs[0] || "Unknown error occurred."}
                      </span>
                    )}
                  </p>
                )}

                {status === 'success' && stats && (
                  <div className="grid grid-cols-3 gap-3 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="bg-zinc-800/50 p-3 rounded-xl border border-zinc-700/50 flex flex-col items-center gap-1">
                      <FileText className="w-5 h-5 text-indigo-400 mb-1" />
                      <span className="text-2xl font-bold text-white">{stats.total_files}</span>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Files</span>
                    </div>
                    <div className="bg-zinc-800/50 p-3 rounded-xl border border-zinc-700/50 flex flex-col items-center gap-1">
                      <Clock className="w-5 h-5 text-fuchsia-400 mb-1" />
                      <span className="text-2xl font-bold text-white">{stats.total_time_secs.toFixed(1)}s</span>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Time</span>
                    </div>
                    <div className="bg-zinc-800/50 p-3 rounded-xl border border-zinc-700/50 flex flex-col items-center gap-1">
                      <BadgeCheck className="w-5 h-5 text-emerald-400 mb-1" />
                      <span className="text-2xl font-bold text-white">{stats.success_count}</span>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Success</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {status === 'running' && (
              <div className="w-full max-w-xs mt-8 bg-zinc-800/50 h-2 rounded-full overflow-hidden relative z-10">
                <motion.div
                  className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-2 left-0 w-full text-center pb-2 pointer-events-none">
        <p className="text-[10px] text-zinc-700 font-mono tracking-widest uppercase opacity-40">
          Fait par Alexandre Enouf Lead Dev BirdPerson Team avec ❤️ Janvier 2026
        </p>
      </div>
    </div>
  );
}

export default App;
