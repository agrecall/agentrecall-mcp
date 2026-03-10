/**
 * AgentRecall Admin Panel - Common Functions
 * Shared utilities across all admin pages
 */

// API Base URL
const API_BASE_URL = window.location.origin;

// State
let currentUser = null;
let authToken = localStorage.getItem('authToken');
let currentTheme = localStorage.getItem('theme') || 'dark';

// ============================================
// Utility Functions
// ============================================

function formatDate(dateString) {
    if (!dateString) return '-';
    var date = new Date(dateString);
    var lang = currentLang === 'en' ? 'en-US' : (currentLang === 'zht' ? 'zh-TW' : 'zh-CN');
    return date.toLocaleString(lang);
}

function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString();
}

function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// Theme Functions
// ============================================

function initTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcons();
}

function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    updateThemeIcons();
}

function updateThemeIcons() {
    var icon = currentTheme === 'dark' ? '&#9728;' : '&#9790;';
    var icons = document.querySelectorAll('#theme-icon, #theme-icon-main, #theme-icon-pc');
    icons.forEach(function(el) {
        if (el) el.innerHTML = icon;
    });
}

// ============================================
// Language Functions
// ============================================

function initLanguage() {
    if (typeof window.initI18n === 'function') {
        window.initI18n();
    }
}

function changeLanguage(lang) {
    if (typeof window.i18nSetLanguage === 'function') {
        window.i18nSetLanguage(lang);
    }
    // Reload page data to update dynamic content
    if (typeof window.loadPageData === 'function') {
        window.loadPageData();
    }
}

// ============================================
// Mobile Sidebar Functions
// ============================================

function initMobileSidebar() {
    var sidebar = document.getElementById('sidebar');
    var sidebarToggle = document.getElementById('sidebar-toggle');
    var sidebarClose = document.getElementById('sidebar-close');
    
    // Create overlay if not exists
    var overlay = document.getElementById('sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sidebar-overlay';
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }
    
    function openSidebar() {
        if (sidebar) sidebar.classList.add('active');
        if (overlay) overlay.classList.add('active');
    }
    
    function closeSidebar() {
        if (sidebar) sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
    }
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', openSidebar);
    }
    
    if (sidebarClose) {
        sidebarClose.addEventListener('click', closeSidebar);
    }
    
    if (overlay) {
        overlay.addEventListener('click', closeSidebar);
    }
}

// ============================================
// API Functions
// ============================================

