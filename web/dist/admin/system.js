/**
 * AgentRecall Admin - System Settings Page (Admin Only)
 */

// Load page data function (called by changeLanguage)
window.loadPageData = loadSystemStats;

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    var isAuth = await checkAuth();
    if (!isAuth) return;
    
    // Check if user is admin
    if (!currentUser || currentUser.role !== 'admin') {
        window.location.href = 'dashboard.html';
        return;
    }
    
    // Load system stats
    loadSystemStats();
});

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
