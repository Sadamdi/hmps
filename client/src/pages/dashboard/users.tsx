import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/dashboard/sidebar";
import Header from "@/components/dashboard/header";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserManagement } from "@/components/dashboard/user-management";
import { Search, UserPlus, Shield, User, Loader2, Edit } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { UserWithRole } from "@shared/schema";

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  // Fetch users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['/api/users'],
    placeholderData: []
  });

  // Filter users based on search and role tab
  const filteredUsers = users
    .filter((user: UserWithRole) => 
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.name && user.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter((user: UserWithRole) => {
      if (activeTab === "all") return true;
      return user.role === activeTab;
    });

  const getRoleBadgeVariant = (role: string) => {
    switch(role) {
      case "owner": return "destructive";
      case "admin": return "default";
      case "chair": return "outline";
      case "vice_chair": return "outline";
      default: return "secondary";
    }
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setIsUserDialogOpen(true);
  };

  const handleEditUser = (user: UserWithRole) => {
    setEditingUser(user);
    setIsUserDialogOpen(true);
  };

  const closeUserDialog = () => {
    setIsUserDialogOpen(false);
    setEditingUser(null);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header title="User Management" />
        <main className="flex-1 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
            <h1 className="text-2xl font-bold">User Management</h1>
            {currentUser?.role === "owner" && (
              <Button onClick={handleAddUser}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            )}
          </div>

          <div className="mb-6 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search users..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="owner">Owner</TabsTrigger>
                <TabsTrigger value="admin">Admin</TabsTrigger>
                <TabsTrigger value="chair">Chair</TabsTrigger>
                <TabsTrigger value="vice_chair">Vice Chair</TabsTrigger>
                <TabsTrigger value="division_head">Division Heads</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500 mb-4">No users found.</p>
                {currentUser?.role === "owner" && (
                  <Button onClick={handleAddUser}>Add User</Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
              <table className="w-full border-collapse text-left">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-sm font-medium text-gray-500">User</th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-500">Role</th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-500">Last Login</th>
                    <th className="px-6 py-4 text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.map((user: UserWithRole) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-100 flex items-center justify-center">
                            {user.name ? (
                              <span className="text-lg font-medium text-gray-700">
                                {user.name.charAt(0)}
                              </span>
                            ) : (
                              <User className="h-5 w-5 text-gray-500" />
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="font-medium text-gray-900">{user.name || user.username}</div>
                            <div className="text-sm text-gray-500">{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={getRoleBadgeVariant(user.role)} className="capitalize">
                          {user.role === "vice_chair" ? "Vice Chair" : 
                           user.role === "division_head" ? "Division Head" : 
                           user.role}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never"}
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          disabled={
                            (currentUser?.role === "admin" && user.role === "owner") ||
                            (currentUser?.id === user.id && currentUser?.role !== "owner")
                          }
                        >
                          {currentUser?.role === "owner" || (currentUser?.role === "admin" && user.role !== "owner") ? (
                            <Edit className="h-4 w-4 mr-1" />
                          ) : (
                            <Shield className="h-4 w-4 mr-1" />
                          )}
                          {currentUser?.role === "owner" || (currentUser?.role === "admin" && user.role !== "owner") 
                            ? "Edit" 
                            : "View"
                          }
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? `${currentUser?.role === "owner" ? "Edit" : "View"} User` : "Add New User"}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {editingUser 
                    ? "View or modify user information based on your permission level."
                    : "Create a new user account with appropriate role and permissions."}
                </p>
              </DialogHeader>
              <UserManagement
                user={editingUser}
                viewOnly={editingUser ? (currentUser?.role !== "owner" && (currentUser?.role === "admin" && editingUser.role === "owner")) : false}
                onSave={closeUserDialog}
                onCancel={closeUserDialog}
              />
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}
