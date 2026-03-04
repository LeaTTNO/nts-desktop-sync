import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { version } from "../../../package.json";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogIn, LogOut } from "lucide-react";

export default function UserMenu() {
  const { isAuthenticated, isLoading, userName, userEmail, userFolder, login, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="h-8 w-8 rounded-full bg-white/20 animate-pulse" />
    );
  }

  if (!isAuthenticated) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-white gap-2 px-6 py-2.5 rounded-full border border-white/80 bg-white/25 hover:bg-white/40 backdrop-blur transition-all font-semibold"
        style={{ fontFamily: '"Montserrat", sans-serif', fontSize: '13px', fontWeight: 600 }}
        onClick={login}
      >
        <LogIn className="h-4 w-4" />
        <span className="hidden sm:inline">Logg inn med Microsoft</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-white gap-2 px-6 py-2.5 rounded-full border border-white/80 bg-white/25 hover:bg-white/40 backdrop-blur transition-all font-semibold"
          style={{ fontFamily: '"Montserrat", sans-serif', fontSize: '13px', fontWeight: 600 }}
        >
          <User className="h-4 w-4" />
          <span className="hidden sm:inline">{userName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span>{userName}</span>
            <span className="text-xs text-muted-foreground font-normal">
              {userEmail}
            </span>
            <span className="text-xs text-muted-foreground font-normal">
              Mappe: {userFolder}
            </span>
            <span className="text-xs text-muted-foreground font-normal mt-1">
              v{version}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-destructive cursor-pointer">
          <LogOut className="h-4 w-4 mr-2" />
          Logg ut
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
