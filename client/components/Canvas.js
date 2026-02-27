// Canvas.js - Hierarchical tree visualization

const COLORS = {
  fameswap: '#6366f1',
  swapd: '#22d3ee',
  z2u: '#a855f7',
  orchestrator: '#ffffff',
  line: 'rgba(255, 255, 255, 0.2)',
  lineActive: 'rgba(255, 255, 255, 0.5)',
};

const NODE_SIZES = {
  orchestrator: 28,
  agent: { width: 80, height: 32 },
  worker: 14,
  search: { height: 20, padding: 10 },
};

const LAYOUT = {
  topMargin: 60,
  levelHeight: 90,
  nodeSpacing: 50,
  maxChildrenPerRow: 8,
};

export class Canvas {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.nodes = new Map();
    this.edges = [];
    this.animationFrame = null;
    this.time = 0;
    this.particles = [];

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Initialize with orchestrator
    this.addNode({
      id: 'orchestrator',
      type: 'orchestrator',
      label: 'Orchestrator',
    });

    this.animate();
  }

  resize() {
    const container = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = container.clientWidth * dpr;
    this.canvas.height = container.clientHeight * dpr;
    this.canvas.style.width = container.clientWidth + 'px';
    this.canvas.style.height = container.clientHeight + 'px';
    this.ctx.scale(dpr, dpr);
    this.width = container.clientWidth;
    this.height = container.clientHeight;
    this.layoutTree();
  }

  addNode(nodeData) {
    const existing = this.nodes.get(nodeData.id);
    if (existing) {
      Object.assign(existing, nodeData);
      return existing;
    }

    const node = {
      ...nodeData,
      x: this.width / 2,
      y: LAYOUT.topMargin,
      targetX: this.width / 2,
      targetY: LAYOUT.topMargin,
      opacity: 0,
      scale: 0.8,
      status: 'active',
      spawnTime: Date.now(),
    };

    this.nodes.set(nodeData.id, node);

    // Add edge to parent
    if (nodeData.parentId && this.nodes.has(nodeData.parentId)) {
      this.edges.push({
        source: nodeData.parentId,
        target: nodeData.id,
        dashOffset: 0,
        active: true,
      });
    }

    // Recalculate layout
    this.layoutTree();

    return node;
  }

  removeNode(id) {
    this.nodes.delete(id);
    this.edges = this.edges.filter(e => e.source !== id && e.target !== id);
    this.layoutTree();
  }

  updateNodeStatus(id, status) {
    const node = this.nodes.get(id);
    if (node) {
      node.status = status;
    }
  }

  layoutTree() {
    // Build parent-children map
    const children = new Map();

    for (const node of this.nodes.values()) {
      const parentId = node.parentId || null;
      if (!children.has(parentId)) {
        children.set(parentId, []);
      }
      children.get(parentId).push(node);
    }

    // Position orchestrator at top center
    const orchestrator = this.nodes.get('orchestrator');
    if (orchestrator) {
      orchestrator.targetX = this.width / 2;
      orchestrator.targetY = LAYOUT.topMargin;
    }

    // Position agents (level 1)
    const agents = children.get('orchestrator') || [];
    this.positionChildrenInRow(agents, this.width / 2, LAYOUT.topMargin + LAYOUT.levelHeight);

    // Position workers/searches under each agent (level 2+)
    for (const agent of agents) {
      const agentChildren = children.get(agent.id) || [];
      if (agentChildren.length > 0) {
        this.positionChildrenTree(agent, agentChildren, children);
      }
    }
  }

  positionChildrenInRow(nodes, centerX, y) {
    if (nodes.length === 0) return;

    const totalWidth = (nodes.length - 1) * LAYOUT.nodeSpacing * 2;
    let startX = centerX - totalWidth / 2;

    nodes.forEach((node, i) => {
      node.targetX = startX + i * LAYOUT.nodeSpacing * 2;
      node.targetY = y;
    });
  }

  positionChildrenTree(parent, directChildren, allChildren) {
    const baseY = parent.targetY + LAYOUT.levelHeight;

    // Group children by source (for coloring consistency)
    // Split into rows if too many
    const rows = [];
    let currentRow = [];

    for (const child of directChildren) {
      currentRow.push(child);
      if (currentRow.length >= LAYOUT.maxChildrenPerRow) {
        rows.push(currentRow);
        currentRow = [];
      }
    }
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    // Position each row
    rows.forEach((row, rowIndex) => {
      const rowY = baseY + rowIndex * (LAYOUT.levelHeight * 0.6);
      const totalWidth = (row.length - 1) * LAYOUT.nodeSpacing;
      const startX = parent.targetX - totalWidth / 2;

      row.forEach((node, i) => {
        node.targetX = startX + i * LAYOUT.nodeSpacing;
        node.targetY = rowY;

        // Position grandchildren
        const grandchildren = allChildren.get(node.id) || [];
        if (grandchildren.length > 0) {
          this.positionChildrenTree(node, grandchildren, allChildren);
        }
      });
    });
  }

  spawnParticle(fromId, toId, type = 'data') {
    const from = this.nodes.get(fromId);
    const to = this.nodes.get(toId);
    if (!from || !to) return;

    this.particles.push({
      x: from.targetX,
      y: from.targetY,
      targetX: to.targetX,
      targetY: to.targetY,
      progress: 0,
      type,
      color: type === 'match' ? '#10b981' : COLORS[from.source] || '#ffffff',
      size: type === 'match' ? 6 : 3,
    });
  }

  burstParticles(nodeId, count = 8) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 2 + Math.random() * 2;
      this.particles.push({
        x: node.targetX,
        y: node.targetY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        type: 'burst',
        color: '#10b981',
        size: 4,
      });
    }
  }

  updatePositions() {
    // Smoothly animate nodes to target positions
    for (const node of this.nodes.values()) {
      node.x += (node.targetX - node.x) * 0.15;
      node.y += (node.targetY - node.y) * 0.15;
    }
  }

  updateParticles() {
    this.particles = this.particles.filter(p => {
      if (p.type === 'burst') {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life -= 0.03;
        return p.life > 0;
      } else {
        p.progress += 0.03;
        p.x = p.x + (p.targetX - p.x) * 0.1;
        p.y = p.y + (p.targetY - p.y) * 0.1;
        return p.progress < 1;
      }
    });
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    this.time += 0.016;

    // Draw edges
    for (const edge of this.edges) {
      const source = this.nodes.get(edge.source);
      const target = this.nodes.get(edge.target);
      if (!source || !target) continue;

      ctx.beginPath();
      ctx.strokeStyle = edge.active ? COLORS.lineActive : COLORS.line;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      edge.dashOffset -= edge.active ? 0.3 : 0.1;
      ctx.lineDashOffset = edge.dashOffset;

      // Straight line down then curve to child
      const midY = source.y + (target.y - source.y) * 0.5;
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(source.x, midY);
      ctx.lineTo(target.x, midY);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw particles
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.type === 'burst' ? p.life : 1;
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Draw nodes (sorted by level so parents draw first)
    const sortedNodes = Array.from(this.nodes.values()).sort((a, b) => a.y - b.y);

    for (const node of sortedNodes) {
      // Animate spawn
      const age = Date.now() - node.spawnTime;
      node.opacity = Math.min(1, age / 300);
      node.scale = 0.8 + Math.min(0.2, age / 300 * 0.2);

      ctx.globalAlpha = node.opacity;
      ctx.save();
      ctx.translate(node.x, node.y);
      ctx.scale(node.scale, node.scale);

      this.drawNode(ctx, node);

      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  drawNode(ctx, node) {
    const color = node.source ? COLORS[node.source] : COLORS.orchestrator;
    const isActive = node.status === 'active';
    const pulse = isActive ? Math.sin(this.time * 3) * 0.05 + 1 : 1;

    if (node.type === 'orchestrator') {
      // Glow
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, NODE_SIZES.orchestrator * 2);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(-NODE_SIZES.orchestrator * 2, -NODE_SIZES.orchestrator * 2,
                   NODE_SIZES.orchestrator * 4, NODE_SIZES.orchestrator * 4);

      // Circle
      ctx.beginPath();
      ctx.arc(0, 0, NODE_SIZES.orchestrator * pulse, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a24';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Icon
      ctx.fillStyle = color;
      ctx.font = '14px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('◉', 0, 0);

    } else if (node.type === 'agent') {
      const { width, height } = NODE_SIZES.agent;

      // Glow
      if (isActive) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
      }

      // Rounded rect
      ctx.beginPath();
      this.roundRect(ctx, -width/2, -height/2, width, height, 8);
      ctx.fillStyle = '#1a1a24';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Label
      ctx.fillStyle = color;
      ctx.font = '11px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label || node.source, 0, 0);

    } else if (node.type === 'worker' || node.type === 'search') {
      const size = NODE_SIZES.worker;

      // Glow
      if (isActive) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
      }

      // Circle
      ctx.beginPath();
      ctx.arc(0, 0, size * pulse, 0, Math.PI * 2);
      ctx.fillStyle = color + '60';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Label (below node)
      if (node.label) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(node.label.slice(0, 12), 0, size + 12);
      }
    }
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }

  animate() {
    this.updatePositions();
    this.updateParticles();
    this.draw();
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }
}

export default Canvas;
