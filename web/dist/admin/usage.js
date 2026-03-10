/**
 * AgentRecall Admin - Usage Stats Page
 */

// Load page data function (called by changeLanguage)
window.loadPageData = loadUsageStats;

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    await checkAuth();
    
    // Load usage stats
    loadUsageStats();
});

async function loadUsageStats() {
    try {
        var data = await apiRequest('/api/v1/stats/user');
        
        if (data.success) {
            // Render trend chart
            var trendChart = document.getElementById('usage-trend-chart');
            if (trendChart) {
                if (data.trends && data.trends.length > 0) {
                    var maxValue = Math.max.apply(null, data.trends.map(function(t) { return parseInt(t.request_count); }));
                    // 生成 Y 轴
                    var yAxisHtml = '<span>' + (maxValue + 5) + '</span><span>' + Math.ceil(maxValue / 2) + '</span><span>0</span>';
                    var yAxisEl = trendChart.parentElement.querySelector('.chart-y-axis');
                    if (yAxisEl) yAxisEl.innerHTML = yAxisHtml;
                    
                    // 生成 X 轴日期
                    var xAxisHtml = '';
                    for (var i = 6; i >= 0; i--) {
                        var d = new Date();
                        d.setDate(d.getDate() - i);
                        xAxisHtml += '<span>' + (d.getMonth() + 1) + '-' + d.getDate() + '</span>';
                    }
                    var xAxisEl = trendChart.parentElement.querySelector('.chart-x-axis');
                    if (xAxisEl) xAxisEl.innerHTML = xAxisHtml;
                    
                    // 生成7天的柱状图
                    var chartHtml = '';
                    var trendsMap = {};
                    data.trends.forEach(function(t) {
                        var d = new Date(t.date);
                        var key = d.getMonth() + '-' + d.getDate();
                        trendsMap[key] = t.request_count;
                    });
                    
                    for (var i = 6; i >= 0; i--) {
                        var d = new Date();
                        d.setDate(d.getDate() - i);
                        var key = d.getMonth() + '-' + d.getDate();
                        var count = trendsMap[key] || 0;
                        var height = maxValue > 0 ? (count / maxValue * 100) : 0;
                        chartHtml += '<div class="chart-bar" style="height: ' + height + '%" data-value="' + count + '" title="' + (d.getMonth()+1) + '-' + d.getDate() + ': ' + count + '"></div>';
                    }
                    trendChart.innerHTML = chartHtml;
                } else {
                    trendChart.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">' + t('no_data') + '</p>';
                }
            }
            
            // Top endpoints
            var endpointsList = document.getElementById('top-endpoints-list');
            if (endpointsList) {
                if (data.topEndpoints && data.topEndpoints.length > 0) {
                    endpointsList.innerHTML = data.topEndpoints.map(function(ep) {
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