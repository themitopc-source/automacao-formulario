import React, { useEffect, useMemo, useState } from "react";

type Form = {
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

const CLASSIFICACOES = ["Quase acidente","Comportamento inseguro","Condição insegura"];
const EMPRESAS = ["Raízen","Contratada"];
const UNIDADES = [
  "Araraquara","Barra","Benalcool","Bonfim","Caarapó","Continental","Costa Pinto","Destivale","Diamante",
  "Dois Córregos","Gasa","Ipaussu","Jataí","Junqueira","Lagoa da Prata","Leme","Maracaí","MB","Mundial",
  "Paraguaçú","Paraíso","Passa Tempo","Rafard","Rio Brilhante","Santa Cândida","Santa Elisa","Santa Helena",
  "São Francisco","Serra","Tarumã","Univalem","Vale do Rosário"
];
const HORAS = Array.from({length: 48}, (_,i)=> {
  const h = String(Math.floor(i/2)).padStart(2,"0");
  const m = i%2===0 ? "00" : "30";
  return `${h}:${m}`;
});
const TURNOS = ["A","B","C"];
const AREAS = ["Adm","Agr","Alm","Aut","Biogás","E2G","Ind"];
const OBSERVACOES = [
  "Condição estrutural do equipamento","Condição estrutural do local","Construção civil","COVID","Descarte de lixo",
  "Direção segura","Elevação e movimentação de carga","Espaço Confinado","LOTO","Meio Ambiente - Fumaça Preta",
  "Meio Ambiente - Resíduos","Meio Ambiente - Vazamentos","Meio Ambiente - Vinhaça",
  "Mov. cargas e interface Homem Máquina","Permissão de Serviços e procedimentos","Regra dos três pontos",
  "Segurança de processo (Aplicável na Indústria)","Serviço elétrico","Serviços a quente","Trabalho em Altura",
  "Uso de EPIS","5S"
];

const GLOBAL_DAILY_LIMIT = 10;

// utils
const todayKey = () => {
  const d = new Date();
  return d.toISOString().slice(0,10); // YYYY-MM-DD
};
const fmtBR = (d: Date) => {
  const dd = String(d.getDate()).padStart(2,"0");
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};
const parseBR = (s: string) => {
  const [dd,mm,yyyy] = s.split("/");
  return new Date(Number(yyyy), Number(mm)-1, Number(dd));
};

export default function PreEnvioForms() {
  // estado base
  const [form, setForm] = useState<Form>(() => ({
    classificacao: "",
    empresa: "",
    unidade: "",
    data: fmtBR(new Date()),
    hora: "08:00",
    turno: "A",
    area: "",
    setor: "",
    atividade: "",
    intervencao: "",
    cs: "",
    observacao: "",
    descricao: "",
    fiz: "",
  }));

  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState("");
  const [used, setUsed] = useState(0);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);

  // carrega contador global do dia (client-side)
  useEffect(() => {
    const k = `usedCount:${todayKey()}`;
    const v = Number(localStorage.getItem(k) || "0");
    setUsed(isNaN(v) ? 0 : v);
  }, []);
  const bumpUsed = (inc: number) => {
    const k = `usedCount:${todayKey()}`;
    const cur = Number(localStorage.getItem(k) || "0");
    const next = Math.min(GLOBAL_DAILY_LIMIT, cur + inc);
    localStorage.setItem(k, String(next));
    setUsed(next);
  };

  // exemplos pro tooltip do 10x
  const exampleDates10 = useMemo(() => {
    const base = parseBR(form.data);
    const arr = [0,1,2].map(off => {
      const d = new Date(base);
      d.setDate(d.getDate() - off);
      return fmtBR(d);
    });
    return arr.join(", ");
  }, [form.data]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const validate = (): boolean => {
    const err: Partial<Record<keyof Form, string>> = {};
    const req = (key: keyof Form) => { if (!String(form[key]||"").trim()) err[key] = "Esta pergunta é obrigatória."; };

    req("classificacao");
    req("empresa");
    req("unidade");
    req("data");
    req("hora");
    req("turno");
    req("area");
    req("setor");
    req("atividade");
    req("intervencao");
    // cs numérico 10..999999999
    if (!/^\d+$/.test(form.cs)) err.cs = "Esta pergunta é obrigatória.";
    else {
      const n = Number(form.cs);
      if (n < 10 || n > 999999999) err.cs = "Informe um número entre 10 e 999999999.";
    }
    req("observacao");
    req("descricao");
    req("fiz");

    setErrors(err);
    return Object.keys(err).length === 0;
  };

  // salva no hosting (rota serverless /api/save) ou baixa .json local se offline
  async function saveToHostingOrDownload(payload: any) {
    try {
      const ctrl = new AbortController();
      const id = setTimeout(()=>ctrl.abort(), 5000);
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      clearTimeout(id);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch {
      // fallback: baixar arquivo local
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `preenvio_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      return false;
    }
  }

  async function gerar(lote10: boolean) {
    setLimitMsg(null);

    if (!validate()) return;

    const desired = lote10 ? 10 : 1;
    if (used + desired > GLOBAL_DAILY_LIMIT) {
      setLimitMsg(`Limite diário alcançado (${used}/${GLOBAL_DAILY_LIMIT}). Tente novamente amanhã.`);
      return;
    }

    setRunning(true);
    setProgress(0);
    setStep("Preparando dados...");

    try {
      const baseDate = parseBR(form.data);
      const entries: any[] = [];
      for (let i=0;i<desired;i++){
        const d = new Date(baseDate);
        if (lote10) d.setDate(d.getDate()-i);
        entries.push({
          ...form,
          data: fmtBR(d),
          createdAt: new Date().toISOString()
        });
        setProgress(Math.round(((i+1)/desired)*80)); // 0..80% enquanto prepara
      }

      setStep("Salvando pacote...");
      const ok = await saveToHostingOrDownload({
        kind: "preenvio-pack",
        count: desired,
        dayKey: todayKey(),
        entries
      });

      setProgress(100);
      setStep(ok ? "Pacote salvo na hospedagem." : "Download local gerado.");
      bumpUsed(desired);
    } catch (e:any) {
      setStep(`Erro: ${e?.message||e}`);
    } finally {
      setTimeout(()=>{ setRunning(false); setStep(""); setProgress(0); }, 800);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-white/10 bg-gray-900/80 sticky top-0 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">Pré-envio de Formulários</h1>
          <div className="text-xs text-gray-300">Seu formulário será enviado posteriormente.</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {limitMsg && <div className="mb-4 rounded-md bg-yellow-500/10 text-yellow-300 px-3 py-2 text-sm">{limitMsg}</div>}

        <div className="grid md:grid-cols-2 gap-4">
          <Field label="1. Classificação">
            <select name="classificacao" value={form.classificacao} onChange={onChange} className="select">
              <option value="">Selecione…</option>
              {CLASSIFICACOES.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <Error text={errors.classificacao} />
          </Field>

          <Field label="2. Empresa">
            <select name="empresa" value={form.empresa} onChange={onChange} className="select">
              <option value="">Selecione…</option>
              {EMPRESAS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <Error text={errors.empresa} />
          </Field>

          <Field label="3. Unidade">
            <select name="unidade" value={form.unidade} onChange={onChange} className="select">
              <option value="">Selecione…</option>
              {UNIDADES.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <Error text={errors.unidade} />
          </Field>

          <Field label="4. Data">
            <input name="data" value={form.data} onChange={onChange} className="input" placeholder="dd/mm/aaaa" />
            <Error text={errors.data} />
          </Field>

          <Field label="5. Hora">
            <select name="hora" value={form.hora} onChange={onChange} className="select">
              {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
            <Error text={errors.hora} />
          </Field>

          <Field label="6. Turno">
            <select name="turno" value={form.turno} onChange={onChange} className="select">
              {TURNOS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <Error text={errors.turno} />
          </Field>

          <Field label="7. Área onde a intervenção foi realizada">
            <select name="area" value={form.area} onChange={onChange} className="select">
              <option value="">Selecione…</option>
              {AREAS.map(o => <option key={o} value={o}>{o}</option>)}
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
            <input name="intervencao" value={form.intervencao} onChange={onChange} className="input" placeholder="Nome/Equipe" />
            <Error text={errors.intervencao} />
          </Field>

          <Field label="11. CS (somente o número)">
            <input name="cs" value={form.cs} onChange={onChange} className="input" inputMode="numeric" placeholder="entre 10 e 999999999" />
            <Error text={errors.cs} />
          </Field>

          <Field label="12. O que observei?">
            <select name="observacao" value={form.observacao} onChange={onChange} className="select">
              <option value="">Selecione…</option>
              {OBSERVACOES.map(o => <option key={o} value={o}>{o}</option>)}
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
        </div>

        {/* BOTÕES */}
        <div className="mt-6 flex flex-wrap gap-3 items-center">
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

          <div className="text-sm text-gray-300">
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
      </main>

      {/* utilitários inline */}
      <style>{`
        .input { width:100%; padding:0.5rem 0.75rem; border-radius:0.375rem; background:#374151; outline:none; }
        .select { width:100%; padding:0.5rem 0.75rem; border-radius:0.375rem; background:#374151; outline:none; }
        .textarea { width:100%; min-height:96px; padding:0.5rem 0.75rem; border-radius:0.375rem; background:#374151; outline:none; }
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
