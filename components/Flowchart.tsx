
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { FlowchartNode, FlowchartEdge } from '../types';

interface FlowchartProps {
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
  onToggleNode: (nodeId: string) => void;
}

const Flowchart: React.FC<FlowchartProps> = ({ nodes, edges, onToggleNode }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Handle resizing robustly
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // D3 Logic
  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0 || dimensions.height === 0 || nodes.length === 0) return;

    const { width, height } = dimensions;

    // Clear previous chart
    d3.select(svgRef.current).selectAll("*").remove();

    // Create SVG Container with Zoom
    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", [0, 0, width, height]);

    // Define arrow markers
    svg.append("defs").selectAll("marker")
      .data(["end"])
      .join("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 30) // Distance from node center (adjusted for larger nodes)
      .attr("refY", 0)
      .attr("markerWidth", 8)
      .attr("markerHeight", 8)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#9aa0a6") // Lighter arrow color
      .attr("d", "M0,-5L10,0L0,5");

    // Group that will be zoomed/panned
    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom as any);

    // Initialize Simulation
    // We use a high alphaDecay to make it settle fast, or pre-tick
    const simulation = d3.forceSimulation(nodes as any)
      .force("link", d3.forceLink(edges).id((d: any) => d.id).distance(180)) // Increased distance
      .force("charge", d3.forceManyBody().strength(-600))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(80).strength(1)); // Increased collision radius
    
    // PRE-CALCULATE LAYOUT
    // Run the simulation in the background so the user sees a static graph initially
    simulation.stop();
    for (let i = 0; i < 300; ++i) simulation.tick();
    
    // Edges
    const link = g.append("g")
      .selectAll("line")
      .data(edges)
      .join("line")
      .attr("stroke", "#9aa0a6") // Lighter edge color
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 2) // Thicker edges
      .attr("marker-end", "url(#arrow)")
      .attr("x1", (d: any) => d.source.x)
      .attr("y1", (d: any) => d.source.y)
      .attr("x2", (d: any) => d.target.x)
      .attr("y2", (d: any) => d.target.y);

    // Node Groups
    const node = g.append("g")
      .selectAll(".node")
      .data(nodes)
      .join("g")
      .attr("class", "node")
      .attr("transform", (d: any) => `translate(${d.x},${d.y})`)
      .style("cursor", "grab")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended) as any);

    // Node Shape (Pill)
    node.append("rect")
      .attr("width", 180) // Increased width
      .attr("height", 56) // Increased height
      .attr("x", -90)
      .attr("y", -28)
      .attr("rx", 28)
      .attr("ry", 28)
      .attr("fill", (d: any) => d.completed ? "#c4eed0" : "#282a2c") // Lighter dark bg
      .attr("stroke", (d: any) => d.completed ? "#c4eed0" : "#5f6368")
      .attr("stroke-width", 2)
      .style("filter", "drop-shadow(0px 4px 6px rgba(0,0,0,0.4))") // Enhanced shadow
      .style("transition", "all 0.2s")
      .on("click", (e, d: any) => {
          e.stopPropagation(); // Prevent drag click interference
          onToggleNode(d.id);
      });

    // Node Label
    node.append("text")
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .text((d: any) => d.label.length > 22 ? d.label.substring(0, 20) + '...' : d.label)
      .attr("fill", (d: any) => d.completed ? "#0f172a" : "#ffffff") // Pure white text
      .attr("font-size", "14px") // Larger font
      .attr("font-weight", "600") // Semi-bold
      .attr("pointer-events", "none")
      .style("font-family", "'Google Sans', sans-serif")
      .style("text-shadow", (d: any) => d.completed ? "none" : "0px 1px 3px rgba(0,0,0,0.8)"); // Stronger text shadow

    // Checkmark indicator
    const checkGroup = node.filter((d: any) => d.completed).append("g")
        .attr("transform", "translate(70, -28)"); // Adjusted position
    
    checkGroup.append("circle")
        .attr("r", 10) // Larger indicator
        .attr("fill", "#188038")
        .attr("stroke", "#c4eed0")
        .attr("stroke-width", 2);
        
    checkGroup.append("path")
        .attr("d", "M-3.5,0.5 l2.5,2.5 l5,-5") // Adjusted tick size
        .attr("stroke", "white")
        .attr("stroke-width", 2)
        .attr("fill", "none");

    // Restart simulation for interaction with high decay to avoid wobble
    simulation.alphaDecay(0.1).restart();

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Drag Handlers - STICKY
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
      d3.select(event.sourceEvent.target).style("cursor", "grabbing");
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      // Sticky: Do NOT set fx/fy to null. Keep them fixed.
      event.subject.fx = event.x;
      event.subject.fy = event.y;
      d3.select(event.sourceEvent.target).style("cursor", "grab");
    }

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, dimensions, onToggleNode]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#131314] relative overflow-hidden">
      {nodes.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            <p>No graph data available</p>
        </div>
      ) : (
        <>
             <svg ref={svgRef} className="w-full h-full block" />
             <div className="absolute bottom-4 right-4 bg-surface/80 backdrop-blur px-3 py-1.5 rounded-lg border border-border text-xs text-gray-400 pointer-events-none select-none">
                Scroll to Zoom • Drag to Position
             </div>
        </>
      )}
    </div>
  );
};

export default Flowchart;
