import { ReactFlow, Controls, MiniMap, Background, BackgroundVariant, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useProjectStore } from '../../store/projectStore';
import { FileNode } from './FileNode';
import { useEffect, useMemo } from 'react';

const nodeTypes = {
  fileNode: FileNode,
};

export function ArchGraph() {
  const { graphNodes, graphEdges, setSelectedFile } = useProjectStore();
  const { fitView } = useReactFlow();

  // Trigger fit view whenever nodes genuinely change
  useEffect(() => {
    if (graphNodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 50);
    }
  }, [graphNodes, fitView]);

  const onNodeClick = (_: React.MouseEvent, node: any) => {
    setSelectedFile(node.id);
  };

  const onPaneClick = () => {
    setSelectedFile(null);
  };

  return (
    <div className="w-full h-full bg-gray-50 relative">
      <ReactFlow
        nodes={graphNodes}
        edges={graphEdges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        minZoom={0.1}
        maxZoom={4}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#E5E7EB" />
        <Controls className="bg-white border border-gray-200 shadow-md rounded-md overflow-hidden" />
        <MiniMap 
          nodeColor={(n: any) => n.data.color || '#E5E7EB'}
          className="border border-gray-200 shadow-md rounded-md"
          maskColor="rgba(249, 250, 251, 0.7)"
        />
      </ReactFlow>
    </div>
  );
}
