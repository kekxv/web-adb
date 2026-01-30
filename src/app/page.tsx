'use client';

import { useState, useRef, useEffect } from 'react';
import { useAdb } from '@/hooks/useAdb';
import FileExplorer from '@/components/FileExplorer';
import AppManager from '@/components/AppManager';
import Shell from '@/components/Shell';
import ScreenMirror from '@/components/ScreenMirror';
import { 
    Smartphone, Link, Unlink, Github, 
    Terminal as TerminalIcon, FolderTree, 
    LayoutGrid, Plus, Loader2, Monitor 
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function Home() {
    const { adb, connecting, isWaitingForAuth, connect, disconnect } = useAdb();
    const [leftTab, setLeftTab] = useState<'files' | 'apps' | 'shell'>('files');
    const [installing, setInstalling] = useState(false);
    const [showMirror, setShowMirror] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset tab to 'files' when switching to desktop view if 'shell' was active
    useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 1024px)');
        const handleHandler = (e: MediaQueryListEvent | MediaQueryList) => {
            if (e.matches && leftTab === 'shell') {
                setLeftTab('files');
            }
        };
        
        mediaQuery.addEventListener('change', handleHandler);
        // Initial check
        handleHandler(mediaQuery);
        
        return () => mediaQuery.removeEventListener('change', handleHandler);
    }, [leftTab]);

    const handleInstallApk = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !adb) return;

        setInstalling(true);
        try {
            const sync = await adb.sync();
            const tempPath = '/data/local/tmp/web_adb_install.apk';
            try {
                await sync.write({
                    filename: tempPath,
                    file: file.stream() as any,
                });
                const result = await adb.subprocess.noneProtocol.spawnWaitText(['pm', 'install', '-r', tempPath]);
                alert(result.includes('Success') ? '应用安装成功！' : '安装失败: ' + result);
                await adb.subprocess.noneProtocol.spawnWaitText(['rm', tempPath]);
            } finally {
                await sync.dispose();
            }
        } catch (error) {
            console.error('Install failed:', error);
            alert('安装过程中出错');
        } finally {
            setInstalling(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <main className="h-screen max-h-screen bg-gray-100 flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-white border-b px-4 sm:px-6 py-3 flex items-center justify-between shadow-sm flex-shrink-0">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-600 p-1.5 rounded-lg shrink-0">
                        <Smartphone className="text-white" size={20} />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-sm sm:text-lg font-bold text-gray-900 leading-tight truncate">Web ADB Manager</h1>
                        <p className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Tango Client</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
                    <a 
                        href="https://github.com/kekxv/web-adb" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors hidden sm:block"
                        title="GitHub Repository"
                    >
                        <Github size={20} />
                    </a>
                    {adb && (
                        <div className="flex items-center gap-2 pr-2 sm:pr-4 border-r border-gray-100">
                             <button
                                onClick={() => setShowMirror(!showMirror)}
                                className={cn(
                                    "flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all border shadow-sm",
                                    showMirror 
                                        ? "bg-blue-600 text-white border-blue-600" 
                                        : "bg-white text-gray-700 hover:bg-gray-50 border-gray-200"
                                )}
                            >
                                <Monitor size={14} />
                                <span className="hidden sm:inline">{showMirror ? '停止预览' : '手机预览'}</span>
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={installing}
                                className="flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-[10px] sm:text-xs font-bold transition-all border border-green-200"
                            >
                                {installing ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                <span className="hidden sm:inline">{installing ? '正在安装...' : '安装 APK'}</span>
                            </button>
                            <input type="file" accept=".apk" className="hidden" ref={fileInputRef} onChange={handleInstallApk} />
                        </div>
                    )}

                    {adb ? (
                        <button
                            onClick={disconnect}
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-[10px] sm:text-xs font-medium transition-colors border border-red-200"
                        >
                            <Unlink size={14} />
                            <span>断开</span>
                        </button>
                    ) : (
                        <button
                            onClick={connect}
                            disabled={connecting}
                            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-xs font-medium transition-all shadow-md"
                        >
                            <Link size={14} />
                            {connecting ? '正在连接...' : '连接手机'}
                        </button>
                    )}
                </div>
            </header>

            {/* Content Area */}
            <div className="flex-1 p-3 flex flex-col gap-3 overflow-hidden min-h-0">
                {!adb ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <div className="bg-white p-10 rounded-2xl shadow-xl border border-gray-100 max-w-md mx-auto">
                            <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Smartphone className="text-blue-600" size={40} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-3">准备开始</h2>
                            <p className="text-gray-600 mb-8 leading-relaxed">
                                请通过 USB 数据线连接您的 Android 手机，并确保已开启 <strong>USB 调试</strong>。
                            </p>

                            {isWaitingForAuth && (
                                <div className="mb-8 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-3 animate-bounce">
                                    <div className="bg-orange-500 p-2 rounded-lg text-white">
                                        <Smartphone size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-orange-800">等待授权...</p>
                                        <p className="text-[10px] text-orange-600">请在手机上点击“始终允许来自此计算机的调试”</p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3 text-left bg-gray-50 p-4 rounded-lg text-sm text-gray-500 border border-gray-100">
                                <div className="flex gap-2">
                                    <span className="font-bold text-blue-600">1.</span>
                                    <span>启用开发者选项</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="font-bold text-blue-600">2.</span>
                                    <span>开启 USB 调试</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col lg:flex-row gap-4 overflow-hidden min-h-0">
                        {/* Tab Sidebar (Left) */}
                        <div className="flex-[3] flex flex-col min-w-0 h-full overflow-hidden">
                            <div className="flex p-1 bg-gray-200/50 rounded-xl mb-2 gap-1 flex-shrink-0">
                                <button 
                                    onClick={() => setLeftTab('files')}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all",
                                        leftTab === 'files' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
                                    )}
                                >
                                    <FolderTree size={14} />
                                    文件管理
                                </button>
                                <button 
                                    onClick={() => setLeftTab('apps')}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all",
                                        leftTab === 'apps' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
                                    )}
                                >
                                    <LayoutGrid size={14} />
                                    应用管理
                                </button>
                                {/* Mobile-only Shell Tab */}
                                <button 
                                    onClick={() => setLeftTab('shell')}
                                    className={cn(
                                        "lg:hidden flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all",
                                        leftTab === 'shell' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"
                                    )}
                                >
                                    <TerminalIcon size={14} />
                                    ADB Shell
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-hidden min-h-0">
                                {leftTab === 'files' && <FileExplorer adb={adb} />}
                                {leftTab === 'apps' && <AppManager adb={adb} />}
                                {leftTab === 'shell' && (
                                    <div className="h-full flex flex-col lg:hidden">
                                        <Shell adb={adb} />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Desktop-only Persistent Shell (Right) */}
                        <div className="hidden lg:flex flex-[7] flex flex-col min-w-0 h-full overflow-hidden">
                            <div className="flex items-center gap-2 mb-2 px-1">
                                <TerminalIcon size={16} className="text-gray-500" />
                                <h3 className="font-bold text-gray-700 text-xs uppercase tracking-wider">ADB Shell</h3>
                            </div>
                            <div className="flex-1 overflow-hidden min-h-0">
                                <Shell adb={adb} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {adb && showMirror && (
                <ScreenMirror adb={adb} onClose={() => setShowMirror(false)} />
            )}

            {/* Footer */}
            <footer className="px-6 py-2 bg-white border-t flex justify-between items-center text-[9px] sm:text-[10px] text-gray-400 font-medium flex-shrink-0">
                <div className="flex gap-4">
                    <span className="hidden sm:inline">WEBUSB / TANGO ENGINE</span>
                    <span>CLIENT-SIDE ONLY</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span>VER 1.0.0</span>
                    </div>
                    <a 
                        href="https://github.com/kekxv/web-adb" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-gray-600 transition-colors"
                    >
                        <Github size={12} className="hidden sm:block" />
                        <span>GITHUB</span>
                    </a>
                </div>
            </footer>
        </main>
    );
}
