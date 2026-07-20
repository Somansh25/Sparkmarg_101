/**
 * SparkMarg — Interactive Single Page Application (SPA) Controller
 * Handles SPA Routing, Auth Flow, Catalog Management, Sandbox Engine & Dashboard Analytics
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // 1. APPLICATION STATE MANAGEMENT
    // ==========================================================================
    const state = {
        user: null,
        simulations: [],
        filteredSimulations: [],
        activeSimulation: null,
        activeNodeId: null,
        currentHistoryId: null,
        selectedChoice: null,
        activeDomain: 'ALL',
        searchQuery: ''
    };

    // ==========================================================================
    // 2. DOM ELEMENT CACHING
    // ==========================================================================
    const elements = {
        // Navigation & Auth Controls
        navLinks: document.querySelectorAll('.nav-link, [data-page]'),
        navMenu: document.getElementById('nav-menu'),
        hamburgerBtn: document.getElementById('hamburger-btn'),
        themeToggleBtn: document.getElementById('theme-toggle-btn'),
        themeIconDark: document.querySelector('.theme-icon-dark'),
        themeIconLight: document.querySelector('.theme-icon-light'),
        authLoggedOut: document.getElementById('auth-actions-logged-out'),
        authLoggedIn: document.getElementById('auth-actions-logged-in'),
        btnOpenLogin: document.getElementById('btn-open-login'),
        btnOpenRegister: document.getElementById('btn-open-register'),
        btnLogout: document.getElementById('btn-logout'),
        navLinkDashboard: document.getElementById('nav-link-dashboard'),
        profileDropdownTrigger: document.getElementById('profile-dropdown-trigger'),
        profileDropdown: document.getElementById('profile-dropdown'),
        userAvatarInitials: document.getElementById('user-avatar-initials'),
        userDisplayName: document.getElementById('user-display-name'),
        userDisplayEmail: document.getElementById('user-display-email'),

        // SPA Pages
        pages: document.querySelectorAll('.spa-page'),

        // Toast Container
        alertContainer: document.getElementById('alert-container'),

        // Modal Elements
        authModal: document.getElementById('auth-modal'),
        modalTitle: document.getElementById('modal-title'),
        modalCloseBtn: document.getElementById('modal-close-btn'),
        tabLogin: document.getElementById('tab-login'),
        tabRegister: document.getElementById('tab-register'),
        formLogin: document.getElementById('form-login'),
        formRegister: document.getElementById('form-register'),

        // Catalog Elements
        catalogSearch: document.getElementById('catalog-search'),
        domainFilters: document.getElementById('domain-filters'),
        catalogGrid: document.getElementById('catalog-grid'),

        // Dashboard Elements
        dashStatCompleted: document.getElementById('dash-stat-completed'),
        dashStatScore: document.getElementById('dash-stat-score'),
        dashSkillsList: document.getElementById('dash-skills-list'),
        dashHistoryList: document.getElementById('dash-history-list'),

        // Simulation Sandbox Elements
        simActiveTitle: document.getElementById('sim-active-title'),
        simActiveDomain: document.getElementById('sim-active-domain'),
        simInteractiveCard: document.getElementById('sim-interactive-card')
    };

    // ==========================================================================
    // 3. INITIALIZATION & ROUTING
    // ==========================================================================
    function init() {
        initTheme();
        setupEventListeners();
        checkAuthSession();
        handleHashRouting();
    }

    function navigateTo(pageId) {
        elements.pages.forEach((page) => {
        if (page.id === `page-${pageId}`) {
            page.classList.add('active');
        } else {
            page.classList.remove('active');
        }
        });

        document.querySelectorAll('.nav-link').forEach((link) => {
        if (link.getAttribute('data-page') === pageId) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
        });

        if (elements.navMenu.classList.contains('active')) {
        elements.navMenu.classList.remove('active');
        elements.hamburgerBtn.classList.remove('active');
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Page Specific Load Hooks
        if (pageId === 'catalog') {
        loadCatalog();
        } else if (pageId === 'dashboard') {
        if (!state.user) {
            showAlert('Please log in to access your Command Center.', 'warning');
            window.location.hash = '#home';
            return;
        }
        loadDashboard();
        }
    }

    function handleHashRouting() {
        const hash = window.location.hash.replace('#', '') || 'home';
        const validPages = ['home', 'catalog', 'dashboard', 'simulation'];
        if (validPages.includes(hash)) {
        navigateTo(hash);
        } else {
        navigateTo('home');
        }
    }

    window.addEventListener('hashchange', handleHashRouting);

    // ==========================================================================
    // 4. THEME & TOAST UTILITIES
    // ==========================================================================
    function initTheme() {
        const savedTheme = localStorage.getItem('sparkmarg_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('sparkmarg_theme', newTheme);
        updateThemeIcon(newTheme);
    }

    function isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    function updateThemeIcon(theme) {
        if (theme === 'dark') {
        elements.themeIconDark.style.display = 'inline';
        elements.themeIconLight.style.display = 'none';
        } else {
        elements.themeIconDark.style.display = 'none';
        elements.themeIconLight.style.display = 'inline';
        }
    }

    function showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} fade-in`;
        alert.innerHTML = `<span>${message}</span>`;
        
        elements.alertContainer.appendChild(alert);

        setTimeout(() => {
        alert.style.opacity = '0';
        alert.style.transform = 'translateY(-10px)';
        setTimeout(() => alert.remove(), 300);
        }, 4000);
    }

    // ==========================================================================
    // 5. AUTHENTICATION CONTROLLER
    // ==========================================================================
    async function checkAuthSession() {
        try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (res.ok && data.user) {
            setAuthenticatedState(data.user);
        } else {
            setUnauthenticatedState();
        }
        } catch (err) {
        setUnauthenticatedState();
        }
    }

    function setAuthenticatedState(user) {
        state.user = user;
        elements.authLoggedOut.style.display = 'none';
        elements.authLoggedIn.style.display = 'flex';
        elements.navLinkDashboard.style.display = 'inline-block';

        const name = user.name || 'User';
        elements.userDisplayName.textContent = name;
        elements.userDisplayEmail.textContent = user.email || '';
        elements.userAvatarInitials.textContent = name.charAt(0).toUpperCase();
    }

    function setUnauthenticatedState() {
        state.user = null;
        elements.authLoggedOut.style.display = 'flex';
        elements.authLoggedIn.style.display = 'none';
        elements.navLinkDashboard.style.display = 'none';
    }

    function openAuthModal(tab = 'login') {
        elements.authModal.classList.add('active');
        switchAuthTab(tab);
    }

    function closeAuthModal() {
        elements.authModal.classList.remove('active');
    }

    function switchAuthTab(tab) {
        if (tab === 'login') {
        elements.tabLogin.classList.add('active');
        elements.tabRegister.classList.remove('active');
        elements.formLogin.style.display = 'flex';
        elements.formRegister.style.display = 'none';
        elements.modalTitle.textContent = 'Sign In to SparkMarg';
        } else {
        elements.tabRegister.classList.add('active');
        elements.tabLogin.classList.remove('active');
        elements.formRegister.style.display = 'flex';
        elements.formLogin.style.display = 'none';
        elements.modalTitle.textContent = 'Create Your Account';
        }
    }

    // ==========================================================================
    // 6. SIMULATION CATALOG CONTROLLER
    // ==========================================================================
    async function loadCatalog() {
        try {
        const res = await fetch('/api/simulations');
        const data = await res.json();
        if (res.ok) {
            state.simulations = data.simulations || [];
            filterAndRenderCatalog();
        } else {
            elements.catalogGrid.innerHTML = `<p class="text-danger">Failed to load simulations.</p>`;
        }
        } catch (err) {
        elements.catalogGrid.innerHTML = `<p class="text-danger">Network error connecting to catalog server.</p>`;
        }
    }

    function filterAndRenderCatalog() {
        let list = state.simulations;

        if (state.activeDomain !== 'ALL') {
        list = list.filter((sim) => sim.domain === state.activeDomain);
        }

        if (state.searchQuery.trim() !== '') {
        const q = state.searchQuery.toLowerCase();
        list = list.filter(
            (sim) =>
            sim.title.toLowerCase().includes(q) ||
            sim.description.toLowerCase().includes(q) ||
            (sim.tags && sim.tags.some((t) => t.toLowerCase().includes(q)))
        );
        }

        state.filteredSimulations = list;
        renderCatalogGrid(list);
    }

    function renderCatalogGrid(list) {
        if (list.length === 0) {
        elements.catalogGrid.innerHTML = `
            <div class="glass" style="grid-column: 1/-1; padding: var(--space-8); text-align: center;">
            <p class="text-muted">No simulations found matching your criteria.</p>
            </div>`;
        return;
        }

        elements.catalogGrid.innerHTML = list
        .map(
            (sim) => `
        <div class="simulation-catalog-card">
            <div class="card-body">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
                <span class="badge-medium">${sim.domain || 'TECH'}</span>
                <span class="catalog-card-difficulty badge-${(sim.difficulty || 'medium').toLowerCase()}">${sim.difficulty || 'Medium'}</span>
            </div>
            <h3 class="card-title">${sim.title}</h3>
            <p class="card-description">${sim.description}</p>
            </div>
            <div class="catalog-card-footer">
            <span class="catalog-card-tech">${sim.tags ? sim.tags.join(' • ') : ''}</span>
            <button class="btn btn-primary btn-sm btn-start-sim" data-sim-id="${sim.id}">Launch →</button>
            </div>
        </div>
        `
        )
        .join('');

        document.querySelectorAll('.btn-start-sim').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const simId = e.currentTarget.getAttribute('data-sim-id');
            startSimulationSession(simId);
        });
        });
    }

    // ==========================================================================
    // 7. INTERACTIVE SANDBOX ENGINE
    // ==========================================================================
    async function startSimulationSession(simId) {
        if (!state.user) {
        showAlert('Please log in or register to launch a simulation session.', 'warning');
        openAuthModal('login');
        return;
        }

        try {
        const res = await fetch('/api/simulations/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ simulation_id: simId })
        });

        const data = await res.json();
        if (res.ok) {
            state.activeSimulation = data.simulation;
            state.activeNodeId = data.start_node_id;
            state.currentHistoryId = data.history_id;
            
            elements.simActiveTitle.textContent = state.activeSimulation.title;
            elements.simActiveDomain.textContent = state.activeSimulation.domain;
            
            window.location.hash = '#simulation';
            renderCurrentNode();
        } else {
            showAlert(data.message || 'Error launching simulation.', 'danger');
        }
        } catch (err) {
        showAlert('Server error initiating sandbox execution.', 'danger');
        }
    }

    function renderCurrentNode() {
        const node = state.activeSimulation.nodes[state.activeNodeId];
        if (!node) {
        showAlert('Simulation state node execution fault.', 'danger');
        return;
        }

        if (node.is_terminal) {
        renderCompletionNode(node);
        return;
        }

        elements.simInteractiveCard.innerHTML = `
        <div class="node-text fade-in">${node.text}</div>
        <div id="choices-wrapper" class="choices-container fade-in delay-1">
            ${node.choices
            .map(
                (choice, idx) => `
            <div class="sim-option-card" data-choice-id="${choice.id}">
                <span style="font-weight: 700; color: var(--primary);">${String.fromCharCode(65 + idx)}.</span>
                <div>
                <div style="font-weight: 600; color: var(--text-main);">${choice.label}</div>
                <div style="font-size: var(--fs-xs); color: var(--text-muted); margin-top: var(--space-1);">${choice.description || ''}</div>
                </div>
            </div>
            `
            )
            .join('')}
        </div>
        <div style="margin-top: var(--space-6); text-align: right;">
            <button id="btn-submit-choice" class="btn btn-primary" disabled>Submit Decision →</button>
        </div>
        `;

        state.selectedChoice = null;
        const choiceCards = elements.simInteractiveCard.querySelectorAll('.sim-option-card');
        const submitBtn = elements.simInteractiveCard.querySelector('#btn-submit-choice');

        choiceCards.forEach((card) => {
        card.addEventListener('click', () => {
            choiceCards.forEach((c) => c.classList.remove('selected'));
            card.classList.add('selected');
            state.selectedChoice = card.getAttribute('data-choice-id');
            submitBtn.disabled = false;
        });
        });

        submitBtn.addEventListener('click', () => {
        if (state.selectedChoice) {
            submitDecision(state.selectedChoice);
        }
        });
    }

    async function submitDecision(choiceId) {
        try {
        const res = await fetch('/api/simulations/step', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            history_id: state.currentHistoryId,
            node_id: state.activeNodeId,
            choice_id: choiceId
            })
        });

        const data = await res.json();
        if (res.ok) {
            renderFeedbackStep(data);
        } else {
            showAlert(data.message || 'Error advancing simulation.', 'danger');
        }
        } catch (err) {
        showAlert('Failed to transmit decision vector.', 'danger');
        }
    }

    function renderFeedbackStep(data) {
        elements.simInteractiveCard.innerHTML = `
        <div class="sim-feedback-box fade-in">
            <h4 style="font-size: var(--fs-md); font-weight: 700; margin-bottom: var(--space-2); color: var(--text-main);">Decision Analysis</h4>
            <p style="color: var(--text-muted); line-height: 1.6;">${data.feedback}</p>
        </div>
        <div style="margin-top: var(--space-6); text-align: right;">
            <button id="btn-continue-step" class="btn btn-primary">Proceed to Next Phase →</button>
        </div>
        `;

        document.getElementById('btn-continue-step').addEventListener('click', () => {
        state.activeNodeId = data.next_node_id;
        renderCurrentNode();
        });
    }

    function renderCompletionNode(node) {
        elements.simInteractiveCard.innerHTML = `
        <div class="fade-in" style="text-align: center; padding: var(--space-4) 0;">
            <div style="font-size: 3.5rem; margin-bottom: var(--space-2);">🎉</div>
            <h2 style="font-size: var(--fs-2xl); font-weight: 800; color: var(--text-main); margin-bottom: var(--space-2);">Simulation Complete!</h2>
            <p class="node-text" style="max-width: 600px; margin: 0 auto var(--space-6);">${node.text}</p>
            
            <div class="score-breakdown glass">
            <h4 style="font-weight: 700; margin-bottom: var(--space-4);">Final Performance Metrics</h4>
            <div class="completion-grid">
                <div class="score-delta-item">
                <span class="score-delta-label">Overall Alignment</span>
                <span class="score-delta-value">${node.score || 90}%</span>
                </div>
                <div class="score-delta-item">
                <span class="score-delta-label">Status</span>
                <span class="score-delta-value" style="color: var(--success);">Passed</span>
                </div>
            </div>
            </div>

            <div style="margin-top: var(--space-8); display: flex; justify-content: center; gap: var(--space-4);">
            <a href="#dashboard" class="btn btn-primary" data-page="dashboard">View Command Center</a>
            <a href="#catalog" class="btn btn-secondary" data-page="catalog">Try Another Simulation</a>
            </div>
        </div>
        `;
    }

    // ==========================================================================
    // 8. DASHBOARD ANALYTICS CONTROLLER
    // ==========================================================================
    async function loadDashboard() {
        try {
        const res = await fetch('/api/user/dashboard');
        const data = await res.json();
        if (res.ok) {
            renderDashboardData(data);
        } else {
            showAlert('Failed to retrieve dashboard telemetry.', 'danger');
        }
        } catch (err) {
        showAlert('Network error fetching dashboard history.', 'danger');
        }
    }

    function renderDashboardData(data) {
        elements.dashStatCompleted.textContent = data.completed_count || 0;
        elements.dashStatScore.textContent = `${data.avg_score || 0}%`;

        // Render Skills Competencies
        if (data.skills && Object.keys(data.skills).length > 0) {
        elements.dashSkillsList.innerHTML = Object.entries(data.skills)
            .map(
            ([skill, level]) => `
            <div class="skill-item">
            <span class="skill-name">${skill}</span>
            <span class="skill-value">${level}%</span>
            </div>
        `
            )
            .join('');
        } else {
        elements.dashSkillsList.innerHTML = `<p class="text-muted text-sm">No evaluated competencies yet.</p>`;
        }

        // Render History Stream
        if (data.history && data.history.length > 0) {
        elements.dashHistoryList.innerHTML = data.history
            .map(
            (item) => `
            <div class="dashboard-stream-row">
            <div class="stream-row-meta">
                <div class="stream-row-title">${item.simulation_title || 'Simulation'}</div>
                <div class="stream-row-subtext">Completed on ${new Date(item.updated_at).toLocaleDateString()}</div>
            </div>
            <div>
                <span class="stream-row-tag">${item.status}</span>
            </div>
            </div>
        `
            )
            .join('');
        } else {
        elements.dashHistoryList.innerHTML = `<p class="text-muted text-center" style="padding: var(--space-6);">No simulation history found. Launch a simulation to begin tracking.</p>`;
        }
    }

    // ==========================================================================
    // 9. EVENT LISTENERS
    // ==========================================================================
    function setupEventListeners() {
        // Theme Toggle
        elements.themeToggleBtn.addEventListener('click', toggleTheme);

        // Navigation Drawer
        elements.hamburgerBtn.addEventListener('click', () => {
        elements.hamburgerBtn.classList.toggle('active');
        elements.navMenu.classList.toggle('active');
        });

        // Profile Dropdown
        if (elements.profileDropdownTrigger) {
        elements.profileDropdownTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.profileDropdown.classList.toggle('dropdown-hidden');
        });
        document.addEventListener('click', () => {
            if (elements.profileDropdown) {
            elements.profileDropdown.classList.add('dropdown-hidden');
            }
        });
        }

        // Modal Triggers & Controls
        elements.btnOpenLogin.addEventListener('click', () => openAuthModal('login'));
        elements.btnOpenRegister.addEventListener('click', () => openAuthModal('register'));
        elements.modalCloseBtn.addEventListener('click', closeAuthModal);
        elements.tabLogin.addEventListener('click', () => switchAuthTab('login'));
        elements.tabRegister.addEventListener('click', () => switchAuthTab('register'));

        elements.authModal.addEventListener('click', (e) => {
            if (e.target.classList.contains('password-toggle')) {
                const input = e.target.parentElement.querySelector('input');
                if (input.type === 'password') {
                    input.type = 'text';
                    e.target.textContent = '🙈';
                } else {
                    input.type = 'password';
                    e.target.textContent = '👁️';
                }
            }
        if (e.target === elements.authModal) closeAuthModal();
        });

        // Auth Forms Submission
        elements.formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');

        if (!email || !password) {
            showAlert('Please fill in all fields.', 'warning');
            return;
        }

        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Authenticating...';

        try {
            const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (res.ok) {
                if (data.access_token) {
                    localStorage.setItem('access_token', data.access_token);
                }
            showAlert('Welcome back!', 'success');
                setAuthenticatedState(data.user);
            closeAuthModal();
            } else {
            showAlert(data.message || 'Login failed.', 'danger');
            }
        } catch (err) {
            showAlert('Server connection error during authentication.', 'danger');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
        });

        elements.formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');

        if (!fullName || !email || !password) {
            showAlert('All fields are required.', 'warning');
            return;
        }
        if (!isValidEmail(email)) {
            showAlert('Please enter a valid email address.', 'warning');
            return;
        }
        if (password.length < 6) {
            showAlert('Password must be at least 6 characters.', 'warning');
            return;
        }

        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating Account...';

        try {
            const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: fullName, email, password })
            });
            const data = await res.json();
            if (res.ok) {
            showAlert('Account created successfully!', 'success');
            setAuthenticatedState(data.user);
            closeAuthModal();
            } else {
            showAlert(data.message || 'Registration failed.', 'danger');
            }
        } catch (err) {
            showAlert('Server connection error during registration.', 'danger');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
        });

        // Logout
        elements.btnLogout.addEventListener('click', async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            setUnauthenticatedState();
            showAlert('You have been logged out.', 'info');
            window.location.hash = '#home';
        } catch (err) {
            showAlert('Logout error.', 'danger');
        }
        });

        // Catalog Domain Pills Filter
        elements.domainFilters.querySelectorAll('.domain-pill').forEach((pill) => {
        pill.addEventListener('click', (e) => {
            elements.domainFilters.querySelectorAll('.domain-pill').forEach((p) => p.classList.remove('active'));
            e.target.classList.add('active');
            state.activeDomain = e.target.getAttribute('data-domain');
            filterAndRenderCatalog();
        });
        });

        // Catalog Search Input
        elements.catalogSearch.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        filterAndRenderCatalog();
        });
    }

    init();
});