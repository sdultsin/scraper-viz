// Canvas.js - Force-directed node graph visualization

const COLORS = {
  fameswap: '#6366f1',
  swapd: '#22d3ee',
  z2u: '#a855f7',
  orchestrator: '#ffffff',
  line: 'rgba(255, 255, 255, 0.15)',
  lineActive: 'rgba(255, 255, 255, 0.4)',
};

const NODE_SIZES = {
  orchestrator: 28,
  agent: { width: 80, height: 32 },
  worker: 16,
  search: { height: 24, padding: 12 },
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

    // Force simulation parameters
    this.simulation = {
      alpha: 1,
      alphaDecay: 0.02,
      velocityDecay: 0.4,
      centerForce: 0.005,
      repelForce: 2500,
      linkDistance: 120,
      linkStrength: 0.15,
    };

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Initialize with orchestrator
    this.addNode({
      id: 'orchestrator',
      type: 'orchestrator',
      label: 'Orchestrator',
      x: this.canvas.width / 2,
      y: 60,
      vx: 0,
      vy: 0,
      fixed: true,
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
  }

  addNode(nodeData) {
    const existing = this.nodes.get(nodeData.id);
    if (existing) {
      Object.assign(existing, nodeData);
      return existing;
    }

    const node = {
      ...nodeData,
      x: nodeData.x ?? this.width / 2 + (Math.random() - 0.5) * 100,
      y: nodeData.y ?? this.height / 2 + (Math.random() - 0.5) * 100,
      vx: 0,
      vy: 0,
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

    // Reset simulation
    this.simulation.alpha = 1;

    return node;
  }

  removeNode(id) {
    this.nodes.delete(id);
    this.edges = this.edges.filter(e => e.source !== id && e.target !== id);
  }

  updateNodeStatus(id, status) {
    const node = this.nodes.get(id);
    if (node) {
      node.status = status;
    }
  }

  spawnParticle(fromId, toId, type = 'data') {
    const from = this.nodes.get(fromId);
    const to = this.nodes.get(toId);
    if (!from || !to) return;

    this.particles.push({
      x: from.x,
      y: from.y,
      targetX: to.x,
      targetY: to.y,
      progress: 0,
      type,
      color: type === 'match' ? '#10b981' : COLORS[from.source] || '#ffffff',
      size: type === 'match' ? 6 : 3,
    });
  }

  // Burst particles from a node (for matches)
  burstParticles(nodeId, count = 8) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 2 + Math.random() * 2;
      this.particles.push({
        x: node.x,
        y: node.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        type: 'burst',
        color: '#10b981',
        size: 4,
      });
    }
  }

  runSimulation() {
    if (this.simulation.alpha < 0.001) return;

    const nodes = Array.from(this.nodes.values());

    // Apply forces
    for (const node of nodes) {
      if (node.fixed) continue;

      // Center force
      node.vx += (this.width / 2 - node.x) * this.simulation.centerForce;
      node.vy += (this.height / 3 - node.y) * this.simulation.centerForce * 0.5;

      // Repulsion from other nodes
      for (const other of nodes) {
        if (other === node) continue;
        const dx = node.x - other.x;
        const dy = node.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = this.simulation.repelForce / (dist * dist);
        node.vx += (dx / dist) * force * this.simulation.alpha;
        node.vy += (dy / dist) * force * this.simulation.alpha;
      }
    }

    // Link forces
    for (const edge of this.edges) {
      const source = this.nodes.get(edge.source);
      const target = this.nodes.get(edge.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const diff = (dist - this.simulation.linkDistance) * this.simulation.linkStrength;

      const fx = (dx / dist) * diff * this.simulation.alpha;
      const fy = (dy / dist) * diff * this.simulation.alpha;

      if (!source.fixed) {
        source.vx += fx;
        source.vy += fy;
      }
      if (!target.fixed) {
        target.vx -= fx;
        target.vy -= fy;
      }
    }

    // Update positions
    for (const node of nodes) {
      if (node.fixed) continue;
      node.vx *= this.simulation.velocityDecay;
      node.vy *= this.simulation.velocityDecay;
      node.x += node.vx;
      node.y += node.vy;

      // Boundary constraints
      const margin = 50;
      node.x = Math.max(margin, Math.min(this.width - margin, node.x));
      node.y = Math.max(margin, Math.min(this.height - margin, node.y));
    }

    this.simulation.alpha *= (1 - this.simulation.alphaDecay);
  }

  updateParticles() {
    this.particles = this.particles.filter(p => {
      if (p.type === 'burst') {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // gravity
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
      edge.dashOffset -= edge.active ? 0.5 : 0.2;
      ctx.lineDashOffset = edge.dashOffset;

      // Curved line
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2 - 20;
      ctx.moveTo(source.x, source.y);
      ctx.quadraticCurveTo(midX, midY, target.x, target.y);
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

    // Draw nodes
    for (const node of this.nodes.values()) {
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
    const pulse = isActive ? Math.sin(this.time * 3) * 0.1 + 1 : 1;

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
        ctx.shadowBlur = 20;
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
        ctx.shadowBlur = 12;
      }

      // Circle
      ctx.beginPath();
      ctx.arc(0, 0, size * pulse, 0, Math.PI * 2);
      ctx.fillStyle = color + '40';
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
        ctx.fillText(node.label.slice(0, 15), 0, size + 12);
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
    this.runSimulation();
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
