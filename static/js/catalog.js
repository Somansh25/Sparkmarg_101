/* =====================================================================
   SparkMarg Simulation Catalog & Search Engine
   ===================================================================== */

const catalogController = {
    simulations: [],
    filteredSimulations: [],
    activeDomain: 'ALL',
    searchQuery: '',

    /**
     * Initialize catalog data and setup filters
     */
    async init() {
      this.bindEvents();
      await this.fetchCatalog();
    },

    /**
     * Bind DOM interaction listeners for search and filtering
     */
    bindEvents() {
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.searchQuery = e.target.value.toLowerCase().trim();
          this.applyFilters();
        });
      }

      const domainPills = document.querySelectorAll('.domain-pill');
      domainPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
          domainPills.forEach(p => p.classList.remove('active'));
          e.currentTarget.classList.add('active');
          this.activeDomain = e.currentTarget.dataset.domain;
          this.applyFilters();
        });
      });
    },

    /**
     * Fetch full catalog from backend API
     */
    async fetchCatalog() {
      const grid = document.getElementById('catalog-grid');
      if (grid) {
        grid.innerHTML = `
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
          <div class="skeleton skeleton-card"></div>
        `;
      }

      try {
        this.simulations = await window.SparkMarg.apiRequest('/api/v1/simulations/');
        this.applyFilters();
      } catch (error) {
        if (grid) {
          grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 0;">
              <p style="color: var(--danger);">Failed to load catalog. Please try again later.</p>
            </div>
          `;
        }
      }
    },

    /**
     * Filter simulations based on search query and selected domain
     */
    applyFilters() {
      this.filteredSimulations = this.simulations.filter(sim => {
        const matchesDomain = this.activeDomain === 'ALL' || 
                              sim.domain.toUpperCase() === this.activeDomain.toUpperCase();
        
        const matchesSearch = sim.title.toLowerCase().includes(this.searchQuery) ||
                              sim.description.toLowerCase().includes(this.searchQuery) ||
                              sim.domain.toLowerCase().includes(this.searchQuery);

        return matchesDomain && matchesSearch;
      });

      this.renderCatalogGrid();
    },

    /**
     * Render catalog cards into grid container
     */
    renderCatalogGrid() {
      const grid = document.getElementById('catalog-grid');
      if (!grid) return;

      if (this.filteredSimulations.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem;" class="animate-fade-in">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔍</div>
            <h3 style="color: var(--text-main); font-weight: 600;">No simulations found</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Try adjusting your search terms or domain filter.</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = this.filteredSimulations.map((sim, idx) => `
        <div class="card animate-slide-up" style="animation-delay: ${idx * 60}ms; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
              <span class="badge" style="background: rgba(99, 102, 241, 0.1); color: var(--primary); border: 1px solid rgba(99, 102, 241, 0.2);">
                ${window.SparkMarg.escapeHtml(sim.domain)}
              </span>
              <span class="badge badge-${window.SparkMarg.escapeHtml(sim.difficulty.toLowerCase())}">
                ${window.SparkMarg.escapeHtml(sim.difficulty)}
              </span>
            </div>

            <h3 style="font-size: 1.15rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.5rem;">
              ${window.SparkMarg.escapeHtml(sim.title)}
            </h3>

            <p style="color: var(--text-muted); font-size: 0.875rem; line-height: 1.5; margin-bottom: 1.25rem; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;">
              ${window.SparkMarg.escapeHtml(sim.description)}
            </p>
          </div>

          <div style="border-top: 1px solid var(--border); padding-top: 1rem; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.8rem; color: var(--text-muted);">
              ⏱️ ${window.SparkMarg.escapeHtml(String(sim.estimated_minutes || 15))} mins
            </span>
            <a href="javascript:void(0)" onclick="window.SparkMarg.navigateTo('simulation?id=${window.SparkMarg.escapeHtml(sim.id)}')" class="btn btn-primary btn-sm">Start Simulation</a>
          </div>
        </div>
      `).join('');
    }
};

export default catalogController;
