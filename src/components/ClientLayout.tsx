"use client";

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { AuthProvider } from '@/contexts/AuthContext';
import { Menu } from 'lucide-react';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isLoginPage = pathname === '/login';
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <AuthProvider>
            {isLoginPage ? (
                children
            ) : (
                <div className="flex flex-col lg:flex-row min-h-screen">
                    {/* Mobile Header */}
                    <div className="lg:hidden flex items-center justify-between p-4 glass border-b border-white/10 sticky top-0 z-40 bg-[#0f172a]/80 backdrop-blur-md">
                        <div className="flex items-center gap-2">
                            {/* Placeholder Logo if needed */}
                            <span className="font-bold text-lg gradient-text">StromApp</span>
                        </div>
                        <button onClick={() => setMobileMenuOpen(true)} className="p-2 hover:bg-white/10 rounded-lg">
                            <Menu className="w-6 h-6 text-white" />
                        </button>
                    </div>

                    <Sidebar mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />

                    <main className="flex-1 p-4 md:p-8 overflow-y-auto overflow-x-hidden">
                        {children}
                    </main>
                </div>
            )}
        </AuthProvider>
    );
}
