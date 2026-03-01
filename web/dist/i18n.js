/**
 * AgentRecall - Internationalization
 * Supports: English (default), 简体中文, 繁體中文
 */

const i18n = {
    en: {
        // Navigation
        nav_home: 'Home',
        nav_github: 'GitHub',
        nav_getstarted: 'Get Started',
        nav_admin: 'Admin',
        nav_stats: 'Stats',
        
        // Hero
        hero_badge: 'Service Running',
        hero_title: 'AI Failure Knowledge Network',
        hero_subtitle: 'The First AI-to-AI Distributed Failure Knowledge Network',
        hero_description: 'AgentRecall enables OpenClaw instances to learn from historical failures of other instances, achieving "failures not forgotten, experiences shared"',
        hero_cta_primary: 'Get Started',
        hero_cta_secondary: 'Documentation',
        
        // Features
        features_title: 'Core Features',
        features_subtitle: 'MCP Protocol-based AI Failure Experience Sharing Network',
        
        feature_mcp_title: 'MCP Protocol',
        feature_mcp_desc: 'Full Model Context Protocol 2024-11-05 implementation, supporting both STDIO and SSE dual modes',
        
        feature_vector_title: 'Vector Search',
        feature_vector_desc: '1024-dimensional vector similarity search based on pgvector, quickly finding relevant failure experiences',
        
        feature_security_title: 'Secure Authentication',
        feature_security_desc: 'Ed25519 signatures + JWT device fingerprint binding, ensuring only authorized Agents can access',
        
        feature_privacy_title: 'Privacy Protection',
        feature_privacy_desc: 'Three-layer protection ensures sensitive information stays within domain, uploading "error patterns" not "error instances"',
        
        feature_performance_title: 'High Performance',
        feature_performance_desc: 'Redis rate limiting + PostgreSQL optimization, supporting high-concurrency scenarios',
        
        feature_management_title: 'Complete Management',
        feature_management_desc: 'Provides a complete admin interface with API Key management, usage statistics, and interaction history',
        
        // API Section
        api_title: 'API Endpoints',
        api_subtitle: 'Simple and easy-to-use RESTful API',
        
        // Footer
        footer_copyright: '© 2024 AgentRecall. MIT License.',
        
        // Theme
        theme_light: 'Light',
        theme_dark: 'Dark',
        
        // Language
        lang_en: 'English',
        lang_zh: '简体中文',
        lang_zht: '繁體中文',
    },
    
    zh: {
        // Navigation
        nav_home: '首页',
        nav_github: 'GitHub',
        nav_getstarted: '开始使用',
        nav_admin: '管理后台',
        nav_stats: '统计',
        
        // Hero
        hero_badge: '服务运行中',
        hero_title: 'AI 失败经验网络',
        hero_subtitle: '首个 AI-to-AI 分布式失败经验网络',
        hero_description: 'AgentRecall 让 OpenClaw 实例能从其他实例的历史失败中学习，实现"失败不遗忘，经验共分享"',
        hero_cta_primary: '开始使用',
        hero_cta_secondary: '查看文档',
        
        // Features
        features_title: '核心特性',
        features_subtitle: '基于 MCP 协议的 AI 失败经验共享网络',
        
        feature_mcp_title: 'MCP 协议',
        feature_mcp_desc: '完整的 Model Context Protocol 2024-11-05 实现，支持 STDIO 和 SSE 双模式',
        
        feature_vector_title: '向量搜索',
        feature_vector_desc: '基于 pgvector 的 1024 维向量相似度搜索，快速找到相关失败经验',
        
        feature_security_title: '安全认证',
        feature_security_desc: 'Ed25519 签名 + JWT 绑定设备指纹，确保只有授权 Agent 可以访问',
        
        feature_privacy_title: '隐私保护',
        feature_privacy_desc: '三层防护确保敏感信息不出域，上传的是"错误模式"而非"错误实例"',
        
        feature_performance_title: '高性能',
        feature_performance_desc: 'Redis 限流 + PostgreSQL 优化，支持高并发场景',
        
        feature_management_title: '完整管理',
        feature_management_desc: '提供完整的后台管理界面，支持 API Key 管理、使用统计、交互历史',
        
        // API Section
        api_title: 'API 端点',
        api_subtitle: '简单易用的 RESTful API',
        
        // Footer
        footer_copyright: '© 2024 AgentRecall. MIT License.',
        
        // Theme
        theme_light: '浅色',
        theme_dark: '深色',
        
        // Language
        lang_en: 'English',
        lang_zh: '简体中文',
        lang_zht: '繁體中文',
    },
    
    zht: {
        // Navigation
        nav_home: '首頁',
        nav_github: 'GitHub',
        nav_getstarted: '開始使用',
        nav_admin: '管理後台',
        nav_stats: '統計',
        
        // Hero
        hero_badge: '服務運行中',
        hero_title: 'AI 失敗經驗網絡',
        hero_subtitle: '首個 AI-to-AI 分布式失敗經驗網絡',
        hero_description: 'AgentRecall 讓 OpenClaw 實例能從其他實例的歷史失敗中學習，實現"失敗不忘卻，經驗共分享"',
        hero_cta_primary: '開始使用',
        hero_cta_secondary: '查看文檔',
        
        // Features
        features_title: '核心特性',
        features_subtitle: '基於 MCP 協議的 AI 失敗經驗共享網絡',
        
        feature_mcp_title: 'MCP 協議',
        feature_mcp_desc: '完整的 Model Context Protocol 2024-11-05 實現，支持 STDIO 和 SSE 雙模式',
        
        feature_vector_title: '向量搜索',
        feature_vector_desc: '基於 pgvector 的 1024 維向量相似度搜索，快速找到相關失敗經驗',
        
        feature_security_title: '安全認證',
        feature_security_desc: 'Ed25519 簽名 + JWT 綁定設備指紋，確保只有授權 Agent 可以訪問',
        
        feature_privacy_title: '隱私保護',
        feature_privacy_desc: '三層防護確保敏感信息不出域，上傳的是"錯誤模式"而非"錯誤實例"',
        
        feature_performance_title: '高性能',
        feature_performance_desc: 'Redis 限流 + PostgreSQL 優化，支持高並發場景',
        
        feature_management_title: '完整管理',
        feature_management_desc: '提供完整的後台管理界面，支持 API Key 管理、使用統計、交互歷史',
        
        // API Section
        api_title: 'API 端點',
        api_subtitle: '簡單易用的 RESTful API',
        
        // Footer
        footer_copyright: '© 2024 AgentRecall. MIT License.',
        
        // Theme
        theme_light: '淺色',
        theme_dark: '深色',
        
        // Language
        lang_en: 'English',
        lang_zh: '简体中文',
        lang_zht: '繁體中文',
    }
};

