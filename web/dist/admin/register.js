const API_BASE = window.location.origin;
let countdown = 0;

// Send verification code
document.getElementById("send-code-btn").addEventListener("click", async function() {
    const email = document.getElementById("register-email").value;
    if (!email) {
        alert(t("enter_email_first"));
        return;
    }
    
    const btn = this;
    btn.disabled = true;
    btn.textContent = t("sending");
    
    try {
        const response = await fetch(API_BASE + "/api/v1/users/send-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(t("code_sent"));
            countdown = 60;
            const timer = setInterval(() => {
                countdown--;
                btn.textContent = countdown + "s";
                if (countdown <= 0) {
                    clearInterval(timer);
                    btn.disabled = false;
                    btn.textContent = t("send_code");
                }
            }, 1000);
        } else {
            alert(translateError(data.error) || t("send_code_failed"));
            btn.disabled = false;
            btn.textContent = t("send_code");
        }
    } catch (error) {
        alert(t("network_error"));
        btn.disabled = false;
        btn.textContent = t("send_code");
    }
});

// Register form
document.getElementById("register-form").addEventListener("submit", async function(e) {
    e.preventDefault();
    
    const username = document.getElementById("register-username").value;
    const email = document.getElementById("register-email").value;
    const code = document.getElementById("register-code").value;
    const password = document.getElementById("register-password").value;
    
    if (!username || !email || !code || !password) {
        alert(t("fill_all_fields"));
        return;
    }
    
    if (password.length < 8) {
        alert(t("password_too_short"));
        return;
    }
    
    const btn = this.querySelector("button[type=submit]");
    btn.disabled = true;
    btn.textContent = t("registering");
    
    try {
        const response = await fetch(API_BASE + "/api/v1/users/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, code, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));
            alert(t("register_success"));
            window.location.href = "dashboard.html";
        } else {
            alert(translateError(data.error) || t("register_failed"));
        }
    } catch (error) {
        alert(t("network_error"));
    }
    
    btn.disabled = false;
    btn.textContent = t("register");
});