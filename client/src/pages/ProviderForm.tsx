import { ArrowLeft, ArrowRight, Check, CheckCircle2, LockKeyhole, Save } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import SiteHeader from "@/components/SiteHeader";
import { useAuth } from "@/_core/hooks/useAuth";
import { SPECIALTIES, type Specialty } from "@/lib/catalog";
import { readPendingGuestClaimForProfile } from "@/lib/guestClaim";
import { trpc } from "@/lib/trpc";

type ProfileDraft = {
  companyName: string;
  professionalName: string;
  phone: string;
  whatsapp: string;
  specialties: string[];
  description: string;
};
const emptyForm: ProfileDraft = { companyName: "", professionalName: "", phone: "", whatsapp: "", specialties: [], description: "" };
const EMPTY_GUEST_TOKEN = "00000000-0000-4000-8000-000000000000";

export default function ProviderForm() {
  const { isAuthenticated, loading } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const rawEditId = Number(params.get("edit"));
  const editId = Number.isInteger(rawEditId) && rawEditId > 0 ? rawEditId : null;
  const rawGuestEditId = Number(params.get("guestEdit"));
  const guestEditId = Number.isInteger(rawGuestEditId) && rawGuestEditId > 0 ? rawGuestEditId : null;
  const guestEditCredential = guestEditId !== null ? readPendingGuestClaimForProfile(guestEditId) : null;
  const accountMode = editId !== null || params.get("account") === "1";
  const resumeDraft = params.get("draft") === "1" && editId === null && guestEditId === null;
  const profileQuery = trpc.providers.ownedById.useQuery({ id: editId ?? 1 }, { enabled: isAuthenticated && editId !== null, retry: false });
  const guestProfileQuery = trpc.providers.guestDraft.useQuery(
    { profileId: guestEditId ?? 1, token: guestEditCredential?.token ?? EMPTY_GUEST_TOKEN },
    { enabled: guestEditId !== null && guestEditCredential !== null, retry: false },
  );
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const [form, setForm] = useState<ProfileDraft>(emptyForm);
  const [initialized, setInitialized] = useState(false);
  const saveProfile = trpc.providers.save.useMutation({
    onSuccess: async profile => {
      localStorage.removeItem("construcao-profile-draft");
      await utils.providers.mineList.invalidate();
      await utils.providers.mine.invalidate();
      await utils.providers.list.invalidate();
      if (editId !== null && profile.isComplete) {
        toast.success("Cadastro atualizado.");
        navigate(`/profissional/${profile.id}`);
        return;
      }
      toast.success("Dados guardados. Agora cadastre os serviços e fotos.");
      navigate(`/cadastro/servicos?profileId=${profile.id}`);
    },
    onError: error => toast.error(error.message),
  });
  const createGuestDraft = trpc.providers.createGuestDraft.useMutation();
  const updateGuestProfile = trpc.providers.updateGuestProfile.useMutation({
    onSuccess: async result => {
      await utils.providers.byId.invalidate({ id: result.id });
      await utils.providers.list.invalidate();
      toast.success("Cadastro atualizado.");
      navigate(`/profissional/${result.id}`);
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (initialized || (loading && accountMode)) return;
    if (accountMode && isAuthenticated && editId !== null && profileQuery.isLoading) return;
    if (guestEditId !== null && guestEditCredential && guestProfileQuery.isLoading) return;
    let next = emptyForm;
    if (editId !== null && profileQuery.data) {
      next = {
        companyName: profileQuery.data.companyName,
        professionalName: profileQuery.data.professionalName,
        phone: profileQuery.data.phone,
        whatsapp: profileQuery.data.whatsapp,
        specialties: profileQuery.data.specialties,
        description: profileQuery.data.description,
      };
    } else if (guestEditId !== null && guestProfileQuery.data) {
      next = {
        companyName: guestProfileQuery.data.companyName,
        professionalName: guestProfileQuery.data.professionalName,
        phone: guestProfileQuery.data.phone,
        whatsapp: guestProfileQuery.data.whatsapp,
        specialties: guestProfileQuery.data.specialties,
        description: guestProfileQuery.data.description,
      };
    } else if (resumeDraft) {
      try {
        const saved = localStorage.getItem("construcao-profile-draft");
        if (saved) next = { ...emptyForm, ...JSON.parse(saved) };
      } catch { /* ignore an invalid saved draft */ }
    }
    setForm(next);
    setInitialized(true);
  }, [initialized, loading, isAuthenticated, accountMode, editId, guestEditId, guestEditCredential?.token, resumeDraft, profileQuery.data, profileQuery.isLoading, guestProfileQuery.data, guestProfileQuery.isLoading]);

  const update = <K extends keyof ProfileDraft>(field: K, value: ProfileDraft[K]) => setForm(current => ({ ...current, [field]: value }));
  const toggleSpecialty = (specialty: string) => update("specialties", form.specialties.includes(specialty) ? form.specialties.filter(item => item !== specialty) : [...form.specialties, specialty]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.specialties.length === 0) { toast.error("Selecione ao menos uma especialidade."); return; }
    if (form.description.trim().length < 10) { toast.error("Conte um pouco mais sobre seus serviços."); return; }
    if (guestEditId !== null) {
      if (!guestEditCredential || !guestProfileQuery.data) { toast.error("Não foi possível autorizar a edição neste navegador."); return; }
      updateGuestProfile.mutate({ profileId: guestEditId, token: guestEditCredential.token, ...form, specialties: form.specialties as Specialty[] });
      return;
    }
    if (accountMode && !isAuthenticated) {
      toast.error("Entre na sua conta para administrar perfis vinculados.");
      return;
    }
    if (accountMode) {
      saveProfile.mutate({ ...(editId !== null ? { profileId: editId } : {}), ...form, specialties: form.specialties as Specialty[] });
      return;
    }
    try {
      let prior: { guestToken?: string } = {};
      if (resumeDraft) {
        try { prior = JSON.parse(localStorage.getItem("construcao-profile-draft") ?? "{}"); } catch { /* start a new token if saved state is invalid */ }
      }
      const token = prior.guestToken && /^[0-9a-f-]{36}$/i.test(prior.guestToken) ? prior.guestToken : crypto.randomUUID();
      const draft = await createGuestDraft.mutateAsync({ token, ...form, specialties: form.specialties as Specialty[] });
      localStorage.setItem("construcao-profile-draft", JSON.stringify({ ...form, guestToken: token, profileId: draft.id }));
      toast.success("Dados guardados. Agora adicione fotos dos serviços.");
      navigate(`/cadastro/servicos?profileId=${draft.id}&guest=1`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível guardar seus dados.");
    }
  };

  if (!initialized && ((loading && accountMode) || (accountMode && isAuthenticated && editId !== null && profileQuery.isLoading) || (guestEditId !== null && guestEditCredential !== null && guestProfileQuery.isLoading))) return <div className="app-shell"><SiteHeader /><main className="state-page">Preparando seu cadastro...</main></div>;
  if (editId !== null && profileQuery.error) return <div className="app-shell"><SiteHeader /><main className="state-page"><h2>Este perfil não foi encontrado na sua conta.</h2><p>Volte ao painel e selecione o perfil que deseja editar.</p><Link className="text-button" href="/painel">Voltar ao painel <ArrowRight size={15} /></Link></main></div>;
  if (guestEditId !== null && (!guestEditCredential || guestProfileQuery.error)) return <div className="app-shell"><SiteHeader /><main className="state-page"><h2>Não foi possível abrir este cadastro para edição.</h2><p>Abra o perfil no mesmo navegador usado para concluir o cadastro.</p><Link className="text-button" href={`/profissional/${guestEditId}`}>Voltar ao perfil <ArrowRight size={15} /></Link></main></div>;
  const isEditing = (editId !== null && Boolean(profileQuery.data)) || (guestEditId !== null && Boolean(guestProfileQuery.data));
  return (
    <div className="app-shell"><SiteHeader /><main className="form-page">
      <Link href="/" className="back-link"><ArrowLeft size={16} /> Voltar ao diretório</Link>
      <div className="form-layout">
        <aside className="form-intro"><span className="section-kicker">FAÇA PARTE DA REDE LOCAL</span><div className="form-number">01<span>/02</span></div><h1>{isEditing ? "Seu trabalho merece ser visto." : "Mostre o que você faz de melhor."}</h1><p>Crie um perfil independente para cada profissional ou empresa da sua rede em Salto.</p><div className="form-benefit"><CheckCircle2 size={18} /><span>Seu perfil aparece nas buscas por especialidade.</span></div><div className="form-benefit"><CheckCircle2 size={18} /><span>Cadastre mais de um profissional na mesma conta.</span></div></aside>
        <form className="provider-form" onSubmit={submit}>
          <div className="form-topline"><div><span className="section-kicker">PERFIL DO PRESTADOR</span><h2>{isEditing ? "Editar este perfil" : "Novo cadastro de profissional"}</h2></div><span className="form-step"><span className="step-active">1</span><i /><span>2</span></span></div>
          <div className="form-section-title"><span className="form-section-number">01</span><div><b>Informações da empresa</b><small>Como as pessoas vão encontrar este profissional</small></div></div>
          <div className="field-grid"><label className="form-field">Nome da empresa<input required minLength={2} maxLength={120} value={form.companyName} onChange={e => update("companyName", e.target.value)} placeholder="Ex.: Silva Reformas" /></label><label className="form-field">Nome do profissional<input required minLength={2} maxLength={120} value={form.professionalName} onChange={e => update("professionalName", e.target.value)} placeholder="Nome do profissional" /></label></div>
          <div className="form-section-title"><span className="form-section-number">02</span><div><b>Informações de contato</b><small>Para clientes falarem diretamente com este profissional</small></div></div>
          <div className="field-grid"><label className="form-field">Telefone<input required type="tel" maxLength={24} value={form.phone} onChange={e => update("phone", e.target.value)} placeholder="(11) 00000-0000" /></label><label className="form-field">WhatsApp <span className="optional">Opcional</span><input type="tel" maxLength={24} value={form.whatsapp} onChange={e => update("whatsapp", e.target.value)} placeholder="(11) 00000-0000" /></label></div>
          <div className="form-section-title"><span className="form-section-number">03</span><div><b>Selecione as especialidades</b><small>Escolha todas que se aplicam</small></div></div>
          <div className="specialty-check-grid">{SPECIALTIES.map(specialty => <label key={specialty} className={`specialty-check ${form.specialties.includes(specialty) ? "checked" : ""}`}><input type="checkbox" checked={form.specialties.includes(specialty)} onChange={() => toggleSpecialty(specialty)} /><span className="check-box">{form.specialties.includes(specialty) && <Check size={13} />}</span><span>{specialty}</span></label>)}</div>
          <div className="form-section-title"><span className="form-section-number">04</span><div><b>Descrição de habilidades</b><small>Conte sobre o trabalho e a experiência</small></div></div>
          <label className="form-field">Sobre os serviços<textarea required minLength={10} maxLength={2000} rows={4} value={form.description} onChange={e => update("description", e.target.value)} placeholder="Descreva os serviços oferecidos..." /><span className="field-hint">{form.description.length}/2000 caracteres</span></label>
          <div className="form-submit-area"><button className="button-primary form-submit" type="submit" disabled={accountMode ? saveProfile.isPending : guestEditId !== null ? updateGuestProfile.isPending : createGuestDraft.isPending}><Save size={17} />{(accountMode ? saveProfile.isPending : guestEditId !== null ? updateGuestProfile.isPending : createGuestDraft.isPending) ? "Guardando..." : isEditing ? "Salvar e continuar" : "Guardar cadastro e continuar"}<ArrowRight size={16} /></button>
            {accountMode ? <span className="secure-note"><LockKeyhole size={13} /> Este perfil fica vinculado à sua conta.</span> : guestEditId !== null ? <span className="secure-note"><LockKeyhole size={13} /> A edição é autorizada pelo token privado deste navegador.</span> : <span className="secure-note">Cadastro gratuito sem criar conta; entre apenas se quiser administrar o perfil depois.</span>}
          </div>
        </form>
      </div>
    </main></div>
  );
}
