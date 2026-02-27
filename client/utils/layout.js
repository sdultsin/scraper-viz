// layout.js - Force-directed graph utilities

export function forceSimulation(nodes, edges, config = {}) {
  const {
    width = 800,
    height = 600,
    centerForce = 0.01,
    repelForce = 500,
    linkDistance = 100,
    linkStrength = 0.3,
    velocityDecay = 0.4,
  } = config;

  // Apply center force
  for (const node of nodes) {
    if (node.fixed) continue;
    node.vx = (node.vx || 0) + (width / 2 - node.x) * centerForce;
    node.vy = (node.vy || 0) + (height / 3 - node.y) * centerForce * 0.5;
  }

  // Apply repulsion between all nodes
  for (let i = 0; i < nodes.length; i++) {
    const nodeA = nodes[i];
    if (nodeA.fixed) continue;

    for (let j = i + 1; j < nodes.length; j++) {
      const nodeB = nodes[j];
      const dx = nodeA.x - nodeB.x;
      const dy = nodeA.y - nodeB.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = repelForce / (dist * dist);

      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      if (!nodeA.fixed) {
        nodeA.vx += fx;
        nodeA.vy += fy;
      }
      if (!nodeB.fixed) {
        nodeB.vx -= fx;
        nodeB.vy -= fy;
      }
    }
  }

  // Apply link forces
  for (const edge of edges) {
    const source = nodes.find(n => n.id === edge.source);
    const target = nodes.find(n => n.id === edge.target);
    if (!source || !target) continue;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const diff = (dist - linkDistance) * linkStrength;

    const fx = (dx / dist) * diff;
    const fy = (dy / dist) * diff;

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
    node.vx *= velocityDecay;
    node.vy *= velocityDecay;
    node.x += node.vx;
    node.y += node.vy;

    // Boundary constraints
    const margin = 50;
    node.x = Math.max(margin, Math.min(width - margin, node.x));
    node.y = Math.max(margin, Math.min(height - margin, node.y));
  }
}

export function hierarchicalLayout(nodes, edges, config = {}) {
  const { width = 800, levelHeight = 100, startY = 80 } = config;

  // Build adjacency
  const children = new Map();
  const parents = new Map();

  for (const edge of edges) {
    if (!children.has(edge.source)) children.set(edge.source, []);
    children.get(edge.source).push(edge.target);
    parents.set(edge.target, edge.source);
  }

  // Find root nodes (no parent)
  const roots = nodes.filter(n => !parents.has(n.id));

  // BFS to assign levels
  const levels = new Map();
  const queue = roots.map(n => ({ node: n, level: 0 }));

  while (queue.length > 0) {
    const { node, level } = queue.shift();
    levels.set(node.id, level);

    const childIds = children.get(node.id) || [];
    for (const childId of childIds) {
      const child = nodes.find(n => n.id === childId);
      if (child) {
        queue.push({ node: child, level: level + 1 });
      }
    }
  }

  // Group by level
  const levelGroups = new Map();
  for (const node of nodes) {
    const level = levels.get(node.id) || 0;
    if (!levelGroups.has(level)) levelGroups.set(level, []);
    levelGroups.get(level).push(node);
  }

  // Position nodes
  for (const [level, group] of levelGroups) {
    const y = startY + level * levelHeight;
    const spacing = width / (group.length + 1);

    group.forEach((node, i) => {
      if (!node.fixed) {
        node.targetX = spacing * (i + 1);
        node.targetY = y;
        // Smooth transition
        node.x = node.x + (node.targetX - node.x) * 0.1;
        node.y = node.y + (node.targetY - node.y) * 0.1;
      }
    });
  }
}

export default { forceSimulation, hierarchicalLayout };
