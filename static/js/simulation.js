// Client-side simulation engine for scenario state management
const simPlayer = {
    simId: null,
    currentSimData: null,
    currentStep: null,
    selectedOptionId: null,
    // FIXED: Cached scores state object to retain final metrics across SPA completion views
    latestScores: null,

    async init() {
      const urlParams = new URLSearchParams(window.location.search || window.location.hash.split('?')[1]);
      this.simId = urlParams.get('id');

      if (!this.simId) {
        window.SparkMarg.showAlert('No simulation scenario specified. Redirecting to catalog...', 'danger');
        setTimeout(() => { window.SparkMarg.navigateTo('catalog'); }, 2000);
        return;
      }

      this.bindEvents();
      await this.loadSimulationData();
      await this.initializeSession();
    },

    bindEvents() {
      const submitBtn = document.getElementById('submit-decision-btn');
      if (submitBtn) {
        submitBtn.addEventListener('click', () => this.handleDecisionSubmit());
      }

      const nextBtn = document.getElementById('next-step-btn');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => this.advanceToNextStep());
      }
    },

    async loadSimulationData() {
      try {
        this.currentSimData = await window.SparkMarg.apiRequest(`/api/v1/simulations/${this.simId}`);
        this.renderSimulationHeader();
      } catch (error) {
        window.SparkMarg.showAlert(`Failed to load simulation: ${error.message}`, 'danger');
      }
    },

    async initializeSession() {
      try {
        const progress = await window.SparkMarg.apiRequest(`/api/v1/progress/start/${this.simId}`, {
          method: 'POST'
        });

        this.latestScores = progress.total_scores;
        this.updateScorecardUI(progress.total_scores);

        if (progress.status === 'COMPLETED') {
          this.renderCompletionScreen(progress.total_scores);
        } else {
          this.loadStep(progress.current_step_id);
        }
      } catch (error) {
        window.SparkMarg.showAlert(`Failed to initialize session: ${error.message}`, 'danger');
      }
    },

    renderSimulationHeader() {
      const titleElem = document.getElementById('sim-title');
      const domainElem = document.getElementById('sim-domain');
      const diffElem = document.getElementById('sim-difficulty');

      if (titleElem) titleElem.textContent = this.currentSimData.title;
      if (domainElem) domainElem.textContent = this.currentSimData.domain;
      if (diffElem) {
        diffElem.textContent = this.currentSimData.difficulty;
        diffElem.className = `badge badge-${this.currentSimData.difficulty.toLowerCase()}`;
      }
    },

    loadStep(stepId) {
      this.selectedOptionId = null;
      const step = this.currentSimData.steps.find(s => s.step_id === stepId);

      if (!step) {
        window.SparkMarg.showAlert('Step configuration error. Resetting simulation...', 'danger');
        return;
      }

      this.currentStep = step;

      const feedbackBox = document.getElementById('sim-feedback-container');
      const nextBtn = document.getElementById('next-step-btn');
      const submitBtn = document.getElementById('submit-decision-btn');

      if (feedbackBox) feedbackBox.style.display = 'none';
      if (nextBtn) nextBtn.style.display = 'none';
      if (submitBtn) {
        submitBtn.style.display = 'inline-flex';
        submitBtn.disabled = true;
      }

      const stepTitle = document.getElementById('step-title');
      const stepScenario = document.getElementById('step-scenario');
      const optionsContainer = document.getElementById('options-container');

      if (stepTitle) stepTitle.textContent = step.title;
      if (stepScenario) stepScenario.textContent = step.scenario;

      if (optionsContainer) {
        optionsContainer.innerHTML = '';
        step.options.forEach((opt, idx) => {
          const card = document.createElement('div');
          card.className = 'sim-option-card animate-slide-up';
          card.style.animationDelay = `${idx * 100}ms`;
          card.dataset.optionId = opt.option_id;

          card.innerHTML = `
            <div style="font-weight: 700; color: var(--accent); min-width: 24px;">
              ${String.fromCharCode(65 + idx)}.
            </div>
            <div style="flex: 1;">
              <p style="font-size: 0.95rem; color: var(--text-main); line-height: 1.5;">
                ${window.SparkMarg.escapeHtml(opt.text)}
              </p>
            </div>
          `;

          card.addEventListener('click', () => this.selectOption(opt.option_id, card));
          optionsContainer.appendChild(card);
        });
      }
    },

    selectOption(optionId, cardElem) {
      this.selectedOptionId = optionId;

      document.querySelectorAll('.sim-option-card').forEach(c => {
        c.classList.remove('selected');
      });
      cardElem.classList.add('selected');

      const submitBtn = document.getElementById('submit-decision-btn');
      if (submitBtn) submitBtn.disabled = false;
    },

    async handleDecisionSubmit() {
      if (!this.selectedOptionId) return;

      const submitBtn = document.getElementById('submit-decision-btn');
      if (submitBtn) submitBtn.disabled = true;

      try {
        const result = await window.SparkMarg.apiRequest(`/api/v1/progress/${this.simId}/decision`, {
          method: 'POST',
          body: {
            simulation_id: this.simId,
            step_id: this.currentStep.step_id,
            option_id: this.selectedOptionId
          }
        });

        this.latestScores = result.updated_total_scores;
        this.renderDecisionFeedback(result);
        this.updateScorecardUI(result.updated_total_scores);

        if (result.status === 'COMPLETED') {
          const nextBtn = document.getElementById('next-step-btn');
          if (nextBtn) {
            nextBtn.textContent = 'View Final Results';
            nextBtn.dataset.completed = 'true';
            nextBtn.style.display = 'inline-flex';
          }
        } else {
          const nextBtn = document.getElementById('next-step-btn');
          if (nextBtn) {
            nextBtn.dataset.nextStepId = result.next_step_id;
            nextBtn.style.display = 'inline-flex';
          }
        }
      } catch (error) {
        window.SparkMarg.showAlert(`Decision processing error: ${error.message}`, 'danger');
        if (submitBtn) submitBtn.disabled = false;
      }
    },

    renderDecisionFeedback(result) {
      const feedbackBox = document.getElementById('sim-feedback-container');
      const feedbackText = document.getElementById('sim-feedback-text');
      const submitBtn = document.getElementById('submit-decision-btn');

      if (submitBtn) submitBtn.style.display = 'none';

      if (feedbackText) feedbackText.textContent = result.feedback;
      if (feedbackBox) {
        feedbackBox.className = 'sim-feedback-box animate-scale-up';
        feedbackBox.style.display = 'block';
      }
    },

    // FIXED: Render completion view using cached scores instead of forcing a window.location.reload()
    advanceToNextStep() {
      const nextBtn = document.getElementById('next-step-btn');
      if (nextBtn && nextBtn.dataset.completed === 'true') {
        this.renderCompletionScreen(this.latestScores || {});
      } else if (nextBtn && nextBtn.dataset.nextStepId) {
        this.loadStep(nextBtn.dataset.nextStepId);
      }
    },

    updateScorecardUI(scores) {
      if (!scores) return;

      const lead = document.getElementById('score-leadership');
      const tech = document.getElementById('score-technical');
      const prob = document.getElementById('score-problem-solving');
      const comm = document.getElementById('score-communication');

      if (lead) lead.textContent = scores.leadership || 0;
      if (tech) tech.textContent = scores.technical || 0;
      if (prob) prob.textContent = scores.problem_solving || 0;
      if (comm) comm.textContent = scores.communication || 0;
    },

    renderCompletionScreen(finalScores) {
      const mainPlayer = document.getElementById('sim-player-card');
      if (!mainPlayer) return;

      mainPlayer.innerHTML = '';
      const container = document.createElement('div');
      container.style.textAlign = 'center';
      container.style.padding = '2.5rem 1rem';
      container.className = 'animate-scale-up';

      const emoji = document.createElement('div');
      emoji.style.fontSize = '3rem';
      emoji.style.marginBottom = '1rem';
      emoji.textContent = '🎉';

      const title = document.createElement('h2');
      title.style.fontSize = '1.75rem';
      title.style.fontWeight = '700';
      title.style.color = 'var(--text-main)';
      title.style.marginBottom = '0.5rem';
      title.textContent = 'Simulation Completed!';

      const desc = document.createElement('p');
      desc.style.color = 'var(--text-muted)';
      desc.style.maxWidth = '500px';
      desc.style.margin = '0 auto 2rem auto';
      desc.innerHTML = `You have successfully navigated all scenario nodes for <strong>${window.SparkMarg.escapeHtml(this.currentSimData.title)}</strong>.`;

      const grid = document.createElement('div');
      grid.className = 'grid grid-4';
      grid.style.marginBottom = '2rem';

      const scoreItems = [
        { label: 'Leadership', val: finalScores.leadership || 0, color: 'var(--primary)' },
        { label: 'Technical', val: finalScores.technical || 0, color: 'var(--accent)' },
        { label: 'Problem Solving', val: finalScores.problem_solving || 0, color: 'var(--success)' },
        { label: 'Communication', val: finalScores.communication || 0, color: 'var(--warning)' }
      ];

      scoreItems.forEach(item => {
        const box = document.createElement('div');
        box.style.background = 'var(--bg-input)';
        box.style.padding = '1rem';
        box.style.borderRadius = 'var(--radius-md)';
        box.innerHTML = `
          <div style="font-size: 0.8rem; color: var(--text-muted);">${item.label}</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: ${item.color};">${item.val}</div>
        `;
        grid.appendChild(box);
      });

      const btnGroup = document.createElement('div');
      btnGroup.style.display = 'flex';
      btnGroup.style.gap = '1rem';
      btnGroup.style.justifyContent = 'center';

      const catBtn = document.createElement('a');
      catBtn.href = 'javascript:void(0)';
      catBtn.onclick = () => window.SparkMarg.navigateTo('catalog');
      catBtn.className = 'btn btn-secondary';
      catBtn.textContent = 'Explore Catalog';

      const dashBtn = document.createElement('a');
      dashBtn.href = 'javascript:void(0)';
      dashBtn.onclick = () => window.SparkMarg.navigateTo('dashboard');
      dashBtn.className = 'btn btn-primary';
      dashBtn.textContent = 'Go to Dashboard';

      btnGroup.appendChild(catBtn);
      btnGroup.appendChild(dashBtn);
      container.appendChild(emoji);
      container.appendChild(title);
      container.appendChild(desc);
      container.appendChild(grid);
      container.appendChild(btnGroup);
      mainPlayer.appendChild(container);
    }
};

export default simPlayer;