/**
 * AgentRecall Admin - User Management Page (Admin Only)
 */

// Load page data function (called by changeLanguage)
window.loadPageData = function() { loadUsers(1); };

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    var isAuth = await checkAuth();
    if (!isAuth) return;
    
    // Check if user is admin
    if (!currentUser || currentUser.role !== 'admin') {
        window.location.href = 'dashboard.html';
        return;
    }
    
    // Load users
    loadUsers(1);
    
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

// Expose to global scope
window.loadUsers = loadUsers;
window.updateUserStatus = updateUserStatus;
