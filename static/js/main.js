/* =====================================================================
   SparkMarg Core Application Utilities & Helper Functions
   ===================================================================== */

window.SparkMarg = {
  currentUser: null,

  /**
   * Initialize common interface elements, authentication checks, and form routers
   */
  init() {
    this.checkAuthState();
    this.setupNavigation();
    this.setupAuthForms();
  },

  /**
   * Verify session status and update UI elements accordingly
   */
  async checkAuthState() {
    if (!localStorage.getItem('access_token')) {
      this.updateNavForGuest();
      return;
    }

    try {
      const data = await this.apiRequest('/api/auth/me');
      this.currentUser = data.user;
      this.updateNavForAuth(this.currentUser);
    } catch (error) {
      this.currentUser = null;
      this.updateNavForGuest();
    }
  },

  /**
   * Render navigation options for authenticated users
   */
  updateNavForAuth(user) {
    const navUserContainer = document.getElementById('nav-user-section');
    if (!navUserContainer) return;

    navUserContainer.innerHTML = '';
    const menuDiv = document.createElement('div');
    menuDiv.className = 'user-menu';
    menuDiv.style.display = 'flex';
    menuDiv.style.alignItems = 'center';
    menuDiv.style.gap = '0.75rem';

    const nameSpan = document.createElement('span');
    nameSpan.style.fontWeight = '500';
    nameSpan.style.color = 'var(--text-main)';
    nameSpan.style.fontSize = '0.9rem';
    nameSpan.textContent = user.full_name || 'User';

    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'logout-btn';
    logoutBtn.className = 'btn btn-outline btn-sm';
    logoutBtn.textContent = 'Logout';
    logoutBtn.addEventListener('click', () => this.logout());

    menuDiv.appendChild(nameSpan);
    menuDiv.appendChild(logoutBtn);
    navUserContainer.appendChild(menuDiv);
  },

  /**
   * Render navigation options for unauthenticated guests
   */
  updateNavForGuest() {
    const navUserContainer = document.getElementById('nav-user-section');
    if (!navUserContainer) return;

    navUserContainer.innerHTML = `
      <a href="/login" class="btn btn-sm btn-outline" id="nav-login-btn">Log In</a>
      <a href="/register" class="btn btn-sm btn-primary" id="nav-register-btn">Sign Up</a>
    `;
  },

  /**
   * Perform logout action and redirect
   */
  async logout() {
    localStorage.removeItem('access_token');
    this.showAlert('Logged out successfully', 'success');
    setTimeout(() => { window.location.href = '/login'; }, 1000);
  },

  /**
   * Highlight active route in navigation bar
   */
  setupNavigation() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
      if (link.getAttribute('href') === currentPath) {
        link.classList.add('active');
      }
    });
  },

  /**
   * Bind event routers dynamically for Auth Forms if they exist on the DOM
   */
  setupAuthForms() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLoginSubmit(e));
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', (e) => this.handleRegisterSubmit(e));
    }
  },

  /**
   * Extracted External Login Action
   */
  async handleLoginSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.textContent = 'Authenticating...';

    const loginData = {
      email: document.getElementById('email').value,
      password: document.getElementById('password').value
    };

    try {
      const data = await this.apiRequest('/api/auth/login', {
        method: 'POST',
        body: loginData
      });

      localStorage.setItem('access_token', data.access_token);
      this.showAlert('Login successful! Redirecting...', 'success');
      setTimeout(() => { window.location.href = '/dashboard'; }, 1000);
    } catch (err) {
      this.showAlert(err.message, 'danger');
      btn.disabled = false;
      btn.textContent = 'Log In';
    }
  },

  /**
   * Extracted External Registration Action
   */
  async handleRegisterSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (password.length < 8) {
      this.showAlert('Password must be at least 8 characters long.', 'danger');
      return;
    }

    if (password !== confirmPassword) {
      this.showAlert('Passwords do not match.', 'danger');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating Account...';

    try {
      await this.apiRequest('/api/auth/register', {
        method: 'POST',
        body: { username, email, password }
      });
      this.showAlert('Registration successful! Please log in.', 'success');
      setTimeout(() => { window.location.href = '/login'; }, 1000);
    } catch (err) {
      this.showAlert('Registration processing error', 'danger');
      btn.disabled = false;
      btn.textContent = 'Get Started';
    }
  },

  /**
   * Display a status banner or alert message on the page
   */
  showAlert(message, type = 'danger', containerId = 'alert-container') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.className = `alert alert-${type} animate-slide-down`;
    container.textContent = message;
    container.style.display = 'block';

    setTimeout(() => { container.style.display = 'none'; }, 4000);
  },

  /**
   * Universal API fetch wrapper
   */
  async apiRequest(url, options = {}) {
    // 1. Grab the token from storage
    const token = localStorage.getItem('access_token'); 
    
    // 2. Inject the Authorization header if the token exists
    const defaultHeaders = { 
      'Content-Type': 'application/json', 
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}) 
    };
    
    const config = { ...options, headers: { ...defaultHeaders, ...options.headers } };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => { window.SparkMarg.init(); });
