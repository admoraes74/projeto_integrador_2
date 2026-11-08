import { ArrowLeft, ArrowRight, CheckCircle2, ImagePlus, LockKeyhole, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type DragEvent as ReactDragEvent } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import SiteHeader from "@/components/SiteHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import { SPECIALTIES, type PortfolioItem, type Specialty } from "@/lib/catalog";
import { readPendingGuestClaimForProfile } from "@/lib/guestClaim";
import { clearLocalDraftServices, listLocalDraftServices, removeLocalDraftService, saveLocalDraftService, type LocalDraftService } from "@/lib/localProviderDraft";
import { trpc } from "@/lib/trpc";

type DraftProfile = {
  companyName: string;
  professionalName: string;
  phone: string;
  whatsapp: string;
  specialties: string[];
  description: string;
  profileId?: number;
  guestToken?: string;
};
const allowedTypes = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedType = typeof allowedTypes[number];
const EMPTY_PROFILE_ID = 1;
const EMPTY_GUEST_TOKEN = "00000000-0000-4000-8000-000000000000";

function readDraftProfile(): DraftProfile | null {
  try {
    const saved = localStorage.getItem("construcao-profile-draft");
    return saved ? JSON.parse(saved) as DraftProfile : null;
  } catch { return null; }
}

function fileAsDataUrl(blob: Blob, contentType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Não foi possível ler a imagem."));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(new Blob([blob], { type: contentType }));
  });
}

function LocalDraftPhoto({ item }: { item: LocalDraftService }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    const url = URL.createObjectURL(item.image);
    setSource(url);
    return () => URL.revokeObjectURL(url);
  }, [item.image]);
  return source ? <img className="local-draft-photo" src={source} alt={item.title} /> : <div className="local-photo-placeholder"><ImagePlus size={23} /><span>Foto guardada neste navegador</span></div>;
}

