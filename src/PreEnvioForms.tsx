import React, { useMemo, useState, useEffect } from "react";

/** ===================== CONSTANTES ===================== */

const CLASSIFICACOES = [
  "Quase acidente",
  "Comportamento inseguro",
  "Condição insegura",
];

const EMPRESAS = ["Raízen", "Contratada"];

const UNIDADES = [
  "Araraquara","Barra","Benalcool","Bonfim","Caarapó","Continental","Costa Pinto",
  "Destivale","Diamante","Dois Córregos","Gasa","Ipaussu","Jataí","Junqueira",
  "Lagoa da Prata","Leme","Maracaí","MB","Mundial","Paraguaçú","Paraíso",
  "Passa Tempo","Rafard","Rio Brilhante","Santa Cândida","Santa Elisa",
  "Santa Helena","São Francisco","Serra","Tarumã","Univalem","Vale do Rosário"
];

const HORAS = (() => {
  const v: string[] = [];
  for (let h = 0; h < 24; h++) {
    v.push(`${String(h).padStart(2, "0")}:00`);
    v.push(`${String(h).padStart(2, "0")}:30`);
  }
  return v;
})();

const TURNOS = ["A", "B", "C"];

const AREAS = ["Adm", "Agr", "Alm", "Aut", "Biogás", "E2G", "Ind"];

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

const GLOBAL_DAILY_LIMIT = 10;

/** ===================== HELPERS ===================== */

function hojeKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
const LS_KEY_COUNT = "preenvio_used_" + hojeKey();

function getUsedToday(): number {
  const raw = localStorage.getItem(LS_KEY_COUNT);
  return raw ? Number(raw) || 0 : 0;
}
function addUsedToday(qtd: number) {
  const cur = getUsedToday();
  localStorage.setItem(LS_KEY_COUNT, String(cur + qtd));
}

