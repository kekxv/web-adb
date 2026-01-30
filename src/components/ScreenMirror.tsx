'use client';

import {useEffect, useRef, useState, useCallback} from 'react';
import {Adb} from '@yume-chan/adb';
import {AdbScrcpyClient, AdbScrcpyOptionsLatest} from '@yume-chan/adb-scrcpy';
import {
    AndroidKeyEventAction,
    ScrcpyVideoCodecId,
    AndroidMotionEventAction,
} from '@yume-chan/scrcpy';
import {WebCodecsVideoDecoder, WebGLVideoFrameRenderer} from '@yume-chan/scrcpy-decoder-webcodecs';
import {PushReadableStream, WritableStream} from '@yume-chan/stream-extra';
import {useI18n} from '@/lib/i18n';
import {X, Power, ArrowLeft, AlertCircle, RefreshCw} from 'lucide-react';

interface ScreenMirrorProps {
    adb: Adb;
    onClose: () => void;
}

const SCRCPY_SERVER_URL = 'scrcpy-server.jar';
const SCRCPY_VERSION = '3.3.4';

export default function ScreenMirror({adb, onClose}: ScreenMirrorProps) {
    const {t} = useI18n();
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const mainContainerRef = useRef<HTMLDivElement>(null);

    // --- 核心状态 ---
    const [initialPos] = useState({x: 100, y: 100});
    // 增加这个状态来控制拖拽时的样式优化
    const [isDraggingState, setIsDraggingState] = useState(false);

    // Ref 存储坐标，用于高性能计算
    const dragRef = useRef({
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        lastX: 0,
        lastY: 0,
        frameId: 0
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [permissionWarning, setPermissionWarning] = useState(false);
    const [retryKey, setRetryKey] = useState(0);

    const clientRef = useRef<AdbScrcpyClient<AdbScrcpyOptionsLatest<true>> | null>(null);
    const decoderRef = useRef<WebCodecsVideoDecoder | null>(null);
    const rendererRef = useRef<WebGLVideoFrameRenderer | null>(null);
    const videoSizeRef = useRef({width: 0, height: 0});

    // --- 极速拖拽逻辑 ---
    const updatePosition = () => {
        if (!mainContainerRef.current) return;
        const {currentX, currentY} = dragRef.current;
        // 使用 translate3d 开启 GPU 加速
        mainContainerRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        dragRef.current.frameId = 0;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.drag-handle')) {
            e.preventDefault();
            // 触发 React 状态更新，用于切换 CSS 类（禁用 pointer-events 等）
            setIsDraggingState(true);

            dragRef.current.startX = e.clientX;
            dragRef.current.startY = e.clientY;
            dragRef.current.lastX = dragRef.current.currentX;
            dragRef.current.lastY = dragRef.current.currentY;

            // 强制立即移除 transition，防止拖拽开始时有延迟
            if (mainContainerRef.current) {
                mainContainerRef.current.style.transition = 'none';
            }

            window.addEventListener('mousemove', handleGlobalMouseMove, {passive: false});
            window.addEventListener('mouseup', handleGlobalMouseUp);
        }
    };

    const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
        e.preventDefault();
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;

        dragRef.current.currentX = dragRef.current.lastX + dx;
        dragRef.current.currentY = dragRef.current.lastY + dy;

        if (dragRef.current.frameId === 0) {
            dragRef.current.frameId = requestAnimationFrame(updatePosition);
        }
    }, []);

    const handleGlobalMouseUp = useCallback(() => {
        setIsDraggingState(false);
        if (dragRef.current.frameId !== 0) {
            cancelAnimationFrame(dragRef.current.frameId);
            dragRef.current.frameId = 0;
            updatePosition();
        }
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, [handleGlobalMouseMove]);

    useEffect(() => {
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
            if (dragRef.current.frameId !== 0) cancelAnimationFrame(dragRef.current.frameId);
        };
    }, [handleGlobalMouseMove, handleGlobalMouseUp]);

    const injectTouch = useCallback(async (action: AndroidMotionEventAction, e: MouseEvent | TouchEvent) => {
        const client = clientRef.current;
        const renderer = rendererRef.current;
        if (!client?.controller || videoSizeRef.current.width === 0 || !renderer) return;

        const canvas = renderer.canvas as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();

        let clientX, clientY;
        if ('touches' in e) {
            if (e.touches.length === 0 && action !== AndroidMotionEventAction.Up) return;
            const touch = e.touches[0] || e.changedTouches[0];
            clientX = touch.clientX;
            clientY = touch.clientY;
        } else {
            clientX = (e as MouseEvent).clientX;
            clientY = (e as MouseEvent).clientY;
        }

        const offsetX = clientX - rect.left;
        const offsetY = clientY - rect.top;
        const x = (offsetX / rect.width) * videoSizeRef.current.width;
        const y = (offsetY / rect.height) * videoSizeRef.current.height;

        if (offsetX < 0 || offsetX > rect.width || offsetY < 0 || offsetY > rect.height) return;

        try {
            await client.controller.injectTouch({
                action,
                pointerId: BigInt(0),
                pointerX: x,
                pointerY: y,
                videoWidth: videoSizeRef.current.width,
                videoHeight: videoSizeRef.current.height,
                pressure: 1,
                actionButton: 0,
                buttons: 0,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
        } catch (err) {
            console.error('Mirror: Touch failed', err);
        }
    }, []);

    useEffect(() => {
        let active = true;

        async function startMirroring() {
            try {
                setLoading(true);
                setError(null);
                setPermissionWarning(false);
                const response = await fetch(SCRCPY_SERVER_URL);
                if (!response.ok) throw new Error('Failed to fetch scrcpy-server.jar');
                const buffer = await response.arrayBuffer();
                if (!active) return;
                await AdbScrcpyClient.pushServer(adb, new PushReadableStream<Uint8Array>(async (controller) => {
                    await controller.enqueue(new Uint8Array(buffer));
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                }) as any);
                const options = new AdbScrcpyOptionsLatest({
                    video: true,
                    audio: false,
                    control: true,
                    maxSize: 1024,
                    videoBitRate: 4_000_000,
                    tunnelForward: true,
                });
                Object.defineProperty(options, 'version', {value: SCRCPY_VERSION});
                const client = await AdbScrcpyClient.start(adb, '/data/local/tmp/scrcpy-server.jar', options);
                clientRef.current = client;
                client.output.pipeTo(new WritableStream({
                    write(line) {
                        if (line.includes('INJECT_EVENTS permission')) {
                            setPermissionWarning(true);
                        }
                    }
                })).catch(() => {
                });
                if (!active) {
                    client.close();
                    return;
                }
                const videoStream = await client.videoStream;
                if (videoStream) {
                    const renderer = new WebGLVideoFrameRenderer();
                    rendererRef.current = renderer;
                    const decoder = new WebCodecsVideoDecoder({
                        codec: ScrcpyVideoCodecId.H264,
                        renderer
                    });
                    decoderRef.current = decoder;
                    decoder.sizeChanged(() => {
                        videoSizeRef.current = {width: decoder.width, height: decoder.height};
                    });
                    if (videoContainerRef.current) {
                        videoContainerRef.current.innerHTML = '';
                        const canvas = renderer.canvas as HTMLCanvasElement;
                        videoContainerRef.current.appendChild(canvas);
                        canvas.style.width = '100%';
                        canvas.style.height = '100%';
                        canvas.style.objectFit = 'contain';
                        canvas.onmousedown = (e) => {
                            injectTouch(AndroidMotionEventAction.Down, e);
                            const onMouseMove = (me: MouseEvent) => {
                                if (me.buttons === 1) injectTouch(AndroidMotionEventAction.Move, me);
                            };
                            const onMouseUp = (me: MouseEvent) => {
                                injectTouch(AndroidMotionEventAction.Up, me);
                                window.removeEventListener('mousemove', onMouseMove);
                                window.removeEventListener('mouseup', onMouseUp);
                            };
                            window.addEventListener('mousemove', onMouseMove);
                            window.addEventListener('mouseup', onMouseUp);
                        };
                    }
                    videoStream.stream.pipeTo(decoder.writable).catch(() => {
                    });
                }
                setLoading(false);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (err: any) {
                console.error('Mirror Error:', err);
                if (active) {
                    setError(err.message || 'Failed to start mirroring');
                    setLoading(false);
                }
            }
        }

        startMirroring();
        return () => {
            active = false;
            clientRef.current?.close();
            decoderRef.current?.dispose();
        };
    }, [adb, retryKey, injectTouch]);

    const handleHome = async () => {
        if (clientRef.current?.controller) {
            await clientRef.current.controller.backOrScreenOn(AndroidKeyEventAction.Down);
            await clientRef.current.controller.backOrScreenOn(AndroidKeyEventAction.Up);
        }
    };

    const handleBack = async () => {
        if (clientRef.current?.controller) {
            await clientRef.current.controller.injectKeyCode({
                action: AndroidKeyEventAction.Down,
                keyCode: 4,
                repeat: 0,
                metaState: 0,
            });
            await clientRef.current.controller.injectKeyCode({
                action: AndroidKeyEventAction.Up,
                keyCode: 4,
                repeat: 0,
                metaState: 0,
            });
        }
    };

    return (
        <div
            ref={mainContainerRef}
            // 移除了 transition-all, duration-200.
            // 只保留必要的布局类。animate-in 仍然可以用，但它通常只在挂载时生效。
            className={`fixed z-[200] bg-[#0a0a0a] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden flex flex-col animate-in fade-in zoom-in ${
                // 拖拽时，降低阴影复杂度，提升渲染性能
                isDraggingState ? 'shadow-none' : ''
            }`}
            onContextMenu={(e) => e.preventDefault()}
            style={{
                left: initialPos.x,
                top: initialPos.y,
                width: '360px',
                height: '760px',
                // 强制开启 GPU 独立层
                willChange: 'transform',
                // 绝对禁止 transition，这是不跟手的罪魁祸首！
                transition: 'none',
                // 拖拽时禁用内部所有鼠标事件，防止 iframe/canvas 抢夺资源
                pointerEvents: isDraggingState ? 'none' : 'auto'
            }}
        >
            <div
                onMouseDown={handleMouseDown}
                // 拖拽手柄需要 pointer-events: auto 才能接收事件，即使父元素禁用了
                style={{pointerEvents: 'auto'}}
                className="drag-handle h-12 bg-gradient-to-b from-gray-800 to-gray-900 border-b border-white/5 flex items-center justify-between px-4 cursor-grab active:cursor-grabbing flex-shrink-0 select-none"
            >
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
                    <span
                        className="text-[11px] font-bold text-gray-300 uppercase tracking-[0.2em]">{t.mirrorTitle}</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setRetryKey(prev => prev + 1)}
                        className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-all"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""}/>
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-full transition-all"
                    >
                        <X size={18}/>
                    </button>
                </div>
            </div>

            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                {loading && (
                    <div className="absolute inset-0 z-30 bg-black flex flex-col items-center justify-center gap-4">
                        <div
                            className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"/>
                        <span
                            className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{t.mirrorLoading}</span>
                    </div>
                )}
                {error && (
                    <div
                        className="absolute inset-0 z-40 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
                        <AlertCircle className="text-red-500 mb-4" size={32}/>
                        <h3 className="text-white font-bold mb-2 text-sm">{t.connected} Error</h3>
                        <p className="text-gray-400 text-[10px] mb-6">{error}</p>
                        <button onClick={() => setRetryKey(prev => prev + 1)}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg transition-all">{t.reconnect}</button>
                    </div>
                )}
                {permissionWarning && !error && (
                    <div
                        className="absolute top-4 left-4 right-4 z-50 bg-orange-500/90 backdrop-blur-md border border-orange-400/50 p-3 rounded-xl shadow-2xl flex items-start gap-3">
                        <AlertCircle className="text-white shrink-0" size={18}/>
                        <div className="flex-1">
                            <p className="text-[11px] font-bold text-white">{t.permTitle}</p>
                            <p className="text-[10px] text-orange-50">{t.permDesc}</p>
                        </div>
                        <button onClick={() => setPermissionWarning(false)} className="text-white/60 hover:text-white">
                            <X size={14}/></button>
                    </div>
                )}

                <div ref={videoContainerRef} className="w-full h-full"/>
            </div>

            <div
                style={{pointerEvents: 'auto'}}
                className="h-16 bg-[#0a0a0a] border-t border-white/5 flex items-center justify-around px-8 flex-shrink-0"
            >
                <button onClick={handleBack}
                        className="p-3 text-gray-500 hover:text-white hover:bg-white/5 rounded-full transition-all"
                        title={t.back}>
                    <ArrowLeft size={22}/>
                </button>
                <button onClick={handleHome} className="relative w-14 h-14 flex items-center justify-center group"
                        title={t.home}>
                    <div
                        className="w-10 h-10 rounded-full border-2 border-gray-700 group-hover:border-blue-500 flex items-center justify-center transition-all duration-300 shadow-inner">
                        <div className="w-3 h-3 rounded-sm bg-gray-600 group-hover:bg-blue-500 transition-colors"/>
                    </div>
                </button>
                <button className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-all"
                        title={t.power}>
                    <Power size={22}/>
                </button>
            </div>
        </div>
    );
}