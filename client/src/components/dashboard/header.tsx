import { useState } from "react";
import { Link } from "wouter";
import { Bell, Home, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const { logout } = useAuth();
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      content: "New article published by Admin",
      time: "10 minutes ago",
    },
    {
      id: 2,
      content: "Media files uploaded by Sarah",
      time: "1 hour ago",
    },
    {
      id: 3,
      content: "Organization structure updated",
      time: "3 hours ago",
    },
  ]);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" className="md:hidden mr-2">
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>

        <div className="flex items-center space-x-4">
          <Link href="/" className="text-gray-500 hover:text-gray-700 p-2">
            <Home className="h-5 w-5" />
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.map((notification) => (
                <DropdownMenuItem key={notification.id} className="py-3">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm">{notification.content}</p>
                    <p className="text-xs text-gray-500">{notification.time}</p>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="justify-center text-primary text-sm">
                View all notifications
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
