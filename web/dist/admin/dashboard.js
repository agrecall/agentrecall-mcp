/**
 * AgentRecall Admin - Dashboard Page
 */

// Load page data function (called by changeLanguage)
window.loadPageData = loadDashboard;

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    await checkAuth();
    
    // Load dashboard data
    loadDashboard();
});

/**
 * 获取用户当前时区
 */
function getUserTimezone() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch (e) {
        return 'UTC';
    }
}

async function loadDashboard() {
    try {
        // 获取用户时区
        const userTimezone = getUserTimezone();
        
        // 构建带时区参数的 URL
        var endpoint = '/api/v1/stats/dashboard?timezone=' + encodeURIComponent(userTimezone);
        var data = await apiRequest(endpoint);
        
        if (data.success) {
            var todayRequests = document.getElementById('today-requests');
            var monthRequests = document.getElementById('month-requests');
            var apiKeyCount = document.getElementById('api-key-count');
            
            if (todayRequests) todayRequests.textContent = formatNumber(data.dashboard.today && data.dashboard.today.request_count);
            if (monthRequests) monthRequests.textContent = formatNumber(data.dashboard.thisMonth && data.dashboard.thisMonth.request_count);
            
            // API Keys count
            var apiKeys = data.dashboard.apiKeys || [];
            if (apiKeyCount) apiKeyCount.textContent = formatNumber(apiKeys.length);
            
            // API Keys list
            var activityList = document.getElementById('recent-activity-list');
            if (activityList) {
                if (apiKeys.length > 0) {
                    activityList.innerHTML = apiKeys.map(function(key) {
                        var statusClass = key.isActive ? 'status-active' : 'status-inactive';
                        var statusText = key.isActive ? t('active') : t('inactive');
                        var perms = key.permissions && key.permissions.join ? key.permissions.join(', ') : (key.permissions || 'read');
                        return '<tr>' +
                            '<td><strong>' + escapeHtml(key.name) + '</strong><br><small style="color: var(--text-muted)">' + escapeHtml(key.prefix) + '</small></td>' +
                            '<td><span class="status-badge ' + statusClass + '">' + statusText + '</span></td>' +
                            '<td>' + escapeHtml(perms) + '</td>' +
                            '<td>' + formatNumber(key.usageCount) + '</td>' +
                            '<td>' + formatDate(key.lastUsedAt) + '</td>' +
                        '</tr>';
                    }).join('');
                } else {
                    activityList.innerHTML = '<tr><td colspan="5" class="text-center">' + t('no_data') + '</td></tr>';
                }
            }
        }
    } catch (error) {
        console.error('Load dashboard error:', error);
    }
}
