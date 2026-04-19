document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const errorMsg = document.getElementById('loginError');
        const password = document.getElementById('password').value;
        
        errorMsg.textContent = '';

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });

            const data = await res.json();
            
            if (res.ok) {
                window.location.href = '/admin';
            } else {
                errorMsg.textContent = data.error || 'Login failed';
                errorMsg.classList.add('active');
            }
        } catch (error) {
            errorMsg.textContent = 'Server error. Try again.';
            errorMsg.classList.add('active');
        }
    });

    // Ripple effect copy (as login.html might not load main.js)
    document.addEventListener('click', function(e) {
        let ripple = document.createElement('div');
        ripple.classList.add('ripple');
        ripple.style.left = `${e.clientX - 10}px`;
        ripple.style.top = `${e.clientY - 10}px`;
        ripple.style.width = '20px';
        ripple.style.height = '20px';
        document.body.appendChild(ripple);
        setTimeout(() => { ripple.remove(); }, 600);
    });
});