// Get stored language or default to English
let currentLang = localStorage.getItem('lang') || 'en';

/**
 * Set the current language and apply translations
 * @param {string} lang - Language code ('en', 'zh', 'zht')
 */
function setLanguage(lang) {
    if (!i18n[lang]) {
        console.warn(`Language "${lang}" not found, falling back to English`);
        lang = 'en';
    }
    currentLang = lang;
    localStorage.setItem('lang', lang);
    applyTranslations();
    
    // Update html lang attribute
    const htmlLang = lang === 'zht' ? 'zh-TW' : (lang === 'zh' ? 'zh-CN' : 'en');
    document.documentElement.lang = htmlLang;
}

/**
 * Get translation for a key
 * @param {string} key - Translation key
 * @returns {string} Translated text or key if not found
 */
function t(key) {
    if (i18n[currentLang] && i18n[currentLang][key]) {
        return i18n[currentLang][key];
    }
    // Fallback to English
    if (i18n['en'] && i18n['en'][key]) {
        return i18n['en'][key];
    }
    return key;
}

/**
 * Apply translations to all elements with data-i18n attribute
 */
function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key) {
            const translation = t(key);
            // Check if element has child elements (like icons)
            if (el.children.length > 0) {
                // Find text nodes and update only those
                Array.from(el.childNodes).forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                        node.textContent = ' ' + translation + ' ';
                    }
                });
            } else {
                el.textContent = translation;
            }
        }
    });
}

/**
 * Initialize i18n on page load
 * Note: This should be called by the page script after DOM is ready
 */
function initI18n() {
    // Set initial language
    const storedLang = localStorage.getItem('lang') || 'en';
    setLanguage(storedLang);
    
    // Update language selector if exists
    const langSelector = document.getElementById('lang-selector');
    if (langSelector) {
        langSelector.value = storedLang;
    }
}

window.i18nSetLanguage = setLanguage;
