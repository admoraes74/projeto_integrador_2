import { ArrowRight, ArrowUpRight, Search, SlidersHorizontal, Sparkles, MapPin, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { DEMO_PROVIDERS, getSpecialties, phoneHref, SPECIALTIES, type Provider } from "@/lib/catalog";
import SiteHeader from "@/components/SiteHeader";
import RatingStars from "@/components/RatingStars";

function ProfessionalCard({ provider, canDelete, onDelete }: { provider: Provider; canDelete: boolean; onDelete?: () => void }) {
  const firstSpecialty = getSpecialties(provider.specialties)[0] || "Profissional";
  const initials = (provider.companyName || provider.professionalName).slice(0, 1).toUpperCase();
  const numberLink = provider.phone ? phoneHref(provider.phone) : undefined;
  const profilePath = `/profissional/${provider.id}`;
  return (
    <article className="pro-card">
      <div className="pro-card-top">
        <div className="avatar avatar-small">{initials}</div>
        <div className="pro-card-heading">
          <h3>{provider.companyName}</h3>
          <div className="pro-tags"><span className="specialty-tag">{firstSpecialty}</span>{provider.demo && <span className="demo-tag">Exemplo</span>}</div>
        </div>
        {canDelete ? <button className="delete-profile" type="button" title="Remover perfil" aria-label={`Remover perfil de ${provider.companyName}`} onClick={event => { event.stopPropagation(); onDelete?.(); }}><Trash2 size={15} /></button> : <span className="verified-dot" title="Profissional local"><Sparkles size={13} /></span>}
      </div>
      <p className="pro-description">{provider.description || "Profissional de construção em Salto."}</p>
      <div className="pro-card-meta"><MapPin size={15} /><span>Salto, SP</span></div>
      {!provider.demo && <div className="pro-rating-meta">{(provider.ratingCount ?? 0) > 0 ? <><RatingStars average={provider.ratingAverage ?? 0} size={13} /><strong>{provider.ratingAverage?.toFixed(1)}</strong><span>{provider.ratingCount} {provider.ratingCount === 1 ? "avaliação" : "avaliações"}</span></> : <span className="rating-none">Sem avaliações</span>}</div>}
      {provider.phone ? <a className="pro-phone" href={numberLink}>{provider.phone}</a> : <span className="pro-phone muted-phone">Contato no perfil</span>}
      <Link className="profile-button" href={profilePath}>Ver Perfil <ArrowRight size={16} /></Link>
    </article>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [activeSpecialty, setActiveSpecialty] = useState("Todos");
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const returnTo = localStorage.getItem("construcao-auth-return");
    if (returnTo && (/^\/cadastro\/servicos(?:\?|$)/.test(returnTo) || /^\/cadastro\?draft=1$/.test(returnTo))) {
      localStorage.removeItem("construcao-auth-return");
      navigate(returnTo);
    }
  }, [navigate]);
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);
  const { user } = useAuth();
  const directory = trpc.providers.list.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const removeProfile = trpc.providers.remove.useMutation({
    onSuccess: async () => { await utils.providers.list.invalidate(); toast.success("Perfil removido do diretório."); },
    onError: error => toast.error(error.message),
  });
  const deleteProvider = (provider: Provider) => {
    if (typeof provider.id !== "number") return;
    const confirmed = window.confirm("O perfil e os dados da galeria serão removidos do diretório. Imagens enviadas podem continuar no armazenamento. Deseja continuar?");
    if (confirmed) removeProfile.mutate({ id: provider.id });
  };
  const [hasDraft, setHasDraft] = useState(() => typeof window !== "undefined" && Boolean(localStorage.getItem("construcao-profile-draft")));
  const source: Provider[] = directory.data?.length ? directory.data as Provider[] : DEMO_PROVIDERS;

  const providers = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return source.filter(provider => {
      const specialties = getSpecialties(provider.specialties);
      const matchesSpecialty = activeSpecialty === "Todos" || specialties.includes(activeSpecialty);
      const searchable = [provider.companyName, provider.professionalName, provider.description, ...specialties].join(" ").toLocaleLowerCase("pt-BR");
      return matchesSpecialty && (!term || searchable.includes(term));
    });
  }, [source, query, activeSpecialty]);

  const resultsHeading = query.trim() ? "Resultados da busca" : activeSpecialty !== "Todos" ? "Profissionais especializados" : "Profissionais em Destaque";
  return (
    <div className="app-shell">
      <SiteHeader />
      {hasDraft && (
        <div className="draft-banner"><span>Seu cadastro está salvo neste navegador.</span><Link href="/cadastro?draft=1">Continuar cadastro <ArrowRight size={15} /></Link><button aria-label="Fechar aviso" onClick={() => { localStorage.removeItem("construcao-profile-draft"); setHasDraft(false); }}>×</button></div>
      )}
      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> CONSTRUINDO COM CONFIANÇA EM SALTO</div>
            <h1>Encontre os melhores profissionais de <em>construção</em> em Salto.</h1>
            <p className="hero-subtitle">Conectamos você com especialistas confiáveis. Pedreiros, encanadores, eletricistas e muito mais.</p>
            <div className="hero-proof"><span className="proof-mark"><MapPin size={15} /></span><span>Gente da cidade, pronta para o seu projeto.</span></div>
          </div>
          <div className="hero-aside" aria-hidden="true">
            <div className="blueprint-card"><div className="blueprint-grid" /><div className="blueprint-house"><span /><span /><span /></div><div className="blueprint-caption"><b>01 / SALTO, SP</b><span>Seu projeto começa<br />com a pessoa certa.</span></div><div className="blueprint-coordinate">23°12' S<br />47°17' W</div></div>
            <div className="orange-stamp"><span>OBRA BOA<br />COMEÇA AQUI</span><ArrowUpRight size={17} /></div>
          </div>
        </section>

        <section className="discovery-section" aria-label="Buscar profissionais">
          <div className="search-row">
            <label className="search-field"><Search size={21} /><input ref={searchInput} value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar profissional ou empresa..." aria-label="Buscar profissional ou empresa" /><kbd>⌘ K</kbd></label>
            <Link href="/cadastro" className="button-primary">Cadastrar Serviço <ArrowUpRight size={17} /></Link>
          </div>
          <div className="category-header"><span><SlidersHorizontal size={15} /> ENCONTRE POR ESPECIALIDADE</span><small>{SPECIALTIES.length} categorias</small></div>
          <div className="category-list" role="group" aria-label="Filtrar por especialidade">
            {["Todos", ...SPECIALTIES].map(specialty => <button key={specialty} type="button" className={`category-pill ${activeSpecialty === specialty ? "active" : ""}`} onClick={() => setActiveSpecialty(specialty)} aria-pressed={activeSpecialty === specialty}>{specialty}</button>)}
          </div>
        </section>

        <section className="directory-section" id="profissionais">
          <div className="section-heading">
            <div><span className="section-kicker">A REDE LOCAL</span><h2>{resultsHeading}<span className="heading-period">.</span></h2><p>Talento e experiência para tirar seu projeto do papel.</p></div>
            <span className="result-count">{providers.length.toString().padStart(2, "0")} {providers.length === 1 ? "profissional" : "profissionais"}</span>
          </div>
          {directory.isLoading && <div className="loading-line">Carregando profissionais...</div>}
          {!directory.isLoading && providers.length > 0 ? <div className="pro-grid">{providers.map(provider => <ProfessionalCard key={provider.id} provider={provider} canDelete={Boolean(user && !provider.demo && (user.role === "admin" || provider.userId === user.id))} onDelete={() => deleteProvider(provider)} />)}</div> : !directory.isLoading && (
            <div className="empty-state"><div className="empty-icon"><Search size={21} /></div><h3>Nenhum profissional encontrado</h3><p>Tente outra busca ou escolha uma especialidade diferente.</p><button type="button" className="text-button" onClick={() => { setQuery(""); setActiveSpecialty("Todos"); }}>Limpar filtros <ArrowRight size={15} /></button></div>
          )}
          <div className="join-strip"><div className="join-icon"><Sparkles size={19} /></div><div><b>É profissional da construção?</b><span>Apresente seu trabalho para quem está construindo em Salto.</span></div><Link href="/cadastro">Faça seu cadastro <ArrowRight size={16} /></Link></div>
        </section>
      </main>
      <footer className="site-footer"><Link href="/" className="footer-brand">Construção <b>Salto</b></Link><span>Feito para quem constrói a cidade.</span><span className="footer-location"><MapPin size={14} /> Salto, SP</span></footer>
    </div>
  );
}