async function apiRequest(endpoint, options) {
    options = options || {};
    var url = API_BASE_URL + endpoint;
    var headers = {
        'Content-Type': 'application/json'
    };
    
    if (options.headers) {
        Object.keys(options.headers).forEach(function(key) {
            headers[key] = options.headers[key];
        });
    }
    
    if (authToken) {
        headers['Authorization'] = 'Bearer ' + authToken;
    }
    
    try {
        var response = await fetch(url, {
            method: options.method || 'GET',
            headers: headers,
            body: options.body
        });
        
        var data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// ============================================
// Auth Functions
// ============================================

async function login(email, password) {
    var data = await apiRequest('/api/v1/users/login', {
        method: 'POST',
        body: JSON.stringify({ email: email, password: password })
    });
    
    if (data.success) {
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('authToken', authToken);
        return true;
    }
    return false;
}

async function register(username, email, password) {
    var data = await apiRequest('/api/v1/users/register', {
        method: 'POST',
        body: JSON.stringify({ username: username, email: email, password: password })
    });
    
    if (data.success) {
        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('authToken', authToken);
        return true;
    }
    return false;
}

async function getCurrentUser() {
    var data = await apiRequest('/api/v1/users/me');
    if (data.success) {
        currentUser = data.user;
        return data.user;
    }
    return null;
}

function logout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    window.location.href = 'index.html';
}

// ============================================
// Auth Check
// ============================================

async function checkAuth() {
    if (!authToken) {
        window.location.href = 'index.html';
        return false;
    }
    
    try {
        var user = await getCurrentUser();
        if (user) {
            currentUser = user;
            // Update user info in sidebar
            var userEmail = document.getElementById('user-email');
            var userRole = document.getElementById('user-role');
            if (userEmail) userEmail.textContent = user.email;
            if (userRole) userRole.textContent = user.role.toUpperCase();
            
            // Show admin-only items
            if (user.role === 'admin') {
                document.querySelectorAll('.admin-only').forEach(function(el) {
                    el.classList.remove('hidden');
                });
            }
            return true;
        } else {
            logout();
            return false;
        }
    } catch (error) {
        logout();
        return false;
    }
}

// ============================================
// Pagination Helper
// ============================================

function renderPagination(containerId, currentPage, totalPages, callback) {
    var container = document.getElementById(containerId);
    if (!container) return;
    
    var html = '';
    
    // Previous
    html += '<button ' + (currentPage === 1 ? 'disabled' : '') + ' onclick="' + callback.name + '(' + (currentPage - 1) + ')">' + t('prev') + '</button>';
    
    // Page numbers
    for (var i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += '<button class="' + (i === currentPage ? 'active' : '') + '" onclick="' + callback.name + '(' + i + ')">' + i + '</button>';
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += '<span>...</span>';
        }
    }
    
    // Next
    html += '<button ' + (currentPage === totalPages ? 'disabled' : '') + ' onclick="' + callback.name + '(' + (currentPage + 1) + ')">' + t('next') + '</button>';
    
    container.innerHTML = html;
}

// ============================================
// Debounce Helper
// ============================================

function debounce(func, wait) {
    var timeout;
    return function() {
        var context = this;
        var args = arguments;
        var later = function() {
            timeout = null;
            func.apply(context, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// Modal Functions
// ============================================

function showModal(modalId) {
    var modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function hideModal(modalId) {
    var modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}

// ============================================
// Initialize Common Features
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Initialize theme
    initTheme();
    
    // Initialize language
    initLanguage();
    
    // Initialize mobile sidebar
    initMobileSidebar();
    
    // Theme toggle buttons
    document.querySelectorAll('#theme-toggle, #theme-toggle-main, #theme-toggle-pc').forEach(function(btn) {
        if (btn) btn.addEventListener('click', toggleTheme);
    });
    
    // Language selectors
    document.querySelectorAll('.lang-selector').forEach(function(selector) {
        selector.addEventListener('change', function(e) {
            changeLanguage(e.target.value);
        });
    });
    
    // Logout button
    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Close modals
    document.querySelectorAll('.modal-close').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var modal = btn.closest('.modal');
            if (modal) modal.classList.add('hidden');
        });
    });
});

// Expose to global scope
window.apiRequest = apiRequest;
window.login = login;
window.register = register;
window.getCurrentUser = getCurrentUser;
window.logout = logout;
window.checkAuth = checkAuth;
window.formatDate = formatDate;
window.formatNumber = formatNumber;
window.escapeHtml = escapeHtml;
window.renderPagination = renderPagination;
window.debounce = debounce;
window.showModal = showModal;
window.hideModal = hideModal;
window.toggleTheme = toggleTheme;
window.changeLanguage = changeLanguage;

// 错误信息映射
const errorMessages = {
    "Invalid email or password": "login_failed",
    "Email already registered": "email_registered",
    "Registration is currently disabled": "registration_disabled",
    "Rate limit exceeded": "rate_limit",
    "Verification code must be 6 digits": "code_length",
    "Account is suspended or deleted": "account_suspended",
    "该邮箱已被注册": "email_registered",
    "验证码错误": "code_invalid",
    "验证码已过期": "code_expired",
    "该邮箱未注册": "email_not_registered"
};

function translateError(error) {
    if (errorMessages[error]) {
        return t(errorMessages[error]);
    }
    return error;
}

