'use client';

import React, {createContext, useContext, useState, useEffect} from 'react';

export type Language = 'en' | 'zh';

const translations = {
    en: {
        title: 'Web ADB Manager',
        subtitle: 'Browser ADB Client',
        connect: 'Connect Phone',
        connecting: 'Connecting...',
        disconnect: 'Disconnect',
        connected: 'Connected',
        waitingAuth: 'Waiting for Auth...',
        authHint: 'Please click "Always allow debugging" on your phone',
        readyTitle: 'Ready to Start',
        readyDesc: 'Please connect your Android phone via USB and ensure USB Debugging is enabled.',
        step1: 'Enable Developer Options',
        step2: 'Enable USB Debugging',
        fileManager: 'Files',
        appManager: 'Apps',
        shell: 'ADB Shell',
        installApk: 'Install APK',
        installing: 'Installing...',
        installSuccess: 'Installation successful!',
        installFailed: 'Installation failed',
        loadingFiles: 'Reading filesystem...',
        emptyDir: 'Directory is empty',
        name: 'Name',
        size: 'Size',
        action: 'Action',
        download: 'Download',
        preview: 'Preview',
        upload: 'Upload',
        searchApps: 'Search package name...',
        userApps: 'User Apps',
        systemApps: 'System Apps',
        noApps: 'No apps found',
        uninstall: 'Uninstall',
        disable: 'Disable',
        run: 'Run',
        confirmUninstall: 'Are you sure you want to uninstall {pkg}?',
        mirror: 'Mirror',
        stopMirror: 'Stop',
        mirrorTitle: 'Live Preview',
        mirrorLoading: 'Initialising Scrcpy...',
        reconnect: 'Retry',
        permTitle: 'Control Restricted',
        permDesc: 'Xiaomi detected? Enable "USB Debugging (Security Settings)" then refresh.',
        home: 'Home',
        back: 'Back',
        power: 'Power',
    },
    zh: {
        title: 'Web ADB 管理器',
        subtitle: '纯网页 ADB 客户端',
        connect: '连接手机',
        connecting: '正在连接...',
        disconnect: '断开',
        connected: '已连接',
        waitingAuth: '等待授权...',
        authHint: '请在手机上点击“始终允许来自此计算机的调试”',
        readyTitle: '准备开始',
        readyDesc: '请通过 USB 数据线连接您的 Android 手机，并确保已开启 USB 调试。',
        step1: '启用开发者选项',
        step2: '开启 USB 调试',
        fileManager: '文件管理',
        appManager: '应用管理',
        shell: 'ADB Shell',
        installApk: '安装 APK',
        installing: '正在安装...',
        installSuccess: '安装成功！',
        installFailed: '安装失败',
        loadingFiles: '正在读取文件系统...',
        emptyDir: '此目录为空',
        name: '名称',
        size: '大小',
        action: '操作',
        download: '下载',
        preview: '预览',
        upload: '上传',
        searchApps: '搜索应用包名...',
        userApps: '用户应用',
        systemApps: '系统应用',
        noApps: '未找到应用',
        uninstall: '卸载',
        disable: '停用',
        run: '运行',
        confirmUninstall: '确定要卸载 {pkg} 吗？',
        mirror: '手机预览',
        stopMirror: '停止预览',
        mirrorTitle: '实时预览',
        mirrorLoading: '正在初始化...',
        reconnect: '重试连接',
        permTitle: '控制受限',
        permDesc: '请开启手机“USB调试（安全设置）”，然后刷新预览窗口。',
        home: '主页',
        back: '返回',
        power: '电源',
    }
};

type Translations = typeof translations.en;

const I18nContext = createContext<{
    lang: Language;
    setLang: (l: Language) => void;
    t: Translations;
}>({
    lang: 'en',
    setLang: () => {
    },
    t: translations.en,
});

export function I18nProvider({children}: { children: React.ReactNode }) {
    // 初始状态必须固定为 en，以匹配服务端渲染结果，防止 Hydration Mismatch
    const [lang, setLang] = useState<Language>('en');

    useEffect(() => {
        const saved = localStorage.getItem('lang') as Language;
        if (saved && (saved === 'en' || saved === 'zh')) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLang(saved);
        } else {
            const browserLang = navigator.language.startsWith('zh') ? 'zh' : 'en';
            setLang(browserLang);
        }
    }, []);

    const handleSetLang = (l: Language) => {
        setLang(l);
        localStorage.setItem('lang', l);
    };

    return (
        <I18nContext.Provider value={{lang, setLang: handleSetLang, t: translations[lang]}}>
            {children}
        </I18nContext.Provider>
    );
}

export const useI18n = () => useContext(I18nContext);
