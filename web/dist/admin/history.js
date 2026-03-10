/**
 * AgentRecall Admin - API Usage History Page
 */

var historyPage = 1;
var historyTotalPages = 1;

window.loadPageData = function() { loadHistory(1); };

document.addEventListener("DOMContentLoaded", async function() {
    await checkAuth();
    loadHistory(1);
    
    var historyTypeFilter = document.getElementById("history-type-filter");
    var historyDaysFilter = document.getElementById("history-days-filter");
    if (historyTypeFilter) {
        historyTypeFilter.addEventListener("change", function() { loadHistory(1); });
    }
    if (historyDaysFilter) {
        historyDaysFilter.addEventListener("change", function() { loadHistory(1); });
    }
});

async function loadHistory(page) {
    page = page || 1;
    try {
        var typeFilter = document.getElementById("history-type-filter");
        var daysFilter = document.getElementById("history-days-filter");
        var type = typeFilter ? typeFilter.value : "";
        var days = daysFilter ? daysFilter.value : "7";
        
        var url = "/api/v1/stats/usage?page=" + page + "&limit=20&days=" + days;
        if (type) url += "&endpoint=" + type;
        
        var data = await apiRequest(url);
        
        if (data.success) {
            var list = document.getElementById("history-list");
            if (list) {
                if (data.logs && data.logs.length > 0) {
                    list.innerHTML = data.logs.map(function(item) {
                        var statusClass = item.status_code >= 200 && item.status_code < 300 ? "success" : 
                                         item.status_code >= 400 ? "danger" : "warning";
                        var keyName = item.api_key_name || item.api_key_prefix || "-";
                        return "<tr><td>" + item.endpoint + "</td><td>" + keyName + "</td><td><span class=\"status-badge status-" + statusClass + "\">" + item.status_code + "</span></td><td>" + item.duration_ms + "ms</td><td>" + formatDate(item.created_at) + "</td></tr>";
                    }).join("");
                } else {
                    list.innerHTML = "<tr><td colspan=\"6\" class=\"text-center\">" + t("no_data") + "</td></tr>";
                }
            }
            historyPage = page;
            historyTotalPages = data.pagination && data.pagination.totalPages ? data.pagination.totalPages : 1;
            renderPagination("history-pagination", historyPage, historyTotalPages, loadHistory);
        }
    } catch (error) {
        console.error("Load history error:", error);
    }
}

window.loadHistory = loadHistory;
