'use client';

import { useState, useEffect, useCallback } from 'react';
import { Adb } from '@yume-chan/adb';
import { Package, Trash2, Play, Ban, RefreshCw, Search, ShieldCheck, User } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface AppInfo {
    packageName: string;
    isSystem: boolean;
}

interface AppManagerProps {
    adb: Adb;
}

export default function AppManager({ adb }: AppManagerProps) {
    const [apps, setApps] = useState<AppInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('');
    const [showSystem, setShowSystem] = useState(false);

    const listApps = useCallback(async () => {
        setLoading(true);
        try {
            // Get third-party apps
            const userAppsRaw = await adb.subprocess.noneProtocol.spawnWaitText(['pm', 'list', 'packages', '-3']);
            const userPackages = userAppsRaw.split('\n')
                .filter(line => line.startsWith('package:'))
                .map(line => ({ packageName: line.replace('package:', '').trim(), isSystem: false }));

            let allApps = userPackages;

            if (showSystem) {
                const systemAppsRaw = await adb.subprocess.noneProtocol.spawnWaitText(['pm', 'list', 'packages', '-s']);
                const systemPackages = systemAppsRaw.split('\n')
                    .filter(line => line.startsWith('package:'))
                    .map(line => ({ packageName: line.replace('package:', '').trim(), isSystem: true }));
                allApps = [...userPackages, ...systemPackages];
            }

            setApps(allApps.sort((a, b) => a.packageName.localeCompare(b.packageName)));
        } catch (error) {
            console.error('Failed to list apps:', error);
        } finally {
            setLoading(false);
        }
    }, [adb, showSystem]);

    useEffect(() => {
        listApps();
    }, [listApps]);

    const uninstallApp = async (packageName: string) => {
        if (!confirm(`确定要卸载 ${packageName} 吗？`)) return;
        try {
            const result = await adb.subprocess.noneProtocol.spawnWaitText(['pm', 'uninstall', packageName]);
            alert(result.includes('Success') ? '卸载成功' : '卸载失败: ' + result);
            listApps();
        } catch (error) {
            alert('卸载出错');
        }
    };

    const disableApp = async (packageName: string) => {
        try {
            await adb.subprocess.noneProtocol.spawnWaitText(['pm', 'disable-user', packageName]);
            alert('已停用');
            listApps();
        } catch (error) {
            alert('操作失败');
        }
    };

    const openApp = async (packageName: string) => {
        try {
            // Using monkey to start the app is the easiest way to find the main activity
            await adb.subprocess.noneProtocol.spawnWaitText(['monkey', '-p', packageName, '-c', 'android.intent.category.LAUNCHER', '1']);
        } catch (error) {
            alert('无法打开应用');
        }
    };

    const filteredApps = apps.filter(app => 
        app.packageName.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden min-h-0">
            {/* Toolbar */}
            <div className="p-3 border-b bg-gray-50 flex flex-col gap-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input 
                            type="text" 
                            placeholder="搜索应用包名..." 
                            className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={listApps}
                        className="p-2 hover:bg-gray-200 rounded-lg text-gray-600 transition-all"
                        title="刷新列表"
                    >
                        <RefreshCw className={cn(loading && "animate-spin")} />
                    </button>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setShowSystem(false)}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all border",
                            !showSystem ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                        )}
                    >
                        <User size={12} />
                        用户应用
                    </button>
                    <button 
                        onClick={() => setShowSystem(true)}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all border",
                            showSystem ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                        )}
                    >
                        <ShieldCheck size={12} />
                        系统应用
                    </button>
                </div>
            </div>

            {/* App List */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                        <RefreshCw className="animate-spin text-blue-500" size={32} />
                        <span className="text-sm">正在获取应用列表...</span>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {filteredApps.length === 0 ? (
                            <div className="py-10 text-center text-gray-400 text-sm">
                                未找到应用
                            </div>
                        ) : (
                            filteredApps.map((app) => (
                                <div key={app.packageName} className="p-3 hover:bg-gray-50 flex items-center justify-between group">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="p-2 bg-gray-100 rounded-lg text-gray-500 flex-shrink-0">
                                            <Package size={20} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-gray-800 truncate" title={app.packageName}>
                                                {app.packageName}
                                            </div>
                                            <div className="text-[10px] text-gray-400 font-mono">
                                                {app.isSystem ? 'SYSTEM' : 'THIRD-PARTY'}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                        <button 
                                            onClick={() => openApp(app.packageName)}
                                            className="p-1.5 hover:bg-green-100 text-green-600 rounded-lg"
                                            title="运行"
                                        >
                                            <Play size={16} fill="currentColor" />
                                        </button>
                                        <button 
                                            onClick={() => disableApp(app.packageName)}
                                            className="p-1.5 hover:bg-orange-100 text-orange-600 rounded-lg"
                                            title="停用"
                                        >
                                            <Ban size={16} />
                                        </button>
                                        {!app.isSystem && (
                                            <button 
                                                onClick={() => uninstallApp(app.packageName)}
                                                className="p-1.5 hover:bg-red-100 text-red-600 rounded-lg"
                                                title="卸载"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
