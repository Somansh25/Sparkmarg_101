// SparkMarg Core Orchestrator: Manages global state, dynamic navigation, and authentication lifecycle.
window.SparkMarg = {
  currentUser: null,
  activeController: null,

  async init() {
    try {
      await this.checkAuthState();
      if (document.getElementById('cloud-shell-expired-overlay')) return;

      await this.loadController('auth');
      this.setupHeaderScroll();
      this.setupFAQ();
      this.setupScrollReveal();
      this.setupThemeToggle();
      
      const initialHash = window.location.hash.slice(1);
      if (initialHash) {
        this.navigateTo(initialHash);
      }
      this.setupNavigation();
    } catch (err) {
      console.error("SparkMarg failed to initialize:", err);
    }
  },

  async navigateTo(targetRoute) {
    if (this.activeController && typeof this.activeController.destroy === 'function') {
      this.activeController.destroy();
      this.activeController = null;
    }

    if (targetRoute.endsWith('Modal')) {
      const modal = document.getElementById(targetRoute);
      if (modal) modal.classList.remove('hidden');
      return;
    }
    let baseRoute = targetRoute.split('?')[0];
    const dynamicRoutes = ['catalog', 'dashboard', 'simulation', 'login', 'register'];

    if (dynamicRoutes.includes(baseRoute)) {
      if (baseRoute === 'dashboard' && !this.currentUser) {
        this.navigateTo('loginModal');
        this.showAlert("Authorization required to access workspace.", "warning");
        return;
      }
      document.body.classList.add('page-loading');
      await Promise.all([
        this.loadDynamicPage(baseRoute),
        this.loadDynamicStyles(baseRoute)
      ]);
      await this.loadController(baseRoute);
    } else {
      this.togglePageStyles(null);
    }
    const views = document.querySelectorAll('.page-view');
    document.body.classList.remove('page-loading');
    if (views.length > 0) {
      views.forEach(view => view.classList.remove('active'));
      const selectedView = document.getElementById(`page-${baseRoute}`);
      if (selectedView) {
        selectedView.classList.add('active');
        if (window.location.hash !== `#${targetRoute}`) {
          window.location.hash = targetRoute;
        }
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
    const navMenu = document.getElementById('navMenu');
    const hamburgerToggle = document.getElementById('hamburgerToggle');
    if (navMenu && navMenu.classList.contains('active')) {
      navMenu.classList.remove('active');
      hamburgerToggle.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  async loadController(route) {
    const routeMapping = {
      'login': 'auth',
      'register': 'auth'
    };
    const controllerName = routeMapping[route] || route;

    try {
      const module = await import(`./${controllerName}.js`);
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

  // FIXED: Refactored style loading to prevent accumulation of orphan dynamic stylesheets
  async loadDynamicStyles(route) {
    const styleId = `style-bundle-${route}`;
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

  // FIXED: Explicitly enables active stylesheet while disabling inactive ones to maintain clean render state
  togglePageStyles(activeRoute) {
    const pageStyles = document.querySelectorAll('.dynamic-page-style');
    pageStyles.forEach(style => {
      style.disabled = (style.id !== `style-bundle-${activeRoute}`);
    });
  },

  async loadDynamicPage(page, forceRefresh = false) {
    const container = document.getElementById(`page-${page}`);
    if (!container) return;
    if (!forceRefresh && container.innerHTML.trim() !== "") return;
    try {
      const response = await fetch(`/${page}`);
      if (!response.ok) throw new Error(`Could not load ${page} content`);
      container.innerHTML = await response.text();
    } catch (error) {
      container.innerHTML = `<h2>Error 404</h2><p>Page not found.</p>`;
      console.error(error);
    }
  },

  async checkAuthState() {
    if (!localStorage.getItem('access_token')) {
      this.updateNavForGuest();
      return false;
    }
    try {
      const data = await this.apiRequest('/api/auth/me');
      this.currentUser = data.user;
      this.updateNavForAuth(this.currentUser);
      return true;
    } catch (error) {
      if (error.message.includes('401')) {
        localStorage.removeItem('access_token');
      }
      this.currentUser = null;
      this.updateNavForGuest();
      return false;
    }
  },

  setupHeaderScroll() {
    const navbar = document.querySelector('.site-header');
    if (!navbar) return;
    const evaluateHeaderScroll = () => {
      window.scrollY > 20 ? navbar.classList.add('scrolled') : navbar.classList.remove('scrolled');
    };
    window.addEventListener('scroll', evaluateHeaderScroll);
    evaluateHeaderScroll();
  },

  updateNavForAuth(user) {
    const navUserContainer = document.getElementById('nav-user-section');
    if (navUserContainer) {
      navUserContainer.innerHTML = '';
      const menuDiv = document.createElement('div');
      menuDiv.className = 'user-menu';
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
    const navAuth = document.getElementById('navAuthSection');
    const userMenu = document.getElementById('userProfileMenu');
    if (navAuth && userMenu) {
      navAuth.classList.add('hidden');
      userMenu.classList.remove('hidden');
      const nameDisplay = document.getElementById('user-name');
      if (nameDisplay) nameDisplay.textContent = user.full_name || 'User';
    }
  },

  updateNavForGuest() {
    const navUserContainer = document.getElementById('nav-user-section');
    if (navUserContainer) {
      navUserContainer.innerHTML = `
        <a href="javascript:void(0)" onclick="window.SparkMarg.navigateTo('login')" class="btn btn-sm btn-outline" id="nav-login-btn">Log In</a>
        <a href="javascript:void(0)" onclick="window.SparkMarg.navigateTo('register')" class="btn btn-sm btn-primary" id="nav-register-btn">Sign Up</a>
      `;
    }
    const navAuth = document.getElementById('navAuthSection');
    const userMenu = document.getElementById('userProfileMenu');
    if (navAuth && userMenu) {
      navAuth.classList.remove('hidden');
      userMenu.classList.add('hidden');
    }
  },

  async logout() {
    localStorage.removeItem('access_token');
    this.showAlert('Logged out successfully', 'success');
    setTimeout(() => { this.navigateTo('login'); }, 1000);
  },

  setupNavigation() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      if (link.getAttribute('href') === currentPath) {
        link.classList.add('active');
      }
    });
    const hamburgerToggle = document.getElementById('hamburgerToggle');
    const navMenu = document.getElementById('navMenu');
    if (hamburgerToggle && navMenu) {
      const toggleMobileMenu = () => {
        hamburgerToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
        const isExpanded = hamburgerToggle.classList.contains('active');
        hamburgerToggle.setAttribute('aria-expanded', isExpanded);
        document.body.style.overflow = isExpanded ? 'hidden' : '';
      };
      hamburgerToggle.addEventListener('click', toggleMobileMenu);
      navLinks.forEach(link => {
        link.addEventListener('click', () => {
          if (navMenu.classList.contains('active')) toggleMobileMenu();
        });
      });
    }
  },

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

  showAlert(message, type = 'danger', containerId = 'alert-container') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.className = `alert alert-${type} animate-slide-down`;
    container.textContent = message;
    container.style.display = 'block';
    setTimeout(() => { container.style.display = 'none'; }, 4000);
  },

  async apiRequest(url, options = {}) {
    const token = localStorage.getItem('access_token'); 
    
    const headers = Object.assign({
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    }, options.headers || {});

    if (token && token !== 'undefined') {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let body = options.body;
    if (body && typeof body === 'object' && !(body instanceof FormData)) {
      body = JSON.stringify(body);
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }

    const config = { 
      ...options, 
      headers: headers,
      body: body,
      credentials: options.credentials || 'include',
      redirect: 'manual'
    };

    try {
      const response = await fetch(url, config);

      if (response.status === 0 || response.type === 'opaqueredirect') {
        this.showSessionExpiredOverlay();
        localStorage.removeItem('access_token');
        throw new Error('Cloud Shell session expired. Please refresh your browser.');
      }

      const isJson = response.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) throw new Error(data.error || data || `HTTP ${response.status}`);
      return data;
    } catch (error) {
      if (error.message.includes('Cloud Shell session expired')) {
        this.showSessionExpiredOverlay();
      } else {
        console.error('API Request failed:', error);
      }
      throw error;
    }
  },

  showSessionExpiredOverlay() {
    if (document.getElementById('cloud-shell-expired-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'cloud-shell-expired-overlay';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '99999',
      backgroundColor: 'rgba(15, 23, 42, 0.98)', color: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: '2rem', backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)'
    });

    overlay.innerHTML = `
      <div style="max-width: 480px; font-family: system-ui, -apple-system, sans-serif;">
        <div style="font-size: 5rem; color: #f59e0b; margin-bottom: 1.5rem;">⚠️</div>
        <h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 1rem; color: #fff;">Environment Session Expired</h2>
        <p style="font-size: 1.1rem; color: #94a3b8; margin-bottom: 2.0rem; line-height: 1.6;">
          Your Google Cloud Shell preview session has timed out. If refreshing doesn't work, please close this tab and click "Web Preview" again from the Cloud Shell terminal.
        </p>
        <button onclick="window.location.href = window.location.origin" style="background: #3b82f6; color: white; border: none; padding: 1rem 2.5rem; border-radius: 0.5rem; font-weight: 600; cursor: pointer; font-size: 1.1rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">Refresh Session</button>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
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

document.addEventListener('DOMContentLoaded', async () => { 
  window.SparkMarg.init();
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