import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { UserWithRole } from "@shared/schema";
import { useAuth } from "@/lib/auth";

interface UserManagementProps {
  user: UserWithRole | null;
  viewOnly?: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function UserManagement({ user, viewOnly = false, onSave, onCancel }: UserManagementProps) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    username: user?.username || "",
    name: user?.name || "",
    email: user?.email || "",
    role: user?.role || "division_head",
    password: "",
    confirmPassword: "",
  });

  // Update local state if user prop changes
  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || "",
        name: user.name || "",
        email: user.email || "",
        role: user.role || "division_head",
        password: "",
        confirmPassword: "",
      });
    } else {
      // Reset form for new user
      setFormData({
        username: "",
        name: "",
        email: "",
        role: "division_head",
        password: "",
        confirmPassword: "",
      });
    }
  }, [user]);

  // Create/update user mutation
  const userMutation = useMutation({
    mutationFn: async (userData: typeof formData) => {
      if (user) {
        // Update existing user
        return await apiRequest('PUT', `/api/users/${user.id}`, userData);
      } else {
        // Create new user
        return await apiRequest('POST', '/api/users', userData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: `User ${user ? "updated" : "created"} successfully`,
      });
      onSave();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${user ? "update" : "create"} user`,
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string | number) => {
      return await apiRequest('DELETE', `/api/users/${userId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
      onSave();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (value: string) => {
    setFormData(prev => ({ ...prev, role: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.username) {
      toast({
        title: "Error",
        description: "Username is required",
        variant: "destructive",
      });
      return;
    }

    // Password validation for new user or if password is being changed
    if (!user || (formData.password && formData.password.length > 0)) {
      if (formData.password.length < 6) {
        toast({
          title: "Error",
          description: "Password must be at least 6 characters long",
          variant: "destructive",
        });
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        toast({
          title: "Error",
          description: "Passwords do not match",
          variant: "destructive",
        });
        return;
      }
    }

    await userMutation.mutateAsync(formData);
  };

  const handleDelete = async () => {
    if (!user) return;
    
    if (window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      // MongoDB menggunakan _id, bukan id
      const userId = user._id || user.id;
      
      if (!userId) {
        toast({
          title: "Error",
          description: "Invalid user ID",
          variant: "destructive",
        });
        return;
      }
      
      await deleteUserMutation.mutateAsync(userId);
    }
  };

  // Available roles based on current user's role
  const availableRoles = () => {
    if (currentUser?.role === "owner") {
      return [
        { value: "owner", label: "Owner" },
        { value: "admin", label: "Admin" },
        { value: "chair", label: "Chair" },
        { value: "vice_chair", label: "Vice Chair" },
        { value: "division_head", label: "Division Head" },
      ];
    } else if (currentUser?.role === "admin") {
      return [
        { value: "admin", label: "Admin" },
        { value: "chair", label: "Chair" },
        { value: "vice_chair", label: "Vice Chair" },
        { value: "division_head", label: "Division Head" },
      ];
    }
    return [];
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            placeholder="Enter username"
            value={formData.username}
            onChange={handleInputChange}
            disabled={viewOnly}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            name="name"
            placeholder="Enter full name"
            value={formData.name}
            onChange={handleInputChange}
            disabled={viewOnly}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="Enter email address"
            value={formData.email}
            onChange={handleInputChange}
            disabled={viewOnly}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select 
            value={formData.role} 
            onValueChange={handleRoleChange}
            disabled={viewOnly}
          >
            <SelectTrigger id="role">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              {availableRoles().map(role => (
                <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!viewOnly && (
          <>
            <div className="space-y-2">
              <Label htmlFor="password">
                {user ? "New Password (leave blank to keep current)" : "Password"}
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder={user ? "Enter new password" : "Enter password"}
                value={formData.password}
                onChange={handleInputChange}
                required={!user}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required={!user || formData.password.length > 0}
              />
            </div>
          </>
        )}
      </div>

      <div className="flex justify-between">
        {user && currentUser?.role === "owner" && !viewOnly ? (
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteUserMutation.isPending}
          >
            {deleteUserMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete User'
            )}
          </Button>
        ) : (
          <div></div>
        )}

        <div className="flex space-x-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            {viewOnly ? "Close" : "Cancel"}
          </Button>
          
          {!viewOnly && (
            <Button 
              type="submit"
              disabled={userMutation.isPending}
            >
              {userMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                user ? 'Update User' : 'Create User'
              )}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
