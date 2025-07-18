import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { log } from "console";
import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Edge,
  MiniMap,
  Node,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

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
    queryKey: ["/api/organization/members", currentPeriod],
    queryFn: () =>
      fetch(`/api/organization/members?period=${currentPeriod}`).then((res) =>
        res.json()
      ),
    placeholderData: [],
  });

  // Fetch organization periods
  const { data: periods = [], isLoading: periodsLoading } = useQuery({
    queryKey: ["/api/organization/periods"],
    placeholderData: [],
  });

  // Set up organization chart nodes and edges based on members data
  // Normalize members data, dari backend _id jadi id
  const normalizedMembers = members.map((member: any) => ({
    ...member,
    id: member._id,
  }));

  const createOrgChart = useCallback(
    (members: OrgMember[]) => {
      // 1. Tambah node root (invisible)
      const rootNode: Node = {
        id: "root",
        type: "input",
        data: { label: "" },
        position: { x: 0, y: 0 },
        style: { opacity: 0, pointerEvents: "none" },
        draggable: false,
      };

      // 2. Mapping posisi
      const positionMembers: Record<string, OrgMember[]> = {};
      members.forEach((member) => {
        if (!positionMembers[member.position]) {
          positionMembers[member.position] = [];
        }
        positionMembers[member.position].push(member);
      });

      // 3. Susun node per level
      const nodes: Node[] = [rootNode];
      const edges: Edge[] = [];

      // Level 1: Ketua & Wakil (horizontal, lebih lebar)
      const ketua = positionMembers["Ketua Himpunan"] || [];
      const wakil = positionMembers["Wakil Ketua Himpunan"] || [];
      const level1 = [...ketua, ...wakil];
      const level1Spacing = 350;
      const level1Offset = ((level1.length - 1) * level1Spacing) / 2;

      level1.forEach((member, i) => {
        nodes.push({
          id: `${member.id}`,
          type: "memberNode",
          data: { member },
          position: { x: i * level1Spacing - level1Offset, y: 100 },
          draggable: true,
        });
        // Garis dari root ke ketua/wakil
        edges.push({
          id: `e-root-${member.id}`,
          source: "root",
          target: `${member.id}`,
          type: "smoothstep",
        });
      });

      // Level 2: Ketua Divisi (bercabang dari root, horizontal)
      const divisiList = [
        "Senor",
        "Public Relation",
        "Religius",
        "Technopreneurship",
        "Medinfo",
        "Intelektual",
      ];
      const level2Spacing = 250;
      const level2Offset = ((divisiList.length - 1) * level2Spacing) / 2;
      divisiList.forEach((div, i) => {
        const ketuaDiv = positionMembers[`Ketua Divisi ${div}`];
        if (ketuaDiv) {
          ketuaDiv.forEach((member, k) => {
            // Jika ada lebih dari satu ketua divisi (jarang), beri jarak horizontal
            nodes.push({
              id: `${member.id}`,
              type: "memberNode",
              data: { member },
              position: {
                x: i * level2Spacing - level2Offset + k * 60,
                y: 300,
              },
              draggable: true,
            });
            // Garis dari root ke ketua divisi
            edges.push({
              id: `e-root-div-${member.id}`,
              source: "root",
              target: `${member.id}`,
              type: "smoothstep",
            });
          });
        }
      });

      // Level 3: Anggota Divisi (bercabang dari ketua divisi, horizontal di bawah ketua divisi)
      divisiList.forEach((div, i) => {
        const anggotaDiv = positionMembers[`Anggota Divisi ${div}`];
        const ketuaDiv = positionMembers[`Ketua Divisi ${div}`];
        if (anggotaDiv && ketuaDiv && ketuaDiv.length > 0) {
          const anggotaSpacing = 180;
          const anggotaOffset = ((anggotaDiv.length - 1) * anggotaSpacing) / 2;
          anggotaDiv.forEach((member, j) => {
            console.log(member);
            // Tambahkan node anggota
            nodes.push({
              id: `${member.id}`, // harus sama dengan yang di edge.target
              type: "memberNode",
              data: { member },
              position: {
                x:
                  i * level2Spacing -
                  level2Offset +
                  j * anggotaSpacing -
                  anggotaOffset,
                y: 500,
              },
              draggable: true,
            });

            // Tambahkan edge dari ketua divisi ke anggota
            edges.push({
              id: `e-div-${ketuaDiv[0].id}-${member.id}`, // id unik edge
              source: `${ketuaDiv[0].id}`, // harus sama dengan node ketua.id
              target: `${member.id}`, // harus sama dengan node anggota.id
              type: "smoothstep", // tipe garis
            });
          });
        }
      });

      setNodes(nodes);
      setEdges(edges);
    },
    [setNodes, setEdges]
  );

  // Update chart when members or period changes
  useEffect(() => {
    if (members.length > 0) {
      const normalizedMembers = members.map((member: any) => ({
        ...member,
        id: member._id,
      }));
      createOrgChart(normalizedMembers);
    }
  }, [members, createOrgChart]);

  return (
    <section id="structure" className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8" data-aos="fade-up">
          <h2 className="text-3xl font-bold text-gray-900 font-serif">
            Struktur Organisasi
          </h2>
          <div className="mt-2 h-1 w-20 bg-primary mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">
            Kepengurusan Himpunan Mahasiswa Teknik Informatika
          </p>
        </div>

        {/* Period Selector */}
        <div
          className="flex justify-center mb-8"
          data-aos="fade-up"
          data-aos-delay="100"
        >
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
                  <div
                    key={i}
                    className="bg-white p-5 rounded-lg shadow-md h-80"
                  >
                    <div className="w-full aspect-square bg-gray-200 rounded-lg mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <Tabs
            value={activeView}
            onValueChange={setActiveView}
            className="mb-8"
            data-aos="fade-up"
            data-aos-delay="200"
          >
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
              <TabsTrigger value="flow">Struktur Organisasi</TabsTrigger>
              <TabsTrigger value="grid">Anggota Pengurus</TabsTrigger>
            </TabsList>

            <TabsContent value="flow" className="mt-0">
              {members.length > 0 ? (
                <div
                  className="w-full h-[600px] border rounded-lg bg-white shadow-sm"
                  data-aos="zoom-in"
                  data-aos-delay="300"
                >
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
                  members.map((member: OrgMember, index) => (
                    <div
                      key={member.id}
                      className="bg-white p-5 rounded-lg shadow-md hover:shadow-lg transition-shadow"
                      data-aos="fade-up"
                      data-aos-delay={300 + index * 50}
                    >
                      <div className="w-full aspect-square overflow-hidden rounded-lg mb-4">
                        <img
                          src={member.imageUrl}
                          alt={member.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <h3 className="font-bold text-lg">{member.name}</h3>
                      <p className="text-primary font-medium">
                        {member.position}
                      </p>
                      <p className="text-gray-500 text-sm mt-1">
                        {member.period}
                      </p>
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
