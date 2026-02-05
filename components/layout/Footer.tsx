import Link from "next/link";

export function Footer() {
  return (
    <footer
      className="mt-auto border-t border-[#e3ba65]/40 bg-[#221913] text-white"
      role="contentinfo"
    >
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-4 lg:col-span-1">
            <p className="text-lg font-semibold tracking-tight">
              Yamalé Legal Platform
            </p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed opacity-90">
              African law, accessible and verifiable. Your trusted source for
              national and regional law, AfCFTA compliance, and AI-powered
              legal research.
            </p>
          </div>
          {/* Product */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#e3ba65]">
              Product
            </p>
            <ul className="mt-4 space-y-2.5 text-sm opacity-90">
              <li>
                <Link href="/library" className="hover:text-[#e3ba65] hover:underline">
                  Legal Library
                </Link>
              </li>
              <li>
                <Link href="/afcfta" className="hover:text-[#e3ba65] hover:underline">
                  AfCFTA Tools
                </Link>
              </li>
              <li>
                <Link href="/ai-research" className="hover:text-[#e3ba65] hover:underline">
                  AI Research
                </Link>
              </li>
              <li>
                <Link href="/marketplace" className="hover:text-[#e3ba65] hover:underline">
                  Marketplace
                </Link>
              </li>
              <li>
                <Link href="/lawyers" className="hover:text-[#e3ba65] hover:underline">
                  Find a Lawyer
                </Link>
              </li>
            </ul>
          </div>
          {/* Company */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#e3ba65]">
              Company
            </p>
            <ul className="mt-4 space-y-2.5 text-sm opacity-90">
              <li>
                <Link href="/pricing" className="hover:text-[#e3ba65] hover:underline">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-[#e3ba65] hover:underline">
                  Sign up
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-[#e3ba65] hover:underline">
                  Sign in
                </Link>
              </li>
            </ul>
          </div>
          {/* Legal */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#e3ba65]">
              Legal
            </p>
            <ul className="mt-4 space-y-2.5 text-sm opacity-90">
              <li>
                <a href="#" className="hover:text-[#e3ba65] hover:underline">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-[#e3ba65] hover:underline">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs opacity-80">
            © {new Date().getFullYear()} Yamalé Legal Platform. All rights reserved.
          </p>
          <a
            href="mailto:contact@yamale-legal.com"
            className="text-xs opacity-80 hover:text-[#e3ba65] hover:underline"
          >
            contact@yamale-legal.com
          </a>
        </div>
      </div>
    </footer>
  );
}
