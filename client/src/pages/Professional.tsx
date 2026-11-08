import { ArrowLeft, ArrowUpRight, BriefcaseBusiness, ImagePlus, MapPin, MessageCircle, Pencil, Phone, Star, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";
import SiteHeader from "@/components/SiteHeader";
import { DEMO_PROVIDERS, getSpecialties, phoneHref, whatsappHref, type Provider } from "@/lib/catalog";
import { readPendingGuestClaimForProfile } from "@/lib/guestClaim";
import { getRatingVoterId } from "@/lib/providerRating";
import RatingStars from "@/components/RatingStars";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const RATING_LABELS = ["", "Muito ruim", "Ruim", "Regular", "Bom", "Excelente"];

export default function Professional() {
  const { user } = useAuth();
  const [, params] = useRoute("/profissional/:id");
  const rawId = params?.id || "";
  const demoProvider = DEMO_PROVIDERS.find(item => item.id === rawId);
  const numericId = /^\d+$/.test(rawId) ? Number(rawId) : undefined;
  const profileQuery = trpc.providers.byId.useQuery({ id: numericId || 0 }, { enabled: Boolean(numericId), retry: false });
  const [voterId] = useState(getRatingVoterId);
  const ratingSummaryQuery = trpc.providers.ratingSummary.useQuery({ profileId: numericId ?? 1, voterId }, { enabled: numericId !== undefined, retry: false });
  const [selectedRating, setSelectedRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const utils = trpc.useUtils();
  const saveRating = trpc.providers.rate.useMutation({
    onSuccess: async () => {
      await Promise.all([ratingSummaryQuery.refetch(), utils.providers.list.invalidate()]);
      toast.success("Sua avaliação foi registrada.");
    },
    onError: error => toast.error(error.message),
  });
  useEffect(() => {
    setSelectedRating(ratingSummaryQuery.data?.myRating ?? 0);
  }, [numericId, ratingSummaryQuery.data?.myRating]);
  const provider = (demoProvider || profileQuery.data) as Provider | undefined;

  if (profileQuery.isLoading && !demoProvider) return <div className="app-shell"><SiteHeader /><main className="state-page"><span className="loader-dot" />Carregando perfil...</main></div>;
  if (!provider) return <div className="app-shell"><SiteHeader /><main className="state-page"><div className="empty-icon"><BriefcaseBusiness size={21} /></div><h2>Perfil não encontrado</h2><p>Este profissional não está disponível no diretório.</p><Link href="/" className="button-primary">Voltar ao início <ArrowLeft size={16} /></Link></main></div>;

  const specialties = getSpecialties(provider.specialties);
  const phone = provider.phone ? phoneHref(provider.phone) : undefined;
  const whatsapp = provider.whatsapp ? whatsappHref(provider.whatsapp) : undefined;
  const portfolio = provider.portfolio || [];
  const guestClaim = numericId !== undefined ? readPendingGuestClaimForProfile(numericId) : null;
  const accountOwner = !provider.demo && user !== null && provider.userId === user.id;
  const guestOwner = !provider.demo && provider.userId === null && guestClaim !== null;
  const ratingAverage = ratingSummaryQuery.data?.average ?? 0;
  const ratingCount = ratingSummaryQuery.data?.count ?? 0;
  const myRating = ratingSummaryQuery.data?.myRating ?? null;
  const emptyRatingLabel = ratingSummaryQuery.isError ? "Avaliações indisponíveis" : "Sem avaliações";
  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="profile-page">
        <div className="profile-page-toolbar">
          <Link href="/" className="back-link"><ArrowLeft size={16} /> Voltar para profissionais</Link>
          {(accountOwner || guestOwner) && numericId !== undefined && <div className="profile-manage-actions">
            <Link href={guestOwner ? `/cadastro?guestEdit=${numericId}` : `/cadastro?edit=${numericId}`} className="profile-manage-link"><Pencil size={15} /> Editar cadastro</Link>
            <Link href={guestOwner ? `/cadastro/servicos?profileId=${numericId}&guest=1` : `/painel?profileId=${numericId}#portfolio`} className="profile-manage-link"><ImagePlus size={15} /> Adicionar fotos</Link>
          </div>}
        </div>
        <section className="profile-hero-card">
          <div className="profile-identity">
            <div className="avatar avatar-large">{provider.companyName.slice(0, 1).toUpperCase()}</div>
            <div><div className="pro-tags">{specialties.map(item => <span key={item} className="specialty-tag">{item}</span>)}{provider.demo && <span className="demo-tag">Perfil de exemplo</span>}</div><h1>{provider.companyName}</h1><p>{provider.professionalName}</p><span className="profile-location"><MapPin size={15} /> Salto, São Paulo</span>{numericId !== undefined && <div className="profile-rating-summary">{ratingCount > 0 ? <><RatingStars average={ratingAverage} size={13} /><strong>{ratingAverage.toFixed(1)}</strong><span>{ratingCount} {ratingCount === 1 ? "avaliação" : "avaliações"}</span></> : <span className="rating-none">{emptyRatingLabel}</span>}</div>}</div>
          </div>
          <div className="profile-actions">
            {phone ? <a href={phone} className="button-primary"><Phone size={16} /> Ligar</a> : <span className="button-disabled"><Phone size={16} /> Telefone não informado</span>}
            {whatsapp ? <a href={whatsapp} target="_blank" rel="noreferrer" className="button-whatsapp"><MessageCircle size={16} /> WhatsApp <ArrowUpRight size={14} /></a> : provider.demo ? null : <span className="button-disabled"><MessageCircle size={16} /> WhatsApp não informado</span>}
          </div>
        </section>
        <div className="profile-content-grid">
          <div className="profile-main-column">
            <section className="content-panel"><div className="panel-title"><span className="panel-icon"><Wrench size={17} /></span><div><span className="section-kicker">QUEM SOMOS</span><h2>Sobre</h2></div></div><p className="about-text">{provider.description || "Este profissional ainda não adicionou uma descrição."}</p></section>
            {numericId !== undefined && <section className="content-panel rating-panel">
              <div className="rating-panel-head"><div><span className="section-kicker">AVALIAÇÃO DO SERVIÇO</span><h2>Avalie este profissional</h2></div><div className="rating-overview">{ratingSummaryQuery.isLoading ? <span className="rating-none">Carregando avaliações...</span> : ratingCount > 0 ? <><RatingStars average={ratingAverage} size={16} /><strong>{ratingAverage.toFixed(1)}</strong><span>{ratingCount} {ratingCount === 1 ? "avaliação" : "avaliações"}</span></> : <span className="rating-none">{emptyRatingLabel}</span>}</div></div>
              <div className="rating-form-row"><div className="rating-vote-copy"><b>Como foi a prestação do serviço?</b><p>Escolha uma nota de 1 a 5 estrelas.</p></div><div className="rating-input-column"><div className="rating-input" role="group" aria-label="Selecione sua nota de 1 a 5 estrelas" onMouseLeave={() => setHoveredRating(0)}>{[1, 2, 3, 4, 5].map(value => <button key={value} type="button" className={`rating-star-button ${value <= (hoveredRating || selectedRating) ? "selected" : ""}`} aria-label={`Avaliar com ${value} estrelas: ${RATING_LABELS[value]}`} aria-pressed={selectedRating === value} title={RATING_LABELS[value]} onMouseEnter={() => setHoveredRating(value)} onFocus={() => setHoveredRating(value)} onBlur={() => setHoveredRating(0)} onClick={() => setSelectedRating(value)}><Star size={25} fill={value <= (hoveredRating || selectedRating) ? "currentColor" : "none"} /></button>)}</div><span className="rating-selection-label">{selectedRating ? RATING_LABELS[selectedRating] : "Selecione uma nota"}</span><button type="button" className="button-primary rating-submit" disabled={!selectedRating || saveRating.isPending} onClick={() => numericId !== undefined && saveRating.mutate({ profileId: numericId, voterId, stars: selectedRating })}>{saveRating.isPending ? "Enviando..." : myRating ? "Atualizar avaliação" : "Enviar avaliação"}</button></div></div>
              <p className="rating-disclaimer">Não é preciso entrar em uma conta. Você pode enviar uma avaliação por profissional neste navegador e alterar sua nota depois.</p>
            </section>}
            <section className="content-panel portfolio-panel"><div className="panel-title"><span className="panel-icon"><ImagePlus size={17} /></span><div><span className="section-kicker">TRABALHOS REALIZADOS</span><h2>Portfólio</h2></div><span className="portfolio-count">{portfolio.length.toString().padStart(2, "0")}</span></div>
              {portfolio.length ? <div className="portfolio-grid">{portfolio.map(item => <article key={item.id} className="portfolio-card"><img src={`/manus-storage/${item.imageKey}`} alt={item.title} /><div className="portfolio-card-info"><span className="specialty-tag">{item.specialty}</span><h3>{item.title}</h3><p>{item.description}</p></div></article>)}</div> : <div className="portfolio-empty"><div className="empty-icon"><ImagePlus size={20} /></div><b>Os trabalhos aparecem por aqui</b><span>A galeria ainda não tem imagens publicadas.</span></div>}
            </section>
          </div>
          <aside className="profile-side-column"><section className="contact-card"><span className="section-kicker">FALE COM O PROFISSIONAL</span><h3>Vamos conversar sobre sua obra?</h3><p>Entre em contato diretamente para explicar o que você precisa.</p>{phone ? <a className="contact-row" href={phone}><Phone size={17} /><span><small>TELEFONE</small><b>{provider.phone}</b></span><ArrowUpRight size={15} /></a> : <div className="contact-row is-muted"><Phone size={17} /><span><small>TELEFONE</small><b>Não informado</b></span></div>}{whatsapp && <a className="contact-row" href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={17} /><span><small>WHATSAPP</small><b>Enviar mensagem</b></span><ArrowUpRight size={15} /></a>}<div className="contact-location"><MapPin size={16} /><span>Salto, SP</span></div></section><div className="profile-note"><BriefcaseBusiness size={17} /><span>Conectando pessoas e profissionais locais.</span></div></aside>
        </div>
      </main>
      <footer className="site-footer"><Link href="/" className="footer-brand">Construção <b>Salto</b></Link><span>Feito para quem constrói a cidade.</span><span className="footer-location"><MapPin size={14} /> Salto, SP</span></footer>
    </div>
  );
}
