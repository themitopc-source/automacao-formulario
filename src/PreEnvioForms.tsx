import React, { useEffect, useMemo, useState } from "react";

/** ========= TIPOS ========= */
type FormState = {
  classificacao: string;
  empresa: string;
  unidade: string;
  data: string;
  hora: string;
  turno: string;
  area: string;
  setor: string;
  atividade: string;
  intervencao: string;
  cs: string;
  observacao: string;
  descricao: string;
  fiz: string;
};

type Errors = Partial<Record<keyof FormState, string>>;

/** ========= CONSTANTES ========= */
const VALID_KEYS = new Set(["THEMITO", "THEMITO10", "THEMITO50*", "THEMITO100#"]);
const GLOBAL_DAILY_LIMIT = 10; // limite global por dia para qualquer pessoa

const OBSERVACOES = [
  "Condição estrutural do equipamento","Condição estrutural do local",
  "Construção civil","COVID","Descarte de lixo","Direção segura",
  "Elevação e movimentação de carga","Espaço Confinado","LOTO",
  "Meio Ambiente - Fumaça Preta","Meio Ambiente - Resíduos",
  "Meio Ambiente - Vazamentos","Meio Ambiente - Vinhaça",
  "Mov. cargas e interface Homem Máquina","Permissão de Serviços e procedimentos",
  "Regra dos três pontos","Segurança de processo (Aplicável na Indústria)",
  "Serviço elétrico","Serviços a quente","Trabalho em Altura",
  "Uso de EPIS","5S"
];

const UNIDADES = [
  "Araraquara","Barra","Benalcool","Bonfim","Caarapó","Continental","Costa Pinto",
  "Destivale","Diamante","Dois Córregos","Gasa","Ipaussu","Jataí","Junqueira",
  "Lagoa da Prata","Leme","Maracaí","MB","Mundial","Paraguaçú","Paraíso",
  "Passa Tempo","Rafard","Rio Brilhante","Santa Cândida","Santa Elisa",
  "Santa Helena","São Francisco","Serra","Tarumã","Univalem","Vale do Rosário"
];

const AREAS = [
  "Administrativo","Agrícola","Almoxarifado","Automação",
  "Biogás","Etanol de Segunda Geração (E2G)","Industrial",
];

const HORAS = Array.from({ length: 48 }, (_, i) => {
  const hh = String(Math.floor(i / 2)).padStart(2, "0");
  const mm = i % 2 === 0 ? "00" : "30";
  return `${hh}:${mm}`;
});