export default function ProviderServices() {
  const { isAuthenticated, loading } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const rawProfileId = Number(params.get("profileId"));
  const urlProfileId = Number.isInteger(rawProfileId) && rawProfileId > 0 ? rawProfileId : null;
  const isGuestRegistration = params.get("guest") === "1" || params.get("draft") === "1";
  const [draftProfile, setDraftProfile] = useState<DraftProfile | null>(() => isGuestRegistration ? readDraftProfile() : null);
  const profileId = urlProfileId ?? draftProfile?.profileId ?? null;
  const pendingGuestClaim = profileId !== null ? readPendingGuestClaimForProfile(profileId) : null;
  const guestToken = draftProfile?.guestToken ?? pendingGuestClaim?.token ?? null;
  const hasGuestCredential = isGuestRegistration && profileId !== null && Boolean(guestToken);
  const profileQuery = trpc.providers.ownedById.useQuery({ id: profileId ?? EMPTY_PROFILE_ID }, { enabled: !isGuestRegistration && isAuthenticated && profileId !== null, retry: false });
  const guestProfileQuery = trpc.providers.guestDraft.useQuery(
    { profileId: profileId ?? EMPTY_PROFILE_ID, token: guestToken ?? EMPTY_GUEST_TOKEN },
    { enabled: hasGuestCredential, retry: false },
  );
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [specialty, setSpecialty] = useState<Specialty | "">("");
  const [localServices, setLocalServices] = useState<LocalDraftService[]>([]);
  const [localLoading, setLocalLoading] = useState(isGuestRegistration);
  const [dragging, setDragging] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saveError, setSaveError] = useState("");
  const saveProfile = trpc.providers.save.useMutation();
  const createGuestDraft = trpc.providers.createGuestDraft.useMutation();
  const addService = trpc.providers.addPortfolioItem.useMutation();
  const addGuestService = trpc.providers.addGuestPortfolioItem.useMutation();
  const completeProfile = trpc.providers.complete.useMutation();
  const completeGuestProfile = trpc.providers.completeGuest.useMutation();
  const profile = isGuestRegistration ? guestProfileQuery.data : profileQuery.data;
  const portfolio = (profile?.portfolio ?? []) as PortfolioItem[];
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isGuestRegistration) { setLocalLoading(false); return; }
    let active = true;
    listLocalDraftServices().then(items => { if (active) setLocalServices(items); }).catch(error => { if (active) toast.error(error instanceof Error ? error.message : "Não foi possível carregar os serviços salvos."); }).finally(() => { if (active) setLocalLoading(false); });
    return () => { active = false; };
  }, [isGuestRegistration]);

  const readFile = (picked: File | undefined) => {
    if (!picked) return;
    if (!allowedTypes.includes(picked.type as AllowedType)) { toast.error("Escolha uma imagem JPG, PNG ou WebP."); return; }
    if (picked.size > 4 * 1024 * 1024) { toast.error("Cada imagem precisa ter até 4 MB."); return; }
    setFile(picked);
    if (!specialty) setSpecialty((profile?.specialties[0] as Specialty | undefined) ?? (draftProfile?.specialties[0] as Specialty | undefined) ?? "");
  };

  const refreshLocalServices = async () => setLocalServices(await listLocalDraftServices());

  const addCurrentService = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) { toast.error("Selecione uma foto do serviço."); return; }
    if (!title.trim() || !specialty) { toast.error("Informe o título e a especialidade do serviço."); return; }
    setAdding(true);
    try {
      if (!isGuestRegistration && isAuthenticated && profileId !== null) {
        const imageData = await fileAsDataUrl(file, file.type);
        await addService.mutateAsync({ profileId, title: title.trim(), description: description.trim(), specialty, contentType: file.type as AllowedType, imageData });
        await profileQuery.refetch();
        toast.success("Serviço e foto adicionados ao perfil.");
      } else if (isGuestRegistration && isPublished && hasGuestCredential && profileId !== null && guestToken) {
        const imageData = await fileAsDataUrl(file, file.type);
        await addGuestService.mutateAsync({ profileId, token: guestToken, title: title.trim(), description: description.trim(), specialty, contentType: file.type as AllowedType, imageData });
        await guestProfileQuery.refetch();
        toast.success("Foto adicionada ao perfil.");
      } else {
        await saveLocalDraftService({ title: title.trim(), description: description.trim(), specialty, image: file, contentType: file.type });
        await refreshLocalServices();
        toast.success("Serviço guardado neste navegador.");
      }
      setFile(null); setTitle(""); setDescription(""); setSpecialty("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível adicionar este serviço.");
    } finally { setAdding(false); }
  };

  const localDraftHasProfile = Boolean(draftProfile && draftProfile.companyName && draftProfile.professionalName);
  const serviceCount = portfolio.length + localServices.length;
  const isPublished = Boolean(profile?.isComplete);
  const displayedProfileName = profile?.companyName ?? draftProfile?.companyName ?? "Seu novo cadastro";

  const finishRegistration = async () => {
    if (isPublished && !isGuestRegistration) { navigate(`/painel?profileId=${profileId}`); return; }
    if (isPublished && isGuestRegistration && localServices.length === 0) { navigate(`/profissional/${profileId}`); return; }
    const wasAlreadyPublished = isPublished;
    if (serviceCount < 1) { toast.error("Adicione pelo menos um serviço com foto antes de concluir."); return; }
    setFinishing(true);
    setSaveError("");
    let guestClaim: { profileId: number; token: string } | null = null;
    try {
      if (isGuestRegistration) {
        if (!hasGuestCredential && (!draftProfile || !localDraftHasProfile)) throw new Error("Não encontrei os dados do cadastro. Volte à etapa anterior e tente novamente.");
        let token = guestToken;
        let targetProfileId = profileId;
        if (!token || targetProfileId === null) {
          if (!draftProfile || !localDraftHasProfile) throw new Error("Não encontrei os dados do cadastro. Volte à etapa anterior e tente novamente.");
          token = crypto.randomUUID();
          const created = await createGuestDraft.mutateAsync({
            token,
            companyName: draftProfile.companyName,
            professionalName: draftProfile.professionalName,
            phone: draftProfile.phone,
            whatsapp: draftProfile.whatsapp,
            specialties: draftProfile.specialties as Specialty[],
            description: draftProfile.description,
          });
          const savedDraft = { ...draftProfile, profileId: created.id, guestToken: token };
          setDraftProfile(savedDraft);
          localStorage.setItem("construcao-profile-draft", JSON.stringify(savedDraft));
          targetProfileId = created.id;
        }
        if (!token || targetProfileId === null) throw new Error("Não foi possível recuperar o rascunho do cadastro.");
        for (const service of localServices) {
          const imageData = await fileAsDataUrl(service.image, service.contentType);
          await addGuestService.mutateAsync({ profileId: targetProfileId, token, title: service.title, description: service.description, specialty: service.specialty, contentType: service.contentType as AllowedType, imageData });
          await removeLocalDraftService(service.id);
          setProgress(value => value + 1);
        }
        await completeGuestProfile.mutateAsync({ profileId: targetProfileId, token });
        guestClaim = { profileId: targetProfileId, token };
      } else {
        let targetProfileId = profileId;
        if (targetProfileId === null) {
          if (!draftProfile || !localDraftHasProfile) throw new Error("Não encontrei os dados do cadastro. Volte à etapa anterior e tente novamente.");
          const saved = await saveProfile.mutateAsync({ companyName: draftProfile.companyName, professionalName: draftProfile.professionalName, phone: draftProfile.phone, whatsapp: draftProfile.whatsapp, specialties: draftProfile.specialties as Specialty[], description: draftProfile.description });
          targetProfileId = saved.id;
          const resumableDraft = { ...draftProfile, profileId: targetProfileId };
          setDraftProfile(resumableDraft);
          localStorage.setItem("construcao-profile-draft", JSON.stringify(resumableDraft));
        }
        for (const service of localServices) {
          const imageData = await fileAsDataUrl(service.image, service.contentType);
          await addService.mutateAsync({ profileId: targetProfileId, title: service.title, description: service.description, specialty: service.specialty, contentType: service.contentType as AllowedType, imageData });
          await removeLocalDraftService(service.id);
          setProgress(value => value + 1);
        }
        await completeProfile.mutateAsync({ profileId: targetProfileId });
      }
      await Promise.all([utils.providers.mineList.invalidate(), utils.providers.mine.invalidate(), utils.providers.list.invalidate()]);
      await clearLocalDraftServices();
      if (guestClaim) localStorage.setItem("construcao-pending-guest-claim", JSON.stringify(guestClaim));
      localStorage.removeItem("construcao-profile-draft");
      localStorage.removeItem("construcao-auth-return");
      toast.success(wasAlreadyPublished ? "Perfil atualizado no diretório." : "Cadastro concluído e publicado no diretório.");
      if (wasAlreadyPublished && isGuestRegistration && guestClaim) navigate(`/profissional/${guestClaim.profileId}`);
      else navigate("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível concluir o cadastro.";
      setSaveError(message);
      toast.error(message);
      await refreshLocalServices().catch(() => undefined);
    } finally { setFinishing(false); setProgress(0); }
  };

  if ((!isGuestRegistration && loading) || (!isGuestRegistration && isAuthenticated && profileId !== null && profileQuery.isLoading) || (hasGuestCredential && guestProfileQuery.isLoading) || localLoading) return <div className="app-shell"><SiteHeader /><main className="state-page">Carregando serviços do cadastro...</main></div>;
  if (hasGuestCredential && (guestProfileQuery.error || !profile)) return <div className="app-shell"><SiteHeader /><main className="state-page"><h2>Não encontrei este cadastro.</h2><p>O rascunho privado não está disponível. Retome o cadastro no mesmo navegador.</p><Link className="text-button" href="/cadastro?draft=1">Voltar aos dados do profissional <ArrowRight size={15} /></Link></main></div>;
  if (!isGuestRegistration && isAuthenticated && profileId !== null && (profileQuery.error || !profile)) return <div className="app-shell"><SiteHeader /><main className="state-page"><h2>Não encontrei este perfil na sua conta.</h2><Link className="text-button" href="/painel">Voltar ao painel <ArrowRight size={15} /></Link></main></div>;
  if (isGuestRegistration && !draftProfile && !profile) return <div className="app-shell"><SiteHeader /><main className="state-page"><h2>O rascunho do cadastro não está disponível neste navegador.</h2><Link className="text-button" href="/cadastro">Começar um cadastro novo <ArrowRight size={15} /></Link></main></div>;

  const stepItems = [...portfolio, ...localServices];
  const completeLabel = isPublished ? (isGuestRegistration ? (localServices.length ? "Salvar fotos e voltar" : "Voltar ao perfil") : "Voltar ao painel") : "Concluir cadastro";
  const detailsHref = isGuestRegistration && guestToken && profileId ? `/cadastro?guestEdit=${profileId}` : profileId && !isGuestRegistration ? `/cadastro?edit=${profileId}` : "/cadastro?draft=1";
  return <div className="app-shell"><SiteHeader /><main className="services-page">
    <Link href={detailsHref} className="back-link"><ArrowLeft size={16} /> Voltar aos dados do profissional</Link>
    <div className="wizard-heading"><div><span className="section-kicker">ETAPA 2 DE 2 · SERVIÇOS E FOTOS</span><h1>{isPublished ? "Atualize o portfólio de " : "Mostre o trabalho de "}<em>{displayedProfileName}</em></h1><p>{isPublished ? "Adicione novas fotos. O cadastro continua publicado e as alterações aparecerão neste perfil." : "Adicione fotos dos serviços realizados. Ao concluir, o perfil será publicado e você voltará ao diretório."}</p></div><div className="wizard-progress"><span className="done-step"><CheckCircle2 size={15} /> Dados</span><i /><span className="current-step">2 Fotos</span></div></div>
    <div className="services-layout"><div className="services-main">
      <section className="dashboard-card service-add-card"><div className="dashboard-card-head"><div><span className="section-kicker">NOVO SERVIÇO</span><h2>Adicionar serviço prestado</h2></div><span className="upload-indicator"><ImagePlus size={17} /> {serviceCount.toString().padStart(2, "0")}</span></div>
        <form onSubmit={addCurrentService}>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" onChange={(event: ChangeEvent<HTMLInputElement>) => readFile(event.target.files?.[0])} />
          <div className={`drop-zone service-drop-zone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`} role="button" tabIndex={0} onClick={() => fileRef.current?.click()} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") fileRef.current?.click(); }} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event: ReactDragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); readFile(event.dataTransfer.files[0]); }}>
            {file ? <><div className="drop-icon"><CheckCircle2 size={21} /></div><b>{file.name}</b><span>{(file.size / 1024 / 1024).toFixed(2)} MB · clique para trocar</span></> : <><div className="drop-icon"><Upload size={21} /></div><b>Clique para escolher uma foto ou arraste aqui</b><span>JPG, PNG ou WebP · até 4 MB por foto</span></>}
          </div>
          <div className="field-grid service-fields"><label className="form-field">Título do serviço<input required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="Ex.: Reforma de banheiro" /></label><label className="form-field">Especialidade<select required value={specialty} onChange={event => setSpecialty(event.target.value as Specialty)}><option value="">Selecione a especialidade</option>{SPECIALTIES.map(item => <option key={item} value={item}>{item}</option>)}</select></label><label className="form-field field-wide">Descrição do trabalho <span className="optional">Opcional</span><textarea maxLength={2000} rows={3} value={description} onChange={event => setDescription(event.target.value)} placeholder="Conte o que foi feito neste serviço..." /></label></div>
          <div className="service-add-actions"><span>{isGuestRegistration ? (isPublished ? "A foto será adicionada imediatamente a este perfil." : "As fotos ficam guardadas neste navegador até concluir o cadastro.") : "A foto será anexada ao perfil selecionado."}</span><button className="button-primary" disabled={adding || !file}>{adding ? "Salvando serviço..." : <><Plus size={16} /> Adicionar serviço</>}</button></div>
        </form>
      </section>
      <section className="dashboard-card service-list-card"><div className="dashboard-card-head"><div><span className="section-kicker">PORTFÓLIO DO PROFISSIONAL</span><h2>Serviços adicionados</h2></div><span className="portfolio-count">{stepItems.length.toString().padStart(2, "0")}</span></div>
        {stepItems.length ? <div className="portfolio-grid dashboard-gallery">{stepItems.map(item => <article key={item.id} className="portfolio-card">{"imageKey" in item ? <img src={`/manus-storage/${item.imageKey}`} alt={item.title} /> : <LocalDraftPhoto item={item} />}<div className="portfolio-card-info"><span className="specialty-tag">{item.specialty}</span><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}{!("imageKey" in item) && <button className="remove-local-service" type="button" onClick={async () => { await removeLocalDraftService(item.id); await refreshLocalServices(); }}> <Trash2 size={13} /> Remover</button>}</div></article>)}</div> : <div className="portfolio-empty"><div className="empty-icon"><ImagePlus size={20} /></div><b>Adicione pelo menos um serviço com foto</b><span>Seu perfil só será publicado depois desta etapa.</span></div>}
      </section>
      {saveError && <div className="services-error" role="alert">{saveError}</div>}
      {isGuestRegistration && <div className="services-auth-note"><LockKeyhole size={16} /><span>{isPublished ? "Não é necessário entrar ou criar conta. As novas fotos serão salvas neste perfil." : "Não é necessário entrar ou criar conta. Ao concluir, seu perfil e as fotos serão publicados e você voltará para a página inicial."}</span></div>}
      <div className="services-finish-row"><Link href={detailsHref} className="text-button"><ArrowLeft size={15} /> Voltar aos dados</Link><button className="button-primary finish-registration" type="button" onClick={finishRegistration} disabled={finishing || (hasGuestCredential && guestProfileQuery.isLoading) || (!isPublished && serviceCount < 1)}>{finishing ? `Concluindo${progress ? ` · ${progress} foto(s)` : "..."}` : completeLabel}<ArrowRight size={16} /></button></div>
    </div><aside className="services-aside"><div className="service-profile-summary"><span className="section-kicker">{isPublished ? "PERFIL PUBLICADO" : "CADASTRO EM ANDAMENTO"}</span><div className="avatar avatar-medium">{displayedProfileName.slice(0, 1).toUpperCase()}</div><b>{displayedProfileName}</b><span>{profile?.professionalName ?? draftProfile?.professionalName ?? "Profissional"}</span><div className="draft-private-note"><LockKeyhole size={14} /> {isPublished ? "Perfil visível no diretório" : "Rascunho privado até concluir"}</div></div><div className="dashboard-tip"><span className="tip-label">PRÓXIMO PASSO</span><b>Adicione as fotos antes de concluir.</b><p>Inclua pelo menos um serviço com foto para publicar este perfil no diretório.</p></div></aside></div>
  </main></div>;
}
