import { ArrowRight, ArrowUpRight, Camera, CheckCircle2, ImagePlus, LockKeyhole, LogOut, MapPin, Pencil, Plus, Upload, UserRound } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import SiteHeader from "@/components/SiteHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { SPECIALTIES, type PortfolioItem, type Specialty } from "@/lib/catalog";
import { PENDING_GUEST_CLAIM_KEY, readPendingGuestClaim, type PendingGuestClaim } from "@/lib/guestClaim";
import { trpc } from "@/lib/trpc";

const allowedTypes = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedType = typeof allowedTypes[number];
export default function Dashboard() {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const profilesQuery = trpc.providers.mineList.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(() => {
    const id = Number(new URLSearchParams(window.location.search).get("profileId"));
    return Number.isInteger(id) && id > 0 ? id : null;
  });
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [specialty, setSpecialty] = useState<Specialty | "">("");
  const [dragging, setDragging] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [pendingGuestClaim, setPendingGuestClaim] = useState<PendingGuestClaim | null>(readPendingGuestClaim);
  const profiles = profilesQuery.data ?? [];
  const profile = profiles.find(item => item.id === selectedProfileId) ?? profiles[0] ?? null;

  useEffect(() => {
    if (profile && profile.id !== selectedProfileId) setSelectedProfileId(profile.id);
  }, [profile, selectedProfileId]);

  useEffect(() => {
    if (window.location.hash !== "#portfolio" || !profile) return;
    requestAnimationFrame(() => document.getElementById("portfolio")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [profile?.id]);

  const addItem = trpc.providers.addPortfolioItem.useMutation({
    onSuccess: async () => {
      await utils.providers.mineList.invalidate();
      setFile(null); setTitle(""); setDescription("");
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Imagem adicionada ao portfólio.");
    },
    onError: error => toast.error(error.message),
  });
  const claimGuest = trpc.providers.claimGuest.useMutation({
    onSuccess: async () => {
      localStorage.removeItem(PENDING_GUEST_CLAIM_KEY);
      setPendingGuestClaim(null);
      await utils.providers.mineList.invalidate();
      await utils.providers.mine.invalidate();
      toast.success("Cadastro vinculado à sua conta.");
    },
    onError: error => toast.error(error.message),
  });
  const linkGuestProfile = () => {
    if (pendingGuestClaim) claimGuest.mutate(pendingGuestClaim);
  };

  const selectProfile = (id: number) => {
    setSelectedProfileId(id);
    setFile(null); setTitle(""); setDescription("");
    if (fileRef.current) fileRef.current.value = "";
    navigate(`/painel?profileId=${id}`);
  };
  const selectFile = (picked: File | undefined) => {
    if (!picked) return;
    if (!allowedTypes.includes(picked.type as AllowedType)) { toast.error("Escolha uma imagem JPG, PNG ou WebP."); return; }
    if (picked.size > 4 * 1024 * 1024) { toast.error("A imagem precisa ter até 4 MB."); return; }
    setFile(picked);
    if (!specialty && profile?.specialties[0]) setSpecialty(profile.specialties[0] as Specialty);
  };
  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => selectFile(event.target.files?.[0]);
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]); };
  const submitImage = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile) { toast.error("Selecione primeiro um perfil profissional."); return; }
    if (!file) { toast.error("Selecione uma imagem para enviar."); return; }
    if (!title.trim() || !specialty) { toast.error("Informe um título e uma especialidade."); return; }
    const contentType = file.type as AllowedType;
    const imageData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Falha ao ler imagem")); reader.onerror = () => reject(new Error("Falha ao ler imagem")); reader.readAsDataURL(file);
    }).catch(() => "");
    if (!imageData) { toast.error("Não foi possível ler este arquivo."); return; }
    addItem.mutate({ profileId: profile.id, title: title.trim(), description: description.trim(), specialty, contentType, imageData });
  };
  const doLogin = () => { try { startLogin(); } catch { toast.error("O acesso à conta não está configurado neste ambiente."); } };
  const doLogout = async () => { setLoggingOut(true); try { await logout(); navigate("/"); } catch { toast.error("Não foi possível sair da conta."); } finally { setLoggingOut(false); } };

  if (loading) return <div className="app-shell"><SiteHeader /><main className="state-page">Carregando sua conta...</main></div>;
  if (!isAuthenticated) return <div className="app-shell"><SiteHeader /><main className="auth-gate"><div className="gate-icon"><UserRound size={24} /></div><span className="section-kicker">ÁREA DO PROFISSIONAL</span><h1>Acesse seu perfil</h1><p>Entre com sua conta Manus para administrar seus cadastros e mostrar seus trabalhos.</p><button className="button-primary" type="button" onClick={doLogin}>Entrar com Manus <ArrowUpRight size={16} /></button><Link href="/cadastro" className="text-button">Ainda não tem perfil? Cadastre-se <ArrowRight size={15} /></Link></main></div>;
  if (profilesQuery.isLoading) return <div className="app-shell"><SiteHeader /><main className="state-page">Carregando seu painel...</main></div>;
  if (profilesQuery.error) return <div className="app-shell"><SiteHeader /><main className="state-page"><h2>Não foi possível carregar seu painel.</h2><button className="text-button" onClick={() => profilesQuery.refetch()}>Tentar novamente <ArrowRight size={15} /></button></main></div>;
  if (!profile) return <div className="app-shell"><SiteHeader /><main className="auth-gate"><div className="gate-icon"><Camera size={24} /></div><span className="section-kicker">ÁREA DO PRESTADOR</span>{pendingGuestClaim ? <><h1>Seu cadastro está pronto.</h1><p>Se quiser administrá-lo por esta conta, vincule-o agora. Isso é opcional.</p><section className="dashboard-card guest-claim-card"><div className="dashboard-card-head"><div><span className="section-kicker">CADASTRO PÚBLICO</span><h2>Encontramos seu perfil</h2></div></div><p>Vincular adiciona este profissional aos perfis administrados pela sua conta.</p><button className="button-primary" type="button" onClick={linkGuestProfile} disabled={claimGuest.isPending}>{claimGuest.isPending ? "Vinculando..." : "Vincular cadastro à minha conta"}<ArrowRight size={16} /></button></section></> : <><h1>Cadastre seu primeiro perfil.</h1><p>Você pode administrar vários profissionais pela mesma conta.</p></>}<Link href="/cadastro?account=1" className="text-button">Cadastrar profissional <ArrowRight size={15} /></Link></main></div>;

  const items = (profile.portfolio || []) as PortfolioItem[];
  return <div className="app-shell"><SiteHeader /><main className="dashboard-page">
    <div className="dashboard-welcome"><div><span className="section-kicker">ÁREA DO PRESTADOR</span><h1>Olá, {profile.professionalName.split(" ")[0]}<span className="heading-period">.</span></h1><p>Gerencie seus profissionais, perfis e trabalhos.</p></div><button className="logout-button" onClick={doLogout} disabled={loggingOut}><LogOut size={16} />{loggingOut ? "Saindo..." : "Sair"}</button></div>
    {pendingGuestClaim && <section className="dashboard-card guest-claim-card"><div className="dashboard-card-head"><div><span className="section-kicker">CADASTRO PÚBLICO</span><h2>Vincule um perfil à sua conta</h2></div></div><p>Encontramos um cadastro concluído neste navegador. Você pode vinculá-lo para administrá-lo por aqui; isso é opcional.</p><button className="button-primary" type="button" onClick={linkGuestProfile} disabled={claimGuest.isPending}>{claimGuest.isPending ? "Vinculando..." : "Vincular cadastro à minha conta"}<ArrowRight size={16} /></button></section>}
    <div className="profile-switcher"><div className="profile-switcher-heading"><div><span className="section-kicker">SEUS CADASTROS</span><b>{profiles.length} {profiles.length === 1 ? "profissional" : "profissionais"} na sua conta</b></div><Link href="/cadastro?account=1" className="button-primary"><Plus size={16} /> Cadastrar outro profissional</Link></div><div className="profile-switcher-list">{profiles.map(item => <button key={item.id} type="button" className={`profile-switcher-item ${profile.id === item.id ? "active" : ""}`} onClick={() => selectProfile(item.id)}><span className="switcher-avatar">{item.companyName.slice(0, 1).toUpperCase()}</span><span><b>{item.companyName}</b><small>{item.isComplete ? item.professionalName : "Rascunho · continuar cadastro"}</small></span></button>)}</div></div>
    <div className="dashboard-layout"><div className="dashboard-main">
      <section className="dashboard-card"><div className="dashboard-card-head"><div><span className="section-kicker">SEU CARTÃO NO DIRETÓRIO</span><h2>Perfil do prestador</h2></div>{profile.isComplete ? <Link className="outline-button" href={`/cadastro?edit=${profile.id}`}><Pencil size={15} /> Editar este perfil</Link> : <Link className="button-primary" href={`/cadastro/servicos?profileId=${profile.id}`}><ArrowRight size={15} /> Continuar cadastro</Link>}</div>
        <div className="dashboard-profile"><div className="avatar avatar-medium">{profile.companyName.slice(0, 1).toUpperCase()}</div><div className="dashboard-profile-copy"><div className="pro-tags">{profile.specialties.map(item => <span key={item} className="specialty-tag">{item}</span>)}</div><h3>{profile.companyName}</h3><p>{profile.professionalName}</p></div></div>
        <p className="dashboard-description">{profile.description}</p><div className="dashboard-contact-row"><span><b>Telefone</b>{profile.phone}</span><span><b>WhatsApp</b>{profile.whatsapp || "Não informado"}</span><span><b>Localização</b><MapPin size={14} /> Salto, SP</span></div>
        {profile.isComplete ? <Link href={`/profissional/${profile.id}`} className="text-button">Visualizar perfil público <ArrowUpRight size={15} /></Link> : <p className="draft-not-published"><LockKeyhole size={14} /> Este rascunho ainda não aparece no diretório.</p>}
      </section>
      <section id="portfolio" className="dashboard-card upload-card"><div className="dashboard-card-head"><div><span className="section-kicker">MOSTRE SEU TRABALHO</span><h2>Adicionar ao portfólio</h2></div><span className="upload-indicator"><ImagePlus size={17} /> {items.length.toString().padStart(2, "0")}</span></div>
        <form onSubmit={submitImage}>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" onChange={onFileChange} />
          <div className={`drop-zone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`} role="button" tabIndex={0} onClick={() => fileRef.current?.click()} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") fileRef.current?.click(); }} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
            {file ? <><div className="drop-icon"><CheckCircle2 size={21} /></div><b>{file.name}</b><span>{(file.size / 1024 / 1024).toFixed(2)} MB · Clique para trocar</span></> : <><div className="drop-icon"><Upload size={21} /></div><b>Clique para selecionar uma imagem ou arraste aqui</b><span>JPG, PNG ou WebP · até 4 MB</span></>}
          </div>
          {file && <div className="field-grid upload-fields"><label className="form-field">Título da imagem<input required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="Ex.: Reforma de cozinha" /></label><label className="form-field">Especialidade<select required value={specialty} onChange={event => setSpecialty(event.target.value as Specialty)}><option value="">Selecione</option>{SPECIALTIES.map(item => <option key={item} value={item}>{item}</option>)}</select></label><label className="form-field field-wide">Descrição<textarea maxLength={2000} rows={3} value={description} onChange={event => setDescription(event.target.value)} placeholder="Conte um pouco sobre este trabalho..." /></label></div>}
          <div className="upload-actions"><span>As imagens publicadas aparecem no perfil selecionado.</span><button className="button-primary" disabled={addItem.isPending || !file}>{addItem.isPending ? "Enviando imagem..." : "Enviar Imagem"}<ArrowRight size={15} /></button></div>
        </form>
      </section>
      <section className="dashboard-card gallery-card"><div className="dashboard-card-head"><div><span className="section-kicker">SEUS PROJETOS · {profile.companyName}</span><h2>Galeria de Trabalhos</h2></div><span className="portfolio-count">{items.length.toString().padStart(2, "0")}</span></div>
        {items.length ? <div className="portfolio-grid dashboard-gallery">{items.map(item => <article key={item.id} className="portfolio-card"><img src={`/manus-storage/${item.imageKey}`} alt={item.title} /><div className="portfolio-card-info"><span className="specialty-tag">{item.specialty}</span><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}</div></article>)}</div> : <div className="portfolio-empty"><div className="empty-icon"><ImagePlus size={20} /></div><b>O portfólio deste perfil está começando</b><span>Adicione uma foto de um trabalho realizado.</span></div>}
      </section>
    </div><aside className="dashboard-aside"><div className="account-card"><div className="account-avatar"><UserRound size={20} /></div><span className="section-kicker">SUA CONTA</span><b>{user?.name || profile.professionalName}</b><span>{profiles.length} {profiles.length === 1 ? "perfil profissional" : "perfis profissionais"} em Salto, SP</span></div><div className="dashboard-tip"><span className="tip-label">DICA</span><b>Perfis completos passam mais confiança.</b><p>Mantenha os dados de cada profissional atualizados.</p><Link href={`/cadastro?edit=${profile.id}`}>Revisar perfil <ArrowRight size={14} /></Link></div></aside></div>
  </main></div>;
}