function todayISO() { return new Date().toISOString().slice(0, 10); }
function usageKey() { return `preenvio:usage:${todayISO()}`; }
function getUsage() { try { return parseInt(localStorage.getItem(usageKey()) || "0", 10) || 0; } catch { return 0; } }
function setUsage(v: number) { try { localStorage.setItem(usageKey(), String(Math.max(0, v))); } catch {} }
function brDate(d: Date) { return d.toLocaleDateString("pt-BR"); }
function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export default function PreEnvioForms(): JSX.Element {
  // licença (apenas desbloqueio; limite é global = 10)
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseMsg, setLicenseMsg] = useState("Insira a chave e valide.");
  const [unlocked, setUnlocked] = useState(false);

  // antispam global
  const [used, setUsed] = useState(0);

  // progresso fake
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("");

  // erros
  const [errors, setErrors] = useState<Errors>({});

  // form
  const [form, setForm] = useState<FormState>({
    classificacao: "Quase acidente",
    empresa: "Raízen",
    unidade: "Vale do Rosário",
    data: new Date().toLocaleDateString("pt-BR"),
    hora: "08:00",
    turno: "A",
    area: "Administrativo",
    setor: "",
    atividade: "",
    intervencao: "",
    cs: "",
    observacao: OBSERVACOES[0],
    descricao: "",
    fiz: "",
  });

  // datas de exemplo para 10x
  const exampleDates10 = useMemo(() => {
    const arr: string[] = [];
    for (let i = 0; i < 10; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      arr.push(brDate(d));
    }
    return arr.join(", ");
  }, []);

  useEffect(() => {
    setUsed(getUsage());
  }, []);

  function onChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  function validateKey() {
    const k = licenseKey.trim().toUpperCase();
    if (!VALID_KEYS.has(k)) {
      setLicenseMsg("Chave inválida.");
      setUnlocked(false);
      return;
    }
    setUnlocked(true);
    setLicenseMsg(`Chave válida. Limite diário global: ${GLOBAL_DAILY_LIMIT}. Hoje usados: ${getUsage()}.`);
  }

  function isValidCS(cs: string) {
    if (!/^\d+$/.test(cs)) return false;
    const n = Number(cs);
    return n >= 10 && n <= 999_999_999;
  }

  function validateRequired(): boolean {
    const e: Errors = {};
    if (!form.classificacao) e.classificacao = "Esta pergunta é obrigatória.";
    if (!form.empresa) e.empresa = "Esta pergunta é obrigatória.";
    if (!form.unidade) e.unidade = "Esta pergunta é obrigatória.";
    if (!form.data) e.data = "Esta pergunta é obrigatória.";
    if (!form.hora) e.hora = "Esta pergunta é obrigatória.";
    if (!form.turno) e.turno = "Esta pergunta é obrigatória.";
    if (!form.area) e.area = "Esta pergunta é obrigatória.";
    if (!form.setor.trim()) e.setor = "Esta pergunta é obrigatória.";
    if (!form.atividade.trim()) e.atividade = "Esta pergunta é obrigatória.";
    if (!form.intervencao.trim()) e.intervencao = "Esta pergunta é obrigatória.";
    if (!form.cs.trim() || !isValidCS(form.cs)) e.cs = "Esta pergunta é obrigatória.";
    if (!form.observacao) e.observacao = "Esta pergunta é obrigatória.";
    if (!form.descricao.trim()) e.descricao = "Esta pergunta é obrigatória.";
    if (!form.fiz.trim()) e.fiz = "Esta pergunta é obrigatória.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function fakeProgress() {
    setRunning(true);
    setStep("Validando campos...");
    setProgress(15);
    await delay(350);
    setStep("Preparando rascunho...");
    setProgress(45);
    await delay(450);
    setStep("Gerando pacote...");
    setProgress(75);
    await delay(550);
    setStep("Pacote salvo. Seu formulário será enviado posteriormente.");
    setProgress(100);
    await delay(250);
    setRunning(false);
  }

  async function uploadToServer(pacote: any) {
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pacote }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async function gerar(simular10x = false) {
    if (!unlocked) { alert("Valide a chave antes de gerar o pacote."); return; }
    if (!validateRequired()) return;

    const unidades = simular10x ? 10 : 1;
    const jaUsado = getUsage();
    if (jaUsado + unidades > GLOBAL_DAILY_LIMIT) {
      const restam = Math.max(0, GLOBAL_DAILY_LIMIT - jaUsado);
      alert(`Limite diário atingido.\nLimite global: ${GLOBAL_DAILY_LIMIT}/dia.\nHoje já gerou: ${jaUsado}. Restam: ${restam}.`);
      return;
    }

    const queue: Array<{ data: string; hora: string }> = [];
    if (simular10x) {
      for (let i = 0; i < 10; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        queue.push({ data: brDate(d), hora: form.hora });
      }
    } else {
      queue.push({ data: form.data, hora: form.hora });
    }

    const pacote = {
      schema_version: "1.0.0",
      form_url: "https://forms.office.com/Pages/ResponsePage.aspx?id=...", // informativo
      license: { unlocked: true },
      last_values: { ...form },
      queue,
      meta: { generated_at: new Date().toISOString(), note: "Rascunho para envio posterior." },
    };

    try {
      await fakeProgress();
      const resp = await uploadToServer(pacote);
      alert(`Salvo no GitHub com sucesso!\n${resp?.html_url ?? ""}`);
      setUsage(jaUsado + unidades);
      setUsed(jaUsado + unidades);
    } catch (e: any) {
      alert("Falha ao salvar no GitHub: " + String(e?.message ?? e));
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
        <h1 className="text-xl md:text-2xl font-bold">Pré-envio de Formulários</h1>
      </header>

      <main className="max-w-5xl mx-auto px-4">
        {/* Licença */}
        <div className="bg-gray-800 rounded-xl p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
            <input
              name="license"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              placeholder="Insira a chave"
              className="px-3 py-2 rounded-md bg-gray-700 w-full md:w-64 outline-none"
            />
            <button
              onClick={validateKey}
              className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500"
            >
              Validar chave
            </button>
            <div className="text-sm text-gray-300">{licenseMsg}</div>
          </div>
          <div className="text-xs text-gray-400 mt-1">Uso de hoje (global): {used}/{GLOBAL_DAILY_LIMIT}</div>
        </div>

        {/* Formulário */}
        <div className="bg-gray-800 rounded-xl p-5">
          <Field label="1. Classificação">
            <select name="classificacao" value={form.classificacao} onChange={onChange} className="select">
              <option>Quase acidente</option>
              <option>Comportamento inseguro</option>
              <option>Condição insegura</option>
            </select>
            <Error text={errors.classificacao} />
          </Field>

          <Field label="2. Empresa">
            <select name="empresa" value={form.empresa} onChange={onChange} className="select">
              <option>Raízen</option>
              <option>Contratada</option>
            </select>
            <Error text={errors.empresa} />
          </Field>

          <Field label="3. Unidade">
            <select name="unidade" value={form.unidade} onChange={onChange} className="select">
              {UNIDADES.map((u) => <option key={u}>{u}</option>)}
            </select>
            <Error text={errors.unidade} />
          </Field>

          <Field label="4. Data">
            <input name="data" value={form.data} onChange={onChange} className="input" placeholder="dd/mm/aaaa" />
            <Error text={errors.data} />
          </Field>

          <Field label="5. Hora">
            <select name="hora" value={form.hora} onChange={onChange} className="select">
              {HORAS.map((h) => <option key={h}>{h}</option>)}
            </select>
            <Error text={errors.hora} />
          </Field>

          <Field label="6. Turno">
            <select name="turno" value={form.turno} onChange={onChange} className="select">
              <option>A</option><option>B</option><option>C</option>
            </select>
            <Error text={errors.turno} />
          </Field>

          <Field label="7. Área onde a intervenção foi realizada">
            <select name="area" value={form.area} onChange={onChange} className="select">
              {AREAS.map((a) => <option key={a}>{a}</option>)}
            </select>
            <Error text={errors.area} />
          </Field>

          <Field label="8. Setor onde a intervenção foi realizada">
            <input name="setor" value={form.setor} onChange={onChange} className="input" placeholder="Informe o setor" />
            <Error text={errors.setor} />
          </Field>

          <Field label="9. Atividade realizada no momento da intervenção">
            <input name="atividade" value={form.atividade} onChange={onChange} className="input" placeholder="Descreva a atividade" />
            <Error text={errors.atividade} />
          </Field>

          <Field label="10. Intervenção realizada por">
            <input name="intervencao" value={form.intervencao} onChange={onChange} className="input" placeholder="Nome/identificação" />
            <Error text={errors.intervencao} />
          </Field>

          <Field label="11. CS (somente o número)">
            <input name="cs" value={form.cs} onChange={onChange} className="input" placeholder="Digite um número entre 10 e 999999999" />
            <Error text={errors.cs} />
          </Field>

          <Field label="12. O que observei?">
            <select name="observacao" value={form.observacao} onChange={onChange} className="select">
              {OBSERVACOES.map((o) => <option key={o}>{o}</option>)}
            </select>
            <Error text={errors.observacao} />
          </Field>

          <Field label="13. Breve descrição do que foi observado">
            <textarea name="descricao" value={form.descricao} onChange={onChange} className="textarea" placeholder="Descreva brevemente" />
            <Error text={errors.descricao} />
          </Field>

          <Field label="14. O que eu fiz a respeito?">
            <textarea name="fiz" value={form.fiz} onChange={onChange} className="textarea" placeholder="Explique sua ação" />
            <Error text={errors.fiz} />
          </Field>

          {/* BOTÕES */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              title="Gera um pacote (1x). Seu formulário será enviado posteriormente."
              onClick={() => gerar(false)}
              disabled={running}
              className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-500 disabled:opacity-60"
            >
              Gerar pacote (1x)
            </button>

            <button
              title={`Gera 10 entradas retrocedendo a data (ex.: ${exampleDates10}).`}
              onClick={() => gerar(true)}
              disabled={running}
              className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-500 disabled:opacity-60"
            >
              Gerar lote (10x)
            </button>

            <div className="text-sm text-gray-300 self-center">
              Hoje: {used}/{GLOBAL_DAILY_LIMIT}
            </div>
          </div>

          {/* PROGRESSO */}
          {running && (
            <div className="mt-6">
              <div className="h-2 bg-gray-700 rounded">
                <div className="h-2 bg-indigo-500 rounded transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="text-xs text-gray-300 mt-2">{step}</div>
            </div>
          )}
        </div>
      </main>

      {/* utilitários inline (funcionam bem com Tailwind) */}
      <style>{`
        .input { width:100%; padding:0.5rem 0.75rem; border-radius:0.375rem; background:#374151; outline:none; }
        .select { width:100%; padding:0.5rem 0.75rem; border-radius:0.375rem; background:#374151; outline:none; }
        .textarea { width:100%; min-height:90px; padding:0.5rem 0.75rem; border-radius:0.375rem; background:#374151; outline:none; }
      `}</style>
    </div>
  );
}

/** ========= SUBCOMPONENTES ========= */
function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1 text-sm text-gray-300">{props.label}</div>
      {props.children}
    </div>
  );
}

function Error({ text }: { text?: string }) {
  if (!text) return null;
  return <div className="text-red-400 text-xs mt-1">{text}</div>;
}
