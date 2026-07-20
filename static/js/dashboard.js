/* =====================================================================
   SparkMarg Analytics & Progress Dashboard Engine
   ===================================================================== */

const dashboardController = {
    userStats: null,
    inProgressSims: [],
    completedSims: [],

    /**
     * Initialize dashboard metrics and active simulations lists
     */
    async init() {
      if (!localStorage.getItem('access_token')) {
         window.SparkMarg.navigateTo('login');
         return;
      }
      await this.loadDashboardData();
    },

    /**
     * Fetch aggregate metrics and user simulation state from API
     */
    async loadDashboardData() {
      try {
        const [stats, active, history] = await Promise.all([
          window.SparkMarg.apiRequest('/api/v1/analytics/overview'),
          window.SparkMarg.apiRequest('/api/v1/progress/active'),
          window.SparkMarg.apiRequest('/api/v1/progress/history')
        ]);

        this.userStats = stats;
        this.inProgressSims = active;
        this.completedSims = history;

        this.renderMetricsOverview();
        this.renderInProgressSection();
        this.renderCompletedSection();
      } catch (error) {
        if (error.message.includes('401') || error.message.includes('status: 401')) {
            localStorage.removeItem('access_token');
            window.SparkMarg.navigateTo('login');
            return;
        }
        window.SparkMarg.showAlert(`Failed to populate dashboard: ${error.message}`, 'danger');
      }
    },

    /**
     * Render total scores and aggregate performance breakdown
     */
    renderMetricsOverview() {
      const { scores, total_completed, total_in_progress } = this.userStats || {};

      const countCompleted = document.getElementById('dash-completed-count');
      const countActive = document.getElementById('dash-active-count');

      if (countCompleted) countCompleted.textContent = total_completed || 0;
      if (countActive) countActive.textContent = total_in_progress || 0;

      const leadVal = document.getElementById('stat-leadership');
      const techVal = document.getElementById('stat-technical');
      const probVal = document.getElementById('stat-problem-solving');
      const commVal = document.getElementById('stat-communication');

      if (leadVal) leadVal.textContent = scores?.leadership || 0;
      if (techVal) techVal.textContent = scores?.technical || 0;
      if (probVal) probVal.textContent = scores?.problem_solving || 0;
      if (commVal) commVal.textContent = scores?.communication || 0;
    },

    /**
     * Render scenarios currently in progress
     */
    renderInProgressSection() {
      const container = document.getElementById('in-progress-container');
      if (!container) return;

      if (!this.inProgressSims || this.inProgressSims.length === 0) {
        container.innerHTML = `
          <div class="card text-center p-4">
            <p class="text-muted">No active simulations. Explore the catalog to jump in!</p>
            <a href="/catalog" class="btn btn-outline btn-sm">Browse Scenarios</a>
          </div>
        `;
        return;
      }

      container.innerHTML = this.inProgressSims.map(sim => `
        <div class="dashboard-stream-row animate-fade-in">
          <div class="stream-row-meta">
            <div>
              <span class="badge d-inline-block me-2">${window.SparkMarg.escapeHtml(sim.domain)}</span>
              <span class="stream-row-subtext">Last played ${window.SparkMarg.escapeHtml(new Date(sim.updated_at).toLocaleDateString())}</span>
            </div>
            <h4 class="stream-row-title mt-1">${window.SparkMarg.escapeHtml(sim.title)}</h4>
          </div>
          <a href="javascript:void(0)" onclick="window.SparkMarg.navigateTo('simulation?id=${window.SparkMarg.escapeHtml(sim.simulation_id)}')" class="btn btn-primary btn-sm">Resume</a>
        </div>
      `).join('');
    },

    /**
     * Render completed history log with score breakdowns
     */
    renderCompletedSection() {
      const container = document.getElementById('completed-container');
      if (!container) return;

      if (!this.completedSims || this.completedSims.length === 0) {
        container.innerHTML = `
          <div class="card text-center p-4">
            <p class="text-muted">No completed scenarios recorded yet.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = this.completedSims.map(sim => `
        <div class="card p-3 animate-fade-in mb-3">
          <div class="catalog-card-header">
            <div>
              <h4 class="stream-row-title">${window.SparkMarg.escapeHtml(sim.title)}</h4>
              <span class="stream-row-subtext">Completed on ${window.SparkMarg.escapeHtml(new Date(sim.completed_at).toLocaleDateString())}</span>
            </div>
            <span class="badge difficulty-medium">Completed</span>
          </div>

          <div class="grid grid-4 score-breakdown mt-2">
            <div class="score-delta-item">
              <span class="score-delta-label">Lead</span>
              <strong class="text-success">+${window.SparkMarg.escapeHtml(String(sim.total_scores.leadership || 0))}</strong>
            </div>
            <div class="score-delta-item">
              <span class="score-delta-label">Tech</span>
              <strong class="text-primary">+${window.SparkMarg.escapeHtml(String(sim.total_scores.technical || 0))}</strong>
            </div>
            <div class="score-delta-item">
              <span class="score-delta-label">Prob</span>
              <strong class="text-success">+${window.SparkMarg.escapeHtml(String(sim.total_scores.problem_solving || 0))}</strong>
            </div>
            <div class="score-delta-item">
              <span class="score-delta-label">Comm</span>
              <strong class="text-primary">+${window.SparkMarg.escapeHtml(String(sim.total_scores.communication || 0))}</strong>
            </div>
          </div>
        </div>
      `).join('');
    }
};

export default dashboardController;
