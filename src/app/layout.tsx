import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StromAbrechnung | Next-Gen Billing",
  description: "Dynamic electricity billing system with InfluxDB integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen flex text-white`}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
