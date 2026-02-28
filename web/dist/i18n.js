/**
 * AgentRecall Admin - Internationalization
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
        
        // Common
        back_home: 'Back to Home',
        admin_title: 'Admin Panel',
        create_account: 'Create New Account',
        
        // Auth
        email: 'Email',
        password: 'Password',
        username: 'Username',
        login: 'Login',
        register: 'Register',
        logout: 'Logout',
        no_account: 'No account?',
        has_account: 'Already have an account?',
        register_now: 'Register now',
        login_now: 'Login now',
        fill_all_fields: 'Please fill in all fields',
        password_too_short: 'Password must be at least 8 characters',
        
        // Sidebar
        dashboard: 'Dashboard',
        api_keys: 'API Keys',
        history: 'History',
        usage_stats: 'Usage Stats',
        user_management: 'User Management',
        system_settings: 'System Settings',
        
        // Dashboard
        today_requests: "Today's Requests",
        today_tokens: "Today's Tokens",
        month_requests: "This Month's Requests",
        api_keys_count: 'API Keys',
        recent_activity: 'Recent Activity',
        
        // Table Headers
        type: 'Type',
        status: 'Status',
        time: 'Time',
        tokens: 'Tokens',
        duration: 'Duration',
        action: 'Action',
        endpoint: 'Endpoint',
        calls: 'Calls',
        role: 'Role',
        api_quota: 'API Quota',
        created_at: 'Created At',
        
        // Filters
        all_types: 'All Types',
        submit_pitfall: 'Submit Pitfall',
        query_pitfall: 'Query Pitfall',
        health_check: 'Health Check',
        last_7_days: 'Last 7 Days',
        last_30_days: 'Last 30 Days',
        last_90_days: 'Last 90 Days',
        all_roles: 'All Roles',
        admin: 'Admin',
        user: 'User',
        search_placeholder: 'Search email or username',
        
        // API Keys
        create_key: '+ Create New Key',
        create_api_key: 'Create API Key',
        name: 'Name',
        permissions: 'Permissions',
        read: 'Read',
        write: 'Write',
        rate_limit: 'Rate Limit (requests/min)',
        expires_in: 'Expires In (days, leave empty for never)',
        create: 'Create',
        api_key_created: 'API Key Created Successfully',
        important: 'Important:',
        copy_key_now: 'Please copy your API Key now. You will not be able to see it again after closing this window!',
        copy: 'Copy',
        delete: 'Delete',
        detail: 'Detail',
        
        // Usage Stats
        api_trend: 'API Call Trend',
        top_endpoints: 'Top Endpoints',
        system_stats: 'System Statistics',
        
        // History Detail
        interaction_detail: 'Interaction Detail',
        request_content: 'Request Content',
        response_content: 'Response Content',
        token_usage: 'Token Usage',
        processing_time: 'Processing Time',
        
        // Messages
        loading: 'Loading...',
        no_data: 'No data available',
        error_loading: 'Error loading data',
        login_failed: 'Login failed',
        register_failed: 'Registration failed',
        create_failed: 'Create failed',
        delete_failed: 'Delete failed',
        update_failed: 'Update failed',
        load_detail_failed: 'Failed to load detail',
        confirm_delete: 'Are you sure you want to delete this API Key? This action cannot be undone.',
        copied: 'Copied to clipboard',
        suspend: 'Suspend',
        activate: 'Activate',
        prev: 'Prev',
        next: 'Next',
        
        // Theme
        theme_light: 'Light',
        theme_dark: 'Dark',
        
        // Language
        lang_en: 'English',
        lang_zh: '简体中文',
        lang_zht: '繁體中文',
        
        // Footer
        footer_copyright: '2024 AgentRecall. MIT License.',
    },
    
    zh: {
        // Navigation
        nav_home: '首页',
        nav_github: 'GitHub',
        nav_getstarted: '开始使用',
        nav_admin: '管理后台',
        nav_stats: '统计',
        
        // Common
        back_home: '返回首页',
        admin_title: '后台管理',
        create_account: '创建新账号',
        
        // Auth
        email: '邮箱',
        password: '密码',
        username: '用户名',
        login: '登录',
        register: '注册',
        logout: '退出登录',
        no_account: '还没有账号？',
        has_account: '已有账号？',
        register_now: '立即注册',
        login_now: '立即登录',
        fill_all_fields: '请填写所有字段',
        password_too_short: '密码至少需要8个字符',
        
        // Sidebar
        dashboard: '仪表盘',
        api_keys: 'API Keys',
        history: '交互历史',
        usage_stats: '使用统计',
        user_management: '用户管理',
        system_settings: '系统设置',
        
        // Dashboard
        today_requests: '今日请求',
        today_tokens: '今日 Token',
        month_requests: '本月请求',
        api_keys_count: 'API Keys',
        recent_activity: '最近活动',
        
        // Table Headers
        type: '类型',
        status: '状态',
        time: '时间',
        tokens: 'Token',
        duration: '耗时',
        action: '操作',
        endpoint: '端点',
        calls: '调用次数',
        role: '角色',
        api_quota: 'API 配额',
        created_at: '创建时间',
        
        // Filters
        all_types: '全部类型',
        submit_pitfall: '提交避坑',
        query_pitfall: '查询避坑',
        health_check: '健康检查',
        last_7_days: '最近7天',
        last_30_days: '最近30天',
        last_90_days: '最近90天',
        all_roles: '全部角色',
        admin: '管理员',
        user: '普通用户',
        search_placeholder: '搜索邮箱或用户名',
        
        // API Keys
        create_key: '+ 创建新 Key',
        create_api_key: '创建 API Key',
        name: '名称',
        permissions: '权限',
        read: '读取',
        write: '写入',
        rate_limit: '速率限制（次/分钟）',
        expires_in: '过期时间（天，留空表示永不过期）',
        create: '创建',
        api_key_created: 'API Key 创建成功',
        important: '重要：',
        copy_key_now: '请立即复制您的 API Key，关闭此窗口后将无法再次查看！',
        copy: '复制',
        delete: '删除',
        detail: '详情',
        
        // Usage Stats
        api_trend: 'API 调用趋势',
        top_endpoints: '热门端点',
        system_stats: '系统统计',
        
        // History Detail
        interaction_detail: '交互详情',
        request_content: '请求内容',
        response_content: '响应内容',
        token_usage: 'Token 使用',
        processing_time: '处理时间',
        
        // Messages
        loading: '加载中...',
        no_data: '暂无数据',
        error_loading: '加载数据失败',
        login_failed: '登录失败',
        register_failed: '注册失败',
        create_failed: '创建失败',
        delete_failed: '删除失败',
        update_failed: '更新失败',
        load_detail_failed: '加载详情失败',
        confirm_delete: '确定要删除这个 API Key 吗？此操作不可恢复。',
        copied: '已复制到剪贴板',
        suspend: '禁用',
        activate: '启用',
        prev: '上一页',
        next: '下一页',
        
        // Theme
        theme_light: '浅色',
        theme_dark: '深色',
        
        // Language
        lang_en: 'English',
        lang_zh: '简体中文',
        lang_zht: '繁體中文',
        
        // Footer
        footer_copyright: '2024 AgentRecall. MIT License.',
    },
    
    zht: {
        // Navigation
        nav_home: '首頁',
        nav_github: 'GitHub',
        nav_getstarted: '開始使用',
        nav_admin: '管理後台',
        nav_stats: '統計',
        
        // Common
        back_home: '返回首頁',
        admin_title: '後台管理',
        create_account: '創建新賬號',
        
        // Auth
        email: '郵箱',
        password: '密碼',
        username: '用戶名',
        login: '登錄',
        register: '註冊',
        logout: '退出登錄',
        no_account: '還沒有賬號？',
        has_account: '已有賬號？',
        register_now: '立即註冊',
        login_now: '立即登錄',
        fill_all_fields: '請填寫所有字段',
        password_too_short: '密碼至少需要8個字符',
        
        // Sidebar
        dashboard: '儀表盤',
        api_keys: 'API Keys',
        history: '交互歷史',
        usage_stats: '使用統計',
        user_management: '用戶管理',
        system_settings: '系統設置',
        
        // Dashboard
        today_requests: '今日請求',
        today_tokens: '今日 Token',
        month_requests: '本月請求',
        api_keys_count: 'API Keys',
        recent_activity: '最近活動',
        
        // Table Headers
        type: '類型',
        status: '狀態',
        time: '時間',
        tokens: 'Token',
        duration: '耗時',
        action: '操作',
        endpoint: '端點',
        calls: '調用次數',
        role: '角色',
        api_quota: 'API 配額',
        created_at: '創建時間',
        
        // Filters
        all_types: '全部類型',
        submit_pitfall: '提交避坑',
        query_pitfall: '查詢避坑',
        health_check: '健康檢查',
        last_7_days: '最近7天',
        last_30_days: '最近30天',
        last_90_days: '最近90天',
        all_roles: '全部角色',
        admin: '管理員',
        user: '普通用戶',
        search_placeholder: '搜索郵箱或用戶名',
        
        // API Keys
        create_key: '+ 創建新 Key',
        create_api_key: '創建 API Key',
        name: '名稱',
        permissions: '權限',
        read: '讀取',
        write: '寫入',
        rate_limit: '速率限制（次/分鐘）',
        expires_in: '過期時間（天，留空表示永不過期）',
        create: '創建',
        api_key_created: 'API Key 創建成功',
        important: '重要：',
        copy_key_now: '請立即複製您的 API Key，關閉此窗口後將無法再次查看！',
        copy: '複製',
        delete: '刪除',
        detail: '詳情',
        
        // Usage Stats
        api_trend: 'API 調用趨勢',
        top_endpoints: '熱門端點',
        system_stats: '系統統計',
        
        // History Detail
        interaction_detail: '交互詳情',
        request_content: '請求內容',
        response_content: '響應內容',
        token_usage: 'Token 使用',
        processing_time: '處理時間',
        
        // Messages
        loading: '加載中...',
        no_data: '暫無數據',
        error_loading: '加載數據失敗',
        login_failed: '登錄失敗',
        register_failed: '註冊失敗',
        create_failed: '創建失敗',
        delete_failed: '刪除失敗',
        update_failed: '更新失敗',
        load_detail_failed: '加載詳情失敗',
        confirm_delete: '確定要刪除這個 API Key 嗎？此操作不可恢復。',
        copied: '已複製到剪貼板',
        suspend: '禁用',
        activate: '啟用',
        prev: '上一頁',
        next: '下一頁',
        
        // Theme
        theme_light: '淺色',
        theme_dark: '深色',
        
        // Language
        lang_en: 'English',
        lang_zh: '简体中文',
        lang_zht: '繁體中文',
        
        // Footer
        footer_copyright: '2024 AgentRecall. MIT License.',
    }
};

// Current language
let currentLang = localStorage.getItem('lang') || 'en';

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
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
        const key = el.getAttribute('data-i18n');
        if (key) {
            el.textContent = t(key);
        }
    });
    
    // Handle placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
        const key = el.getAttribute('data-i18n-placeholder');
        if (key) {
            el.placeholder = t(key);
        }
    });
}

/**
 * Set the current language and apply translations
 * @param {string} lang - Language code ('en', 'zh', 'zht')
 */
function setLanguage(lang) {
    if (!i18n[lang]) {
        console.warn('Language "' + lang + '" not found, falling back to English');
        lang = 'en';
    }
    currentLang = lang;
    localStorage.setItem('lang', lang);
    applyTranslations();
    
    // Update html lang attribute
    const htmlLang = lang === 'zht' ? 'zh-TW' : (lang === 'zh' ? 'zh-CN' : 'en');
    document.documentElement.lang = htmlLang;
    
    // Update all language selectors
    document.querySelectorAll('.lang-selector').forEach(function(selector) {
        selector.value = lang;
    });
}

/**
 * Initialize i18n on page load
 */
function initI18n() {
    // Set initial language
    const storedLang = localStorage.getItem('lang') || 'en';
    setLanguage(storedLang);
}

// Expose to global scope
window.i18nSetLanguage = setLanguage;
window.i18nT = t;
window.initI18n = initI18n;
