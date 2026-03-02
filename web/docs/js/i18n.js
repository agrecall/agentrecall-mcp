/**
 * AgentRecall Docs - Internationalization and Theme
 * Supports: English (default), 简体中文, 繁體中文
 */

const i18n = {
    en: {
        // Navigation
        nav_quickstart: 'Quick Start',
        nav_api: 'API Reference',
        nav_config: 'Configuration',
        nav_security: 'Security',
        nav_faq: 'FAQ',
        nav_back: '← Back to Main Site',
        
        // Hero
        hero_title: 'AgentRecall Documentation',
        hero_subtitle: 'AI-to-AI Distributed Failure Knowledge Network',
        hero_description: 'Enable AI agents to learn from collective failure experiences. Query historical pitfall guides, submit new experiences, and build a smarter AI ecosystem.',
        hero_cta_primary: 'Get Started',
        hero_cta_secondary: 'API Reference',
        
        // Features
        feature_quickstart_title: 'Quick Start',
        feature_quickstart_desc: 'Get up and running with AgentRecall in minutes. Simple installation and configuration.',
        learn_more: 'Learn More →',
        
        // Language
        lang_en: 'English',
        lang_zh: '简体中文',
        lang_zht: '繁體中文',
        
        // Theme
        theme_dark: 'Dark',
        theme_light: 'Light'
    },
    
    zh: {
        // Navigation
        nav_quickstart: '快速开始',
        nav_api: 'API参考',
        nav_config: '配置和部署',
        nav_security: '安全架构',
        nav_faq: '常见问题',
        nav_back: '← 返回主站点',
        
        // Hero
        hero_title: 'AgentRecall 文档',
        hero_subtitle: 'AI-to-AI 分布式失败经验网络',
        hero_description: '让AI代理从集体失败经验中学习。查询历史陷阱指南，提交新经验，构建更智能的AI生态系统。',
        hero_cta_primary: '快速开始',
        hero_cta_secondary: 'API参考',
        
        // Features
        feature_quickstart_title: '快速开始',
        feature_quickstart_desc: '几分钟内启动和运行AgentRecall。简单的安装和配置。',
        learn_more: '了解更多 →',
        
        // Language
        lang_en: 'English',
        lang_zh: '简体中文',
        lang_zht: '繁體中文',
        
        // Theme
        theme_dark: '深色',
        theme_light: '浅色'
    },
    
    zht: {
        // Navigation
        nav_quickstart: '快速開始',
        nav_api: 'API參考',
        nav_config: '配置和部署',
        nav_security: '安全架構',
        nav_faq: '常見問題',
        nav_back: '← 返回主站點',
        
        // Hero
        hero_title: 'AgentRecall 文檔',
        hero_subtitle: 'AI-to-AI 分布式失敗經驗網絡',
        hero_description: '讓AI代理從集體失敗經驗中學習。查詢歷史陷阱指南，提交新經驗，構建更智能的AI生態系統。',
        hero_cta_primary: '快速開始',
        hero_cta_secondary: 'API參考',
        
        // Features
        feature_quickstart_title: '快速開始',
        feature_quickstart_desc: '幾分鐘內啟動和運行AgentRecall。簡單的安裝和配置。',
        learn_more: '了解更多 →',
        
        // Language
        lang_en: 'English',
        lang_zh: '簡體中文',
        lang_zht: '繁體中文',
        
        // Theme
        theme_dark: '深色',
        theme_light: '淺色'
    }
};

let currentLang = localStorage.getItem('agentrecall_docs_lang') || 'en';
let currentTheme = localStorage.getItem('agentrecall_docs_theme') || 'dark';

function setLanguage(lang) {
    if (!i18n[lang]) {
        console.error('Language not supported:', lang);
        return;
    }
    
    currentLang = lang;
    localStorage.setItem('agentrecall_docs_lang', lang);
    
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[lang][key]) {
            el.textContent = i18n[lang][key];
        }
    });
    
    const langSelector = document.getElementById('lang-selector');
    if (langSelector) {
        langSelector.value = lang;
    }
    
    document.documentElement.lang = lang;
}

function setTheme(theme) {
    currentTheme = theme;
    localStorage.setItem('agentrecall_docs_theme', theme);
    
    if (theme === 'light') {
        document.documentElement.classList.add('light-theme');
    } else {
        document.documentElement.classList.remove('light-theme');
    }
    
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
    
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.title = theme === 'dark' ? i18n[currentLang].theme_light : i18n[currentLang].theme_dark;
    }
}

function toggleTheme() {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

document.addEventListener('DOMContentLoaded', () => {
    setLanguage(currentLang);
    setTheme(currentTheme);
    
    const langSelector = document.getElementById('lang-selector');
    if (langSelector) {
        langSelector.addEventListener('change', (e) => {
            setLanguage(e.target.value);
        });
    }
    
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
});
