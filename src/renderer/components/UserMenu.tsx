import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { userFolders } from "@/config/userConfig";
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
  const { isAuthenticated, isLoading, isInIframe, userName, userEmail, userFolder, login, loginAsDemo, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="h-8 w-8 rounded-full bg-white/20 animate-pulse" />
    );
  }

  if (!isAuthenticated) {
    // Group users by language
    const noUsers = userFolders.filter(u => u.language === "no");
    const dkUsers = userFolders.filter(u => u.language === "da");

    const getUserDisplayName = (email: string) => {
      const name = email.split("@")[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    };

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-white gap-2 px-6 py-2.5 rounded-full border border-white/80 bg-white/25 hover:bg-white/40 backdrop-blur transition-all font-semibold"
            style={{ fontFamily: '"Montserrat", sans-serif', fontSize: '13px', fontWeight: 600 }}
          >
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">Logg inn</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-background min-w-[200px] max-h-[400px] overflow-y-auto">
          <DropdownMenuLabel>🇳🇴 Norge</DropdownMenuLabel>
          {noUsers.map(user => (
            <DropdownMenuItem 
              key={user.email} 
              onClick={() => loginAsDemo(user.email)} 
              className="cursor-pointer"
            >
              {getUserDisplayName(user.email)}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>🇩🇰 Danmark</DropdownMenuLabel>
          {dkUsers.map(user => (
            <DropdownMenuItem 
              key={user.email} 
              onClick={() => loginAsDemo(user.email)} 
              className="cursor-pointer"
            >
              {getUserDisplayName(user.email)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
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
