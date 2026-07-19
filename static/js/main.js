/* =====================================================================
   SparkMarg Core Application Utilities & Helper Functions
   ===================================================================== */

window.SparkMarg = {
  currentUser: null,
  activeController: null,

  /**
   * Initialize common interface elements, authentication checks, and form routers
   */
  init() {
    this.checkAuthState();
    this.setupNavigation();
    this.setupAuthForms();
    this.setupHeaderScroll();
    this.setupFAQ();
    this.setupScrollReveal();
    this.setupThemeToggle();
    
    // Handle initial route based on hash for landing page sections
    const initialHash = window.location.hash.slice(1);
    if (initialHash) {
      this.navigateTo(initialHash);
    }
  },

  /**
   * Centralized view orchestration engine for dynamic navigation
   */
  async navigateTo(targetRoute) {
    // 0. Cleanup previous dynamic controller lifecycle
    if (this.activeController && typeof this.activeController.destroy === 'function') {
      this.activeController.destroy();
      this.activeController = null;
    }

    // 1. Handle Modal Navigation
    if (targetRoute.endsWith('Modal')) {
      const modal = document.getElementById(targetRoute);
      if (modal) modal.classList.remove('hidden');
      return;
    }

    // 2. Handle Dynamic Routes (SPA Fragments)
    const dynamicRoutes = ['temp', 'catalog', 'dashboard', 'simulation'];
    const baseRoute = targetRoute.split('?')[0]; // Handle query params if any

    if (dynamicRoutes.includes(baseRoute)) {
      if (baseRoute === 'dashboard' && !this.currentUser) {
        this.navigateTo('loginModal');
        this.showAlert("Authorization required to access workspace.", "warning");
        return;
      }

      // Parallel load HTML, Styles, and Controller for optimized performance
      await Promise.all([
        this.loadDynamicPage(baseRoute),
        this.loadDynamicStyles(baseRoute)
      ]);
      await this.loadController(baseRoute);
    } else {
      // Disable any active page-specific styles when returning to static landing sections
      this.togglePageStyles(null);
    }

    // 3. Handle View Toggling
    const views = document.querySelectorAll('.page-view');
    if (views.length > 0) {
      views.forEach(view => view.classList.remove('active'));
      const selectedView = document.getElementById(`page-${baseRoute}`);
      if (selectedView) {
        selectedView.classList.add('active');
        // Update URL hash for bookmarking and history
        window.location.hash = targetRoute;
        
        // Update active status for navigation items
        document.querySelectorAll('.nav-link').forEach(link => {
          link.classList.remove('active');
          const clickAttr = link.getAttribute('onclick');
          if (clickAttr && clickAttr.includes(`'${targetRoute}'`)) {
            link.classList.add('active');
          }
        });
        window.scrollTo(0, 0);
      }
    }

    // 5. Close mobile menu if expanded
    const navMenu = document.getElementById('navMenu');
    const hamburgerToggle = document.getElementById('hamburgerToggle');
    if (navMenu && navMenu.classList.contains('active')) {
      navMenu.classList.remove('active');
      hamburgerToggle.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  /**
   * Dynamically imports and initializes the controller for a specific route
   */
  async loadController(route) {
    try {
      // Dynamically import the module. Note: paths are relative to this file
      const module = await import(`./${route}.js`);
      if (module.default) {
        this.activeController = module.default;
        if (typeof this.activeController.init === 'function') {
          this.activeController.init();
        }
      }
    } catch (err) {
      console.warn(`No controller found or failed to load for route: ${route}`, err);
    }
  },

  /**
   * Dynamically fetches and injects page-specific CSS into the document head
   */
  async loadDynamicStyles(route) {
    const styleId = `style-bundle-${route}`;
    
    // Toggle visibility logic first to ensure no clashing during the fetch
    this.togglePageStyles(route);

    if (document.getElementById(styleId)) return;

    return new Promise((resolve) => {
      const link = document.createElement('link');
      link.id = styleId;
      link.rel = 'stylesheet';
      link.href = `/static/css/${route}.css`;
      link.className = 'dynamic-page-style';
      
      link.onload = () => resolve();
      link.onerror = () => {
        console.warn(`Dynamic CSS bundle for "${route}" not found or failed to load.`);
        link.remove();
        resolve();
      };
      
      document.head.appendChild(link);
    });
  },

  /**
   * Manages the disabled state of stylesheets to prevent CSS rule collisions
   */
  togglePageStyles(activeRoute) {
    const pageStyles = document.querySelectorAll('.dynamic-page-style');
    pageStyles.forEach(style => {
      style.disabled = (style.id !== `style-bundle-${activeRoute}`);
    });
  },

  /**
   * Fetches external HTML from the server and injects it into the main container
   */
  async loadDynamicPage(page) {
    const container = document.getElementById(`page-${page}`);
    if (!container) return;

    // If content is already present, skip fetching to optimize performance
    if (container.innerHTML.trim() !== "") return;

    try {
      // Fetch the template content from our new Flask route
      const response = await fetch(`/${page}`);
      if (!response.ok) throw new Error(`Could not load ${page} content`);
      
      const htmlContent = await response.text();
      container.innerHTML = htmlContent;
    } catch (error) {
      container.innerHTML = `<h2>Error 404</h2><p>Page not found.</p>`;
      console.error(error);
    }
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
   * Handle interactive color shifting for the fixed header
   */
  setupHeaderScroll() {
    const navbar = document.querySelector('.site-header');
    if (!navbar) return;
    
    const evaluateHeaderScroll = () => {
      window.scrollY > 50 ? navbar.classList.add('scrolled') : navbar.classList.remove('scrolled');
    };

    window.addEventListener('scroll', evaluateHeaderScroll);
    evaluateHeaderScroll();
  },

  /**
   * Render navigation options for authenticated users
   */
  updateNavForAuth(user) {
    const navUserContainer = document.getElementById('nav-user-section');
    if (navUserContainer) {
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
    }

    // Handle index.html specific advanced navigation components
    const navAuth = document.getElementById('navAuthSection');
    const userMenu = document.getElementById('userProfileMenu');
    if (navAuth && userMenu) {
      navAuth.classList.add('hidden');
      userMenu.classList.remove('hidden');
      const nameDisplay = document.getElementById('user-name');
      if (nameDisplay) nameDisplay.textContent = user.full_name || 'User';
    }
  },

  /**
   * Render navigation options for unauthenticated guests
   */
  updateNavForGuest() {
    const navUserContainer = document.getElementById('nav-user-section');
    if (navUserContainer) {
      navUserContainer.innerHTML = `
        <a href="/login" class="btn btn-sm btn-outline" id="nav-login-btn">Log In</a>
        <a href="/register" class="btn btn-sm btn-primary" id="nav-register-btn">Sign Up</a>
      `;
    }

    const navAuth = document.getElementById('navAuthSection');
    const userMenu = document.getElementById('userProfileMenu');
    if (navAuth && userMenu) {
      navAuth.classList.remove('hidden');
      userMenu.classList.add('hidden');
    }
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

    // Navigation Toggle for Mobile View
    const hamburgerToggle = document.getElementById('hamburgerToggle');
    const navMenu = document.getElementById('navMenu');

    if (hamburgerToggle && navMenu) {
      const toggleMobileMenu = () => {
        hamburgerToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
        const isExpanded = hamburgerToggle.classList.contains('active');
        hamburgerToggle.setAttribute('aria-expanded', isExpanded);

        // Prevent body layer background scroll leaking when mobile menu is expanded
        document.body.style.overflow = isExpanded ? 'hidden' : '';
      };

      hamburgerToggle.addEventListener('click', toggleMobileMenu);

      // Dismiss overlay states when individual anchor targets are touched
      navLinks.forEach(link => {
        link.addEventListener('click', () => {
          if (navMenu.classList.contains('active')) toggleMobileMenu();
        });
      });
    }
  },

  /**
   * Interactive Accordion Mechanics (FAQ)
   */
  setupFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
      const trigger = item.querySelector('.faq-trigger');
      const content = item.querySelector('.faq-panel') || item.querySelector('.faq-content');

      if (trigger && content) {
        trigger.addEventListener('click', () => {
          const isCurrentlyActive = item.classList.contains('active');

          faqItems.forEach(alternateItem => {
            alternateItem.classList.remove('active');
            const altContent = alternateItem.querySelector('.faq-panel') || alternateItem.querySelector('.faq-content');
            const altTrigger = alternateItem.querySelector('.faq-trigger');
            if (altContent) altContent.style.maxHeight = null;
            if (altTrigger) altTrigger.setAttribute('aria-expanded', 'false');
          });

          if (!isCurrentlyActive) {
            item.classList.add('active');
            trigger.setAttribute('aria-expanded', 'true');
            content.style.maxHeight = content.scrollHeight + 'px';
          }
        });
      }
    });
  },

  /**
   * Scroll Intersection Reveal Transitions
   */
  setupScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal');
    if (revealElements.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    revealElements.forEach(el => observer.observe(el));
  },

  /**
   * Dark Mode Toggle Logic
   */
  setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;

    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      const icon = themeToggle.querySelector('i');
      if (icon) icon.classList.replace('fa-moon', 'fa-sun');
    }

    themeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const newTheme = isDark ? 'light' : 'dark';
      const icon = themeToggle.querySelector('i');

      if (newTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (icon) icon.classList.replace('fa-moon', 'fa-sun');
      } else {
        document.documentElement.removeAttribute('data-theme');
        if (icon) icon.classList.replace('fa-sun', 'fa-moon');
      }
      localStorage.setItem('theme', newTheme);
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
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]') || document.getElementById('submit-btn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Authenticating...';

    const loginData = {
      email: (form.querySelector('input[type="email"]') || document.getElementById('email')).value,
      password: (form.querySelector('input[type="password"]') || document.getElementById('password')).value
    };

    try {
      const data = await this.apiRequest('/api/auth/login', {
        method: 'POST',
        body: loginData
      });

      localStorage.setItem('access_token', data.access_token);
      this.showAlert('Login successful! Redirecting...', 'success');
      this.closeModal('loginModal');
      setTimeout(() => { window.location.href = '/dashboard'; }, 1000);
    } catch (err) {
      this.showAlert(err.message, 'danger');
      btn.disabled = false;
      btn.textContent = originalText;
    }
  },

  /**
   * Extracted External Registration Action
   */
  async handleRegisterSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]') || document.getElementById('submit-btn');
    const originalText = btn.textContent;
    
    const username = (form.querySelector('#username') || document.getElementById('username')).value.trim();
    const email = (form.querySelector('input[type="email"]') || document.getElementById('email')).value.trim();
    const password = (form.querySelector('input[name="password"]') || document.getElementById('password')).value;
    const confirmPassword = (form.querySelector('#confirm-password') || document.getElementById('confirm-password')).value;

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
      this.closeModal('signupModal');
      setTimeout(() => { window.location.href = '/login'; }, 1000);
    } catch (err) {
      this.showAlert(err.message || 'Registration processing error', 'danger');
      btn.disabled = false;
      btn.textContent = originalText;
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

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  },

  switchModal(toOpen, toClose) {
    this.closeModal(toClose);
    this.navigateTo(toOpen);
  },

  handleModalOutSideClick(event, modalId) {
    if (event.target.id === modalId) {
      this.closeModal(modalId);
    }
  },

  toggleProfileMenu() {
    const menu = document.getElementById('dropDownMenu');
    if (menu) menu.classList.toggle('hidden');
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => { 
  window.SparkMarg.init();

  // FAQ Search Filter Logic
  const faqSearch = document.getElementById('faq-search');
  if (faqSearch) {
    faqSearch.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const faqItems = document.querySelectorAll('.faq-item');
      faqItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(term) ? 'block' : 'none';
      });
    });
  }
});