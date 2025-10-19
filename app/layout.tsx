import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Family Movies',
  description: 'Your family movie concierge',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-gray-50">
          {/* Navigation */}
          <nav className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-6">
              <div className="flex justify-between h-16">
                <div className="flex">
                  {/* Logo */}
                  <Link href="/chat" className="flex items-center">
                    <span className="text-xl font-bold text-gray-900">
                      Family Movies
                    </span>
                  </Link>

                  {/* Main Navigation */}
                  <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
                    <Link
                      href="/chat"
                      className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2 border-transparent hover:border-gray-300"
                    >
                      Chat
                    </Link>
                    <Link
                      href="/queue"
                      className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2 border-transparent hover:border-gray-300"
                    >
                      Queue
                    </Link>
                    <Link
                      href="/history"
                      className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2 border-transparent hover:border-gray-300"
                    >
                      History
                    </Link>
                    <Link
                      href="/settings"
                      className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 border-b-2 border-transparent hover:border-gray-300"
                    >
                      Settings
                    </Link>
                  </div>
                </div>

                {/* Logout */}
                <div className="flex items-center">
                  <a
                    href="/auth/logout"
                    className="text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    Logout
                  </a>
                </div>
              </div>
            </div>
          </nav>

          {/* Page Content */}
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
