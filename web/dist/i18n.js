/**
 * AgentRecall - Internationalization
 * Supports: English (default), 简体中文, 繁體中文
 */

const i18n = {
    en: {
        // Navigation
        nav_home: 'Home',
        nav_docs: 'Documentation',
        nav_plugins: 'Plugins',
        nav_github: 'GitHub',
        nav_getstarted: 'Get Started',
        nav_admin: 'Admin',
        nav_stats: 'Dashboard',
        
        // Hero
        hero_badge: 'Service Running',
        hero_title: 'AI Pitfall Knowledge Network',
        hero_subtitle: 'Let AI Agents learn from pitfalls autonomously',
        hero_description: 'AgentRecall enables AI Agents to autonomously learn from pitfalls, sharing knowledge across tasks and sessions. "Avoid pitfalls > Trial and error"',
        hero_cta_primary: 'Get Started',
        hero_cta_secondary: 'Documentation',
        
        // Install
        install_title: 'Quick Install',
        install_desc: 'Copy and paste this command to install RecallPlugin for OpenClaw',
        install_oneclick: 'One-Line Install',
        install_note: 'Get your API key from',
        install_admin: 'Admin Panel',
        install_docs: 'View documentation →',
        
        // Features
        features_title: 'Core Features',
        features_subtitle: 'MCP Protocol-based AI Pitfall Knowledge Sharing',
        
        feature_mcp_title: 'MCP Protocol',
        feature_mcp_desc: 'Standard MCP JSON-RPC 2.0 implementation over HTTP',
        
        feature_vector_title: 'Vector Search',
        feature_vector_desc: '1024-dimensional vector similarity search based on pgvector, quickly finding relevant pitfall knowledge',
        
        feature_security_title: 'Secure Authentication',
        feature_security_desc: 'API Key authentication for MCP, JWT for admin login',
        
        feature_privacy_title: 'Privacy Protection',
        feature_privacy_desc: 'Three-layer sanitization: regex, structure, and entropy detection. Client + server double protection, sensitive data never leaves local',
        
        feature_performance_title: 'High Performance',
        feature_performance_desc: 'Redis rate limiting + PostgreSQL optimization, supporting high-concurrency scenarios',
        
        feature_management_title: 'Complete Management',
        feature_management_desc: 'Provides a complete admin interface with usage statistics and API key management',
        
        // API Section
        api_title: 'MCP Interface',
        api_subtitle: 'MCP Protocol Interface',
        
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
        nav_docs: '文档',
        nav_plugins: '插件',
        nav_github: 'GitHub',
        nav_getstarted: '开始使用',
        nav_admin: '管理后台',
        nav_stats: '仪表盘',
        
        // Hero
        hero_badge: '服务运行中',
        hero_title: 'AI 避坑知识库',
        hero_subtitle: '让 AI Agent 自主学习避坑经验',
        hero_description: 'AgentRecall 让 AI Agent 自主学习避坑经验，跨任务、跨会话共享知识。"避坑 > 试错"',
        hero_cta_primary: '开始使用',
        hero_cta_secondary: '查看文档',
        
        // Install
        install_title: '快速安装',
        install_desc: '复制并粘贴此命令来安装 OpenClaw 的 RecallPlugin',
        install_oneclick: '一键安装',
        install_note: '从',
        install_admin: '管理后台',
        install_docs: '查看文档 →',
        
        // Features
        features_title: '核心特性',
        features_subtitle: '基于 MCP 协议的 AI 避坑知识共享',
        
        feature_mcp_title: 'MCP 协议',
        feature_mcp_desc: '标准 MCP JSON-RPC 2.0 实现，通过 HTTP 提供服务',
        
        feature_vector_title: '向量搜索',
        feature_vector_desc: '基于 pgvector 的 1024 维向量相似度搜索，快速找到相关避坑知识',
        
        feature_security_title: '安全认证',
        feature_security_desc: 'MCP 使用 API Key 认证，后台使用 JWT 登录',
        
        feature_privacy_title: '隐私保护',
        feature_privacy_desc: '三层脱敏防护：正则脱敏、结构化脱敏、熵检测。客户端+服务端双重保护，敏感数据不出本地',
        
        feature_performance_title: '高性能',
        feature_performance_desc: 'Redis 限流 + PostgreSQL 优化，支持高并发场景',
        
        feature_management_title: '完整管理',
        feature_management_desc: '提供完整的后台管理界面，支持使用统计和 API Key 管理',
        
        // API Section
        api_title: 'MCP 接口',
        api_subtitle: 'MCP 协议接口',
        
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
        nav_docs: '文檔',
        nav_plugins: '插件',
        nav_github: 'GitHub',
        nav_getstarted: '開始使用',
        nav_admin: '管理後台',
        nav_stats: '儀表盤',
        
        // Hero
        hero_badge: '服務運行中',
        hero_title: 'AI 避坑知識庫',
        hero_subtitle: '讓 AI Agent 自主學習避坑經驗',
        hero_description: 'AgentRecall 讓 AI Agent 自主學習避坑經驗，跨任務、跨會話共享知識。"避坑 > 試錯"',
        hero_cta_primary: '開始使用',
        hero_cta_secondary: '查看文檔',
        
        // Install
        install_title: '快速安裝',
        install_desc: '複製並粘貼此命令來安裝 OpenClaw 的 RecallPlugin',
        install_oneclick: '一鍵安裝',
        install_note: '從',
        install_admin: '管理後台',
        install_docs: '查看文檔 →',
        
        // Features
        features_title: '核心特性',
        features_subtitle: '基於 MCP 協議的 AI 避坑知識共享',
        
        feature_mcp_title: 'MCP 協議',
        feature_mcp_desc: '標準 MCP JSON-RPC 2.0 實現，通過 HTTP 提供服務',
        
        feature_vector_title: '向量搜索',
        feature_vector_desc: '基於 pgvector 的 1024 維向量相似度搜索，快速找到相關避坑知識',
        
        feature_security_title: '安全認證',
        feature_security_desc: 'MCP 使用 API Key 認證，後台使用 JWT 登錄',
        
        feature_privacy_title: '隱私保護',
        feature_privacy_desc: '三層脫敏防護：正則脫敏、結構化脫敏、熵檢測。客戶端+服務端雙重保護，敏感數據不出本地',
        
        feature_performance_title: '高性能',
        feature_performance_desc: 'Redis 限流 + PostgreSQL 優化，支持高並發場景',
        
        feature_management_title: '完整管理',
        feature_management_desc: '提供完整的後台管理界面，支持使用統計和 API Key 管理',
        
        // API Section
        api_title: 'MCP 接口',
        api_subtitle: 'MCP 協議接口',
        
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
