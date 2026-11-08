import { Link, useLocation } from "wouter";
import { ArrowUpRight, Menu, UserRound, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";

export default function SiteHeader() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const openProfile = () => {
    setMenuOpen(false);
    if (isAuthenticated) navigate("/painel");
    else {
      try { startLogin(); }
      catch { toast.error("O acesso à conta não está configurado neste ambiente."); }
    }
  };

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="Construção Salto — início">
          <span className="brand-mark"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-7h6v7"/><path d="M7.5 12h2"/></svg></span>
          <span className="brand-name">Construção <b>Salto</b></span>
        </Link>
        <button className="menu-toggle" type="button" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <nav className={`header-nav ${menuOpen ? "is-open" : ""}`}>
          <Link href="/cadastro" className="header-register" onClick={() => setMenuOpen(false)}>Sou profissional <ArrowUpRight size={15} /></Link>
          <button className="profile-link" onClick={openProfile} type="button">
            <span className="profile-icon"><UserRound size={16} /></span>
            <span>{isAuthenticated ? (user?.name?.split(" ")[0] || "Meu Perfil") : "Meu Perfil"}</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
