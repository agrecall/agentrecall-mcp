const API_BASE = window.location.origin;

document.getElementById("send-code-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = document.getElementById("reset-email").value;
    const btn = e.target.querySelector("button");
    
    btn.disabled = true;
    btn.textContent = t("sending");
    
    try {
        const response = await fetch(API_BASE + "/api/v1/users/send-reset-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(t("code_sent"));
            document.getElementById("send-code-form").style.display = "none";
            document.getElementById("reset-password-form").style.display = "block";
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

document.getElementById("reset-password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = document.getElementById("reset-email").value;
    const code = document.getElementById("reset-code").value;
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;
    
    if (newPassword !== confirmPassword) {
        alert(t("password_mismatch"));
        return;
    }
    
    if (newPassword.length < 8) {
        alert(t("password_too_short"));
        return;
    }
    
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    btn.textContent = t("resetting");
    
    try {
        const response = await fetch(API_BASE + "/api/v1/users/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code, newPassword })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(t("reset_success"));
            window.location.href = "index.html";
        } else {
            alert(translateError(data.error) || t("reset_failed"));
            btn.disabled = false;
            btn.textContent = t("reset_password");
        }
    } catch (error) {
        alert(t("network_error"));
        btn.disabled = false;
        btn.textContent = t("reset_password");
    }
});