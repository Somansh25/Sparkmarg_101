/**
 * AuthController: Manages identity lifecycles and secure form interactions.
 */
const AuthController = {
    _boundSubmitHandler: null,

    init() {
        // Store bound reference to ensure correct removal during destroy()
        this._boundSubmitHandler = this.handleFormSubmit.bind(this);
        document.addEventListener('submit', this._boundSubmitHandler);

        // Apply accessibility attributes to identity forms if present in the DOM
        // FIXED: Using relative input selector to avoid global document element lookup collisions
        const loginPwd = document.querySelector('input[type="password"]');
        if (loginPwd) loginPwd.setAttribute('autocomplete', 'current-password');
    },

    async handleFormSubmit(e) {
        try {
            const formId = e.target.id;
            // FIXED: Handle submissions from both page-level forms and index modal overlays
            if (formId === 'login-form' || formId === 'modal-login-form') {
                e.preventDefault();
                await this.login(e.target);
            } else if (formId === 'register-form' || formId === 'modal-register-form') {
                e.preventDefault();
                await this.register(e.target);
            }
        } catch (err) {
            console.warn("Auth form submission interrupted:", err.message);
        }
    },

    async login(form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        // FIXED: Scoped selector within active submitting form element to prevent ID collision shadowing
        const emailInput = form.querySelector('input[type="email"]');
        const passwordInput = form.querySelector('input[type="password"]');
        const alertNode = form.querySelector('.error-msg-block');

        const email = emailInput ? emailInput.value : '';
        const password = passwordInput ? passwordInput.value : '';

        // Enhanced client-side validation
        if (!email || !password) {
            this.showFormError(alertNode, "Email and password are required.");
            return;
        }
        if (!this.validateEmail(email)) {
            this.showFormError(alertNode, "Please enter a valid email address.");
            return;
        }

        try {
            this.setLoading(submitBtn, true, 'Authenticating...');
            const data = await window.SparkMarg.apiRequest('/api/auth/login', {
                method: 'POST',
                body: { email, password }
            });

            localStorage.setItem('access_token', data.access_token);
            window.SparkMarg.showAlert('Session established.', 'success');
            
            // FIXED: Close modal overlay if submission came from index modal
            if (form.id === 'modal-login-form') {
                window.SparkMarg.closeModal('loginModal');
            }

            const isAuthed = await window.SparkMarg.checkAuthState();
            
            if (isAuthed) {
                setTimeout(() => window.SparkMarg.navigateTo('dashboard'), 800);
            } else {
                throw new Error("Session verification failed. Please try again.");
            }
        } catch (err) {
            if (err.message.includes('Cloud Shell session expired')) return;
            const displayMsg = err.message.includes('401') ? 'Invalid email or password.' : err.message;
            this.showFormError(alertNode, displayMsg);
        } finally {
            this.setLoading(submitBtn, false, 'Access Workspace');
        }
    },

    async register(form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        // FIXED: Scoped selector within active submitting form
        const nameInput = form.querySelector('input[type="text"]');
        const emailInput = form.querySelector('input[type="email"]');
        const passwordInput = form.querySelector('input[type="password"]');
        const confirmPasswordInput = form.querySelector('input[name="confirm_password"]');
        const alertNode = form.querySelector('.error-msg-block');

        const fullName = nameInput ? nameInput.value : '';
        const email = emailInput ? emailInput.value : '';
        const password = passwordInput ? passwordInput.value : '';
        const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : null;

        // Enhanced client-side validation
        if (!fullName || !email || !password) {
            this.showFormError(alertNode, "All fields are required to create an account.");
            return;
        }
        if (!this.validateEmail(email)) {
            this.showFormError(alertNode, "The email address format is invalid.");
            return;
        }
        if (password.length < 6) {
            this.showFormError(alertNode, "Security requirement: Password must be at least 6 characters.");
            return;
        }
        if (confirmPassword !== null && password !== confirmPassword) {
            this.showFormError(alertNode, "Passwords do not match. Please verify.");
            return;
        }

        try {
            this.setLoading(submitBtn, true, 'Initializing...');
            await window.SparkMarg.apiRequest('/api/auth/register', {
                method: 'POST',
                body: { full_name: fullName, email, password }
            });

            window.SparkMarg.showAlert('Account provisioned. Please sign in.', 'success');

            // FIXED: Smooth modal transition if submitted from index modal overlay
            if (form.id === 'modal-register-form') {
                window.SparkMarg.closeModal('signupModal');
                window.SparkMarg.navigateTo('loginModal');
            } else {
                setTimeout(() => window.SparkMarg.navigateTo('login'), 1200);
            }
        } catch (err) {
            if (err.message.includes('Cloud Shell session expired')) {
                window.SparkMarg.showSessionExpiredOverlay();
            } else {
                this.showFormError(alertNode, err.message);
            }
        } finally {
            this.setLoading(submitBtn, false, 'Initialize Profile');
        }
    },

    validateEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    setLoading(btn, isLoading, text) {
        if (!btn) return;
        btn.disabled = isLoading;
        btn.textContent = text;
    },

    showFormError(alertNode, message) {
        if (alertNode) {
            alertNode.textContent = message;
            alertNode.classList.remove('hidden');
            setTimeout(() => alertNode.classList.add('hidden'), 5000);
        }
        window.SparkMarg.showAlert(message, 'danger');
    },

    destroy() {
        if (this._boundSubmitHandler) {
            document.removeEventListener('submit', this._boundSubmitHandler);
        }
    }
};

export default AuthController;