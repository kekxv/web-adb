'use client';

import { useState, useEffect, useCallback } from 'react';
import { Adb } from '@yume-chan/adb';
import { Folder, File, ArrowLeft, Download, Upload, Home, Loader2, Eye, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Image from 'next/image';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface FileEntry {
    name: string;
    isDirectory: boolean;
    size: bigint;
    mtime: number;
}

interface FileExplorerProps {
    adb: Adb;
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];

export default function FileExplorer({ adb }: FileExplorerProps) {
    const { t } = useI18n();
    const [path, setPath] = useState('/sdcard');
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewName, setPreviewName] = useState('');
    const [previewLoading, setPreviewLoading] = useState(false);

    const isImage = (name: string) => {
        const lower = name.toLowerCase();
        return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext));
    };

    const listFiles = useCallback(async (targetPath: string) => {
        setLoading(true);
        try {
            const sync = await adb.sync();
            try {
                const entries = await sync.readdir(targetPath);
                const sortedEntries: FileEntry[] = entries
                    .filter(e => e.name !== '.' && e.name !== '..')
                    .map(e => ({
                        name: e.name,
                        isDirectory: (e.mode & 0x4000) !== 0,
                        size: e.size,
                        mtime: Number(e.mtime)
                    }))
                    .sort((a, b) => {
                        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(a.name);
                        return a.isDirectory ? -1 : 1;
                    });
                setFiles(sortedEntries);
                setPath(targetPath);
            } finally {
                await sync.dispose();
            }
        } catch (error) {
            console.error('Failed to list files:', error);
        } finally {
            setLoading(false);
        }
    }, [adb]);

    useEffect(() => {
        listFiles(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [adb]); // path is managed internally, adding it causes double load on setPath

    const navigateTo = (name: string) => {
        const newPath = path === '/' ? `/${name}` : `${path}/${name}`;
        listFiles(newPath);
    };

    const navigateUp = () => {
        if (path === '/') return;
        const parts = path.split('/').filter(Boolean);
        parts.pop();
        const newPath = '/' + parts.join('/');
        listFiles(newPath);
    };

    const getFileBlob = async (name: string) => {
        const sync = await adb.sync();
        try {
            const filePath = path === '/' ? `/${name}` : `${path}/${name}`;
            const stream = await sync.read(filePath);
            
            const chunks: Uint8Array[] = [];
            const reader = stream.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) chunks.push(value);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return new Blob(chunks as any, { type: 'application/octet-stream' });
        } finally {
            await sync.dispose();
        }
    };

    const downloadFile = async (name: string) => {
        try {
            const blob = await getFileBlob(name);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
        }
    };

    const previewFile = async (name: string) => {
        setPreviewLoading(true);
        setPreviewName(name);
        try {
            const blob = await getFileBlob(name);
            const mimeType = name.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : `image/${name.split('.').pop()}`;
            const imageBlob = new Blob([blob], { type: mimeType });
            const url = URL.createObjectURL(imageBlob);
            setPreviewUrl(url);
        } catch (error) {
            console.error('Preview failed:', error);
        } finally {
            setPreviewLoading(false);
        }
    };

    const closePreview = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
    };

    const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const sync = await adb.sync();
            try {
                const targetPath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
                await sync.write({
                    filename: targetPath,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    file: file.stream() as any,
                });
                listFiles(path);
            } finally {
                await sync.dispose();
            }
        } catch (error) {
            console.error('Upload failed:', error);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden min-h-0 relative">
            <div className="p-3 border-b bg-gray-50 flex items-center gap-2 flex-shrink-0">
                <button 
                    onClick={navigateUp} 
                    disabled={path === '/'}
                    className="p-1.5 hover:bg-gray-200 rounded-lg disabled:opacity-30 transition-all"
                >
                    <ArrowLeft size={18} />
                </button>
                <button 
                    onClick={() => listFiles('/sdcard')} 
                    className="p-1.5 hover:bg-gray-200 rounded-lg transition-all"
                >
                    <Home size={18} />
                </button>
                <div className="flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-mono truncate shadow-inner text-gray-600">
                    {path}
                </div>
                <label className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg cursor-pointer transition-all" title={t.upload}>
                    <Upload size={18} />
                    <input type="file" className="hidden" onChange={uploadFile} />
                </label>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 text-gray-700">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                        <Loader2 className="animate-spin text-blue-500" size={32} />
                        <span className="text-sm">{t.loadingFiles}</span>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500 uppercase z-10">
                            <tr>
                                <th className="px-4 py-3 font-semibold">{t.name}</th>
                                <th className="px-4 py-3 font-semibold">{t.size}</th>
                                <th className="px-4 py-3 font-semibold text-right">{t.action}</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-100">
                            {files.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={3} className="px-6 py-10 text-center text-gray-400">
                                        {t.emptyDir}
                                    </td>
                                </tr>
                            )}
                            {files.map((file) => (
                                <tr key={file.name} className="hover:bg-blue-50/40 transition-colors group">
                                    <td className="px-4 py-3">
                                        <div 
                                            className={cn(
                                                "flex items-center gap-2.5 cursor-pointer",
                                                file.isDirectory ? "text-blue-600 font-medium" : "text-gray-700"
                                            )}
                                            onClick={() => file.isDirectory ? navigateTo(file.name) : null}
                                        >
                                            {file.isDirectory ? 
                                                <Folder size={16} className="text-blue-500 fill-blue-50" /> : 
                                                <File size={16} className="text-gray-400" />
                                            }
                                            <span className="truncate max-w-[150px]">{file.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-400 font-mono text-[10px]">
                                        {file.isDirectory ? '-' : `${(Number(file.size) / 1024).toFixed(1)} KB`}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {!file.isDirectory && (
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {isImage(file.name) && (
                                                    <button 
                                                        onClick={() => previewFile(file.name)}
                                                        className="p-1.5 hover:bg-blue-100 text-blue-500 rounded-lg"
                                                        title={t.preview}
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => downloadFile(file.name)}
                                                    className="p-1.5 hover:bg-blue-100 text-blue-500 rounded-lg"
                                                    title={t.download}
                                                >
                                                    <Download size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Preview Loading Overlay */}
            {previewLoading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex items-center justify-center flex-col gap-2">
                    <Loader2 className="animate-spin text-blue-600" size={32} />
                    <span className="text-sm font-medium text-gray-600">{t.preview}...</span>
                </div>
            )}

            {/* Image Preview Modal */}
            {previewUrl && (
                <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-4">
                    <div className="absolute top-4 right-4 flex gap-4">
                         <button 
                            onClick={() => downloadFile(previewName)}
                            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                            title={t.download}
                        >
                            <Download size={24} />
                        </button>
                        <button 
                            onClick={closePreview}
                            className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                    <div className="max-w-full max-h-full flex flex-col items-center">
                        <Image 
                            src={previewUrl} 
                            alt={previewName}
                            width={1920}
                            height={1080}
                            className="max-w-full max-h-[85vh] object-contain shadow-2xl rounded"
                        />
                        <p className="mt-4 text-white font-medium text-sm bg-black/50 px-4 py-1.5 rounded-full border border-white/20">
                            {previewName}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}