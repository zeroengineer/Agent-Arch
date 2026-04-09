import { create } from 'zustand';
import { Node, Edge } from '@xyflow/react';
import dagre from 'dagre';
import { ProjectWithRelations, FileNodeData } from '../../shared/types/index';

interface ProjectState {
  activeProject: ProjectWithRelations | null;
  selectedFileId: string | null;
  graphNodes: Node[];
  graphEdges: Edge[];
  setActiveProject: (p: ProjectWithRelations) => void;
  setSelectedFile: (id: string | null) => void;
  buildGraph: (project: ProjectWithRelations) => void;
}

const LANGUAGE_COLORS: Record<string, string> = {
  javascript: '#BA7517',
  typescript: '#7F77DD',
  python: '#1D9E75',
  go: '#378ADD',
  rust: '#D85A30',
  java: '#E04A3A',
  cpp: '#4372A1',
  c: '#5C6BC0',
  csharp: '#178600'
};

export const useProjectStore = create<ProjectState>((set) => ({
  activeProject: null,
  selectedFileId: null,
  graphNodes: [],
  graphEdges: [],
  setActiveProject: (p) => set({ activeProject: p }),
  setSelectedFile: (id) => set({ selectedFileId: id }),
  buildGraph: (project) => {
    if (!project.files || !project.edges) {
      set({ graphNodes: [], graphEdges: [] });
      return;
    }

    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'TB', ranksep: 60, nodesep: 60 });
    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes to dagre graph
    project.files.forEach((file: FileNodeData) => {
      // 180px wide, ~80px height for FileNode
      g.setNode(file.id, { width: 180, height: 80 }); 
    });

    // We want thicker edges for higher centralization. 
    // Calculate simple in-degree counts
    const inDegrees: Record<string, number> = {};
    project.edges.forEach(edge => {
      inDegrees[edge.targetFileId] = (inDegrees[edge.targetFileId] || 0) + 1;
    });

    const maxDegree = Math.max(1, ...Object.values(inDegrees));

    // Add edges to dagre graph
    project.edges.forEach(edge => {
      g.setEdge(edge.sourceFileId, edge.targetFileId);
    });

    // Compute layout
    dagre.layout(g);

    // Map out React Flow nodes
    const graphNodes: Node[] = project.files.map((file: FileNodeData) => {
      const nodeWithPosition = g.node(file.id);
      return {
        id: file.id,
        type: 'fileNode',
        position: {
          x: nodeWithPosition.x - nodeWithPosition.width / 2,
          y: nodeWithPosition.y - nodeWithPosition.height / 2,
        },
        data: {
          file,
          color: LANGUAGE_COLORS[file.language] || '#888780'
        },
      };
    });

    const graphEdges: Edge[] = project.edges.map(edge => {
      const sourceFile = project.files.find(f => f.id === edge.sourceFileId);
      const color = sourceFile ? LANGUAGE_COLORS[sourceFile.language] || '#888780' : '#888780';
      const targetDegree = inDegrees[edge.targetFileId] || 0;
      
      // Scale stroke width between 1px and 4px based on target indegree
      const strokeWidth = Math.max(1, Math.min(4, 1 + (targetDegree / maxDegree) * 3));

      return {
        id: edge.id,
        source: edge.sourceFileId,
        target: edge.targetFileId,
        animated: true,
        style: { stroke: color, strokeWidth },
      };
    });

    set({ graphNodes, graphEdges });
  }
}));
