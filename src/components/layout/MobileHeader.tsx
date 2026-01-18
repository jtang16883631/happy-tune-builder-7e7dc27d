import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard } from 'lucide-react';
import { AnnouncementBell } from '@/components/announcements/AnnouncementBell';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Link } from 'react-router-dom';

interface MobileHeaderProps {
  title?: string;
}

export function MobileHeader({ title }: MobileHeaderProps) {
  const { user, roles, signOut } = useAuth();

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = () => {
    if (roles.includes('owner')) return 'Owner';
    if (roles.includes('developer')) return 'Developer';
    if (roles.includes('office_admin')) return 'Office Admin';
    if (roles.includes('coordinator')) return 'Coordinator';
    if (roles.includes('auditor')) return 'Auditor';
    return null;
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[hsl(215,50%,23%)] text-white safe-area-top">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left: Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
            <LayoutDashboard className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-sm tracking-wide">MERIDIAN</span>
        </Link>

        {/* Center: Page title (optional) */}
        {title && (
          <h1 className="text-sm font-semibold absolute left-1/2 -translate-x-1/2 truncate max-w-[40%]">
            {title}
          </h1>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <AnnouncementBell />
          
          {/* User Profile Sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <button className="focus:outline-none">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.user_metadata?.avatar_url} alt="Avatar" />
                  <AvatarFallback className="bg-white/20 text-white text-xs">
                    {getInitials(user?.user_metadata?.full_name || user?.email)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <SheetHeader>
                <SheetTitle>Profile</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {/* User Info */}
                <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={user?.user_metadata?.avatar_url} alt="Avatar" />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(user?.user_metadata?.full_name || user?.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {user?.user_metadata?.full_name || 'User'}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                    {getRoleLabel() && (
                      <span className="text-xs text-primary font-medium">{getRoleLabel()}</span>
                    )}
                  </div>
                </div>

                {/* Sign Out */}
                <Button
                  variant="outline"
                  onClick={() => signOut()}
                  className="w-full justify-start gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
