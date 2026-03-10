/**
 * AgentRecall Admin - API Keys Page
 */

// Load page data function (called by changeLanguage)
window.loadPageData = loadApiKeys;

document.addEventListener('DOMContentLoaded', async function() {
    // Check authentication
    await checkAuth();
    
    // Load API keys
    loadApiKeys();
    
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
});

/**
 * 复制到剪贴板
 */
function copyToClipboard(text, successMessage) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
            showToast(successMessage || t('copied'));
        }).catch(function(err) {
            fallbackCopy(text, successMessage);
        });
    } else {
        fallbackCopy(text, successMessage);
    }
}

function fallbackCopy(text, successMessage) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showToast(successMessage || t('copied'));
    } catch (err) {
        alert('Copy failed');
    }
    document.body.removeChild(textarea);
}

/**
 * 显示 Toast 提示
 */
function showToast(message) {
    // 移除已存在的 toast
    var existingToast = document.getElementById('toast-notification');
    if (existingToast) {
        existingToast.remove();
    }
    
    var toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.textContent = message;
    toast.style.cssText = 'position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: var(--primary-color); color: white; padding: 10px 20px; border-radius: 5px; z-index: 9999; animation: fadeInOut 2s;';
    document.body.appendChild(toast);
    
    setTimeout(function() {
        toast.remove();
    }, 2000);
}

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
                
                var prefix = key.key_prefix || 'ak_...';
                
                return '<div class="apikey-card">' +
                    '<div class="apikey-info">' +
                        '<h4>' + escapeHtml(key.key_name || 'Unnamed Key') + '</h4>' +
                        '<div class="apikey-meta">' +
                            '<span class="apikey-prefix">' + escapeHtml(prefix) + '</span>' +
                            '<span class="badge">' + permissions.join(', ').toUpperCase() + '</span>' +
                            '<span>' + t('usage_stats') + ': ' + formatNumber(key.usage_count || 0) + '</span>' +
                            expiresText +
                        '</div>' +
                    '</div>' +
                    '<div class="apikey-actions">' +
                        '<button class="btn btn-secondary btn-sm" onclick="copyPrefix(\'' + escapeHtml(prefix) + '\')" title="' + t('copy_prefix') + '">&#128203; ' + t('copy') + '</button>' +
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

function copyPrefix(prefix) {
    copyToClipboard(prefix, t('copied'));
}

// Expose to global scope
window.deleteApiKey = deleteApiKey;
window.copyPrefix = copyPrefix;
