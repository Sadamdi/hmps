import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/dashboard/sidebar";
import Header from "@/components/dashboard/header";
import OrganizationEditor from "@/components/dashboard/organization-editor";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Edit, Loader2, Search, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface OrgMember {
  id: number;
  name: string;
  position: string;
  period: string;
  imageUrl: string;
}

export default function DashboardOrganization() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<OrgMember | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState("2023-2024");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query members and periods
  const { data: members = [], isLoading: isMembersLoading } = useQuery({
    queryKey: ['/api/organization/members', selectedPeriod],
  });

  const { data: periods = [], isLoading: isPeriodsLoading } = useQuery({
    queryKey: ['/api/organization/periods'],
    placeholderData: ["2023-2024", "2022-2023"]
  });

  // Filter members based on search
  const filteredMembers = members.filter((member: OrgMember) => 
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.position.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const handleEditMember = (member: OrgMember) => {
    setEditingMember(member);
    setIsEditorOpen(true);
  };

  const handleNewMember = () => {
    setEditingMember(null);
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingMember(null);
  };

  const handleMemberSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/organization/members'] });
    closeEditor();
    toast({
      title: "Success",
      description: `Organization member ${editingMember ? "updated" : "created"} successfully`,
    });
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="Organization Structure" />
        <main className="flex-1 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
            <h1 className="text-2xl font-bold">Organization Structure Management</h1>
            <Button onClick={handleNewMember}>
              <Users className="h-4 w-4 mr-2" />
              Add Member
            </Button>
          </div>

          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search members..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select 
              value={selectedPeriod} 
              onValueChange={setSelectedPeriod}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((period: string) => (
                  <SelectItem key={period} value={period}>{period}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isMembersLoading || isPeriodsLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500 mb-4">No organization members found.</p>
                <Button onClick={handleNewMember}>Add Organization Member</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredMembers.map((member: OrgMember) => (
                <Card key={member.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="w-full aspect-square overflow-hidden">
                    <img
                      src={member.imageUrl}
                      alt={member.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold">{member.name}</h3>
                        <p className="text-primary font-medium">{member.position}</p>
                        <p className="text-gray-500 text-sm">{member.period}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => handleEditMember(member)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingMember ? "Edit Organization Member" : "Add Organization Member"}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {editingMember 
                    ? "Update the details of this organization member." 
                    : "Add a new member to the organization structure."}
                </p>
              </DialogHeader>
              <OrganizationEditor 
                member={editingMember} 
                currentPeriod={selectedPeriod}
                onSave={handleMemberSaved} 
                onCancel={closeEditor}
              />
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}
