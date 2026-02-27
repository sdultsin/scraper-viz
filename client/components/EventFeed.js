// EventFeed.js - Scrolling event log

const ICONS = {
  activity: '●',
  filtered: '○',
  matched: '★',
  error: '⚠',
};

const MAX_ENTRIES = 50;

export class EventFeed {
  constructor(containerElement) {
    this.container = containerElement;
    this.entries = [];
    this.autoScroll = true;
    this.highlightCallback = null;
  }

  setHighlightCallback(callback) {
    this.highlightCallback = callback;
  }

  addEntry(event) {
    const entry = this.createEntry(event);
    this.entries.push(entry);

    // Limit entries
    while (this.entries.length > MAX_ENTRIES) {
      const removed = this.entries.shift();
      removed.element.remove();
    }

    this.container.appendChild(entry.element);

    if (this.autoScroll) {
      this.container.scrollTop = this.container.scrollHeight;
    }
  }

  createEntry(event) {
    const { type, source, data } = event;
    const el = document.createElement('div');
    el.className = 'feed-entry';

    let icon = ICONS.activity;
    let message = '';

    switch (type) {
      case 'agent:spawn':
        message = `agent spawned: ${data.label || data.id}`;
        break;
      case 'worker:spawn':
        message = `worker spawned: ${data.label || data.id}`;
        break;
      case 'search:start':
        message = `search:start "${data.label || data.id}"`;
        break;
      case 'search:complete':
        message = `search:complete "${data.label || data.id}"`;
        break;
      case 'listing:found':
        message = `listing:found - ${data.listing?.title?.slice(0, 40) || 'unknown'}`;
        break;
      case 'listing:filtered':
        icon = ICONS.filtered;
        el.classList.add('filtered');
        message = `listing:filtered - ${data.reason || 'unknown reason'}`;
        break;
      case 'listing:matched':
        icon = ICONS.matched;
        el.classList.add('matched');
        const listing = data.listing || {};
        const title = listing.title || listing.handle || 'unknown';
        const followers = listing.followers ? ` (${this.formatNumber(listing.followers)})` : '';
        const price = listing.price ? ` - $${listing.price}` : '';
        message = `listing:matched! ${title}${followers}${price}`;
        break;
      case 'cycle:start':
        message = '--- new cycle started ---';
        break;
      case 'cycle:end':
        message = '--- cycle complete ---';
        break;
      case 'error':
        icon = ICONS.error;
        el.classList.add('error');
        message = `error: ${data.message || 'unknown error'}`;
        break;
      default:
        message = `${type}: ${JSON.stringify(data).slice(0, 50)}`;
    }

    el.innerHTML = `
      <span class="feed-icon ${this.getIconClass(type)}">${icon}</span>
      <span class="feed-source ${source}">[${source?.toUpperCase() || 'SYS'}]</span>
      <span class="feed-message">${this.escapeHtml(message)}</span>
    `;

    // Hover to highlight node
    if (data.id && this.highlightCallback) {
      el.addEventListener('mouseenter', () => this.highlightCallback(data.id, true));
      el.addEventListener('mouseleave', () => this.highlightCallback(data.id, false));
    }

    return { element: el, event };
  }

  getIconClass(type) {
    if (type === 'listing:filtered') return 'filtered';
    if (type === 'listing:matched') return 'matched';
    if (type === 'error') return 'error';
    return 'activity';
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

  toggleAutoScroll() {
    this.autoScroll = !this.autoScroll;
    return this.autoScroll;
  }

  clear() {
    this.entries = [];
    this.container.innerHTML = '';
  }
}

export default EventFeed;
