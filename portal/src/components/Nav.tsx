'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Bottom tab bar: reachable with a thumb, like a phone app.
export function Nav({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const tabs = [
    { href: '/', label: 'Today', icon: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', active: pathname === '/' || pathname.startsWith('/visits') },
    { href: '/homes', label: 'Homes', icon: 'M4 21V8l8-5 8 5v13M9 21v-6h6v6M9 11h.01M15 11h.01', active: pathname.startsWith('/homes') },
    { href: '/schedule', label: 'Schedule', icon: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', active: pathname.startsWith('/schedule') },
    ...(isOwner ? [{ href: '/team', label: 'Team', icon: 'M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM21 20v-1a4 4 0 0 0-3-3.87M15.5 4.13a3.5 3.5 0 0 1 0 6.75', active: pathname.startsWith('/team') }] : []),
  ];

  return (
    <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-2xl">
        {tabs.map((tab) => (
          <li key={tab.href} className="flex-1">
            <Link
              href={tab.href}
              aria-current={tab.active ? 'page' : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-bold ${tab.active ? 'text-navy' : 'text-navy-muted'}`}
            >
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={tab.active ? 2.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={tab.icon} />
              </svg>
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
