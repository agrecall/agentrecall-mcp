/**
 * AgentRecall Admin - Login Page
 */

document.addEventListener('DOMContentLoaded', async function() {
    // Check if already logged in
    var authToken = localStorage.getItem('authToken');
    if (authToken) {
        try {
            var user = await getCurrentUser();
            if (user) {
                window.location.href = 'dashboard.html';
                return;
            }
        } catch (error) {
            localStorage.removeItem('authToken');
        }
    }
    
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
    
    // Login form
    var loginForm = document.getElementById('login-form');
    if (loginForm) {
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
                window.location.href = 'dashboard.html';
            } catch (error) {
                alert(translateError(error.message) || t('login_failed'));
            }
        });
    }
});
