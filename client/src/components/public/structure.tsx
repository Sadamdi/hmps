import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  Node, 
  Edge, 
  ReactFlowProvider, 
  useNodesState, 
  useEdgesState 
} from "reactflow";
import "reactflow/dist/style.css";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface OrgMember {
  id: number;
  name: string;
  position: string;
  period: string;
  imageUrl: string;
}

// Custom node component for organizational chart
const MemberNode = ({ data }: { data: { member: OrgMember } }) => {
  const { member } = data;
  
  return (
    <div className="px-4 py-2 shadow-md rounded-lg bg-white border-2 border-gray-200 flex flex-col items-center w-60">
      <div className="w-20 h-20 overflow-hidden rounded-full mb-2">
        <img 
          src={member.imageUrl} 
          alt={member.name} 
          className="w-full h-full object-cover"
        />
      </div>
      <div className="text-center">
        <h3 className="font-bold text-base">{member.name}</h3>
        <p className="text-primary font-medium text-sm">{member.position}</p>
      </div>
    </div>
  );
};

// Node types declaration
const nodeTypes = {
  memberNode: MemberNode,
};

export default function Structure() {
  const [currentPeriod, setCurrentPeriod] = useState<string>("2023-2024");
  const [activeView, setActiveView] = useState<string>("flow");
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Fetch organization members
  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['/api/organization/members', currentPeriod],
    queryFn: () => fetch(`/api/organization/members?period=${currentPeriod}`).then(res => res.json()),
    placeholderData: []
  });

  // Fetch organization periods
  const { data: periods = [], isLoading: periodsLoading } = useQuery({
    queryKey: ['/api/organization/periods'],
    placeholderData: []
  });

  // Set up organization chart nodes and edges based on members data
  const createOrgChart = useCallback((members: OrgMember[]) => {
    const positions: Record<string, string[]> = {
      "Ketua Umum": [],
      "Wakil Ketua": [],
      "Kepala Divisi Akademik": ["Ketua Umum"],
      "Kepala Divisi Humas": ["Ketua Umum"],
      "Kepala Divisi Pengembangan": ["Ketua Umum"],
      "Kepala Divisi Acara": ["Ketua Umum"],
      "Kepala Divisi Media": ["Ketua Umum"],
      "Kepala Divisi Keuangan": ["Ketua Umum"],
      "Anggota Divisi Akademik": ["Kepala Divisi Akademik"],
      "Anggota Divisi Humas": ["Kepala Divisi Humas"],
      "Anggota Divisi Pengembangan": ["Kepala Divisi Pengembangan"],
      "Anggota Divisi Acara": ["Kepala Divisi Acara"],
      "Anggota Divisi Media": ["Kepala Divisi Media"],
      "Anggota Divisi Keuangan": ["Kepala Divisi Keuangan"],
    };

    const nodeMap: Record<string, Node> = {};
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    
    // Create nodes by position level first
    const positionLevels = [
      ["Ketua Umum"],
      ["Wakil Ketua"],
      [
        "Kepala Divisi Akademik", 
        "Kepala Divisi Humas", 
        "Kepala Divisi Pengembangan", 
        "Kepala Divisi Acara", 
        "Kepala Divisi Media", 
        "Kepala Divisi Keuangan"
      ],
      [
        "Anggota Divisi Akademik", 
        "Anggota Divisi Humas", 
        "Anggota Divisi Pengembangan", 
        "Anggota Divisi Acara", 
        "Anggota Divisi Media", 
        "Anggota Divisi Keuangan"
      ]
    ];

    // Create position to member mapping
    const positionMembers: Record<string, OrgMember[]> = {};
    members.forEach(member => {
      if (!positionMembers[member.position]) {
        positionMembers[member.position] = [];
      }
      positionMembers[member.position].push(member);
    });

    // Calculate vertical spacing between levels
    const levelHeight = 180;
    
    // Calculate node positions and create nodes
    positionLevels.forEach((level, levelIndex) => {
      const levelY = levelIndex * levelHeight;
      const levelWidth = level.length;
      
      level.forEach((position, posIndex) => {
        // Skip positions with no members
        if (!positionMembers[position]) return;
        
        positionMembers[position].forEach((member, memberIndex) => {
          // Center the level
          const membersInPosition = positionMembers[position].length;
          const spacing = 300;
          const offset = ((levelWidth - 1) * spacing) / 2;
          const positionX = posIndex * spacing - offset;
          
          // Adjust for multiple members in same position
          const memberOffset = (membersInPosition - 1) * 180 / 2;
          const x = positionX + (memberIndex * 180) - memberOffset;
          const y = levelY;
          
          const node: Node = {
            id: `${member.id}`,
            type: 'memberNode',
            data: { member },
            position: { x, y },
            draggable: true,
          };
          
          nodeMap[`${member.id}`] = node;
          newNodes.push(node);
        });
      });
    });
    
    // Create edges based on reporting relationships
    Object.entries(positions).forEach(([position, reportsTos]) => {
      if (!positionMembers[position]) return;
      
      positionMembers[position].forEach(member => {
        reportsTos.forEach(reportsTo => {
          if (!positionMembers[reportsTo]) return;
          
          positionMembers[reportsTo].forEach(manager => {
            newEdges.push({
              id: `e-${member.id}-${manager.id}`,
              source: `${manager.id}`,
              target: `${member.id}`,
              type: 'smoothstep',
              animated: false,
            });
          });
        });
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [setNodes, setEdges]);

  // Update chart when members or period changes
  useEffect(() => {
    if (members.length > 0) {
      createOrgChart(members);
    }
  }, [members, createOrgChart]);

  return (
    <section id="structure" className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 font-serif">Struktur Organisasi</h2>
          <div className="mt-2 h-1 w-20 bg-primary mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Kepengurusan Himpunan Mahasiswa Teknik Informatika</p>
        </div>
        
        {/* Period Selector */}
        <div className="flex justify-center mb-8">
          <div className="w-full max-w-xs">
            <Select value={currentPeriod} onValueChange={setCurrentPeriod}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih Periode" />
              </SelectTrigger>
              <SelectContent>
                {periodsLoading ? (
                  <SelectItem value="loading">Loading periods...</SelectItem>
                ) : (
                  periods.map((period: string) => (
                    <SelectItem key={period} value={period}>
                      {period}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {membersLoading ? (
          <div className="flex justify-center">
            <div className="animate-pulse space-y-8 w-full">
              <div className="grid md:grid-cols-4 sm:grid-cols-2 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-white p-5 rounded-lg shadow-md h-80">
                    <div className="w-full aspect-square bg-gray-200 rounded-lg mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <Tabs value={activeView} onValueChange={setActiveView} className="mb-8">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
              <TabsTrigger value="flow">Struktur Organisasi</TabsTrigger>
              <TabsTrigger value="grid">Anggota Pengurus</TabsTrigger>
            </TabsList>
            
            <TabsContent value="flow" className="mt-0">
              {members.length > 0 ? (
                <div className="w-full h-[600px] border rounded-lg bg-white shadow-sm">
                  <ReactFlowProvider>
                    <ReactFlow
                      nodes={nodes}
                      edges={edges}
                      onNodesChange={onNodesChange}
                      onEdgesChange={onEdgesChange}
                      nodeTypes={nodeTypes}
                      fitView
                      attributionPosition="bottom-right"
                    >
                      <Controls />
                      <MiniMap />
                      <Background />
                    </ReactFlow>
                  </ReactFlowProvider>
                </div>
              ) : (
                <div className="w-full py-20 text-center text-gray-500">
                  Tidak ada data pengurus untuk periode {currentPeriod}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="grid" className="mt-0">
              <div className="grid md:grid-cols-4 sm:grid-cols-2 gap-6 mt-6">
                {members.length > 0 ? (
                  members.map((member: OrgMember) => (
                    <div key={member.id} className="bg-white p-5 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                      <div className="w-full aspect-square overflow-hidden rounded-lg mb-4">
                        <img 
                          src={member.imageUrl} 
                          alt={member.name} 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <h3 className="font-bold text-lg">{member.name}</h3>
                      <p className="text-primary font-medium">{member.position}</p>
                      <p className="text-gray-500 text-sm mt-1">{member.period}</p>
                    </div>
                  ))
                ) : (
                  <div className="col-span-4 py-20 text-center text-gray-500">
                    Tidak ada data pengurus untuk periode {currentPeriod}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </section>
  );
}
