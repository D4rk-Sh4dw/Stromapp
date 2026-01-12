"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface User {
    id: string;
    email: string;
    role: string;
    autoBilling?: boolean;
}

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    user: User | null;
    login: () => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    login: () => { },
    logout: () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        checkAuth();
    }, [pathname]);

    const checkAuth = async () => {
        try {
            const res = await fetch('/api/auth/me');

            if (res.ok) {
                const userData = await res.json();
                setUser(userData);
                setIsAuthenticated(true);
            } else {
                setUser(null);
                setIsAuthenticated(false);
                if (pathname !== '/login') {
                    router.push('/login');
                }
            }
        } catch (error) {
            setUser(null);
            setIsAuthenticated(false);
            if (pathname !== '/login') {
                router.push('/login');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const login = () => {
        // We just redirect, checkAuth will run on new page load or we call it manually
        // But for better UX let's call checkAuth
        checkAuth().then(() => router.push('/'));
    };

    const logout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            document.cookie = 'session_token=; path=/; max-age=0';
            setUser(null);
            setIsAuthenticated(false);
            router.push('/login');
        }
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
