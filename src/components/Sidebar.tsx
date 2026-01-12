"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    BarChart3,
    LayoutDashboard,
    Zap,
    Settings,
    User,
    FileText,
    ShieldCheck,
    LogOut,
    ChevronLeft,
    ChevronRight,
    X,
    Menu
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useAuth } from "@/contexts/AuthContext";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const navItems = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Live Kosten", href: "/live", icon: Zap },
    { name: "Historie", href: "/history", icon: BarChart3 },
    { name: "Rechnungen", href: "/bills", icon: FileText },
    { name: "Administration", href: "/admin", icon: ShieldCheck, admin: true },
    { name: "Einstellungen", href: "/settings", icon: Settings },
];

interface SidebarProps {
    mobileOpen?: boolean;
    setMobileOpen?: (open: boolean) => void;
}

export default function Sidebar({ mobileOpen = false, setMobileOpen }: SidebarProps) {
    const pathname = usePathname();
    const { logout, user } = useAuth();
    const [collapsed, setCollapsed] = useState(false);


    const SidebarContent = ({ isMobile = false }) => (
        <div className="flex flex-col h-full p-4 md:p-6">
            {/* Header */}
            <div className={cn("flex items-center gap-3 mb-8 transition-all duration-300", collapsed && !isMobile && "justify-center mb-12")}>
                <Zap className="text-primary w-8 h-8 fill-primary shrink-0" />
                {(!collapsed || isMobile) && (
                    <span className="text-xl font-bold gradient-text underline underline-offset-4 decoration-primary/30 whitespace-nowrap overflow-hidden text-ellipsis">
                        StromApp
                    </span>
                )}
            </div>

            {/* Nav */}
            <nav className="flex-1 space-y-2">
                {navItems.map((item) => {
                    if (item.admin && user?.role !== 'ADMIN') return null;

                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen?.(false)}
                            className={cn(
                                "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 group relative",
                                isActive
                                    ? "bg-primary/20 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                                    : "text-white/60 hover:text-white hover:bg-white/5",
                                collapsed && !isMobile && "justify-center px-2"
                            )}
                            title={collapsed && !isMobile ? item.name : undefined}
                        >
                            <Icon className={cn("w-5 h-5 shrink-0", isActive ? "text-primary" : "group-hover:text-primary")} />
                            {(!collapsed || isMobile) && <span className="font-medium whitespace-nowrap">{item.name}</span>}

                            {/* Tooltip for collapsed desktop */}
                            {collapsed && !isMobile && (
                                <div className="absolute left-full ml-4 px-2 py-1 bg-black/80 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-white/10">
                                    {item.name}
                                </div>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="mt-auto pt-6 border-t border-white/10 space-y-2">
                <button
                    onClick={logout}
                    className={cn(
                        "flex items-center gap-3 px-3 py-3 w-full rounded-xl text-red-400 hover:bg-red-500/10 transition-all font-medium",
                        collapsed && !isMobile && "justify-center px-2"
                    )}
                    title={collapsed && !isMobile ? "Abmelden" : undefined}
                >
                    <LogOut className="w-5 h-5 shrink-0" />
                    {(!collapsed || isMobile) && <span className="font-medium">Abmelden</span>}
                </button>

                {/* Collapse Button (Desktop Only) */}
                {!isMobile && (
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="hidden lg:flex items-center justify-center w-full py-2 text-white/20 hover:text-white/60 transition-colors mt-2"
                    >
                        {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                    </button>
                )}
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop Sidebar */}
            <div className={cn(
                "hidden lg:block h-screen glass border-r border-white/10 sticky top-0 transition-all duration-300 z-30",
                collapsed ? "w-20" : "w-64"
            )}>
                <SidebarContent />
            </div>

            {/* Mobile Sidebar Overlay */}
            <div className={cn(
                "fixed inset-0 z-50 lg:hidden transition-all duration-300",
                mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            )}>
                {/* Full Screen Drawer */}
                <div className={cn(
                    "absolute inset-0 glass transition-transform duration-300 bg-[#0f172a] flex flex-col pt-24 px-6",
                    mobileOpen ? "translate-y-0" : "-translate-y-full"
                )}>
                    {/* Close Button Mobile */}
                    <button
                        onClick={() => setMobileOpen?.(false)}
                        className="absolute top-6 right-6 p-2 text-white/50 hover:text-white z-50 bg-white/5 rounded-full"
                    >
                        <X className="w-8 h-8" />
                    </button>
                    <div className="h-full overflow-y-auto pb-10">
                        <SidebarContent isMobile={true} />
                    </div>
                </div>
            </div>
        </>
    );
}
