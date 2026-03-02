/**
 * AgentRecall Admin Panel - Frontend Application
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

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(function(p) {
        p.classList.add('hidden');
    });
    var page = document.getElementById(pageId);
    if (page) {
        page.classList.remove('hidden');
    }
}

function showContentPage(pageName) {
    document.querySelectorAll('.content-page').forEach(function(p) {
        p.classList.add('hidden');
    });
    var contentPage = document.getElementById(pageName + '-page');
    if (contentPage) {
        contentPage.classList.remove('hidden');
    }
    
    document.querySelectorAll('.nav-item').forEach(function(n) {
        n.classList.remove('active');
    });
    var navItem = document.querySelector('[data-page="' + pageName + '"]');
    if (navItem) {
        navItem.classList.add('active');
    }
    
    // Close sidebar on mobile after navigation
    if (window.innerWidth <= 768) {
        var sidebar = document.getElementById('sidebar');
        var overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
    }
}

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
    var icons = document.querySelectorAll('#theme-icon, #theme-icon-register, #theme-icon-main');
    icons.forEach(function(el) {
        if (el) el.innerHTML = icon;
    });
}

// ============================================
// Language Functions
// ============================================

function initLanguage() {
    // Use initI18n from i18n.js if available
    if (typeof window.initI18n === 'function') {
        window.initI18n();
    }
}

function changeLanguage(lang) {
    // Use the setLanguage function from i18n.js if available
    if (typeof window.i18nSetLanguage === 'function') {
        window.i18nSetLanguage(lang);
    }
    
    // Reload current page data to update dynamic content
    var currentPage = document.querySelector('.content-page:not(.hidden)');
    if (currentPage) {
        var pageId = currentPage.id;
        switch(pageId) {
            case 'dashboard-page':
                loadDashboard();
                break;
            case 'apikeys-page':
                loadApiKeys();
                break;
            case 'history-page':
                loadHistory();
                break;
            case 'usage-page':
                loadUsageStats();
                break;
            case 'users-page':
                loadUsers();
                break;
        }
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
    showPage('login-page');
}

// ============================================
// Dashboard Functions
// ============================================

async function loadDashboard() {
    try {
        var data = await apiRequest('/api/v1/stats/dashboard');
        
        if (data.success) {
            var todayRequests = document.getElementById('today-requests');
            var todayTokens = document.getElementById('today-tokens');
            var monthRequests = document.getElementById('month-requests');
            var apiKeyCount = document.getElementById('api-key-count');
            
            if (todayRequests) todayRequests.textContent = formatNumber(data.dashboard.today && data.dashboard.today.request_count);
            if (todayTokens) todayTokens.textContent = formatNumber(data.dashboard.today && data.dashboard.today.token_count);
            if (monthRequests) monthRequests.textContent = formatNumber(data.dashboard.thisMonth && data.dashboard.thisMonth.request_count);
            if (apiKeyCount) apiKeyCount.textContent = formatNumber(data.dashboard.apiKeyCount);
            
            // Recent activity
            var activityList = document.getElementById('recent-activity-list');
            if (activityList) {
                if (data.dashboard.recentActivity && data.dashboard.recentActivity.length > 0) {
                    activityList.innerHTML = data.dashboard.recentActivity.map(function(activity) {
                        return '<tr>' +
                            '<td>' + escapeHtml(activity.request_type) + '</td>' +
                            '<td><span class="status-badge status-' + activity.status + '">' + activity.status + '</span></td>' +
                            '<td>' + formatDate(activity.created_at) + '</td>' +
                        '</tr>';
                    }).join('');
                } else {
                    activityList.innerHTML = '<tr><td colspan="3" class="text-center">' + t('no_data') + '</td></tr>';
                }
            }
        }
    } catch (error) {
        console.error('Load dashboard error:', error);
    }
}

// ============================================
// API Keys Functions
// ============================================

async function loadApiKeys() {
    var list = document.getElementById('apikey-list');
    if (!list) return;
    
    // Show loading state
    list.innerHTML = '<div class="empty-state"><p>' + t('loading') + '</p></div>';
    
    try {
        var data = await apiRequest('/api/v1/apikeys');
        
        if (data.success && data.apiKeys && data.apiKeys.length > 0) {
            list.innerHTML = data.apiKeys.map(function(key) {
                // Safely parse permissions - handle multiple formats
                var permissions = ['read'];
                try {
                    if (key.permissions) {
                        if (typeof key.permissions === 'string') {
                            var permStr = key.permissions.trim();
                            // Try JSON parse first
                            if (permStr.startsWith('[') || permStr.startsWith('{')) {
                                var parsed = JSON.parse(permStr);
                                permissions = Array.isArray(parsed) ? parsed : [parsed];
                            }
                            // Handle PostgreSQL array format: {read,write}
                            else if (permStr.startsWith('{') && permStr.endsWith('}')) {
                                permissions = permStr.slice(1, -1).split(',').map(function(p) { return p.trim(); });
                            }
                            // Handle comma-separated format: read,write
                            else if (permStr.indexOf(',') !== -1) {
                                permissions = permStr.split(',').map(function(p) { return p.trim(); });
                            }
                            // Single permission
                            else {
                                permissions = [permStr];
                            }
                        } else if (Array.isArray(key.permissions)) {
                            permissions = key.permissions;
                        }
                    }
                } catch (e) {
                    console.warn('Failed to parse permissions:', key.permissions, e);
                    permissions = ['read'];
                }
                
                var expiresText = key.expires_at 
                    ? '<span class="expires">' + t('expires_in') + ': ' + formatDate(key.expires_at) + '</span>' 
                    : '';
                
                return '<div class="apikey-card">' +
                    '<div class="apikey-info">' +
                        '<h4>' + escapeHtml(key.key_name || 'Unnamed Key') + '</h4>' +
                        '<div class="apikey-meta">' +
                            '<span class="apikey-prefix">' + escapeHtml(key.key_prefix || 'ak_...') + '</span>' +
                            '<span class="badge">' + permissions.join(', ').toUpperCase() + '</span>' +
                            '<span>' + t('usage_stats') + ': ' + formatNumber(key.usage_count || 0) + '</span>' +
                            expiresText +
                        '</div>' +
                    '</div>' +
                    '<div class="apikey-actions">' +
                        '<button class="btn btn-danger btn-sm" onclick="deleteApiKey(\'' + key.id + '\')">' + t('delete') + '</button>' +
                    '</div>' +
                '</div>';
            }).join('');
        } else {
            list.innerHTML = '<div class="empty-state"><p>' + t('no_data') + '</p></div>';
        }
    } catch (error) {
        console.error('Load API keys error:', error);
        list.innerHTML = '<div class="empty-state"><p class="error">' + t('error_loading') + '</p></div>';
    }
}

async function createApiKey(name, permissions, rateLimit, expiresInDays) {
    var data = await apiRequest('/api/v1/apikeys', {
        method: 'POST',
        body: JSON.stringify({
            name: name,
            permissions: permissions,
            rateLimit: rateLimit,
            expiresInDays: expiresInDays ? parseInt(expiresInDays) : undefined
        })
    });
    
    if (data.success) {
        // Show newly created API Key
        var newApiKeyValue = document.getElementById('new-apikey-value');
        if (newApiKeyValue) {
            newApiKeyValue.value = data.apiKey.key;
        }
        showModal('show-apikey-modal');
        loadApiKeys();
    }
}

async function deleteApiKey(id) {
    if (!confirm(t('confirm_delete'))) {
        return;
    }
    
    try {
        await apiRequest('/api/v1/apikeys/' + id, {
            method: 'DELETE'
        });
        loadApiKeys();
    } catch (error) {
        alert(t('delete_failed') + ': ' + error.message);
    }
}

// ============================================
// History Functions
// ============================================

var historyPage = 1;
var historyTotalPages = 1;

async function loadHistory(page) {
    page = page || 1;
    try {
        var typeFilter = document.getElementById('history-type-filter');
        var daysFilter = document.getElementById('history-days-filter');
        var type = typeFilter ? typeFilter.value : '';
        var days = daysFilter ? daysFilter.value : '7';
        
        var url = '/api/v1/stats/history?page=' + page + '&limit=20&days=' + days;
        if (type) url += '&type=' + type;
        
        var data = await apiRequest(url);
        
        if (data.success) {
            var list = document.getElementById('history-list');
            if (list) {
                if (data.history && data.history.length > 0) {
                    list.innerHTML = data.history.map(function(item) {
                        return '<tr>' +
                            '<td>' + item.request_type + '</td>' +
                            '<td><span class="status-badge status-' + item.status + '">' + item.status + '</span></td>' +
                            '<td>' + formatNumber(item.tokens_input + item.tokens_output) + '</td>' +
                            '<td>' + item.processing_time_ms + 'ms</td>' +
                            '<td>' + formatDate(item.created_at) + '</td>' +
                            '<td><button class="btn btn-secondary btn-sm" onclick="showHistoryDetail(\'' + item.id + '\')">' + t('detail') + '</button></td>' +
                        '</tr>';
                    }).join('');
                } else {
                    list.innerHTML = '<tr><td colspan="6" class="text-center">' + t('no_data') + '</td></tr>';
                }
            }
            
            // Pagination
            historyPage = page;
            historyTotalPages = data.pagination && data.pagination.totalPages ? data.pagination.totalPages : 1;
            renderPagination('history-pagination', historyPage, historyTotalPages, loadHistory);
        }
    } catch (error) {
        console.error('Load history error:', error);
    }
}

async function showHistoryDetail(id) {
    try {
        var data = await apiRequest('/api/v1/stats/history/' + id);
        
        if (data.success) {
            var content = document.getElementById('history-detail-content');
            if (content) {
                content.innerHTML = 
                    '<div class="form-group"><label>' + t('type') + '</label><input type="text" value="' + data.history.request_type + '" readonly></div>' +
                    '<div class="form-group"><label>' + t('status') + '</label><input type="text" value="' + data.history.status + '" readonly></div>' +
                    '<div class="form-group"><label>' + t('request_content') + '</label><pre style="background: var(--bg-primary); padding: 16px; border-radius: 8px; overflow: auto;">' + JSON.stringify(data.history.request_payload, null, 2) + '</pre></div>' +
                    '<div class="form-group"><label>' + t('response_content') + '</label><pre style="background: var(--bg-primary); padding: 16px; border-radius: 8px; overflow: auto;">' + JSON.stringify(data.history.response_payload, null, 2) + '</pre></div>' +
                    '<div class="form-group"><label>' + t('token_usage') + '</label><input type="text" value="Input: ' + data.history.tokens_input + ', Output: ' + data.history.tokens_output + '" readonly></div>' +
                    '<div class="form-group"><label>' + t('processing_time') + '</label><input type="text" value="' + data.history.processing_time_ms + 'ms" readonly></div>' +
                    '<div class="form-group"><label>' + t('created_at') + '</label><input type="text" value="' + formatDate(data.history.created_at) + '" readonly></div>';
            }
            showModal('history-detail-modal');
        }
    } catch (error) {
        alert(t('load_detail_failed') + ': ' + error.message);
    }
}

// ============================================
// Usage Stats Functions
// ============================================

async function loadUsageStats() {
    try {
        var data = await apiRequest('/api/v1/stats/user');
        
        if (data.success) {
            // Render trend chart
            var trendChart = document.getElementById('usage-trend-chart');
            if (trendChart) {
                if (data.trends && data.trends.length > 0) {
                    var maxValue = Math.max.apply(null, data.trends.map(function(t) { return parseInt(t.request_count); }));
                    trendChart.innerHTML = data.trends.map(function(t) {
                        var height = maxValue > 0 ? (parseInt(t.request_count) / maxValue * 100) : 0;
                        return '<div class="chart-bar" style="height: ' + height + '%" data-value="' + t.request_count + '" title="' + t.date + ': ' + t.request_count + '"></div>';
                    }).join('');
                } else {
                    trendChart.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">' + t('no_data') + '</p>';
                }
            }
            
            // Top endpoints
            var endpointsList = document.getElementById('top-endpoints-list');
            if (endpointsList) {
                if (data.stats && data.stats.topEndpoints && data.stats.topEndpoints.length > 0) {
                    endpointsList.innerHTML = data.stats.topEndpoints.map(function(ep) {
                        return '<tr>' +
                            '<td>' + (ep.endpoint || ep.category || 'Unknown') + '</td>' +
                            '<td>' + formatNumber(ep.request_count || ep.count) + '</td>' +
                        '</tr>';
                    }).join('');
                } else {
                    endpointsList.innerHTML = '<tr><td colspan="2" class="text-center">' + t('no_data') + '</td></tr>';
                }
            }
        }
    } catch (error) {
        console.error('Load usage stats error:', error);
    }
}

// ============================================
// User Management Functions (Admin)
// ============================================

async function loadUsers(page) {
    page = page || 1;
    try {
        var searchInput = document.getElementById('user-search');
        var roleFilter = document.getElementById('user-role-filter');
        var search = searchInput ? searchInput.value : '';
        var role = roleFilter ? roleFilter.value : '';
        
        var url = '/api/v1/users?page=' + page + '&limit=20';
        if (search) url += '&search=' + encodeURIComponent(search);
        if (role) url += '&role=' + role;
        
        var data = await apiRequest(url);
        
        if (data.success) {
            var list = document.getElementById('users-list');
            if (list) {
                if (data.users && data.users.length > 0) {
                    list.innerHTML = data.users.map(function(user) {
                        return '<tr>' +
                            '<td>' + escapeHtml(user.email) + '</td>' +
                            '<td>' + escapeHtml(user.username) + '</td>' +
                            '<td><span class="badge">' + user.role.toUpperCase() + '</span></td>' +
                            '<td><span class="status-badge status-' + user.status + '">' + user.status + '</span></td>' +
                            '<td>' + formatNumber(user.api_used) + ' / ' + formatNumber(user.api_quota) + '</td>' +
                            '<td>' + formatDate(user.created_at) + '</td>' +
                            '<td>' +
                                '<button class="btn btn-secondary btn-sm" onclick="updateUserStatus(\'' + user.id + '\', \'' + (user.status === 'active' ? 'suspended' : 'active') + '\')">' +
                                    (user.status === 'active' ? t('suspend') : t('activate')) +
                                '</button>' +
                            '</td>' +
                        '</tr>';
                    }).join('');
                } else {
                    list.innerHTML = '<tr><td colspan="7" class="text-center">' + t('no_data') + '</td></tr>';
                }
            }
        }
    } catch (error) {
        console.error('Load users error:', error);
    }
}

async function updateUserStatus(id, status) {
    try {
        await apiRequest('/api/v1/users/' + id + '/status', {
            method: 'PUT',
            body: JSON.stringify({ status: status })
        });
        loadUsers();
    } catch (error) {
        alert(t('update_failed') + ': ' + error.message);
    }
}

// ============================================
// System Stats Functions (Admin)
// ============================================

async function loadSystemStats() {
    try {
        var data = await apiRequest('/api/v1/stats/system');
        
        if (data.success) {
            var grid = document.getElementById('system-stats-grid');
            if (grid) {
                grid.innerHTML = 
                    '<div class="stat-card"><div class="stat-icon">&#128101;</div><div class="stat-info"><h3>' + t('total_users') + '</h3><p class="stat-value">' + formatNumber(data.stats && data.stats.total_users) + '</p></div></div>' +
                    '<div class="stat-card"><div class="stat-icon">&#128273;</div><div class="stat-info"><h3>' + t('total_api_keys') + '</h3><p class="stat-value">' + formatNumber(data.stats && data.stats.total_api_keys) + '</p></div></div>' +
                    '<div class="stat-card"><div class="stat-icon">&#128202;</div><div class="stat-info"><h3>' + t('total_api_calls') + '</h3><p class="stat-value">' + formatNumber(data.stats && data.stats.total_api_calls) + '</p></div></div>' +
                    '<div class="stat-card"><div class="stat-icon">&#128197;</div><div class="stat-info"><h3>' + t('today_api_calls') + '</h3><p class="stat-value">' + formatNumber(data.stats && data.stats.today_api_calls) + '</p></div></div>';
            }
        }
    } catch (error) {
        console.error('Load system stats error:', error);
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
// Event Listeners
// ============================================

document.addEventListener('DOMContentLoaded', async function() {
    // Initialize theme
    initTheme();
    
    // Initialize language
    initLanguage();
    
    // Initialize mobile sidebar
    initMobileSidebar();
    
    // Theme toggle buttons (login, register, mobile main, pc main)
    document.querySelectorAll('#theme-toggle, #theme-toggle-register, #theme-toggle-main, #theme-toggle-pc').forEach(function(btn) {
        if (btn) btn.addEventListener('click', toggleTheme);
    });
    
    // Language selectors
    document.querySelectorAll('.lang-selector').forEach(function(selector) {
        selector.addEventListener('change', function(e) {
            changeLanguage(e.target.value);
        });
    });
    
    // Check if already logged in
    if (authToken) {
        try {
            var user = await getCurrentUser();
            if (user) {
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
                
                showPage('main-page');
                loadDashboard();
            } else {
                logout();
            }
        } catch (error) {
            logout();
        }
    }
    
    // Login form
    var loginForm = document.getElementById('login-form');
    if (loginForm) {
        // Load saved credentials if they exist
        var savedEmail = localStorage.getItem('rememberedEmail');
        var savedPassword = localStorage.getItem('rememberedPassword');
        var rememberCheckbox = document.getElementById('remember-password');
        
        if (savedEmail && savedPassword) {
            var emailInput = document.getElementById('login-email');
            var passwordInput = document.getElementById('login-password');
            if (emailInput) emailInput.value = savedEmail;
            if (passwordInput) passwordInput.value = savedPassword;
            if (rememberCheckbox) rememberCheckbox.checked = true;
        }
        
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var emailInput = document.getElementById('login-email');
            var passwordInput = document.getElementById('login-password');
            var rememberCheckbox = document.getElementById('remember-password');
            var email = emailInput ? emailInput.value : '';
            var password = passwordInput ? passwordInput.value : '';
            var remember = rememberCheckbox ? rememberCheckbox.checked : false;
            
            if (!email || !password) {
                alert(t('fill_all_fields'));
                return;
            }
            
            // Save or clear credentials based on checkbox
            if (remember) {
                localStorage.setItem('rememberedEmail', email);
                localStorage.setItem('rememberedPassword', password);
            } else {
                localStorage.removeItem('rememberedEmail');
                localStorage.removeItem('rememberedPassword');
            }
            
            try {
                await login(email, password);
                var user = await getCurrentUser();
                var userEmail = document.getElementById('user-email');
                var userRole = document.getElementById('user-role');
                if (userEmail) userEmail.textContent = user.email;
                if (userRole) userRole.textContent = user.role.toUpperCase();
                
                if (user.role === 'admin') {
                    document.querySelectorAll('.admin-only').forEach(function(el) {
                        el.classList.remove('hidden');
                    });
                }
                
                showPage('main-page');
                loadDashboard();
            } catch (error) {
                alert(t('login_failed') + ': ' + error.message);
            }
        });
    }
    
    // Register form
    var registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var usernameInput = document.getElementById('register-username');
            var emailInput = document.getElementById('register-email');
            var passwordInput = document.getElementById('register-password');
            var username = usernameInput ? usernameInput.value : '';
            var email = emailInput ? emailInput.value : '';
            var password = passwordInput ? passwordInput.value : '';
            
            if (!username || !email || !password) {
                alert(t('fill_all_fields'));
                return;
            }
            
            if (password.length < 8) {
                alert(t('password_too_short'));
                return;
            }
            
            try {
                await register(username, email, password);
                var user = await getCurrentUser();
                var userEmail = document.getElementById('user-email');
                var userRole = document.getElementById('user-role');
                if (userEmail) userEmail.textContent = user.email;
                if (userRole) userRole.textContent = user.role.toUpperCase();
                showPage('main-page');
                loadDashboard();
            } catch (error) {
                alert(t('register_failed') + ': ' + error.message);
            }
        });
    }
    
    // Show register/login links
    var showRegister = document.getElementById('show-register');
    if (showRegister) {
        showRegister.addEventListener('click', function(e) {
            e.preventDefault();
            showPage('register-page');
        });
    }
    
    var showLogin = document.getElementById('show-login');
    if (showLogin) {
        showLogin.addEventListener('click', function(e) {
            e.preventDefault();
            showPage('login-page');
        });
    }
    
    // Logout
    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(function(item) {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            var page = item.getAttribute('data-page');
            showContentPage(page);
            
            // Load page data
            switch (page) {
                case 'dashboard':
                    loadDashboard();
                    break;
                case 'apikeys':
                    loadApiKeys();
                    break;
                case 'history':
                    loadHistory();
                    break;
                case 'usage':
                    loadUsageStats();
                    break;
                case 'users':
                    loadUsers();
                    break;
                case 'system':
                    loadSystemStats();
                    break;
            }
        });
    });
    
    // Stat card click handlers (dashboard cards)
    document.querySelectorAll('.stat-card.clickable').forEach(function(card) {
        card.addEventListener('click', function() {
            var navPage = card.getAttribute('data-nav');
            if (navPage) {
                showContentPage(navPage);
                // Load page data
                switch (navPage) {
                    case 'apikeys':
                        loadApiKeys();
                        break;
                    case 'usage':
                        loadUsageStats();
                        break;
                }
            }
        });
    });
    
    // Create API Key button
    var createApiKeyBtn = document.getElementById('create-apikey-btn');
    if (createApiKeyBtn) {
        createApiKeyBtn.addEventListener('click', function() {
            showModal('create-apikey-modal');
        });
    }
    
    // Create API Key form
    var createApiKeyForm = document.getElementById('create-apikey-form');
    if (createApiKeyForm) {
        createApiKeyForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var nameInput = document.getElementById('apikey-name');
            var rateLimitInput = document.getElementById('apikey-rate-limit');
            var expiresInput = document.getElementById('apikey-expires');
            var name = nameInput ? nameInput.value : '';
            var permissions = Array.from(document.querySelectorAll('input[name="permissions"]:checked')).map(function(cb) {
                return cb.value;
            });
            var rateLimit = rateLimitInput ? parseInt(rateLimitInput.value) : 100;
            var expiresInDays = expiresInput ? expiresInput.value : '';
            
            try {
                await createApiKey(name, permissions, rateLimit, expiresInDays);
                hideModal('create-apikey-modal');
                createApiKeyForm.reset();
            } catch (error) {
                alert(t('create_failed') + ': ' + error.message);
            }
        });
    }
    
    // Copy API Key
    var copyApiKeyBtn = document.getElementById('copy-apikey-btn');
    if (copyApiKeyBtn) {
        copyApiKeyBtn.addEventListener('click', function() {
            var input = document.getElementById('new-apikey-value');
            if (input) {
                input.select();
                document.execCommand('copy');
                alert(t('copied'));
            }
        });
    }
    
    // Close modals
    document.querySelectorAll('.modal-close').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var modal = btn.closest('.modal');
            if (modal) modal.classList.add('hidden');
        });
    });
    
    // History filters
    var historyTypeFilter = document.getElementById('history-type-filter');
    var historyDaysFilter = document.getElementById('history-days-filter');
    if (historyTypeFilter) {
        historyTypeFilter.addEventListener('change', function() {
            loadHistory(1);
        });
    }
    if (historyDaysFilter) {
        historyDaysFilter.addEventListener('change', function() {
            loadHistory(1);
        });
    }
    
    // User filters
    var userSearch = document.getElementById('user-search');
    var userRoleFilter = document.getElementById('user-role-filter');
    if (userSearch) {
        userSearch.addEventListener('input', debounce(function() {
            loadUsers(1);
        }, 500));
    }
    if (userRoleFilter) {
        userRoleFilter.addEventListener('change', function() {
            loadUsers(1);
        });
    }
});

// Expose functions to global scope for onclick handlers
window.deleteApiKey = deleteApiKey;
window.showHistoryDetail = showHistoryDetail;
window.updateUserStatus = updateUserStatus;
window.loadHistory = loadHistory;
window.loadUsers = loadUsers;
