import React, { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { useNotesStore } from "../store/notesStore.js";
import { extractWikiLinks } from "@daymark/core";

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  title: string;
  type: string;
  taskCount: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

export function GraphView({ onClose }: { onClose: () => void }) {
  const svgRef    = useRef<SVGSVGElement>(null);
  const { notes, openNote, activeNoteId } = useNotesStore();

  const build = useCallback(() => {
    const nodeMap = new Map<string, GraphNode>();
    const links: GraphLink[] = [];

    for (const note of notes.values()) {
      nodeMap.set(note.id, {
        id:        note.id,
        title:     note.title,
        type:      note.type,
        taskCount: note.tasks.filter((t) => t.state === "open").length,
      });
    }

    for (const note of notes.values()) {
      const wikiLinks = extractWikiLinks(note.content);
      for (const wl of wikiLinks) {
        // Find target by title
        const target = [...notes.values()].find(
          (n) => n.title.toLowerCase() === wl.target.toLowerCase()
        );
        if (target && target.id !== note.id) {
          links.push({ source: note.id, target: target.id });
        }
      }
    }

    return { nodes: [...nodeMap.values()], links };
  }, [notes]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const { nodes, links } = build();
    const W = svg.clientWidth  || 800;
    const H = svg.clientHeight || 600;

    d3.select(svg).selectAll("*").remove();

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    d3.select(svg).call(zoom);

    const g = d3.select(svg).append("g");

    const sim = d3.forceSimulation<GraphNode>(nodes)
      .force("link",   d3.forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(80))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collide", d3.forceCollide(24));

    // Links
    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      // Theme-aware so links stay visible on dark and light backgrounds.
      .style("stroke", "var(--color-text-muted)")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.45);

    // Nodes
    const node = g.append("g")
      .selectAll<SVGCircleElement, GraphNode>("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => Math.max(6, Math.min(18, 6 + d.taskCount * 1.5)))
      .attr("fill", (d) => {
        if (d.id === activeNoteId) return "#7c6fff";
        if (d.type === "daily")    return "#60a5fa";
        if (d.type === "weekly" || d.type === "monthly") return "#4ade80";
        return "#888";
      })
      .attr("stroke", (d) => d.id === activeNoteId ? "#9080ff" : "none")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .call(
        d3.drag<SVGCircleElement, GraphNode>()
          .on("start", (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on("drag",  (event, d) => { d.fx = event.x; d.fy = event.y; })
          .on("end",   (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      )
      .on("click", (_, d) => openNote(d.id));

    // Labels
    const label = g.append("g")
      .selectAll<SVGTextElement, GraphNode>("text")
      .data(nodes)
      .join("text")
      .text((d) => d.title.length > 18 ? d.title.slice(0, 18) + "…" : d.title)
      .attr("font-size", 10)
      .style("fill", "var(--color-text-muted)")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => Math.max(6, Math.min(18, 6 + d.taskCount * 1.5)) + 14)
      .style("pointer-events", "none")
      .style("user-select", "none");

    // Tooltip
    node.append("title").text((d) => `${d.title} (${d.taskCount} open tasks)`);

    sim.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as GraphNode).x ?? 0)
        .attr("y1", (d) => (d.source as GraphNode).y ?? 0)
        .attr("x2", (d) => (d.target as GraphNode).x ?? 0)
        .attr("y2", (d) => (d.target as GraphNode).y ?? 0);
      node.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);
      label.attr("x", (d) => d.x ?? 0).attr("y", (d) => d.y ?? 0);
    });

    return () => { sim.stop(); };
  }, [build, activeNoteId, openNote]);

  const nodeCount = notes.size;

  return (
    <div className="graph-overlay">
      <div className="graph-header">
        <span className="graph-title">Note Graph</span>
        <span className="graph-count">{nodeCount} notes</span>
        <div className="graph-legend">
          <span className="graph-legend-item"><span style={{ background: "#60a5fa" }} />Daily</span>
          <span className="graph-legend-item"><span style={{ background: "#4ade80" }} />Periodic</span>
          <span className="graph-legend-item"><span style={{ background: "#888" }} />Note</span>
          <span className="graph-legend-item"><span style={{ background: "#7c6fff" }} />Active</span>
        </div>
        <button className="graph-close" onClick={onClose}>✕</button>
      </div>
      <svg ref={svgRef} className="graph-svg" />
      <div className="graph-hint">Drag to rearrange · Scroll to zoom · Click to open</div>
    </div>
  );
}