function toDDMMYYYY(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function ddmmyyyyIsValid(v: string) {
  // dd/mm/yyyy básico
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const d = new Date(yyyy, mm - 1, dd);
  return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
}

async function salvarNoServidor(payload: any) {
  const res = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let data: any = {};
  try {
    data = await res.json();
  } catch {}
  if (!res.ok || !data?.ok) {
    const msg =
      data?.error || `Falha ao salvar (HTTP ${res.status}). Verifique as variáveis no Vercel.`;
    throw new Error(msg);
  }
  return data as { ok: true; path: string; content_sha: string; commit_sha: string };
}

/** ===================== TIPO DO FORM ===================== */

type FormData = {
  classificacao: string;
  empresa: string;
  unidade: string;
  data: string; // dd/mm/yyyy
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

type Errors = Partial<Record<keyof FormData, string>>;

/** ===================== COMPONENTE ===================== */

export default function PreEnvioForms() {
  const [form, setForm] = useState<FormData>({
    classificacao: "",
    empresa: "",
    unidade: "",
    data: toDDMMYYYY(new Date()),
    hora: "",
    turno: "",
    area: "",
    setor: "",
    atividade: "",
    intervencao: "",
    cs: "",
    observacao: "",
    descricao: "",
    fiz: "",
  });

  const [errors, setErrors] = useState<Errors>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("");

  const used = getUsedToday();
  const remaining = Math.max(0, GLOBAL_DAILY_LIMIT - used);

  useEffect(() => {
    // Atualiza o título com limite usado
    document.title = `Pré-envio (${used}/${GLOBAL_DAILY_LIMIT})`;
  }, [used]);

  const exampleDates10 = useMemo(() => {
    const hoje = new Date();
    return Array.from({ length: 3 })
      .map((_, i) => toDDMMYYYY(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - i)))
      .join(", ") + ", ...";
  }, []);

  function onChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    // limpa erro do campo ao digitar
    setErrors((err) => ({ ...err, [name]: undefined }));
  }

  function validate(f: FormData): Errors {
    const e: Errors = {};
    const REQ = "Esta pergunta é obrigatória.";

    if (!f.classificacao) e.classificacao = REQ;
    if (!f.empresa) e.empresa = REQ;
    if (!f.unidade) e.unidade = REQ;

    if (!f.data) e.data = REQ;
    else if (!ddmmyyyyIsValid(f.data)) e.data = "Informe a data no formato dd/mm/aaaa.";

    if (!f.hora) e.hora = REQ;
    if (!f.turno) e.turno = REQ;
    if (!f.area) e.area = REQ;

    if (!f.setor) e.setor = REQ;
    if (!f.atividade) e.atividade = REQ;
    if (!f.intervencao) e.intervencao = REQ;

    if (!f.cs) e.cs = REQ;
    else if (!/^\d+$/.test(f.cs) || Number(f.cs) < 10 || Number(f.cs) > 999999999) {
      e.cs = "Informe um número entre 10 e 999999999.";
    }

    if (!f.observacao) e.observacao = REQ;
    if (!f.descricao) e.descricao = REQ;
    if (!f.fiz) e.fiz = REQ;

    return e;
  }

  async function gerar(lote10: boolean) {
    if (running) return;

    // Limite diário
    if (remaining <= 0) {
      alert(`Limite diário atingido (${GLOBAL_DAILY_LIMIT}/${GLOBAL_DAILY_LIMIT}). Tente amanhã.`);
      return;
    }

    // Validação
    const v = validate(form);
    setErrors(v);
    const hasError = Object.values(v).some(Boolean);
    if (hasError) {
      // foca no primeiro erro
      const first = Object.entries(v).find(([, msg]) => msg);
      if (first) {
        const el = document.querySelector(`[name="${first[0]}"]`) as HTMLElement | null;
        el?.focus();
      }
      return;
    }

    try {
      setRunning(true);
      setProgress(0);
      setStep("Preparando pacote...");

      if (!lote10) {
        // 1x
        const payload = {
          tipo: "single",
          quando: new Date().toISOString(),
          dados: form,
          info: { notice: "Seu formulário será enviado posteriormente." },
        };

        setStep("Salvando no servidor...");
        const r = await salvarNoServidor(payload);
        setProgress(100);
        addUsedToday(1);
        alert(`Pacote gerado e arquivado: ${r.path}`);
      } else {
        // 10x com datas retroativas
        const hoje = new Date();
        const itens = Array.from({ length: Math.min(10, remaining) }).map((_, i) => {
          const d = new Date(hoje);
          d.setDate(d.getDate() - i);
          return { ...form, data: toDDMMYYYY(d) };
        });

        // Simula progresso
        for (let i = 0; i <= 70; i += 10) {
          setProgress(i);
          await new Promise((res) => setTimeout(res, 80));
        }

        setStep("Salvando lote no servidor...");
        const payload = {
          tipo: "lote10",
          quando: new Date().toISOString(),
          itens,
          info: { notice: "Seu formulário será enviado posteriormente." },
        };
        const r = await salvarNoServidor(payload);
        setProgress(100);
        addUsedToday(itens.length);
        alert(`Lote (${itens.length}x) arquivado: ${r.path}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Falha ao salvar: ${err?.message || err}`);
    } finally {
      setRunning(false);
      setStep("");
      setProgress(0);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <header className="px-5 py-4 border-b border-gray-800">
        <h1 className="text-xl font-semibold">Pré-envio de Formulários</h1>
        <p className="text-sm text-gray-300 mt-1">
          Seu formulário será enviado posteriormente.
        </p>
      </header>

      <main className="max-w-3xl mx-auto p-5">
        <div className="rounded-lg bg-gray-800/60 p-5 shadow-lg">
          <div className="mb-4 text-sm text-gray-300">
            Todos os campos são obrigatórios.
          </div>

          {/* 1. Classificação */}
          <Field label="1. Classificação">
            <select name="classificacao" value={form.classificacao} onChange={onChange} className="select">
              <option value="">Selecione...</option>
              {CLASSIFICACOES.map((o) => <option key={o}>{o}</option>)}
            </select>
            <Error text={errors.classificacao} />
          </Field>

          {/* 2. Empresa */}
          <Field label="2. Empresa">
            <select name="empresa" value={form.empresa} onChange={onChange} className="select">
              <option value="">Selecione...</option>
              {EMPRESAS.map((o) => <option key={o}>{o}</option>)}
            </select>
            <Error text={errors.empresa} />
          </Field>

          {/* 3. Unidade */}
          <Field label="3. Unidade">
            <select name="unidade" value={form.unidade} onChange={onChange} className="select">
              <option value="">Selecione...</option>
              {UNIDADES.map((o) => <option key={o}>{o}</option>)}
            </select>
            <Error text={errors.unidade} />
          </Field>

          {/* 4. Data */}
          <Field label="4. Data">
            <input
              name="data"
              value={form.data}
              onChange={onChange}
              className="input"
              placeholder="dd/mm/aaaa"
            />
            <Error text={errors.data} />
          </Field>

          {/* 5. Hora */}
          <Field label="5. Hora">
            <select name="hora" value={form.hora} onChange={onChange} className="select">
              <option value="">Selecione...</option>
              {HORAS.map((o) => <option key={o}>{o}</option>)}
            </select>
            <Error text={errors.hora} />
          </Field>

          {/* 6. Turno */}
          <Field label="6. Turno">
            <select name="turno" value={form.turno} onChange={onChange} className="select">
              <option value="">Selecione...</option>
              {TURNOS.map((o) => <option key={o}>{o}</option>)}
            </select>
            <Error text={errors.turno} />
          </Field>

          {/* 7. Área onde a intervenção foi realizada */}
          <Field label="7. Área onde a intervenção foi realizada">
            <select name="area" value={form.area} onChange={onChange} className="select">
              <option value="">Selecione...</option>
              {AREAS.map((o) => <option key={o}>{o}</option>)}
            </select>
            <Error text={errors.area} />
          </Field>

          {/* 8. Setor */}
          <Field label="8. Setor onde a intervenção foi realizada">
            <input
              name="setor"
              value={form.setor}
              onChange={onChange}
              className="input"
              placeholder="Digite o setor"
            />
            <Error text={errors.setor} />
          </Field>

          {/* 9. Atividade */}
          <Field label="9. Atividade realizada no momento da intervenção">
            <input
              name="atividade"
              value={form.atividade}
              onChange={onChange}
              className="input"
              placeholder="Descreva a atividade"
            />
            <Error text={errors.atividade} />
          </Field>

          {/* 10. Intervenção realizada por */}
          <Field label="10. Intervenção realizada por">
            <input
              name="intervencao"
              value={form.intervencao}
              onChange={onChange}
              className="input"
              placeholder="Nome de quem realizou"
            />
            <Error text={errors.intervencao} />
          </Field>

          {/* 11. CS */}
          <Field label="11. CS (somente o número)">
            <input
              name="cs"
              value={form.cs}
              onChange={onChange}
              className="input"
              placeholder="Entre 10 e 999999999"
              inputMode="numeric"
            />
            <Error text={errors.cs} />
          </Field>

          {/* 12. O que observei? */}
          <Field label="12. O que observei?">
            <select name="observacao" value={form.observacao} onChange={onChange} className="select">
              <option value="">Selecione...</option>
              {OBSERVACOES.map((o) => <option key={o}>{o}</option>)}
            </select>
            <Error text={errors.observacao} />
          </Field>

          {/* 13. Descrição */}
          <Field label="13. Breve descrição do que foi observado">
            <textarea
              name="descricao"
              value={form.descricao}
              onChange={onChange}
              className="textarea"
              placeholder="Descreva brevemente"
            />
            <Error text={errors.descricao} />
          </Field>

          {/* 14. O que eu fiz a respeito? */}
          <Field label="14. O que eu fiz a respeito?">
            <textarea
              name="fiz"
              value={form.fiz}
              onChange={onChange}
              className="textarea"
              placeholder="Explique sua ação"
            />
            <Error text={errors.fiz} />
          </Field>

          {/* BOTÕES */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              title="Gera um pacote (1x). Seu formulário será enviado posteriormente."
              onClick={() => gerar(false)}
              disabled={running || remaining <= 0}
              className="px-4 py-2 rounded-md bg-purple-600 hover:bg-purple-500 disabled:opacity-60"
            >
              Gerar pacote (1x)
            </button>

            <button
              title={`Gera 10 entradas retrocedendo a data (ex.: ${exampleDates10}).`}
              onClick={() => gerar(true)}
              disabled={running || remaining <= 0}
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

/** ===================== SUBCOMPONENTES ===================== */

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
