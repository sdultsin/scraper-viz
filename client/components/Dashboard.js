// Dashboard.js - Stats panel management

export class Dashboard {
  constructor() {
    this.elements = {
      progressValue: document.getElementById('progress-value'),
      progressLabel: document.getElementById('progress-label'),
      progressRing: document.getElementById('progress-ring-fill'),
      statFound: document.getElementById('stat-found'),
      statFiltered: document.getElementById('stat-filtered'),
      statMatched: document.getElementById('stat-matched'),
      barFameswap: document.getElementById('bar-fameswap'),
      barSwapd: document.getElementById('bar-swapd'),
      barZ2u: document.getElementById('bar-z2u'),
      countFameswap: document.getElementById('count-fameswap'),
      countSwapd: document.getElementById('count-swapd'),
      countZ2u: document.getElementById('count-z2u'),
      filterList: document.getElementById('filter-list'),
      matchesList: document.getElementById('matches-list'),
      sessionTimer: document.getElementById('session-timer'),
    };

    this.stats = {
      searchesTotal: 0,
      searchesComplete: 0,
      listingsFound: 0,
      listingsFiltered: 0,
      listingsMatched: 0,
      bySource: { fameswap: 0, swapd: 0, z2u: 0 },
      filterReasons: {},
    };

    this.recentMatches = [];
    this.startTime = Date.now();
    this.timerInterval = setInterval(() => this.updateTimer(), 1000);
  }

  updateStats(stats) {
    this.stats = { ...this.stats, ...stats };
    this.render();
  }

  incrementStat(key, value = 1) {
    if (key in this.stats) {
      this.stats[key] += value;
    }
    this.render();
  }

  incrementSource(source) {
    if (source in this.stats.bySource) {
      this.stats.bySource[source]++;
    }
    this.render();
  }

  addFilterReason(reason) {
    this.stats.filterReasons[reason] = (this.stats.filterReasons[reason] || 0) + 1;
    this.render();
  }

  addMatch(match) {
    this.recentMatches.unshift(match);
    if (this.recentMatches.length > 5) {
      this.recentMatches.pop();
    }
    this.renderMatches();
  }

  setStartTime(timestamp) {
    this.startTime = timestamp;
  }

  reset() {
    this.stats = {
      searchesTotal: 0,
      searchesComplete: 0,
      listingsFound: 0,
      listingsFiltered: 0,
      listingsMatched: 0,
      bySource: { fameswap: 0, swapd: 0, z2u: 0 },
      filterReasons: {},
    };
    this.startTime = Date.now();
    this.render();
  }

  render() {
    // Progress ring
    const progress = this.stats.searchesTotal > 0
      ? this.stats.searchesComplete / this.stats.searchesTotal
      : 0;
    const percent = Math.round(progress * 100);
    const circumference = 2 * Math.PI * 52; // radius = 52
    const offset = circumference - (progress * circumference);

    this.elements.progressValue.textContent = `${percent}%`;
    this.elements.progressLabel.textContent =
      `${this.stats.searchesComplete} of ${this.stats.searchesTotal} searches`;
    this.elements.progressRing.style.strokeDashoffset = offset;

    // Stats
    this.animateValue(this.elements.statFound, this.stats.listingsFound);
    this.animateValue(this.elements.statFiltered, this.stats.listingsFiltered);
    this.animateValue(this.elements.statMatched, this.stats.listingsMatched);

    // Source bars
    const maxSource = Math.max(
      this.stats.bySource.fameswap,
      this.stats.bySource.swapd,
      this.stats.bySource.z2u,
      1
    );

    this.elements.barFameswap.style.width =
      `${(this.stats.bySource.fameswap / maxSource) * 100}%`;
    this.elements.barSwapd.style.width =
      `${(this.stats.bySource.swapd / maxSource) * 100}%`;
    this.elements.barZ2u.style.width =
      `${(this.stats.bySource.z2u / maxSource) * 100}%`;

    this.elements.countFameswap.textContent = this.stats.bySource.fameswap;
    this.elements.countSwapd.textContent = this.stats.bySource.swapd;
    this.elements.countZ2u.textContent = this.stats.bySource.z2u;

    // Filter breakdown
    this.renderFilters();
  }

  animateValue(element, value) {
    const current = parseInt(element.textContent) || 0;
    if (current !== value) {
      element.textContent = value;
      element.classList.add('bounce');
      setTimeout(() => element.classList.remove('bounce'), 200);
    }
  }

  renderFilters() {
    const sorted = Object.entries(this.stats.filterReasons)
      .sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0) {
      this.elements.filterList.innerHTML =
        '<div class="empty-state">No filters applied</div>';
      return;
    }

    this.elements.filterList.innerHTML = sorted.map(([reason, count]) => `
      <div class="filter-item">
        <span class="filter-name">${reason}</span>
        <span class="filter-count">${count}</span>
      </div>
    `).join('');
  }

  renderMatches() {
    if (this.recentMatches.length === 0) {
      this.elements.matchesList.innerHTML =
        '<div class="empty-state">No matches yet</div>';
      return;
    }

    this.elements.matchesList.innerHTML = this.recentMatches.map(match => `
      <div class="match-card">
        <div class="match-title">${this.escapeHtml(match.title || match.handle || 'Unknown')}</div>
        <div class="match-meta">
          <span class="match-source ${match.source}">${match.source}</span>
          ${match.followers ? `${this.formatNumber(match.followers)} followers` : ''}
          ${match.price ? ` - $${match.price}` : ''}
        </div>
      </div>
    `).join('');
  }

  updateTimer() {
    const elapsed = Date.now() - this.startTime;
    const hours = Math.floor(elapsed / 3600000);
    const minutes = Math.floor((elapsed % 3600000) / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);

    this.elements.sessionTimer.textContent =
      `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  destroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }
}

export default Dashboard;
